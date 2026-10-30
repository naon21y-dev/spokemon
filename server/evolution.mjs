import {randomInt,randomUUID} from 'node:crypto';
import {evolutionChains,evolutionStage,enhancementChance,evolutionMaxStage,diglettForms} from '../src/data/evolutions.js';
const fail=(status,message)=>{const e=new Error(message);e.status=status;throw e};
export function ensureEnhancement(pet,level,now){
 if(pet.enhancement?.version===2)return pet.enhancement;
 const highestRoll=Math.max(0,...Object.values(pet.evolutions??{}).map(e=>Number(e?.lastRollLevel)||0));
 pet.enhancement={version:2,stage:evolutionStage(pet),lastOpportunityLevel:Math.max(Math.floor(level/10)*10,highestRoll),pending:null,queued:[],history:[],lastResult:null,migratedAt:now};return pet.enhancement;
}
export function queueEnhancements(pet,previousLevel,newLevel,now){
 const state=ensureEnhancement(pet,previousLevel,now),offers=[];if(!evolutionChains[pet.character])return offers;
 for(let boundary=(Math.floor(previousLevel/10)+1)*10;boundary<=newLevel;boundary+=10){
  if(boundary<=state.lastOpportunityLevel)continue;state.lastOpportunityLevel=boundary;if(state.stage>=evolutionMaxStage(pet.character)||pet.character==='mew'&&boundary<30)continue;
  const offer={id:randomUUID(),level:boundary,at:now};if(!state.pending)state.pending=offer;else state.queued.push(offer);offers.push(offer);
 }
 return offers;
}
function resetSelectedSkins(pet,state){if(!pet.skinByCharacter)return;for(const [character,skin] of Object.entries(pet.skinByCharacter)){if(!skin)continue;state.previousSkins??={};state.previousSkins[character]=skin;pet.skinByCharacter[character]=''}}
export function decideEnhancement(pet,offerId,accept,now,draw=()=>randomInt(100),chooseDiglett=()=>randomInt(3)){
 const state=ensureEnhancement(pet,Math.floor(pet.xp/100)+1,now);if(typeof offerId!=='string'||offerId.length>100)fail(400,'강화 기회를 확인해 주세요.');
 const prior=state.history.find(e=>e.id===offerId);if(prior){if(prior.decision!==(accept?'accept':'decline'))fail(409,'이미 선택이 완료된 강화 기회입니다.');return prior}
 if(state.pending?.id!==offerId)fail(404,'사용 가능한 강화 기회가 아닙니다.');if(state.stage>=evolutionMaxStage(pet.character))fail(400,'이미 최종 강화 단계입니다.');
 const before=state.stage,event={id:offerId,character:pet.character,level:state.pending.level,decision:accept?'accept':'decline',fromStage:before,toStage:before,chance:enhancementChance(before,pet.character),success:null,at:now};
 if(accept){
  if(pet.character==='diglett'){
   const choice=chooseDiglett();if(!Number.isInteger(choice)||choice<0||choice>=diglettForms.length)throw Error('Invalid Diglett random choice');event.success=true;event.toStage=2;event.formId=diglettForms[choice].id;state.diglettForm=event.formId;
  }else{
   const roll=draw();if(!Number.isInteger(roll)||roll<0||roll>99)throw Error('Invalid server enhancement random value');event.success=roll<event.chance;event.toStage=event.success?before+1:1;
   if(!event.success){event.diglett=true;pet.diglettRecovery={id:offerId,character:pet.character};pet.character='diglett';state.diglettForm=null}
  }
  state.stage=event.toStage;resetSelectedSkins(pet,state);state.lastResult={...event,acknowledged:false};pet.lastEvolution=event;
 }
 state.history.push(event);
 if(state.stage>=evolutionMaxStage(pet.character)){state.pending=null;state.queued=[]}else if(event.diglett){state.pending=null}else state.pending=state.queued.shift()??null;
 return event;
}
export function acknowledgeEnhancement(pet,id){const result=pet.enhancement?.lastResult;if(!result||result.id!==id)fail(404,'강화 결과를 찾을 수 없어요.');result.acknowledged=true;}

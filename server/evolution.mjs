import {randomInt,randomUUID} from 'node:crypto';
import {evolutionChains} from '../src/data/evolutions.js';
export function advanceEvolution(pet,previousLevel,newLevel,now,draw=()=>randomInt(100)){
 if(!evolutionChains[pet.character])return [];
 if(!pet.evolutions||typeof pet.evolutions!=='object'||Array.isArray(pet.evolutions))pet.evolutions={};
 let state=pet.evolutions[pet.character];
 if(!state){state={stage:1,lastRollLevel:Math.floor(previousLevel/10)*10,history:[]};pet.evolutions[pet.character]=state}
 const events=[];
 for(let boundary=(Math.floor(previousLevel/10)+1)*10;boundary<=newLevel;boundary+=10){
  if(boundary<=state.lastRollLevel)continue;state.lastRollLevel=boundary;if(state.stage>=3)continue;
  const roll=draw();if(!Number.isInteger(roll)||roll<0||roll>99)throw new Error('Invalid server evolution random value');
  const success=roll<10,event={id:randomUUID(),character:pet.character,level:boundary,fromStage:state.stage,toStage:state.stage+(success?1:0),success,at:now};
  if(!Array.isArray(state.history))state.history=[];state.history.push(event);events.push(event);
  if(success){state.stage++;pet.lastEvolution=event;if(pet.skinByCharacter?.[pet.character]){state.previousSkin=pet.skinByCharacter[pet.character];pet.skinByCharacter[pet.character]=''}}
 }
 return events;
}

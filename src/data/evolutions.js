import {findCharacter} from './characters.js';
export const evolutionChains={
 piplup:[{id:'piplup',name:'팽도리',image:'/images/characters/piplup.png'},{id:'prinplup',name:'팽태자',image:'/images/evolutions/prinplup.png'},{id:'empoleon',name:'엠페르트',image:'/images/evolutions/empoleon.png'}],
 squirtle:[{id:'squirtle',name:'꼬부기',image:'/images/characters/squirtle.png'},{id:'wartortle',name:'어니부기',image:'/images/evolutions/wartortle.png'},{id:'blastoise',name:'거북왕',image:'/images/evolutions/blastoise.png'}],
 gengar:[{id:'gengar',name:'팬텀',image:'/images/characters/gengar.png'},{id:'gengar-mega',name:'메가팬텀',image:'/images/evolutions/gengar-mega.png'},{id:'gengar-gmax',name:'거다이맥스 팬텀',image:'/images/evolutions/gengar-gmax.png'}],
 bulbasaur:[{id:'bulbasaur',name:'이상해씨',image:'/images/characters/bulbasaur.png'},{id:'ivysaur',name:'이상해풀',image:'/images/evolutions/ivysaur.png'},{id:'venusaur',name:'이상해꽃',image:'/images/evolutions/venusaur.png'}]
};
export function evolutionStage(pet){const current=pet?.enhancement?.stage;if(Number.isInteger(current)&&current>=1&&current<=3)return current;const legacy=pet?.evolutions?.[pet?.character]?.stage;return Number.isInteger(legacy)&&legacy>=1&&legacy<=3?legacy:1}
export function characterAtStage(character,stage=1){const base=findCharacter(character),chain=evolutionChains[base.id],index=Number.isInteger(stage)&&stage>=1&&stage<=3?stage-1:0,form=chain[index];return {...base,...form,id:base.id,formId:form.id,stage:index+1}}
export const evolvedCharacter=pet=>characterAtStage(pet?.character,evolutionStage(pet));

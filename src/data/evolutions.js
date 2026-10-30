import {findCharacter} from './characters.js';
export const evolutionChains={
 magikarp:[{"id": "magikarp", "name": "잉어킹", "image": "/images/characters/magikarp.png"}, {"id": "gyarados", "name": "갸라도스", "image": "/images/evolutions/gyarados.png"}, {"id": "gyarados-mega", "name": "메가 갸라도스", "image": "/images/evolutions/gyarados-mega.png"}],
 dratini:[{"id": "dratini", "name": "미뇽", "image": "/images/characters/dratini.png"}, {"id": "dragonair", "name": "신뇽", "image": "/images/evolutions/dragonair.png"}, {"id": "dragonite", "name": "망나뇽", "image": "/images/evolutions/dragonite.png"}],
 froakie:[{"id": "froakie", "name": "개구마르", "image": "/images/characters/froakie.png"}, {"id": "frogadier", "name": "개굴반장", "image": "/images/evolutions/frogadier.png"}, {"id": "greninja", "name": "개굴닌자", "image": "/images/evolutions/greninja.png"}],
 pichu:[{"id": "pichu", "name": "피츄", "image": "/images/characters/pichu.png"}, {"id": "pikachu", "name": "피카츄", "image": "/images/evolutions/pikachu.png"}, {"id": "raichu", "name": "라이츄", "image": "/images/evolutions/raichu.png"}],

 diglett:[{id:'diglett',name:'디그다',image:'/images/characters/diglett.png'}],
 mew:[{id:'mew',name:'뮤',image:'/images/characters/mew.png'},{id:'mewtwo',name:'뮤츠',image:'/images/evolutions/mewtwo.png'},{id:'mewtwo-mega-x',name:'메가뮤츠 X',image:'/images/evolutions/mewtwo-mega-x.png'}],
 piplup:[{id:'piplup',name:'팽도리',image:'/images/characters/piplup.png'},{id:'prinplup',name:'팽태자',image:'/images/evolutions/prinplup.png'},{id:'empoleon',name:'엠페르트',image:'/images/evolutions/empoleon.png'}],
 squirtle:[{id:'squirtle',name:'꼬부기',image:'/images/characters/squirtle.png'},{id:'wartortle',name:'어니부기',image:'/images/evolutions/wartortle.png'},{id:'blastoise',name:'거북왕',image:'/images/evolutions/blastoise.png'}],
 gengar:[{id:'gengar',name:'팬텀',image:'/images/characters/gengar.png'},{id:'gengar-mega',name:'메가팬텀',image:'/images/evolutions/gengar-mega.png'},{id:'gengar-gmax',name:'거다이맥스 팬텀',image:'/images/evolutions/gengar-gmax.png'}],
 bulbasaur:[{id:'bulbasaur',name:'이상해씨',image:'/images/characters/bulbasaur.png'},{id:'ivysaur',name:'이상해풀',image:'/images/evolutions/ivysaur.png'},{id:'venusaur',name:'이상해꽃',image:'/images/evolutions/venusaur.png'}]
};
export const evolutionMaxStage=character=>evolutionChains[character]?.length??3;
export const enhancementCost=character=>character==='mew'?1000:0;
export function evolutionStage(pet){const current=pet?.enhancement?.stage;if(Number.isInteger(current)&&current>=1&&current<=3)return Math.min(current,evolutionMaxStage(pet.character));const legacy=pet?.evolutions?.[pet?.character]?.stage;return Number.isInteger(legacy)&&legacy>=1&&legacy<=3?legacy:1}
export function characterAtStage(character,stage=1){const base=findCharacter(character),chain=evolutionChains[base.id],index=Number.isInteger(stage)&&stage>=1?Math.min(stage,chain.length)-1:0,form=chain[index];return {...base,...form,id:base.id,formId:form.id,stage:index+1}}
export const evolvedCharacter=pet=>characterAtStage(pet?.character,evolutionStage(pet));

// Probability is based on the current stage: 1→2, then 2→3.
export const enhancementChance = stage => stage === 1 ? 80 : stage === 2 ? 50 : 0;

export const partnerTheme = partner => ['mewtwo','mewtwo-mega-x'].includes(partner?.formId) ? 'mewtwo' : partner?.id;

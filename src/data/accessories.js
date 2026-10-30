import {accessoryAnchors,skinAccessoryAnchors} from './accessoryAnchors.js';
const headItems={'👑':.75,'🎩':1,'🧢':1.05,'👒':1.2,'🎓':1.15};
const eyeItems={'🕶️':1.05,'🥽':1.05,'🎭':1.1};
export function accessoryPlacement(character,item,skinId){
 const a=skinAccessoryAnchors[skinId]??accessoryAnchors[character]??accessoryAnchors.piplup;
 let point=a.ear,size=a.headWidth*.45,kind='ornament',offset='-50%';
 if(headItems[item]){point=a.head;size=a.headWidth*headItems[item];kind='head';offset='-88%'}
 else if(eyeItems[item]){point=a.eyes;size=a.headWidth*eyeItems[item];kind='eyes'}
 else if(item==='🎧'){point=[a.head[0],(a.eyes[1]+a.head[1])/2];size=a.headWidth*1.35;kind='headphones'}
 else if(item==='🧣'){point=[a.head[0],Math.min(90,a.eyes[1]+a.headWidth*a.ratio*.35)];size=a.headWidth*1.15;kind='scarf'}
 else if(['🎗️','🏅','🎖️'].includes(item)){point=a.chest;size=a.headWidth*.4;kind='brooch'}
 else if(item==='💎'){point=a.chest;size=a.headWidth*.36;kind='brooch'}
 else if(['🔥','❄️','💫','🫧'].includes(item)){point=a.aura;size=24;kind='aura'}
 return {kind,rotation:kind==='eyes'?({piplup:-10,gengar:-15,bulbasaur:-3}[character]??0):0,ratio:a.ratio,x:point[0],y:point[1],size,offset};
}

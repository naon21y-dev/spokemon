export const petCareActions={food:{price:10,xp:15,field:'hunger'},play:{price:5,xp:10,field:'happy'},train:{price:30,xp:50,field:null}};
export const PET_LOW=40,AWAY_HOURS=12;
export function petCondition(pet,now=Date.now()){
 const last=Number(pet.last),hours=Number.isFinite(last)?Math.max(0,(now-last)/3600000):0;
 return {...pet,hunger:Math.max(0,Math.min(100,Number(pet.hunger??70)-hours*3)),happy:Math.max(0,Math.min(100,Number(pet.happy??70)-hours*2)),longAbsence:!!pet.longAbsence||hours>=AWAY_HOURS};
}
export function petMood(condition){const messages=[];if(condition.hunger<=PET_LOW)messages.push('배고파요');if(condition.happy<=PET_LOW)messages.push('우울해요');if(condition.longAbsence&&!messages.length)messages.push('오랜만이에요… 보고 싶었어요');return {rainy:messages.length>0,messages}}

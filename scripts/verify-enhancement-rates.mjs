import assert from 'node:assert/strict';
import {queueEnhancements,decideEnhancement} from '../server/evolution.mjs';
import {enhancementChance,evolutionChains,evolutionMaxStage} from '../src/data/evolutions.js';
for(const character of Object.keys(evolutionChains))for(const [stage,rate] of [[1,80],[2,50]]){
 if(character==='diglett'||stage>=evolutionMaxStage(character))continue;
 let successes=0;
 for(let roll=0;roll<100;roll++){
  const pet={character,xp:2895,enhancement:{version:2,stage,lastOpportunityLevel:20,pending:null,queued:[],history:[],lastResult:null}};
  queueEnhancements(pet,29,30,1000);const id=pet.enhancement.pending.id;
  const event=decideEnhancement(pet,id,true,2000,()=>roll);
  assert.equal(event.chance,rate);assert.equal(event.success,roll<rate);assert.equal(event.toStage,roll<rate?stage+1:1);
  successes+=Number(event.success);
  assert.deepEqual(decideEnhancement(pet,id,true,2001,()=>{throw Error('Duplicate must not reroll')}),event);
 }
 assert.equal(successes,rate);assert.equal(enhancementChance(stage),rate);
}
assert.equal(enhancementChance(3),0);
console.log('PASS: all Pokemon, exact 80/100 stage-2 and 50/100 stage-3 outcomes; boundary rolls; failure resets; duplicate decisions preserved.');

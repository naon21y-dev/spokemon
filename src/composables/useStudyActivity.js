import {onMounted,onUnmounted,watch,ref} from 'vue'
import {api} from '../lib/api'
export function useStudyActivity(getContext){
 const tabId=crypto.randomUUID(),owner=ref(false);let sequence=0,lastInput=Date.now(),timer,stopped=false,oldContext=null
 async function beat(visible=document.visibilityState==='visible',context=getContext()){
  if(!context)return
  const payload={tabId,seq:++sequence,visible,context,activityAgeMs:Math.max(0,Date.now()-lastInput)}
  try{const result=await api('/study/heartbeat',{method:'POST',body:payload,keepalive:!visible});if(!stopped)owner.value=result.owner}catch{owner.value=false}
 }
 function activity(event){if(!event.isTrusted)return;const wasIdle=Date.now()-lastInput>=300000;lastInput=Date.now();if(wasIdle)beat()}
 function visibility(){beat(document.visibilityState==='visible')}
 const events=['pointerdown','keydown','scroll','wheel','touchstart']
 const unwatch=watch(()=>JSON.stringify(getContext()),(_,previous)=>{if(previous&&previous!=='null'&&previous!=='undefined')beat(false,JSON.parse(previous));oldContext=getContext();if(oldContext){lastInput=Date.now();beat()}},{flush:'post'})
 onMounted(()=>{oldContext=getContext();lastInput=Date.now();for(const event of events)window.addEventListener(event,activity,{passive:true,capture:true});document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',stopPage);timer=setInterval(()=>beat(),10000);beat()})
 function stopPage(){beat(false,oldContext??getContext())}
 onUnmounted(()=>{stopped=true;unwatch();clearInterval(timer);for(const event of events)window.removeEventListener(event,activity,true);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',stopPage);stopPage()})
 return {owner}
}

import {defineStore} from 'pinia';
import {ref} from 'vue';
import {api} from '../lib/api';
import {useArcade} from './arcade';
export const useActivity=defineStore('activity',()=>{
 const queue=ref([]),busy=ref(false),error=ref('');let generation=0,latest=0,seen=new Set();
 async function refresh(){
  const s=useArcade(),user=s.user?.id;if(s.user?.role!=='student'||document.visibilityState!=='visible')return;
  const current=generation,sequence=++latest;
  try{const data=await api('/activity/notifications');if(current!==generation||sequence!==latest||s.user?.id!==user||document.visibilityState!=='visible')return;
   const key='spokemon-activity-alerts:'+user;
   const claim=()=>{if(current!==generation||sequence!==latest||s.user?.id!==user)return;let stored=[];try{stored=JSON.parse(localStorage.getItem(key)??'[]');if(!Array.isArray(stored))stored=[]}catch{}
    const known=new Set([...stored,...seen]);const fresh=data.events.filter(e=>!known.has(e.id));for(const e of fresh){known.add(e.id);seen.add(e.id)}queue.value.push(...fresh);try{localStorage.setItem(key,JSON.stringify([...known].slice(-5000)))}catch{}
   };
   if(navigator.locks?.request)await navigator.locks.request(key,claim);else claim();
   if(data.balance!==s.data.coins)s.refresh().catch(()=>{});
  }catch{/* Notifications must not interrupt a game. */}
 }
 async function dismiss(accept=false){
  if(busy.value||!queue.value.length)return;const event=queue.value[0],s=useArcade(),user=s.user?.id,current=generation;busy.value=true;error.value='';
  try{if(accept&&event.kind==='friend-request'){await api('/friends',{method:'POST',body:{studentId:event.senderId}});window.dispatchEvent(new Event('spokemon-friends-refresh'))}await api('/activity/notifications/read',{method:'POST',body:{ids:[event.id]}});if(current===generation&&s.user?.id===user)queue.value.shift()}
  catch(e){if(current===generation)error.value=e.message}finally{if(current===generation)busy.value=false}
 }
 function reset(){generation++;latest++;queue.value=[];seen=new Set();busy.value=false;error.value=''}
 return {queue,busy,error,refresh,dismiss,reset};
});

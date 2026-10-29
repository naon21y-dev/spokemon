import {defineStore} from 'pinia'
import {ref} from 'vue'
import {api} from '../lib/api'
import {useArcade} from './arcade'
export const useQuests=defineStore('quests',()=>{
 const ready=ref(0);let generation=0,latest=0
 function accept(book){latest++;ready.value=Math.max(0,Number(book.ready)||0)}
 function reset(){generation++;latest++;ready.value=0}
 async function refresh(){
  const s=useArcade(),user=s.user?.id;if(s.user?.role!=='student')return
  const current=generation,sequence=++latest
  try{const book=await api('/quests');if(current===generation&&sequence===latest&&s.user?.id===user)ready.value=Math.max(0,Number(book.ready)||0)}catch{/* Keep the last confirmed indicator when temporarily offline. */}
 }
 return {ready,accept,refresh,reset}
})

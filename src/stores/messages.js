import {defineStore} from 'pinia'
import {ref} from 'vue'
import {api} from '../lib/api'
export const useMessages=defineStore('messages',()=>{
 const unread=ref(0),pending=ref(0);let generation=0,latest=0
 async function refresh(){const current=generation,sequence=++latest;try{const result=await api('/messages/summary');if(current===generation&&sequence===latest){unread.value=result.unread;pending.value=result.pending}}catch{/* A badge failure must not interrupt gameplay. */}}
 function reset(){generation++;unread.value=0;pending.value=0}
 return {unread,pending,refresh,reset}
})

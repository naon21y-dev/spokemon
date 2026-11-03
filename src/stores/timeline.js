import {defineStore} from 'pinia'
import {ref} from 'vue'
import {api} from '../lib/api'

export const useTimeline = defineStore('timeline',()=>{
  const unread=ref(0)
  let sequence=0
  function reset(){sequence++;unread.value=0}
  async function refresh(){
    const request=++sequence
    try{
      const data=await api('/timeline',{background:true})
      if(request===sequence)unread.value=data.unread
    }catch{}
  }
  return {unread,reset,refresh}
})

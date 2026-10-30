import {defineStore} from 'pinia'
import {ref,computed} from 'vue'
import {api} from '../lib/api'
import {useArcade} from './arcade'
import {defaultRoom,roomItemMap} from '../data/roomItems'
const clone=x=>JSON.parse(JSON.stringify(x))
export const useRoom=defineStore('room',()=>{
 const design=ref(defaultRoom()),inventory=ref([]),version=ref(0),editing=ref(false),selected=ref(''),busy=ref(false),error=ref(''),notice=ref(''),loaded=ref(false)
 let saved=defaultRoom(),generation=0,purchase=null
 const selectedPlacement=computed(()=>design.value.placements.find(p=>p.copyId===selected.value)),selectedItem=computed(()=>roomItemMap[inventory.value.find(i=>i.id===selected.value)?.item_id]),dirty=computed(()=>JSON.stringify(saved)!==JSON.stringify(design.value))
 function accept(value,keepDraft=false){inventory.value=value.inventory;if(!keepDraft){version.value=value.version;design.value=clone(value.design);saved=clone(value.design)}loaded.value=true}
 function reset(){generation++;design.value=defaultRoom();saved=defaultRoom();inventory.value=[];version.value=0;editing.value=false;selected.value='';busy.value=false;error.value='';notice.value='';loaded.value=false;purchase=null}
 async function load(){const g=generation,user=useArcade().user?.id;try{const value=await api('/room');if(g!==generation||user!==useArcade().user?.id)return;accept(value);error.value=''}catch(e){if(g===generation)error.value=e.message}}
 async function buy(itemId,quantity=1){if(busy.value)return;busy.value=true;error.value='';notice.value='';const g=generation;if(!purchase||purchase.itemId!==itemId||purchase.quantity!==quantity)purchase={itemId,quantity,requestKey:crypto.randomUUID()};try{const value=await api('/room/buy',{method:'POST',body:purchase});if(g!==generation)return;purchase=null;accept(value,editing.value&&dirty.value);await useArcade().refresh();notice.value='구매 완료! 내 아이템에서 선택해 배치하세요.'}catch(e){if(g===generation)error.value=e.message}finally{if(g===generation)busy.value=false}}
 function choose(itemId){const copies=inventory.value.filter(i=>i.item_id===itemId),copy=copies.find(i=>!design.value.placements.some(p=>p.copyId===i.id))??copies[0];if(!copy)return;selected.value=copy.id;editing.value=true;notice.value='방의 원하는 곳을 클릭해 배치하세요. 크기는 아래에서 조절해요.'}
 function place(x,y){if(!editing.value||!selected.value||!inventory.value.some(i=>i.id===selected.value))return;const existing=selectedPlacement.value;if(existing){existing.x=x;existing.y=y}else design.value.placements.push({copyId:selected.value,x,y,size:14,rotation:0,front:false})}
 function remove(){design.value.placements=design.value.placements.filter(p=>p.copyId!==selected.value);selected.value='';notice.value='내 아이템으로 돌려놓았어요. 저장하면 반영됩니다.'}
 function cancel(){design.value=clone(saved);editing.value=false;selected.value='';error.value='';notice.value='편집을 취소했어요.'}
 async function save(){if(busy.value)return;busy.value=true;error.value='';const g=generation;try{const value=await api('/room',{method:'PUT',body:{version:version.value,design:design.value}});if(g!==generation)return;accept(value);editing.value=false;selected.value='';notice.value='방을 저장했어요!'}catch(e){if(g===generation)error.value=e.message}finally{if(g===generation)busy.value=false}}
 return {design,inventory,version,editing,selected,busy,error,notice,loaded,dirty,selectedPlacement,selectedItem,load,reset,buy,choose,place,remove,cancel,save}
})

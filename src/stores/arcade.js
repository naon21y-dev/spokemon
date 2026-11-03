import {defineStore} from 'pinia'
import {ref,computed,watch} from 'vue'
import {activeSkin} from '../data/skins'
import {evolvedCharacter} from '../data/evolutions'
import {api} from '../lib/api'
const defaults=()=>({coins:0,tickets:[],pet:{character:'piplup',hunger:70,happy:70,xp:0,wear:'',owned:[],last:Date.now()},records:[],card:null,metro:null})
export const useArcade=defineStore('arcade',()=>{
 const data=ref(defaults()),user=ref(null),storageError=ref(''),partnerWaiting=ref(false),ready=ref(false);let initPromise,gameTimer
 function apply(value){const gained=user.value?.id===value.user?.id&&value.data.coins>data.value.coins;user.value=value.user;data.value={...defaults(),...value.data};storageError.value='';if(gained)window.dispatchEvent(new Event('spokemon-points-refresh'))}
 async function refresh(options){apply(await api('/me',options))}
 function init(){if(!initPromise)initPromise=api('/me').then(result=>{apply(result);partnerWaiting.value=result.partnerWaiting===true}).catch(e=>{if(e.status!==401)storageError.value=e.message}).finally(()=>ready.value=true);return initPromise}
 function legacyAccount(login){try{return JSON.parse(localStorage.getItem('pocket-accounts-v1'))?.accounts.find(a=>a.login===login.trim().toLowerCase())}catch{return null}}
 async function legacyMatches(account,password){if(!account)return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(account.salt),iterations:150000,hash:'SHA-256'},key,256);return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')===account.digest}
 async function requestMigration(account){if(account&&!data.value.legacyMigration){try{apply(await api('/migration',{method:'POST',body:{legacyId:account.id,progress:account.progress}}))}catch(e){storageError.value='기존 기록은 브라우저에 보존되어 있습니다. 이전 요청: '+e.message}}}
 async function login(login,password){const old=legacyAccount(login);try{const result=await api('/auth/login',{method:'POST',body:{login,password}});apply(result);partnerWaiting.value=result.partnerWaiting===true}catch(e){if(e.status!==401||!await legacyMatches(old,password))throw e;apply(await api('/auth/register',{method:'POST',body:{login,password,nickname:old.nickname}}))}await requestMigration(old);window.dispatchEvent(new CustomEvent('spokemon-login-success',{detail:{userId:user.value.id}}))}
 async function register(login,password,nickname){apply(await api('/auth/register',{method:'POST',body:{login,password,nickname}}));const old=legacyAccount(login);if(await legacyMatches(old,password))await requestMigration(old)}
 function clearSession(){partnerWaiting.value=false;clearTimeout(gameTimer);user.value=null;data.value=defaults();storageError.value=''}
 async function logout(){await api('/auth/logout',{method:'POST'});clearSession()}
 async function rename(nickname){apply(await api('/profile',{method:'PATCH',body:{nickname}}))}
 async function selectCharacter(character,options={}){try{apply(await api('/profile',{method:'PATCH',body:{character,...options}}))}catch(e){storageError.value=e.message;throw e}}
 async function petAction(action,item,requestKey,ticketId){apply(await api('/pet',{method:'POST',body:{action,item,requestKey,ticketId}}))}
 async function age(){if(user.value?.role==='student')try{await petAction('age')}catch(e){storageError.value=e.message}}
 const skin=computed(()=>activeSkin(data.value.pet)),partner=computed(()=>evolvedCharacter(data.value.pet)),petName=computed(()=>data.value.pet.nickname||partner.value.name),level=computed(()=>Math.floor(data.value.pet.xp/100)+1)
 watch(()=>[data.value.card,data.value.metro],()=>{clearTimeout(gameTimer);if(user.value?.role!=='student')return;gameTimer=setTimeout(()=>api('/games',{method:'PUT',body:{card:data.value.card,metro:data.value.metro}}).catch(e=>storageError.value=e.message),600)},{deep:true})
 return {data,user,partnerWaiting,ready,storageError,partner,petName,skin,level,init,refresh,login,register,logout,clearSession,rename,selectCharacter,petAction,age}
})
export function shuffle(input){const a=[...input];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

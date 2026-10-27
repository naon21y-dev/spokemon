import {beginPageRequest} from './pageNetwork'
export async function api(path,options={}){
 const request=beginPageRequest(path);try{
 const response=await fetch('/api'+path,{credentials:'same-origin',...options,signal:options.signal??AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','X-Spokemon-Request':'1',...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)})
 const data=await response.json().catch(()=>({error:'서버 응답을 확인해 주세요.'}))
 if(!response.ok){const error=new Error(data.error??'요청에 실패했어요.');error.status=response.status;throw error}return data
 }catch(error){request.fail(error);throw error}finally{request.done()}
}
export const formatTime=seconds=>{const minutes=Math.floor((seconds??0)/60);return `${Math.floor(minutes/60)}시간 ${minutes%60}분 ${Math.floor((seconds??0)%60)}초`}

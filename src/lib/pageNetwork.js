import {reactive} from 'vue'
export const pageNetwork=reactive({pending:0,failure:''})
export function clearPageFailure(){pageNetwork.failure=''}
export function beginPageRequest(path){const tracked=/^\/(me|learning|catalog|summary|admin\/dashboard|admin\/students\/[^/]+|workshop(?:\/[^/]+(?:\/edit)?)?|quiz\/start|review\/start)(?:\?|$)/.test(path);if(tracked)pageNetwork.pending++;return {tracked,done(){if(tracked)pageNetwork.pending=Math.max(0,pageNetwork.pending-1)},fail(error){if(tracked&&(!error.status||error.status>=500))pageNetwork.failure=error.name==='TimeoutError'||error.name==='AbortError'?'응답이 늦어지고 있어요. 잠시 후 다시 시도하세요.':'서버와 연결하지 못했어요. 연결 상태를 확인해 주세요.'}}}

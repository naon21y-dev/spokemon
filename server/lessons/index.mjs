import {readFileSync} from 'node:fs';
import {unitOf} from '../service.mjs';
const bank=Object.fromEntries(['vue','intellij','sql','javascript','python','deeplearning','git'].map(id=>[id,JSON.parse(readFileSync(new URL('./'+id+'.json',import.meta.url),'utf8'))]));
const numpy=JSON.parse(readFileSync(new URL('./numpy.json',import.meta.url),'utf8'));
export function lessonGuide(subject,unit,questions,title){
 if(/numpy|넘파이|ndarray/i.test(title+' '+questions.map(q=>q.prompt).join(' ')))return structuredClone(numpy);
 // Match original content too: moving a subject must not replace its teaching material.
 const matches=new Map();for(const q of questions){const origin=q.originalId??q.id;const name=Object.keys(bank).find(id=>origin.startsWith(id+'-'));if(name){const number=unitOf({...q,id:origin,unit:undefined});const key=name+':'+number;matches.set(key,(matches.get(key)??0)+1)}}
 const key=[...matches].sort((a,b)=>b[1]-a[1])[0]?.[0];const [origin,number]=key?.split(':')??[];const authored=key?bank[origin]?.[Number(number)-1]:bank[subject]?.[unit-1];
 if(authored)return structuredClone(authored);
 const selected=questions.slice(0,4);return {title,minutes:15,goals:['개념을 자신의 말로 설명하기','사례를 비교하고 근거 찾기','조건을 바꿔 결과 예상하기'],concepts:selected.map(q=>({title:q.prompt,body:q.explanation})),example:{code:selected.map((q,i)=>`${i+1}. ${q.prompt}\n개념: ${q.explanation}`).join('\n\n'),explanation:'현재 단원에 등록된 공식 문제의 개념을 비교하세요. 각 개념이 적용되는 조건과 적용되지 않는 조건을 구분해 노트에 기록합니다.'},practice:{task:'위 개념에서 하나를 골라 직접 입력·조건을 바꾼 예제를 작성하고 예상 결과와 실제 결과를 비교하세요.',steps:['개념의 적용 조건을 두 가지 적기','정상 사례와 오류 사례를 하나씩 만들기','오류를 수정한 이유를 설명하기'],solution:selected.map(q=>q.explanation).join('\n')},checks:selected.slice(0,2).map((q,i)=>({id:'check-'+(i+1),prompt:q.prompt,options:[q.explanation,'조건과 입력을 확인하지 않아도 언제나 같은 결과다.','실행 결과와 원리를 확인할 필요가 없다.'],answer:0,explanation:q.explanation}))};
}
export const guidePublic=guide=>({...guide,checks:guide.checks.map(({answer,explanation,...q})=>q)});
export function gradeGuide(guide,answers){return guide.checks.map(q=>({id:q.id,correct:answers?.[q.id]===q.answer,answer:q.answer,explanation:q.explanation}))}
export {bank as lessonBank};

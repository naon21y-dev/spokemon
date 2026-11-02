import {createHash,randomInt,randomUUID} from 'node:crypto';
const sum=a=>a.reduce((s,n)=>s+n,0),sequence=(n)=>Array.from({length:n},(_,i)=>i+1),names=['runes','coins','sparks','leaves','gems','steps','stars'];
export function makeQuestion(level,index,seed=randomInt(1,2000000000)){
 const a=2+seed%83,b=2+Math.floor(seed/83)%9,c=1+Math.floor(seed/747)%9,v=names[Math.floor(seed/6723)%names.length]+'_'+seed.toString(36),factor=2+seed%17,limit=a+b,word=['별빛','이끼','수정','바람','불씨','물방울'][seed%6]+(1+Math.floor(seed/6)%99999),q={id:randomUUID(),level,index,seed,type:'output',prompt:'',code:'',answer:'',hint:'',explanation:'',reference:'',entry:null,tests:[]};
 const set=(type,prompt,code,answer,hint,explanation)=>Object.assign(q,{type,prompt,code,answer:String(answer),hint,explanation});
 const coding=(type,prompt,code,entry,reference,tests,hint,explanation)=>Object.assign(q,{type,prompt,code,entry,reference,tests,hint,explanation});
 if(level===1){
  if(index===0)set('multiple',`보급품 ${a}개를 ${b}개 더 받았어요. 출력은?`,`${v} = ${a}\nprint(${v} + ${b})`,a+b,'+는 숫자 덧셈이에요.','정수를 더한 결과가 print()로 출력됩니다.');
  if(index===1)set('blank',`정수 ${a*b}를 저장했어요. 이 변수의 자료형 이름을 영어로 쓰세요.`,`${v} = ${a*b}`, 'int','소수점 없는 수는 정수예요.','정수 자료형은 int, 소수는 float, 문자열은 str입니다.');
  if(index===2)coding('fix',`인사말 “${word}의 마을”을 한 줄 출력하도록 문법 오류를 고치세요.`,`print("${word}의 마을"`,null,`print("${word}의 마을")`,[{stdout:`${word}의 마을`}],'문자열 따옴표와 함수 괄호의 짝을 확인하세요.','print()의 문자열과 닫는 괄호를 맞추면 정상 출력됩니다.');
  if(index===3)coding('code',`energy(${v}) 함수를 작성하세요. ${v}에 ${b}를 곱하고 ${a}를 더한 값을 반환합니다.`,`def energy(${v}):\n    # 계산한 값을 반환하세요\n    pass`,'energy',`def energy(${v}):\n    return ${v} * ${b} + ${a}`, [0,1,3,7,11].map(x=>({args:[x],expected:x*b+a})),'곱셈은 *, 반환은 return을 사용해요.','매개변수는 호출마다 달라집니다. 계산 결과를 return으로 돌려주세요.');
 }
 if(level===2){
  if(index===0)set('multiple',`체력은 ${a}, 입장 기준은 ${b*5}, 열쇠 보유는 ${seed%2?'True':'False'}예요. 문이 열릴까요?`,`${v} = ${a}\nhas_key = ${seed%2?'True':'False'}\nprint(${v} >= ${b*5} and has_key)`,a>=b*5&&seed%2?'True':'False','and는 두 조건이 모두 참이어야 해요.','비교 결과와 열쇠 보유가 모두 True일 때만 전체가 True입니다.');
  if(index===1){const score=seed%3===0?limit+c:seed%3===1?a+c:a-c;set('output',`표지판이 가리키는 목적지를 쓰세요. (따옴표 제외)`,`${v} = ${score}\nif ${v} >= ${limit}:\n    print("성")\nelif ${v} >= ${a}:\n    print("숲")\nelse:\n    print("마을")`,score>=limit?'성':score>=a?'숲':'마을','위에서부터 처음 참인 조건 한 개만 실행돼요.','if → elif → else 순서로 검사하며 선택된 분기만 출력합니다.');}
  if(index===2)coding('fix',`${v}가 ${limit} 이상이면 True를 반환하도록 문법 오류를 고치세요.`,`def can_enter(${v}):\n    if ${v} >= ${limit}\n        return True\n    return False`,'can_enter',`def can_enter(${v}):\n    if ${v} >= ${limit}:\n        return True\n    return False`,[0,limit-1,limit,limit+1,limit+12].map(x=>({args:[x],expected:x>=limit})),'if 조건 끝에는 콜론이 필요해요.','조건문 헤더 뒤에 :를 넣고 분기 본문을 들여씁니다.');
  if(index===3)coding('code',`gate(${v}, key): ${v}가 ${limit} 이상이고 key가 True이면 "통과", 아니면 "대기"를 반환하세요.`,`def gate(${v}, key):\n    pass`,'gate',`def gate(${v}, key):\n    if ${v} >= ${limit} and key:\n        return "통과"\n    return "대기"`,[[limit,true],[limit-1,true],[limit+3,false],[0,false],[limit+9,true]].map(args=>({args,expected:args[0]>=limit&&args[1]?'통과':'대기'})),'비교와 and를 결합하고 두 경로 모두 값을 반환하세요.','경계값(기준과 같은 점수)과 열쇠가 없는 경우도 처리해야 합니다.');
 }
 if(level===3){
  if(index===0){const start=c,end=c+b*2,step=1+seed%3;let total=0;for(let n=start;n<end;n+=step)total+=n;set('multiple','수정의 힘을 모두 더하면 얼마일까요?',`total = 0\nfor ${v} in range(${start}, ${end}, ${step}):\n    total += ${v}\nprint(total)`,total,'range의 끝값은 포함하지 않아요.','시작부터 끝 미만까지 간격만큼 이동한 수를 누적합니다.');}
  if(index===1)set('blank',`${c+b}에 도달하면 반복을 즉시 끝내야 해요. 빈칸의 키워드를 쓰세요.`,`for ${v} in range(${c}, ${c+b+7}):\n    if ${v} == ${c+b}:\n        ___\n    print(${v})`,'break','반복 전체에서 빠져나오는 명령이에요.','break는 가장 가까운 반복문을 종료하고 continue는 다음 반복으로 넘어갑니다.');
  if(index===2)coding('fix',`${v}부터 ${c+1}까지 한 줄씩 출력하고 종료되도록 고치세요. (${v}는 ${c+1} 이상)`,`def countdown(${v}):\n    while ${v} > ${c}:\n        print(${v})\n        # 종료하려면 ${v}를 어떻게 바꿔야 할까요?`,'countdown',`def countdown(${v}):\n    while ${v} > ${c}:\n        print(${v})\n        ${v} -= 1`,[1,c,c+3].map(n=>({args:[c+n],stdout:sequence(n).map(x=>x+c).reverse().join('\n')})),'반복할 때마다 n을 줄여 종료 조건에 가까워지게 하세요.','while의 조건에 영향을 주는 값을 갱신해야 무한 반복을 막습니다.');
  if(index===3)coding('code',`collect(${v}): 1부터 ${v}까지 중 ${b}의 배수는 건너뛰고 나머지 수 각각에 ${factor}를 곱한 합을 반환하세요.`,`def collect(${v}):\n    pass`,'collect',`def collect(${v}):\n    total = 0\n    for n in range(1, ${v} + 1):\n        if n % ${b} == 0:\n            continue\n        total += n * ${factor}\n    return total`,[0,1,b,b+3,b*3+c].map(n=>({args:[n],expected:sum(sequence(n).filter(x=>x%b!==0))*factor})),'나머지 연산 %와 continue를 활용해 보세요.','range의 끝에 1을 더해 limit를 포함하고 제외 조건을 먼저 처리합니다.');
 }
 if(level===4){
  if(index===0){const arr=[a,a+b,a+b+c,a*2],i=seed%4;set('output',`${v} 목록에서 선택된 값을 쓰세요.`,`${v} = ${JSON.stringify(arr)}\nprint(${v}[${i}])`,arr[i],'리스트 인덱스는 0부터 시작해요.','첫 번째 원소가 인덱스 0이므로 해당 위치를 순서대로 찾습니다.');}
  if(index===1)set('blank',`호출한 곳으로 value + ${seed}를 돌려주는 키워드를 쓰세요.`,`def boost(value):\n    ___ value + ${seed}\n\nprint(boost(${b}))`,'return','print는 보여 주고, 이 키워드는 값을 돌려줘요.','return은 함수를 끝내고 계산한 값을 호출 위치로 전달합니다.');
  if(index===2)coding('fix',`pack(items)가 각 단어를 대문자로 바꾼 뒤 "${word}"를 붙인 리스트를 반환하도록 메서드를 고치세요.`,`def pack(items):\n    result = []\n    for item in items:\n        result.add(item.upper() + "${word}")\n    return result`,'pack',`def pack(items):\n    result = []\n    for item in items:\n        result.append(item.upper() + "${word}")\n    return result`,[[],[word,'rune'],['key'+a,'map'+b]].map(args=>({args:[args],expected:args.map(x=>x.toUpperCase()+word)})),'리스트에 원소 한 개를 붙이는 메서드는 append예요.','리스트는 append(), 집합은 add()를 사용합니다. 문자열 upper()는 새 대문자 문자열을 돌려줍니다.');
  if(index===3)coding('code',`total(${v}, bonus): ${v} 리스트의 합계에 bonus × ${factor}를 더해 반환하세요.`,`def total(${v}, bonus):\n    pass`,'total',`def total(${v}, bonus):\n    return sum(${v}) + bonus * ${factor}`,[{args:[[],0],expected:0},{args:[[a,b,c],c],expected:a+b+c+c*factor},{args:[[1,2,3],a],expected:6+a*factor},{args:[[-2,8],b],expected:6+b*factor}],'sum 또는 for로 합계를 구하고 두 번째 매개변수도 사용하세요.','함수는 매개변수로 여러 값을 받아 계산 결과 하나를 반환할 수 있습니다.');
 }
 if(level===5){
  if(index===0){const arr=[c,b,c+b],factor=1+seed%5;set('multiple','보스의 첫 주문! 최종 출력 숫자는?',`def spell(${v}):\n    return sum(${v}) * ${factor}\n\nprint(spell(${JSON.stringify(arr)}))`,sum(arr)*factor,'함수 인수로 전달된 리스트의 합부터 구하세요.','함수 호출 → 리스트 합계 → 곱셈 → print 순서로 실행됩니다.');}
  if(index===1)coding('fix',`shield(${v})가 모든 방어력의 합에 기본 방어력 ${a}를 더해 반환하도록 고치세요.`,`def shield(${v}):\n    total = ${a}\n    for value in ${v}:\n        total = value\n    return total`,'shield',`def shield(${v}):\n    total = ${a}\n    for value in ${v}:\n        total += value\n    return total`,[[],[a,b,c],[a,-b,c],[b,b,b,b]].map(arr=>({args:[arr],expected:sum(arr)+a})),'대입과 누적 대입은 달라요. 이전 합계를 보존하세요.','total = value는 매번 덮어쓰고 total += value는 기존 값에 더합니다.');
  if(index===2){const n=c+b,divisor=2+seed%4,arr=sequence(n).filter(x=>x%divisor===0);set('output','보스의 세 번째 주문! 출력될 합계를 쓰세요.',`power = 0\nfor ${v} in range(1, ${n+1}):\n    if ${v} % ${divisor} == 0:\n        power += ${v}\nprint(power)`,sum(arr),'반복 범위에서 나머지가 0인 수만 골라 더하세요.','조건을 만족하는 배수만 누적하며 반복 종료 뒤 한 번 출력합니다.');}
  if(index===3)coding('code',`victory(${v}, threshold): ${v}에서 threshold 이상인 원소만 골라 각각 ${factor}배한 리스트를 순서대로 반환하세요.`,`def victory(${v}, threshold):\n    pass`,'victory',`def victory(${v}, threshold):\n    result = []\n    for value in ${v}:\n        if value >= threshold:\n            result.append(value * ${factor})\n    return result`,[[[],0],[[a,b,c],b],[[0,-1,3,8],0],[[a-1,a,a+1],a],[[5,5,1],5]].map(args=>({args,expected:args[0].filter(x=>x>=args[1]).map(x=>x*factor)})),'빈 리스트를 만들고 조건을 만족하는 값만 append하세요.','반복·조건·함수·리스트를 함께 사용하면 필요한 값만 변환할 수 있습니다.');
 }
 if(q.type==='multiple'){
  const correct=q.answer,variants=correct==='True'||correct==='False'?['True','False','None','오류']:Number.isFinite(Number(correct))?[correct,String(Number(correct)+b),String(Number(correct)-c),String(Number(correct)+a+1)]:[correct,'None','True','오류'];
  const labels=[...new Set(variants)];let filler=a*b;while(labels.length<4){filler++;if(!labels.includes(String(filler)))labels.push(String(filler))}
  q.options=labels.map(label=>({id:randomUUID(),label}));for(let i=3;i>0;i--){const j=randomInt(i+1);[q.options[i],q.options[j]]=[q.options[j],q.options[i]]}q.correctOptionId=q.options.find(x=>x.label===correct).id;
 }
 if(!q.tests.length){
  if(q.type!=='blank')q.validation={code:q.code,tests:[{stdout:q.answer}]};
  else if(level===1)q.validation={code:q.code+'\nprint(isinstance('+v+', int))',tests:[{stdout:'True'}]};
  else if(level===3)q.validation={code:q.code.replace('___',q.answer),tests:[{stdout:Array.from({length:b},(_,i)=>c+i).join('\n')}]};
  else if(level===4)q.validation={code:q.code.replace('___',q.answer),tests:[{stdout:String(b+seed)}]};
 }
 q.hash=createHash('sha256').update(JSON.stringify({level,index,type:q.type,prompt:q.prompt.replace(/\s+/g,' ').trim(),code:q.code.replace(/\r/g,'').trim(),options:q.options?.map(x=>x.label).sort()})).digest('hex');
 if(!q.prompt||!q.hint||!q.explanation||(['fix','code'].includes(q.type)&&!q.tests.length))throw Error('Invalid question template');
 return q;
}
export const publicQuestion=q=>({id:q.id,type:q.type,prompt:q.prompt,code:q.code,options:q.options??null});

<script setup>
import {ref,computed} from 'vue'
const selected=ref('start')
const chapters=[
 {id:'start',icon:'✦',title:'처음 오셨나요?',subtitle:'배우고, 풀고, 함께 성장해요',intro:'Spokemon은 코딩을 배우고 퀴즈와 게임으로 쉬어 가며 나만의 포켓몬을 키우는 학습 공간이에요.',steps:[
  ['내 학습에서 시작','공개된 과목과 단원을 확인하고 학습하기를 눌러 보세요. 아직 잠긴 단원은 관리자에게 기수 배정과 진도 공개를 문의해 주세요.'],
  ['퀴즈로 확인하고 복습','문제풀기에서 과목과 문제 유형을 골라 풀어 보세요. 틀린 문제는 마이 리틀 펫의 틀린 문제!에서 다시 확인할 수 있어요.'],
  ['포인트로 파트너 돌보기','획득한 포인트로 먹이·놀이·훈련을 이용하거나 아이템과 새 파트너를 만나 보세요. 보유 포인트는 화면 위에서 확인해요.']],links:[['/student','내 학습 시작하기'],['/quiz','퀴즈 풀어보기']]},
 {id:'learn',icon:'▤',title:'학습·퀴즈',subtitle:'나에게 공개된 진도로 차근차근',intro:'내 학습에서 공부시간과 공개 진도, 학습 실적을 확인해요. 공식 학습 진도와 학생 제작 문제 실적은 구분해서 표시돼요.',steps:[
  ['학습하기','개념과 예제, 실습을 읽고 이해 확인을 진행해요. 공개 진도율은 공개된 공식 학습 항목 중 완료한 항목의 비율이에요.'],
  ['문제풀기(퀴즈타임)','과목을 선택한 다음 전체·객관식·주관식 유형을 골라요. 답안을 제출하면 채점과 해설을 확인할 수 있고, 정답이면 다음 문제로 자동 이동해요.'],
  ['틀린 문제!와 메모','오답노트에서 내가 쓴 답과 해설을 보고 다시 풀어 보세요. 오늘 배운 내용 정리하기에는 나만의 학습 메모를 남길 수 있어요.']],links:[['/student','내 학습'],['/pet/mistakes','오답 복습하기']]},
 {id:'points',icon:'🪙',title:'포인트·선물',subtitle:'받을 보상을 챙겨 보세요',intro:'코인과 포인트(P)는 같은 잔액이에요. 획득한 포인트와 사용 내역은 내 학습의 포인트 내역에서 확인할 수 있어요.',steps:[
  ['퀴즈와 게임 보상','공식 퀴즈는 문제별 최초 정답에 보상이 지급돼요. 학생 제작 문제는 본인 문제를 제외하고 보상 규칙과 일일 한도가 적용돼요. 게임별 보상은 각 게임의 안내를 확인해 주세요.'],
  ['퀘스트·출석','화면 위 퀘스트에서 목표와 진행 상황을 확인하고 완료 보상을 수령해요. 여러 보상은 일괄 수령할 수 있어요. 학생 출석은 연속 출석으로 이어지며 하루를 건너뛰면 다시 1일 차부터 시작해요.'],
  ['선물/선물함','질문있어요! 옆 선물/선물함을 열면 오늘의 선물과 받은 선물함을 볼 수 있어요. 오늘의 선물은 하루 한 번 상자를 고르는 방식이에요. 관리자에게 받은 입양권·디그다 탈출권은 수령 후 내 아이템에 보관돼요.']],links:[['/quests','퀘스트북 열기'],['/student','포인트 내역 보기']]},
 {id:'pet',icon:'♥',title:'마이 리틀 펫',subtitle:'돌보고 꾸미고 새로운 파트너 만나기',intro:'마이 리틀 펫에서 포켓몬을 돌보고 방을 꾸밀 수 있어요. 파트너에 맞춰 화면 색상도 함께 바뀌어요.',steps:[
  ['돌보기와 강화','먹이주기·놀아주기·훈련시키기로 경험치를 모아요. 돌보기 버튼을 한 번 선택한 뒤 스페이스바로 반복할 수 있어요. 강화는 성공 확률이 있으며 실패하면 디그다가 될 수 있으니 확인 안내를 꼭 읽어 주세요.'],
  ['상점과 내 아이템','상점에서 산 아이템은 내 슬롯에서 확인해요. 포켓몬 착용 아이템은 착용 위치 편집으로 옮길 수 있고, 방 꾸미기 아이템은 위치와 크기를 조절할 수 있어요. 방은 초기 상태로 되돌릴 수도 있어요.'],
  ['포켓몬 도감과 스킨','입양한 파트너는 도감에서 다시 선택해요. 레벨 제한과 강화 상태에 따라 선택 조건이 달라져요. 스킨은 펫 방 가운데 포켓몬의 모습만 바꾸며, 현재 강화 단계에 맞는 스킨을 착용해야 해요.'],
  ['전설의 포켓몬 도감','수령 조건을 하나 달성할 때마다 전설 포켓몬을 한 마리씩 받을 수 있어요. 조건마다 한 번만 수령할 수 있고, 미획득 포켓몬은 미공개로 표시돼요. 7종을 모으면 아르세우스 수령 버튼이 열려요. 전설 포켓몬은 진화 없이 파트너로 선택할 수 있어요.']],links:[['/pet','파트너 돌보기'],['/collection','포켓몬 도감'],['/legendary','전설의 포켓몬 도감']]},
 {id:'games',icon:'🎮',title:'게임하기',subtitle:'짧은 휴식도 모험처럼',intro:'사이드바의 게임하기를 펼치면 네 가지 게임을 선택할 수 있어요. 게임 화면에서 조작법과 보상 조건을 먼저 확인해 주세요.',steps:[
  ['카드 뒤집기','같은 그림의 카드 두 장을 찾아 모든 짝을 맞혀요. 단계가 높아질수록 카드 수가 늘어나요. 위치 기억하기 아이템으로 도움을 받을 수 있어요.'],
  ['숨은그림 찾기','그림 안에 숨은 이모지를 찾아 눌러요. 위치 알려주기 아이템을 사용할 수 있고, 명예의 전당에서 기록을 확인할 수 있어요.'],
  ['Python 코딩 던전 탈출','방향키 또는 WASD로 이동하고 E로 상호작용해요. 코딩 미션을 해결하면 다음 LEVEL이 열려요. 게임을 떠나면 플레이 진행은 초기화되지만 획득 포인트와 학습 기록은 유지돼요. 같은 라운드의 보상은 최초 한 번만 받아요.'],
  ['SQL 미스터리 탐정단','몬스터 탐정과 사건 데이터를 읽고 SQL로 단서를 모아요. LEVEL 1~4는 5지선다·빈칸, LEVEL 5는 SQL 직접 작성 후 범인 지목으로 검거해요. 제한 시간 없이 추격과 JOIN 수사를 즐길 수 있고, 최초 라운드 보상은 총 200P까지예요. 나가면 수사는 초기화되지만 풀이 기록과 SQL MASTER 배지는 보존돼요.']],links:[['/cards','카드 뒤집기'],['/hidden','숨은그림 찾기'],['/python-dungeon','코딩 던전'],['/sql-detective','SQL 탐정단']]},
 {id:'together',icon:'✉',title:'공유·쪽지·계정',subtitle:'배운 것을 나누고 궁금한 것을 물어봐요',intro:'함께 배우는 공간과 비공개 쪽지함을 용도에 맞게 이용해 주세요.',steps:[
  ['문제 제작소와 Sloud','문제 제작소에서는 객관식·주관식·O/X 문제와 코드를 작성해 공유할 수 있어요. Sloud에는 배운 내용이나 이야기를 올리고 파일·이미지와 댓글로 소통해요. 댓글 작성자를 눌러 친구 추가도 할 수 있어요.'],
  ['질문있어요!와 내 쪽지함','질문있어요!는 관리자에게 보내는 비공개 질문이에요. 과목 질문과 단순 질문을 보낼 수 있어요. 내 쪽지함에서 관리자 답장을 확인하거나 아이디를 검색해 친구를 추가하고 친구에게 쪽지를 보내요.'],
  ['회원정보와 안전한 이용','회원정보에서 닉네임과 비밀번호를 관리해요. 비밀번호를 잊었다면 관리자에게 초기화를 요청해 주세요. 공용 컴퓨터를 사용했다면 사이드바 맨 아래 로그아웃을 눌러 주세요.']],links:[['/workshop','문제 제작소'],['/sloud','Sloud'],['/pet/mailbox','내 쪽지함']]}
]
const chapter=computed(()=>chapters.find(c=>c.id===selected.value))
</script>
<template>
 <section class="user-guide">
  <header class="guide-heading"><div><p class="guide-kicker">SPOKEMON ADVENTURE MANUAL</p><h1 aria-label="Spokemon 이용 가이드"><img class="guide-title-logo" src="/images/pokemon-logo.png" alt="Spokemon" width="1869" height="854"/><span>이용 가이드</span></h1><p>처음이라면 여기서 시작해요. 필요한 안내를 골라 보세요!</p></div><RouterLink to="/student" class="button light">닫기 ✕</RouterLink></header>
  <div class="guide-layout">
   <nav class="guide-chapters" aria-label="이용 가이드 목차"><button v-for="item in chapters" :key="item.id" :class="{selected:selected===item.id}" :aria-pressed="selected===item.id" aria-controls="guide-content" @click="selected=item.id"><span aria-hidden="true">{{item.icon}}</span>{{item.title}}<b aria-hidden="true">›</b></button></nav>
   <article id="guide-content" class="panel guide-content" aria-live="polite"><p class="guide-kicker">{{chapter.subtitle}}</p><h2>{{chapter.title}}</h2><p class="guide-intro">{{chapter.intro}}</p><ol><li v-for="(step,index) in chapter.steps" :key="step[0]"><span class="guide-number" aria-hidden="true">0{{index+1}}</span><div><h3>{{step[0]}}</h3><p>{{step[1]}}</p></div></li></ol><div class="guide-links"><RouterLink v-for="link in chapter.links" :key="link[0]" :to="link[0]" class="button">{{link[1]}} →</RouterLink></div></article>
  </div>
  <details class="panel guide-help"><summary>잠금이 있거나 문제가 생겼나요?</summary><p>잠긴 과목·단원은 관리자가 공개해야 이용할 수 있어요. 새로 가입했다면 기수 배정을 요청해 주세요. 포켓몬 선택은 필요한 레벨과 보유 상태도 확인해 주세요.</p><p>화면이나 저장에 문제가 있다면 안내된 오류를 확인한 뒤 새로고침해 보세요. 계속 문제가 생기면 질문있어요!로 어떤 화면에서 발생했는지 알려 주세요.</p></details>
 </section>
</template>
<style scoped>
.user-guide{max-width:1280px;margin:0 auto;min-width:0;color:var(--rpg-ink)}.guide-heading{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:22px}.guide-heading h1{font-size:clamp(21px,2.5vw,32px);margin:8px 0 12px;overflow-wrap:anywhere}.guide-heading p{margin:0;line-height:1.8}.guide-heading>.button{flex:none}.guide-kicker{font-size:11px;color:var(--rpg-mid);font-weight:bold;letter-spacing:.04em}.guide-layout{display:grid;grid-template-columns:235px minmax(0,1fr);gap:20px;align-items:start}.guide-chapters{display:flex;flex-direction:column;gap:10px}.guide-chapters button{display:flex;align-items:center;gap:10px;text-align:left;padding:14px 12px;min-height:48px;font-size:13px;min-width:0;width:100%;box-sizing:border-box}.guide-chapters button>b{margin-left:auto}.guide-chapters .selected{background:var(--rpg-soft)!important;color:var(--rpg-ink)!important;outline:2px solid var(--rpg-bright);outline-offset:-5px}.guide-content{margin:0!important;min-width:0;padding:26px!important;box-sizing:border-box}.guide-content h2{font-size:23px;margin:10px 0 16px}.guide-intro{line-height:1.9;font-size:14px}.guide-content ol{list-style:none;padding:0;margin:22px 0;display:grid;gap:18px}.guide-content li{display:flex;gap:14px;align-items:flex-start;border-top:1px solid var(--rpg-mid);padding-top:18px}.guide-number{flex:none;display:grid;place-items:center;width:34px;height:34px;border:2px solid var(--rpg-edge);background:var(--rpg-soft);font-size:13px}.guide-content h3{margin:0 0 8px;font-size:15px;line-height:1.6}.guide-content li p{margin:0;font-size:13px;line-height:1.95;overflow-wrap:anywhere}.guide-links{display:flex;gap:10px;flex-wrap:wrap}.guide-links .button{font-size:12px;padding:11px 14px;min-height:40px;box-sizing:border-box}.guide-help{margin-top:22px;font-size:13px;line-height:1.9}.guide-help summary{cursor:pointer;font-weight:bold}.guide-help p{max-width:85ch}@media(max-width:700px){.guide-layout{grid-template-columns:minmax(0,1fr);gap:16px}.guide-chapters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.guide-chapters button{font-size:11px;padding:11px 9px;gap:6px}.guide-heading{align-items:flex-start;gap:10px}.guide-heading>.button{font-size:11px;padding:9px}.guide-heading>div{min-width:0}.guide-heading p:not(.guide-kicker){font-size:12px}.guide-kicker{font-size:9px}.guide-content{padding:18px!important}.guide-content h2{font-size:20px}.guide-content li{gap:10px}.guide-intro{font-size:13px}.guide-links .button{flex:1;text-align:center;font-size:11px}.guide-help{padding:16px!important}}@media(prefers-reduced-motion:reduce){.user-guide *{scroll-behavior:auto}}
</style>

<style scoped>
.guide-heading h1{display:flex;align-items:center;gap:14px;flex-wrap:wrap;color:var(--rpg-ink);letter-spacing:0;line-height:1.4}.guide-title-logo{width:clamp(110px,14vw,175px);height:auto;max-height:80px;object-fit:contain}.guide-heading h1>span{color:var(--rpg-ink);font-weight:900}@media(max-width:700px){.guide-heading h1{gap:8px;font-size:20px}.guide-title-logo{width:110px;max-height:51px}}
</style>

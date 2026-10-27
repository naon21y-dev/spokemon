import { defineQuestions } from './schema.js'
export default defineQuestions('vue', [
 ['Vue의 주된 용도는 무엇인가요?', '사용자 인터페이스 만들기', '운영체제 커널 만들기', '데이터베이스 서버 관리', '이미지 압축 형식 정의', 'Vue는 컴포넌트 기반으로 웹 사용자 인터페이스를 만드는 JavaScript 프레임워크예요.'],
 ['Vue 단일 파일 컴포넌트의 일반적인 확장자는?', '.vue', '.java', '.sql', '.py', '.vue 파일은 템플릿, 로직, 스타일을 하나의 컴포넌트로 작성할 수 있어요.'],
 ['템플릿에서 message 값을 텍스트로 출력하는 구문은?', '{{ message }}', '[[ message ]]', '<% message %>', '${ message }', '이중 중괄호 보간은 값을 HTML이 아닌 텍스트로 표시해요.'],
 ['입력창과 상태를 양방향으로 연결하는 지시자는?', 'v-model', 'v-for', 'v-once', 'v-cloak', 'v-model은 입력 요소의 값과 상태를 함께 갱신하는 데 사용해요.'],
 ['조건이 거짓이면 해당 블록을 렌더링하지 않는 지시자는?', 'v-if', 'v-bind', 'v-text', 'v-for', 'v-if는 조건에 따라 블록을 생성하거나 제거해요.'],
 ['배열의 각 항목을 반복 출력할 때 쓰는 지시자는?', 'v-for', 'v-html', 'v-show', 'v-pre', 'v-for는 배열이나 객체를 순회하며 항목을 렌더링해요.'],
 ['v-for에서 안정적인 :key의 주된 역할은?', '항목의 정체성을 추적하기', '비밀번호 암호화하기', '배열을 자동 정렬하기', 'HTTP 요청 전송하기', '고유하고 안정적인 key는 Vue가 항목을 구별하여 DOM 상태를 올바르게 유지하도록 도와요.'],
 ['클릭 이벤트를 연결하는 올바른 축약 구문은?', '@click="save"', ':click="save"', '#click="save"', 'v-model:click="save"', '@는 v-on의 축약으로 이벤트 리스너를 연결해요.'],
 ['속성 값을 JavaScript 표현식에 연결하는 v-bind의 축약은?', ':', '@', '#', '$', ':src="imageUrl"처럼 콜론으로 동적 속성을 지정할 수 있어요.'],
 ['Vue 3에서 ref(0)의 값을 스크립트에서 바꿀 때 사용하는 속성은?', '.value', '.data', '.state', '.current', 'ref는 스크립트에서 .value로 접근하고 템플릿에서는 보통 자동으로 풀려요.'],
 ['다른 반응형 값으로부터 계산되는 값을 정의하는 API는?', 'computed', 'fetch', 'setTimeout', 'parseInt', 'computed는 의존하는 반응형 값이 바뀔 때 다시 계산되는 파생 상태예요.'],
 ['반응형 값이 바뀔 때 저장 같은 부수 효과를 실행하는 API는?', 'watch', 'createApp', 'defineProps', 'h', 'watch는 감시 대상의 변경에 반응하여 콜백을 실행해요.'],
 ['부모가 자식에게 전달하는 입력 데이터는?', 'props', 'emits', 'slots의 이름만', 'CSS 클래스만', 'props는 부모에서 자식으로 전달되며 자식이 직접 수정하지 않는 방식으로 사용해요.'],
 ['컴포넌트가 DOM에 마운트된 뒤 실행할 콜백을 등록하는 API는?', 'onMounted', 'onBeforeMount만', 'defineEmits', 'reactive', 'onMounted는 컴포넌트가 마운트된 후 DOM 작업 등을 할 때 사용해요.'],
 ['컴포넌트가 제거될 때 interval을 정리할 위치는?', 'onUnmounted 콜백', 'computed의 반환값', '템플릿 문자열', 'props 선언문', 'onUnmounted에서 clearInterval 등을 호출하면 화면을 떠난 뒤 작업이 남는 것을 막을 수 있어요.']
], [
 ['입력창 양방향 바인딩 지시자를 쓰세요.', ['v-model'], 'v-model은 폼 입력과 반응형 상태를 연결해요.'],
 ['조건부 렌더링 지시자 중 참일 때만 블록을 만드는 것을 쓰세요.', ['v-if'], 'v-if는 조건이 거짓이면 블록을 제거해요.'],
 ['목록을 반복 렌더링하는 지시자를 쓰세요.', ['v-for'], 'v-for와 고유한 key를 함께 사용해요.'],
 ['Vue 3에서 원시 값에 반응성을 부여하는 API 이름은?', ['ref', 'ref()'], 'ref는 숫자나 문자열 등을 반응형으로 감싸요.'],
 ['의존성에 따라 파생 값을 계산하고 캐시하는 API는?', ['computed', 'computed()'], 'computed는 계산된 값을 반응형 의존성에 맞춰 갱신해요.'],
 ['부모가 자식에게 전달하는 데이터의 명칭은?', ['props', 'prop'], '자식은 props를 읽고 변경 요청은 이벤트로 전달하는 방식이 일반적이에요.'],
 ['script setup에서 컴포넌트 이벤트를 선언하는 매크로는?', ['defineEmits', 'defineEmits()'], 'defineEmits는 이벤트 목록을 선언하고 emit 함수를 제공해요.'],
 ['마운트 후 콜백을 등록하는 Composition API 이름은?', ['onMounted', 'onMounted()'], '마운트 이후 DOM을 사용할 작업을 등록해요.'],
 ['자식 컴포넌트에 부모가 템플릿 내용을 넣는 기능의 이름은?', ['slot', 'slots', '슬롯'], '슬롯은 컴포넌트 내부의 지정된 자리에 내용을 삽입해요.'],
 ['Vue 애플리케이션 인스턴스를 생성하는 API 이름은?', ['createApp', 'createApp()'], 'createApp으로 생성한 앱을 mount로 DOM 컨테이너에 연결해요.']
])

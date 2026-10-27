import { defineQuestions } from './schema.js'
export default defineQuestions('javascript', [
 ['재할당 가능한 블록 범위 변수를 선언하는 키워드는?', 'let', 'const', 'import', 'return', 'let은 블록 범위이며 선언 후 다른 값을 재할당할 수 있어요.'],
 ['const에 대한 올바른 설명은?', '변수 바인딩을 재할당할 수 없다', '객체 속성도 절대 바꿀 수 없다', '항상 숫자만 담는다', '전역 변수만 선언한다', 'const는 재할당을 막지만 참조하는 객체의 속성 변경까지 막지는 않아요.'],
 ['엄격한 동등 비교 연산자는?', '===', '=', '!=', '=>', '===는 동등 비교에서 암묵적으로 타입을 변환하지 않아요.'],
 ['typeof 42의 결과 문자열은?', 'number', 'integer', 'float', 'numeric', '일반적인 JavaScript 숫자는 number 타입이에요.'],
 ['배열 끝에 요소를 추가하는 메서드는?', 'push', 'pop', 'shift', 'slice', 'push는 배열 끝에 요소를 추가하고 새 길이를 반환해요.'],
 ['배열의 각 요소를 변환해 새 배열을 만드는 메서드는?', 'map', 'find', 'every', 'includes', 'map은 각 요소에 함수를 적용한 결과로 새 배열을 만들어요.'],
 ['조건을 만족하는 요소들로 새 배열을 만드는 메서드는?', 'filter', 'reduce만', 'pop', 'join', 'filter는 콜백이 참으로 평가되는 요소만 선택해요.'],
 ['함수에서 결과를 호출자에게 돌려주는 키워드는?', 'return', 'break', 'continue', 'throw만', 'return은 함수 실행을 끝내고 지정한 값을 반환해요.'],
 ['JSON 문자열을 JavaScript 값으로 해석하는 메서드는?', 'JSON.parse', 'JSON.stringify', 'Object.keys', 'Array.join', 'JSON.parse는 유효한 JSON 문자열을 JavaScript 값으로 바꿔요.'],
 ['JavaScript 값을 JSON 문자열로 만드는 메서드는?', 'JSON.stringify', 'JSON.parse', 'String.parse', 'Number.isNaN', 'JSON.stringify는 직렬화 가능한 값을 JSON 문자열로 만들어요.'],
 ['async 함수가 기본적으로 반환하는 것은?', 'Promise', '항상 문자열', '항상 undefined', 'DOM 요소만', 'async 함수는 반환값을 감싼 Promise를 반환해요.'],
 ['await를 일반적인 함수 내부에서 사용하려면 어떤 선언이 필요한가요?', 'async 함수', 'const 객체', 'class 이름만', 'switch 문', '일반적인 함수 내부의 await는 async 함수 안에서 사용해요. 모듈 최상위 await도 지원돼요.'],
 ['예외 처리를 위한 구문은?', 'try...catch', 'for...in만', 'switch...case만', 'import...from', 'try에서 발생한 예외를 catch에서 처리할 수 있어요.'],
 ['배열의 길이를 읽는 속성은?', 'length', 'size()', 'count()', 'capacity', '배열의 length 속성은 배열 길이를 나타내요.'],
 ['addEventListener의 목적은?', '이벤트 발생 시 실행할 리스너 등록', '객체를 JSON으로 변환', '배열 정렬', '함수 강제 종료', '이벤트 리스너는 클릭 등의 이벤트에 반응하는 코드를 등록해요.']
], [
 ['재할당 가능한 블록 범위 변수 선언 키워드를 쓰세요.', ['let'], 'let으로 선언한 변수에는 새 값을 재할당할 수 있어요.'],
 ['재할당을 허용하지 않는 변수 선언 키워드는?', ['const'], 'const는 바인딩의 재할당을 막아요.'],
 ['엄격한 동등 비교 연산자를 쓰세요.', ['==='], '===는 암묵적 타입 변환 없이 비교해요.'],
 ['문자열 "abc"의 길이를 얻는 속성 이름은?', ['length'], '문자열과 배열의 길이는 length로 읽어요.'],
 ['JSON 문자열을 값으로 해석하는 메서드를 객체 이름까지 쓰세요.', ['JSON.parse', 'JSON.parse()'], 'JSON.parse는 JSON 형식의 문자열을 해석해요.'],
 ['배열 요소를 하나씩 변환해 새 배열을 만드는 메서드 이름은?', ['map', 'map()'], 'map은 원본을 직접 수정하는 대신 결과 배열을 만들어요.'],
 ['문자열 양끝 공백을 제거하는 메서드 이름은?', ['trim', 'trim()'], 'trim은 양끝 공백을 제거한 새 문자열을 반환해요.'],
 ['문자열을 소문자로 바꾸는 메서드 이름은?', ['toLowerCase', 'toLowerCase()'], 'toLowerCase는 소문자로 변환한 문자열을 반환해요.'],
 ['비동기 함수 선언 앞에 붙이는 키워드는?', ['async'], 'async 함수 안에서 await를 사용해 비동기 흐름을 작성할 수 있어요.'],
 ['null과 undefined일 때만 오른쪽 값을 사용하는 병합 연산자는?', ['??'], '??는 0이나 빈 문자열을 그대로 유지하면서 nullish 값에만 기본값을 적용해요.']
])

import { defineQuestions } from './schema.js'
export default defineQuestions('sql', [
 ['테이블에서 데이터를 조회하는 SQL 명령은?', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'SELECT는 저장된 데이터를 조회하는 명령이에요.'],
 ['SELECT 문에서 조회할 테이블을 지정하는 절은?', 'FROM', 'ORDER BY', 'HAVING', 'LIMIT', 'FROM 절은 조회 대상 테이블 등을 지정해요.'],
 ['개별 행을 조건으로 필터링하는 절은?', 'WHERE', 'GROUP BY', 'ORDER BY', 'AS', 'WHERE는 조건을 만족하는 행만 선택해요.'],
 ['결과를 정렬할 때 사용하는 절은?', 'ORDER BY', 'INSERT INTO', 'VALUES', 'DROP TABLE', 'ORDER BY는 지정한 열이나 표현식 기준으로 결과를 정렬해요.'],
 ['새 행을 추가하는 명령은?', 'INSERT INTO', 'SELECT', 'DROP', 'ROLLBACK', 'INSERT INTO와 VALUES 등으로 행을 추가할 수 있어요.'],
 ['기존 행의 값을 변경하는 명령은?', 'UPDATE', 'CREATE', 'SELECT', 'GRANT', 'UPDATE는 SET으로 값을 지정해 기존 행을 수정해요.'],
 ['조건에 맞는 행을 제거하는 명령은?', 'DELETE', 'ALTER', 'COMMIT', 'SELECT', 'DELETE는 행을 제거하며 WHERE가 없으면 모든 행이 대상이 될 수 있어요.'],
 ['기본 키(Primary Key)의 핵심 특성은?', '각 행을 고유하게 식별하며 NULL을 허용하지 않음', '반드시 문자열이어야 함', '항상 중복을 허용함', '테이블당 무조건 10개 필요', '기본 키는 고유성과 NOT NULL을 만족하며 여러 열을 묶어 구성할 수도 있어요.'],
 ['외래 키(Foreign Key)의 역할은?', '참조 대상의 키와 관계 무결성을 유지하기', '모든 데이터를 자동 암호화하기', '결과를 항상 내림차순 정렬하기', '테이블을 파일로 압축하기', '외래 키는 다른 행의 키를 참조하여 관계의 무결성을 돕는 제약 조건이에요.'],
 ['NULL 여부를 검사하는 올바른 조건은?', 'IS NULL', '= NULL', '== NULL', 'EQUAL NULL', 'NULL은 값이 없거나 알려지지 않음을 뜻하며 IS NULL로 검사해요.'],
 ['두 테이블에서 조인 조건이 일치하는 행을 결합하는 방식은?', 'INNER JOIN', 'ORDER BY', 'COUNT', 'DISTINCT', 'INNER JOIN은 두 입력에서 조인 조건을 만족하는 조합을 반환해요.'],
 ['같은 값의 행을 묶어 집계하는 절은?', 'GROUP BY', 'ORDER BY', 'WHERE만', 'INSERT', 'GROUP BY는 같은 그룹의 행에 SUM, COUNT 같은 집계를 적용할 때 사용해요.'],
 ['GROUP BY로 묶인 그룹을 조건으로 걸러내는 절은?', 'HAVING', 'FROM', 'VALUES', 'SET', 'HAVING은 그룹에 대한 조건이며 WHERE는 그룹화 전 개별 행을 거르는 데 사용해요.'],
 ['결과의 모든 행 수를 세는 표현식은?', 'COUNT(*)', 'SUM(*)', 'ROWS()', 'TOTAL(*)', 'COUNT(*)는 NULL이 있는 열과 관계없이 결과 행 수를 세어요.'],
 ['트랜잭션의 변경을 확정하는 명령은?', 'COMMIT', 'ROLLBACK', 'SELECT', 'EXPLAIN', 'COMMIT은 트랜잭션의 변경을 확정하며 ROLLBACK은 변경을 취소해요.']
], [
 ['데이터를 조회하는 SQL 키워드를 쓰세요.', ['SELECT'], 'SELECT로 조회할 열이나 표현식을 지정해요.'],
 ['개별 행을 조건으로 거르는 절의 키워드는?', ['WHERE'], 'WHERE 뒤에 참·거짓으로 평가되는 조건을 작성해요.'],
 ['결과 정렬에 사용하는 두 단어의 SQL 절은?', ['ORDER BY'], 'ORDER BY 뒤에 정렬 열과 ASC 또는 DESC를 지정할 수 있어요.'],
 ['내림차순 정렬 방향 키워드는?', ['DESC'], 'DESC는 큰 값에서 작은 값으로 정렬하는 방향이에요.'],
 ['결과에서 중복된 행을 제거하는 SELECT 수정 키워드는?', ['DISTINCT'], 'SELECT DISTINCT는 선택된 열들의 조합에서 중복을 제거해요.'],
 ['NULL인 행을 찾는 조건 연산 구문을 쓰세요.', ['IS NULL'], 'column IS NULL처럼 쓰며 = NULL을 사용하지 않아요.'],
 ['결과의 전체 행 수를 세는 집계 표현식을 쓰세요.', ['COUNT(*)', 'COUNT( * )'], 'COUNT(*)는 결과 행 수를 세어요.'],
 ['행을 고유하게 식별하는 기본 키의 영어 명칭 또는 약어는?', ['PRIMARY KEY', 'PK'], '기본 키는 중복과 NULL을 허용하지 않아요.'],
 ['트랜잭션의 변경을 취소하는 명령은?', ['ROLLBACK'], 'ROLLBACK은 현재 트랜잭션의 변경을 취소해요.'],
 ['테이블에서 특정 열의 최댓값을 구하는 집계 함수 이름은?', ['MAX', 'MAX()'], 'MAX는 그룹 또는 전체 결과에서 최댓값을 구해요.']
])

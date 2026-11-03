# SQL 미스터리 탐정단

`/sql-detective`에서 플레이합니다. 새 파일 에셋을 받지 않고 인라인 SVG 몬스터와 CSS 사건 현장을 사용합니다.

- LEVEL 1~4: 5지선다·빈칸, LEVEL 5: SELECT 전체 코드 작성. 매 사건 필수 SQL 미션 4개 + 범인 지목.
- 기본 모드는 게임 시간제한이 없습니다. 운영 서버를 보호하는 SQL 실행 한도만 적용합니다.
- `/api/detective/*`는 학생 인증·본인 세션·선행 라운드 완료·현재 문제·일시정지를 검사합니다.
- 매 시작 때 5개 새 사건과 20문제를 생성합니다. 사용자별 정규화 콘텐츠 해시를 저장해 재출제를 방지합니다.
- 정답 결과·해설·확보한 단서만 공개합니다. 정답 SQL과 범인 번호는 풀이 전 클라이언트에 내려주지 않습니다. 사건의 원시 테이블은 추리와 학습을 위해 공개합니다.
- SQL은 운영 DB 연결이 없는 별도 Python 프로세스의 인메모리 SQLite에서 실행됩니다. SELECT 한 문장만 허용하고 테이블·함수 allowlist, SQLite authorizer, progress handler, 128MB 메모리·2초 CPU·2.5초 프로세스 한도를 적용합니다. 최대 2개 동시 실행과 12개 대기열을 사용합니다.
- `detective_awards(user_id, level)` 기본키와 write transaction으로 사용자별 라운드 최초 1회(5/15/30/50/100P)만 지급합니다. 수사 재시작과 새로고침은 보상 자격을 초기화하지 않습니다.
- 페이지 재입장 시 기존 수사를 종료하고 새 게임은 LEVEL 1부터 시작합니다. 종료 확인창과 일시정지를 지원하며, 풀이 기록·포인트 내역·SQL MASTER 배지는 DB에 보존됩니다. 비정상 종료 세션은 2시간 후 만료됩니다.
- Turso DB에 추가 테이블이 자동 생성됩니다. 기존 테이블·계정·포인트를 초기화하지 않습니다. Render Free와 기존 Python 런타임을 그대로 사용하며 추가 외부 서비스/키는 필요하지 않습니다.

검증: `npm run test:detective`, `npm run build`. SQL 보안 API는 [Python sqlite3 문서](https://docs.python.org/3/library/sqlite3.html#sqlite3.Connection.set_authorizer)를 따릅니다.

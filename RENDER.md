# Render Free + Turso 배포

Vue 화면과 API를 **하나의 Node Web Service**로 실행합니다. DB는 Turso 원격 libSQL에 저장합니다. Render 로컬 디스크에 계정·학습 기록을 저장하지 않습니다.

## 1. Turso DB와 서버 비밀값 준비

Turso에서 **libSQL 호환 DB**를 만들고 URL(`libsql://…`)과 쓰기 가능한 인증 토큰을 발급하세요. 이 프로젝트는 요청대로 `@libsql/client`를 사용합니다. 다른 엔진의 `turso://` URL은 사용할 수 없습니다.

Render Environment에 다음 값을 직접 등록합니다. `.env.example`은 이름만 담은 예시입니다.

| 환경변수 | 값/용도 |
| --- | --- |
| `TURSO_DATABASE_URL` | Turso의 libSQL 원격 DB URL |
| `TURSO_AUTH_TOKEN` | 해당 DB 인증 토큰. Secret으로 관리 |
| `SPOKEMON_ADMIN_LOGIN` | 새 DB의 첫 관리자 아이디. 기본 `admin` |
| `SPOKEMON_ADMIN_PASSWORD` | 첫 관리자 비밀번호, 12자 이상. 기존 관리자가 있으면 변경하지 않음 |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24` |
| `API_HOST` | `0.0.0.0` |
| `COOKIE_SECURE` | `true` |
| `APP_ORIGIN` | 사용자 도메인을 쓸 때만 `https://사용자도메인` |

`PORT`와 기본 출처는 Render의 `PORT`, `RENDER_EXTERNAL_URL`을 자동으로 사용합니다. `TURSO_*`에는 `VITE_` 접두어를 붙이지 마세요. 토큰을 Vue 코드, Git, 로그, 채팅에 넣지 마세요. 서버만 DB에 접속합니다.

**기존 기록을 옮길 경우 다음 이전 작업을 먼저 완료한 뒤 배포합니다.** 앱을 먼저 실행하면 대상 DB에 스키마가 생기므로 이전 도구가 덮어쓰기를 거부합니다.

## 2. 기존 SQLite → Turso 이전 (별도 작업)

자동으로 기존 DB를 업로드하거나 초기화하지 않습니다. 앱과 모든 쓰기 작업을 멈춘 뒤 `server/data/spokemon.sqlite`의 백업을 별도 보관하세요. SQLite가 열려 있는 동안 파일만 복사하지 마세요. 실행 중 백업이 필요하면 SQLite 백업 API/도구를 사용합니다.

로컬에서 Node 24와 의존성을 준비합니다.

```sh
npm ci
npm run db:migrate -- --source "D:/backups/spokemon.sqlite" --dry-run
```

`--dry-run`은 원본 무결성과 테이블/행 수만 확인하며 원격 연결이 필요 없습니다. 다음으로 Git에서 제외되는 로컬 `.env`에 **비어 있는 새 Turso DB**의 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`을 설정하고 실행합니다.

```sh
npm run test:turso:remote
npm run db:migrate -- --source "D:/backups/spokemon.sqlite"
```

- 원본은 `node:sqlite`로 **읽기 전용** 접근합니다. 런타임 서버는 `@libsql/client`만 사용합니다.
- 스키마, 계정/해시/세션, 기존 포인트와 지급 내역, 단원 공개, 학습/오답/공부시간, 학생 문제, 쪽지/친구, 펫/아이템/메모를 테이블 단위로 복사합니다.
- 각 묶음의 데이터와 체크포인트를 원격 트랜잭션으로 함께 저장합니다. 끊기면 **동일한 백업 파일로 같은 명령을 재실행**하세요. 원본이 바뀌면 재개를 거부합니다.
- 테이블별 행 수와 내용 SHA-256, 외래 키를 검증한 뒤에만 `complete: true`로 표시합니다. 모든 작업이 끝날 때까지 대상 DB에 앱을 연결하지 마세요. 서버도 미완료 이전 표시가 있으면 시작을 거부합니다.
- 원래 rowid와 정수/BLOB을 보존합니다. 완료 후 재실행은 중복 복사하지 않습니다. 기존 앱 데이터가 있는 DB에는 덮어쓰지 않습니다.
- SQLite 데이터 파일, 백업, `.env`는 Git에 올리지 마세요. 검증 후에도 원본 백업을 보관하세요. 실패 시 원본 앱으로 돌아갈 수 있지만, 새 원격 DB에서 발생한 변경을 역으로 합치는 기능은 없습니다.

## 3. Render 설정

New → Blueprint에서 저장소와 브랜치를 선택하고 `render.yaml`을 사용합니다. **Free Node Web Service**이며 영구 디스크를 요청하지 않습니다. 기존 Starter 서비스를 사용 중이라면 Render에서 플랜 변경 여부도 확인하세요. 파일 수정만으로 기존 유료 리소스가 자동 해지되지는 않습니다.

직접 만드는 경우:

- Runtime: Node 24 / Instance type: Free
- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm start`
- Health Check: `/api/health`
- 위의 서버 환경변수 등록. `SPOKEMON_DB`와 Disk 설정은 제거

운영 환경에서 Turso 변수가 없으면 시작을 거부합니다. Render 임시 SQLite로 자동 전환하지 않습니다. 재시작/재배포 후에도 동일한 Turso URL을 유지해야 기존 데이터가 보입니다. 새 DB에만 초기 관리자를 생성하며, 이전한 관리자 비밀번호·포인트·학생 기록은 바꾸지 않습니다.

Render Free 서비스는 비활성 시 절전되므로 첫 요청에 지연이 생길 수 있습니다. DB/토큰 연결이 실패하면 API는 오류를 반환하며 포인트나 기록을 로컬에 임시 확정하지 않습니다. Turso 무료 사용량과 요금은 대시보드에서 확인하세요. 앱 서버와 가까운 DB 위치를 선택하면 지연을 줄일 수 있습니다.

## 로컬 개발과 검증

Turso 환경변수가 있으면 로컬 서버도 그 원격 DB를 사용합니다. 실제 운영 DB 대신 개발용 DB를 권장합니다. 두 변수가 없으면 개발/테스트에서만 `SPOKEMON_DB` 또는 `server/data/spokemon.sqlite`를 `@libsql/client`의 `file:` 드라이버로 사용합니다. 기존 로컬 DB 파일은 삭제하지 않습니다.

```sh
npm run server
# 별도 터미널
npm run dev -- --host 127.0.0.1 --port 5188
```

```sh
npm run test:turso
npm run test:server
npm run test:mail
npm run test:workshop
npm run test:notes
npm run build
npm run test:render
```

`test:turso`는 임시 로컬 libSQL DB에서 비동기 호출/롤백/여러 프로세스의 중복 보상 방지와 이전·재개를 검증합니다. 다른 회귀 테스트도 임시 DB를 사용합니다. 실제 원격 연결은 환경변수를 설정한 뒤 `npm run test:turso:remote`로 별도 확인합니다. 이 연결 검사는 `SELECT 1`만 실행해 데이터와 스키마를 변경하지 않습니다.

트랜잭션은 SDK의 `transaction('write')`를 사용하며 오류 시 롤백합니다. 포인트 최초 지급 키·원본 문제 키·일일 상한·잔액·원장은 같은 트랜잭션에서 처리합니다. 같은 프로세스의 요청은 DB 연결별 큐로 정리하고, 여러 프로세스 간에는 DB 쓰기 트랜잭션과 고유 제약이 중복 지급을 막습니다. 통계/문제 등록/이전의 반복 쿼리는 묶어서 전송합니다.

공식 문서: [Turso TypeScript/libSQL](https://docs.turso.tech/sdk/ts/quickstart), [libSQL transactions](https://tursodatabase.github.io/libsql-client-ts/interfaces/Client.html), [Render Free](https://render.com/docs/free).

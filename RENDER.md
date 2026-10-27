# Render 배포

Vue 화면과 API를 **하나의 Node Web Service**로 실행합니다. Static Site로 만들면 로그인과 DB가 작동하지 않습니다.

## Blueprint로 만들기

1. Render에서 New → Blueprint를 선택하고 `naon21y-dev/spokemon` 저장소와 코드가 올라간 브랜치를 선택합니다.
2. 루트의 `render.yaml`을 사용합니다.
3. `SPOKEMON_ADMIN_PASSWORD`에 배포용 관리자 비밀번호를 입력합니다. 12자 이상이며 저장소에는 저장하지 않습니다.
4. 이 설정은 **유료 Starter 서비스와 1GB 영구 디스크**를 사용합니다. Render에서 비용을 확인한 뒤 생성하세요.

## Web Service를 직접 만들 때

- Runtime: Node, 버전 24 (`.node-version` 또는 `NODE_VERSION=24`)
- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm start`
- Health Check: `/api/health`
- Disk: `/var/data`, 1GB
- `SPOKEMON_DB=/var/data/spokemon.sqlite`
- `SPOKEMON_ADMIN_LOGIN=admin`
- `SPOKEMON_ADMIN_PASSWORD`: 12자 이상 비밀값
- `COOKIE_SECURE=true`
- `API_HOST=0.0.0.0`

Render의 `PORT`를 자동 사용합니다. 기본 Render URL은 `RENDER_EXTERNAL_URL`에서 읽어 API 출처 검증에 사용합니다. 사용자 도메인을 연결하면 `APP_ORIGIN=https://사용자도메인`으로 설정하세요.

관리자 계정이 없는 새 DB에서만 환경변수로 초기 관리자를 생성합니다. 이미 존재하는 관리자 비밀번호·학생·포인트·기록은 재시작 시 변경하지 않습니다. 로컬 DB와 계정은 Git에 업로드되지 않으므로 새 배포는 별도 계정으로 시작합니다.

SQLite 기록은 영구 디스크 안에 저장해야 재배포 후에도 유지됩니다. 무료 서비스의 임시 파일시스템만으로는 기록 유지가 보장되지 않습니다. 파일 DB는 한 서비스 인스턴스에서 사용합니다.

https://render.com/docs/web-services
https://render.com/docs/disks

## 로컬 실행

```sh
npm ci
npm run build
npm start
```

개발 중에는 별도 터미널에서 `npm run dev -- --host 127.0.0.1 --port 5188`을 실행합니다.

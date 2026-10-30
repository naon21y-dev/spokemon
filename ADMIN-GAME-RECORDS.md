# 관리자 명예의 전당 기록 관리
- 관리자 페이지 → 게임 기록에서 카드 뒤집기(1~8단계), 숨은그림 찾기(1~10단계)를 조회합니다.
- 이름·아이디 검색, 현재 기록/삭제된 기록, 페이지당 50개 목록을 제공합니다.
- 기록 삭제는 선택한 게임·세션을 명예의 전당에서 제외합니다. 검색 결과 전체 삭제는 실제 조회한 게임·단계·학생 검색 조건을 고정해 확인창에 표시하며 ‘삭제’ 입력 후 실행합니다.
- game_score_removals에 삭제 상태와 관리자를 저장합니다. game_score_actions에 개별/일괄 삭제와 복원 이력을 남깁니다. 원본 점수·게임 클리어·보상 원장은 유지됩니다.
- 삭제 기록은 랭킹 계산 전에 제외되므로 다음 개인 최고 기록으로 순위와 메달이 다시 계산됩니다. 중복 완료·기존 마이그레이션으로 다시 노출되지 않습니다.
- 삭제된 기록에서 복원하면 순위 계산에 다시 포함됩니다.
- GET/DELETE /api/admin/game-rankings, DELETE /api/admin/game-rankings/:game/:sessionId, POST /api/admin/game-rankings/:game/:sessionId/restore는 서버에서 관리자 권한을 검사합니다.
- 검증: npm run test:admin-game-records, npm run test:card-performance, npm run build.

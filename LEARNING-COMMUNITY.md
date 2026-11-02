# 학습·커뮤니티·일일 선물 업데이트

- 학습 자료: server/lessons의 과목별 JSON. 기본 7과목 35단원, 개념 3개·코드 예제·설명·실습·이해 확인 2개(총70개). 서버에서 진도 권한 확인 후 전달합니다. 이해 확인의 정답과 해설은 제출 후 반환합니다. 통과하면 해당 단원 공식 학습 항목을 트랜잭션에서 완료 처리합니다. 기존 완료·포인트 기록은 유지하며 학습 완료에 포인트를 지급하지 않습니다. 이동한 문제는 원본 ID로 기존 자료를 찾고 사용자 추가 단원은 등록된 공식 설명을 기반으로 자료를 구성합니다.
- 참고 문서: [Vue](https://vuejs.org/guide/) · [IntelliJ](https://www.jetbrains.com/help/idea/working-with-source-code.html) · [SQL](https://www.postgresql.org/docs/current/tutorial-sql.html) · [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide) · [Python](https://docs.python.org/3/tutorial/) · [TensorFlow](https://www.tensorflow.org/tutorials/keras/overfit_and_underfit) · [Git](https://git-scm.com/docs/gittutorial). 예제는 학습용으로 직접 작성했습니다.
- 관리자 학생 정보: `admin_student_name`은 관리자 목록·상세 전용이며 공개 닉네임과 별도입니다. 학생 상태·로그인·친구 정보에 포함하지 않습니다. 현재 계열·강화 모습·펫 이름과 마지막 접속일시(KST)를 표시합니다. 기존 사용자 접속일은 새 로그인 또는 접속 heartbeat부터 기록됩니다.
- 문제 제작소: 게시판형 목록, 선택적 코드(12,000자), 객관식·단답형·O/X. O/X는 `format=ox`, `type=multiple`, 고정 선택지 O/X의 ID로 서버 채점합니다. 기존 원본/버전별 보상 중복 방지와 진도 잠금을 사용합니다. 코드를 실행하거나 HTML로 렌더링하지 않습니다.
- Sloud: 로그인한 모든 회원이 글·첨부·댓글을 볼 수 있습니다. 친구 관계 없이 댓글 작성이 가능하며 학생 댓글 작성자를 눌러 친구 요청을 보낼 수 있습니다. 작성자 또는 관리자가 자기 글/댓글을 숨김 삭제할 수 있습니다. 목록은20개씩 조회하며 작성 요청 키로 중복 글·댓글을 방지합니다.
- 첨부: 쪽지는 이미지, Sloud는 이미지·PDF·UTF-8 텍스트/코드. 최대3개, 파일당1MB, 계정 보관 한도100개/30MB. PNG/JPEG/GIF/WEBP/PDF 시그니처와 텍스트 확장자를 서버에서 확인합니다. SVG/HTML 업로드는 차단하며 텍스트/PDF 파일은 다운로드로 제공합니다. 이미지도 실행 불가 CSP/nosniff를 사용합니다. 파일은 Turso DB의 BLOB으로 저장하므로 Render Free 재시작에도 유지됩니다. 쪽지 첨부는 해당 대화 참여자와 담당 관리자만 접근할 수 있고 Sloud 첨부는 로그인 회원에게만 공개됩니다. 첨부 취소/작성 취소된 업로드는 아직 게시되지 않은 본인 전용 파일로 남아 보관 한도에 포함됩니다.
- 일일 선물: 학생만 이용, KST 하루1회. 상자3개 중 하나를 선택하면 서버의 암호학적 난수로 0/500/1000P 중 각각1/3 확률로 결정합니다. 선택과 수령은 별도 단계이며 하루 선택은 고정됩니다. `(user_id,day)` 기본키와 고유 원장 키/트랜잭션으로 동시 선택·수령을 방지합니다. 미수령 선물은 해당 한국 날짜에만 받을 수 있습니다. 카드 등 기존 보상 규칙은 변경하지 않습니다.
- 25레벨 파트너: 불꽃숭이/야돈/치코리타/리오르 4계열, 단계별3종·스킨9개씩. 가입 화면에서는 제외하고 파트너 선택 페이지에 추가했습니다. 기존5000P 변경,80%/50% 강화,실패 디그다,단계별500/1000/1500P 스킨 규칙을 사용합니다. 이미지 출처는 `public/images/partner-expansion/LEVEL25-SOURCES.json`에 기록합니다.
- 검증: `npm run test:launch-features`, `npm run test:pet-care-trio`, 기존 서버·꾸미기·문제 제작·쪽지·저장 회귀 테스트와 `npm run build`.

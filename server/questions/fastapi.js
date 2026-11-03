import {defineQuestions} from './schema.js'

const questions = defineQuestions('fastapi', [
  ["FastAPI에서 Python 타입 힌트를 사용하는 이유는?","입력 검증과 OpenAPI 스키마 생성에 활용한다","모든 함수를 자동으로 async로 만든다","SQL 테이블을 자동 생성한다","요청을 모두 캐시한다","FastAPI는 타입 선언을 읽어 요청 데이터를 파싱하고 검증하며 해당 구조를 문서에 반영합니다."],
  ["서버의 상품 목록을 조회하는 일반적인 HTTP 메서드는?","GET","POST","PUT","DELETE","GET은 리소스 표현을 조회하는 메서드입니다. 읽기 요청을 처리할 때 상품을 생성하거나 삭제하는 부작용을 넣지 않습니다."],
  ["서버가 ID를 할당하는 새 상품을 생성할 때 일반적인 요청은?","POST /items","GET /items","DELETE /items","PUT /items/unknown","컬렉션에 새 항목을 추가할 때 일반적으로 POST를 사용합니다. 생성 성공 응답에는 201을 사용할 수 있습니다."],
  ["상품 7의 표현 전체를 클라이언트가 보낸 값으로 교체할 때 일반적인 요청은?","PUT /items/7","GET /items/7","POST /items/search","DELETE /items/7","PUT은 대상 URI의 상태를 요청 표현으로 설정하는 메서드입니다. 일부 필드만 수정하는 API에는 PATCH를 고려할 수 있습니다."],
  ["상품 7을 제거하는 의도를 표현하는 요청은?","DELETE /items/7","GET /items/7","POST /items","PUT /items/7","DELETE는 지정한 리소스의 제거를 요청합니다. 성공 시 본문이 없다면 204를 선택할 수 있습니다."],
  ["GET /items/7?limit=3에서 /items/{item_id}의 경로 값과 쿼리 값은?","item_id=7, limit=3","item_id=3, limit=7","둘 다 경로 값","둘 다 쿼리 값","URI 경로의 {item_id}는 7이고 물음표 뒤의 limit은 쿼리 매개변수입니다."],
  ["FastAPI의 기본 Swagger UI 경로는?","/docs","/swagger.json","/redoc","/api/schema","기본 Swagger UI는 /docs입니다. /redoc은 다른 문서 UI이고 /openapi.json은 원본 OpenAPI 스키마입니다."],
  ["Pydantic 모델에 price: float를 선언했는데 price에 숫자로 변환할 수 없는 문자열을 보내면?","요청 검증 오류가 발생한다","자동으로 0이 된다","문자열 그대로 항상 전달된다","데이터베이스가 먼저 검사한다","요청 본문을 모델로 읽을 때 필드 타입을 검사합니다. 기본 설정에서는 이 요청의 오류가 422 응답으로 나타납니다."],
  ["@app.get('/items/{item_id}') 함수에서 item_id: int인데 /items/abc로 요청하면 기본 응답은?","422","404","201","500","경로 자체는 일치하지만 abc를 int로 변환할 수 없어 FastAPI의 요청 검증이 422를 반환합니다."],
  ["함수 매개변수가 q: Optional[str] = None이고 경로에 q가 없으면 어떻게 해석되나요?","생략할 수 있는 쿼리 매개변수","반드시 필요한 경로 매개변수","항상 요청 본문 필드","인증 헤더","경로 템플릿에 없는 단순 타입은 기본적으로 쿼리 매개변수입니다. 기본값 None 때문에 생략 가능합니다."],
  ["@app.post('/items')의 함수 인자가 item: Item이고 Item이 BaseModel이면 기본적으로 어디에서 읽나요?","JSON 요청 본문","경로","쿼리","응답 헤더","별도 선언이 없으면 Pydantic 모델 인자를 요청 본문으로 해석해 JSON 데이터를 검증합니다."],
  ["존재하지 않는 항목을 조회했을 때 함수 안에서 404를 반환하는 관용적인 방법은?","raise HTTPException(status_code=404, detail='Not found')","return {'status_code':404}","raise ValueError('404')","return None","HTTPException을 발생시키면 FastAPI가 상태 코드와 detail 본문을 만듭니다. 딕셔너리의 status_code 필드는 실제 상태 코드를 설정하지 않습니다."],
  ["@app.post('/items', status_code=201)의 의미는?","정상 응답의 기본 상태 코드를 201로 지정한다","모든 예외도 201이 된다","본문 검증을 끈다","GET 요청도 허용한다","데코레이터의 status_code는 정상 응답의 상태 코드와 문서에 반영됩니다. 검증 오류나 명시적 예외에는 각자의 상태 코드가 적용됩니다."],
  ["Request 객체에서 원시 헤더를 직접 확인하는 속성은?","request.headers","request.response","request.status_code","request.body.headers","Request는 들어온 요청을 나타냅니다. headers 속성으로 헤더를 읽으며 특정 헤더만 필요하면 Header 선언도 사용할 수 있습니다."],
  ["응답에 X-Trace-ID 헤더를 추가하려면 주입된 response: Response에 무엇을 설정하나요?","response.headers['X-Trace-ID'] = trace_id","request.headers['X-Trace-ID'] = trace_id","response.status_code = trace_id","return {'X-Trace-ID': trace_id}","Response 객체의 headers에 값을 지정하면 응답 헤더에 반영됩니다. 반환 딕셔너리는 기본적으로 응답 본문입니다."],
  ["FastAPI의 기본 OpenAPI JSON 경로는?","/openapi.json","/docs.json","/redoc.json","/schema","/openapi.json은 도구가 읽을 수 있는 스키마입니다. Swagger UI는 이를 읽어 대화형 문서를 보여 줍니다."],
  ["@app.get('/users/me')와 @app.get('/users/{name}')가 모두 있을 때 /users/me 전용 처리를 보장하는 등록 순서는?","고정 경로를 매개변수 경로보다 먼저 등록","매개변수 경로를 먼저 등록","등록 순서와 관계없이 고정 경로가 항상 우선","두 경로 모두 반드시 POST로 바꾸기","라우트는 등록 순서대로 평가됩니다. 동적 경로가 앞에 있으면 me도 name 값으로 먼저 매칭됩니다."],
  ["response_model=PublicUser인 경로에서 정상 반환 딕셔너리에 password_hash가 추가로 들어 있다면?","PublicUser에 없는 필드는 일반 응답 직렬화에서 제외된다","항상 모든 필드가 노출된다","요청 검증에서 해시가 삭제된다","DB에서 해시 필드를 삭제한다","일반 객체를 반환하면 응답 모델에 따라 검증하고 필드를 제한합니다. Response 객체를 직접 반환하는 별도 경로에서는 스스로 본문을 관리해야 합니다."],
  ["DELETE가 성공하고 보낼 본문이 없을 때 올바른 응답 설계는?","204와 빈 본문","204와 필수 JSON 본문","422와 성공 메시지","201과 빈 본문","204는 No Content로 응답 본문이 없어야 합니다. 성공 결과를 JSON으로 보내려면 보통 200을 선택합니다."],
  ["async def 경로 함수에서 동기 블로킹 HTTP 클라이언트를 직접 호출하면?","이벤트 루프가 막혀 다른 요청이 지연될 수 있다","FastAPI가 호출을 자동으로 await한다","타입 힌트가 호출을 병렬화한다","Swagger UI만 느려진다","async def 안의 일반 블로킹 호출은 이벤트 루프에서 실행됩니다. 비동기 클라이언트를 await하거나 블로킹 작업을 적절히 스레드로 분리합니다."]
], [
  ["빈칸을 채우세요. app = ___()  # from fastapi import FastAPI",["FastAPI"],"FastAPI()는 애플리케이션 인스턴스를 만듭니다. 여기에 라우트를 등록합니다."],
  ["Pydantic 모델 선언의 빈칸을 채우세요. class Item(___):  # from pydantic import BaseModel",["BaseModel"],"BaseModel을 상속하면 타입 선언으로 필드와 검증 규칙을 정의할 수 있습니다."],
  ["빈칸을 채우세요. limit: int = Query(10, ___=1)  # 최솟값 1을 포함",["ge"],"ge는 greater than or equal 조건입니다. 1을 허용하고 0은 입력 검증에서 거부합니다."],
  ["빈칸에 HTTP 메서드 이름을 소문자로 적으세요. @app.___('/items/{id}')  # 항목 삭제",["delete"],"app.delete는 DELETE 요청을 해당 경로 함수에 연결합니다."],
  ["공개 응답 필드를 지정하는 빈칸을 채우세요. @app.get('/users/{id}', ___=PublicUser)",["response_model"],"response_model은 일반 반환값의 출력 구조를 검증·필터링하고 OpenAPI 응답 스키마에 반영합니다."]
], {multiple:0,short:0})

const units = [1, 2, 2, 2, 2, 1, 1, 3, 2, 3, 3, 4, 4, 4, 4, 1, 5, 5, 4, 5, 1, 3, 3, 2, 5]
const difficulties = ["beginner", "beginner", "beginner", "beginner", "beginner", "beginner", "beginner", "beginner", "intermediate", "intermediate", "intermediate", "intermediate", "intermediate", "intermediate", "intermediate", "intermediate", "advanced", "advanced", "advanced", "advanced", "beginner", "beginner", "intermediate", "intermediate", "advanced"]
export default questions.map((question,index)=>({...question,unit:units[index],difficulty:difficulties[index]}))

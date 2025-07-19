# main.py
from fastapi import FastAPI, Request, Query, Path, HTTPException, status
from pydantic import BaseModel
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict
from fastapi.responses import JSONResponse
import json
import re
import uuid

from fastapi import APIRouter, Path, BackgroundTasks
from fastapi.responses import StreamingResponse
from starlette.requests import Request

from graph_builder import build_graph
from tools import query_db_mcp
from config import config
import uvicorn
import asyncio

from fastapi.middleware.cors import CORSMiddleware

# services/llm_service.py에서 새로운 에이전트 함수 임포트
from services.llm_service import agent_chat_with_claude, generate_and_update_chat_title, agent_chat_with_claude_stream, generate_and_update_report_title

# /dashboard/cgm 응답 모델
class CgmDayData(BaseModel):
    time: str  # "HH:MM" 형식
    cgm: float

class CgmData(BaseModel):
    date: date
    cgm_mean: float
    cgm_day: Optional[List[CgmDayData]] = None

# /dashboard/insulin 응답 모델
class InsulinDayData(BaseModel):
    time: str  # "HH:MM" 형식
    insulin: float
    algorithm: str

class InsulinData(BaseModel):
    date: date
    insulin_mean: float
    insulin_day: Optional[List[InsulinDayData]] = None

# /chat 응답 모델
class ChatRoom(BaseModel):
    chat_id: int
    chat_name: str

# /chat/{chat_id} 응답 모델
class Message(BaseModel):
    msg_id: int
    date: datetime
    who: str
    msg: str

# 채팅 상세 정보 전체 응답 모델
class ChatDetailsResponse(BaseModel):
    chat_name: str
    messages: List[Message]

# /chat/{chat_id}/message 요청 모델
class NewMessage(BaseModel): #! 수정 필요 - role 추가, 이 role은 User 아니면 AI.
    msg: str

# /reports API의 각 항목에 대한 모델
class ReportInfo(BaseModel):
    report_id: int
    report_title: str
    created_at: datetime

# /reports/{report_id} API의 상세 응답 모델
class ReportDetail(ReportInfo):
    report_contents: str

# 새로운 리포트 생성 요청을 위한 모델
class NewReportRequest(BaseModel):
    user_id: int
    report_title: str
    question: str

# /diagnosis API의 각 항목에 대한 모델
class DiagnosisInfo(BaseModel):
    dia_id: int
    diagnosis_preview: str # 진단 내용 미리보기
    created_at: datetime

# /diagnosis/{dia_id} API의 상세 응답 모델
class DiagnosisDetail(BaseModel):
    dia_id: int
    dia_message: str # 진단 내용 전체
    created_at: datetime
    dia_llm_message: str # llm이 생성한 진단 내용 전체

# oref0 API 요청/응답 모델
class Oref0Request(BaseModel):
    current_cgm: float
    cgm_history: Optional[List[Dict]] = []
    insulin_history: Optional[List[Dict]] = []
    carbs: Optional[float] = 0
    cob: Optional[float] = 0
    profile: Optional[Dict] = None
    patient_name: Optional[str] = "default"

class Oref0Response(BaseModel):
    recommended_insulin: float
    basal_rate: float
    target_bg: float
    current_bg: float
    eventual_bg: float
    iob: float
    bgi: float
    deviation: float
    smb_enabled: bool
    reason: str
    timestamp: str

app = FastAPI(
    title="Orchestration Hub & Frontend API",
    version="1.0.0",
    description="DMMS.R 및 여러 AI 서버를 조율하고, 프론트엔드에 데이터를 제공하는 통합 서버입니다.",
    # 여기에 다른 Swagger UI 파라미터를 추가할 수 있습니다.[3][5]
    swagger_ui_parameters={"docExpansion": "none"} # 처음에는 모든 API를 닫힌 상태로 보여줌
)

origins = [
    "*"  # 모든 출처 허용 (개발 및 테스트용)
]

# CORS 미들웨어 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # 허용할 출처 설정
    allow_credentials=True,
    allow_methods=["*"],  # 모든 HTTP 메서드 허용
    allow_headers=["*"],  # 모든 HTTP 헤더 허용
)

# 애플리케이션 시작 시 그래프를 한 번만 컴파일
hub_graph = build_graph()

@app.post("/calculate-decision")
async def calculate_decision(request: Request):
    """Simglucose Controller로부터 요청을 받아 그래프를 실행하고 최종 결정을 반환"""
    
    try:
        simglucose_input_data = await request.json()

        cgm_value = simglucose_input_data.get("current_cgm")
        time = datetime.fromisoformat(simglucose_input_data.get("timestamp"))
        id = 1
        sql_query = f"INSERT INTO cgm_records (id, cgm_value, time) VALUES ({id}, {cgm_value}, '{time}')"
        await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=sql_query, query_type="query")
        

        # 초기 상태 설정 (DMMS 대신 Simglucose 입력 사용)
        initial_state = {"simglucose_input": simglucose_input_data}

        print(f"Backend-Orchestra: Starting LangGraph execution...")
        
        # LangGraph 실행 (invoke는 동기, stream/astream은 비동기 스트리밍)
        final_state = await hub_graph.ainvoke(initial_state)

        print(f"Backend-Orchestra: LangGraph execution completed")
        print(f"   Final state keys: {list(final_state.keys()) if final_state else 'None'}")

        # 최종 결정만 추출하여 반환
        final_decision = final_state.get("final_decision", {})
        recommended_insulin = final_decision.get("recommended_insulin")
        if final_decision.get("algorithm") == "oref0":
            recommended = {
                "basal": recommended_insulin.get("basal"),
                "smb": recommended_insulin.get("smb"),
                "algorithm": "oref0"
            }
            sql_query = f"INSERT INTO insulin_records (id, insulin_amount, time, algorithm) VALUES ({id}, {recommended_insulin.get('basal') + recommended_insulin.get('smb')}, '{time}', 'OREF0')"
            await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=sql_query, query_type="query")
        else:
            recommended = {
                "basal": recommended_insulin,
                "algorithm": "g2p2c"
            }
            sql_query = f"INSERT INTO insulin_records (id, insulin_amount, time, algorithm) VALUES ({id}, {recommended_insulin}, '{time}', 'G2P2C')"
            await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=sql_query, query_type="query")
        

        print(f"Backend-Orchestra: Sending final decision: {final_decision.get('recommended_insulin', 'N/A')} units")
        print(f"   Final decision: {final_decision}")
        
        return recommended
        
    except Exception as e:
        print(f"Backend-Orchestra: Error processing request: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/oref0/calculate", response_model=Oref0Response, tags=["oref0"])
async def calculate_oref0_decision(request: Oref0Request):
    """oref0 알고리즘을 사용하여 인슐린 투여 결정을 계산합니다."""
    try:
        
        # simglucose 형식으로 데이터 변환
        simglucose_data = {
            "current_cgm": request.current_cgm,
            "cgm_history": request.cgm_history,
            "insulin_history": request.insulin_history,
            "carbs": request.carbs,
            "cob": request.cob,
            "profile": request.profile,
            "patient_name": request.patient_name
        }
        
        # oref0 서비스로 결정 계산
        result = oref0_service.process_simglucose_request(simglucose_data)
        
        print(f"Oref0: Decision calculated")
        print(f"   Recommended insulin: {result.get('recommended_insulin', 0)} units")
        print(f"   SMB enabled: {result.get('smb_enabled', False)}")
        
        return Oref0Response(**result)
        
    except Exception as e:
        print(f"Oref0: Error calculating decision: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Oref0 calculation error: {str(e)}")

@app.get("/dashboard/cgm", response_model=List[CgmData], tags=["대시보드"])
async def get_cgm_history(start_date: date, end_date: date = date.today()):
    """혈당 이력 조회 API - MCP를 통해 데이터베이스에서 조회"""
    try:
        if start_date == end_date:
            # 특정 날짜의 상세 데이터 조회 (5분 단위 데이터 포함)
            sql_query = f"""
                SELECT 
                    DATE(time) as query_date,
                    AVG(cgm_value) as cgm_mean,
                    JSON_ARRAYAGG(JSON_OBJECT('time', TIME_FORMAT(time, '%H:%i'), 'cgm', cgm_value)) as cgm_day
                FROM cgm_records 
                WHERE DATE(time) = '{start_date}'
                GROUP BY DATE(time)
            """
        else:
            # 여러 날짜의 평균 데이터 조회
            sql_query = f"""
                SELECT 
                    DATE(time) as query_date,
                    AVG(cgm_value) as cgm_mean
                FROM cgm_records 
                WHERE DATE(time) BETWEEN '{start_date}' AND '{end_date}'
                GROUP BY DATE(time)
                ORDER BY query_date
            """
        
        db_result = await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=sql_query, query_type="query")
        
        processed_results = []
        for row in db_result.get("rows", []):
            day_data = None
            # cgm_day 필드가 있고, 내용이 있을 경우 JSON 문자열을 파이썬 리스트로 변환
            if "cgm_day" in row and row["cgm_day"]:
                day_data = json.loads(row["cgm_day"])
            
            processed_results.append(
                CgmData(
                    date=row["query_date"],
                    cgm_mean=row["cgm_mean"],
                    cgm_day=day_data
                )
            )
        
        return processed_results
        
    except Exception as e:
        print(f"CGM 데이터 조회 실패: {e}")
        # 에러 발생 시 404 Not Found 또는 500 Internal Server Error를 반환하는 것이 더 좋습니다.
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"데이터 조회 중 오류 발생: {e}")

@app.get("/dashboard/insulin", response_model=List[InsulinData], tags=["대시보드"])
async def get_insulin_history(start_date: date, end_date: date = date.today()):
    """인슐린 주입 이력 조회 API - MCP를 통해 데이터베이스에서 조회"""
    try:
        if start_date == end_date:
            # 특정 날짜의 상세 데이터 조회 (5분 단위 데이터 포함)
            sql_query = f"""
                SELECT 
                    DATE(time) as query_date,
                    AVG(insulin_amount) as insulin_mean,
                    algorithm,
                    JSON_ARRAYAGG(JSON_OBJECT('time', TIME_FORMAT(time, '%H:%i'), 'insulin', insulin_amount, 'algorithm', algorithm)) as insulin_day
                FROM insulin_records 
                WHERE DATE(time) = '{start_date}'
                GROUP BY DATE(time), algorithm
            """
        else:
            # 여러 날짜의 평균 데이터 조회
            sql_query = f"""
                SELECT 
                    DATE(time) as query_date,
                    AVG(insulin_amount) as insulin_mean
                FROM insulin_records 
                WHERE DATE(time) BETWEEN '{start_date}' AND '{end_date}'
                GROUP BY DATE(time)
                ORDER BY query_date
            """

        db_result = await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=sql_query, query_type="query")

        processed_results = []
        for row in db_result.get("rows", []):
            day_data = None
            if "insulin_day" in row and row["insulin_day"]:
                day_data = json.loads(row["insulin_day"])

            processed_results.append(
                InsulinData(
                    date=row["query_date"],
                    insulin_mean=row["insulin_mean"],
                    insulin_day=day_data
                )
            )
            
        return processed_results

    except Exception as e:
        print(f"인슐린 데이터 조회 실패: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"데이터 조회 중 오류 발생: {e}")

@app.get("/chat", response_model=List[ChatRoom], tags=["LLM채팅"])
async def get_chat_list():
    """채팅 리스트 조회 API (최근 100개, 최신순) - MCP를 통해 데이터베이스에서 조회"""
    try:
        sql_query = """
            SELECT 
                chat_id,
                chat_name
            FROM chat_rooms 
            ORDER BY chat_id DESC
            LIMIT 100 
        """
        # 디버깅을 위해 잠깐 100개로 수정.
        
        # MCP를 통해 데이터베이스에서 조회
        db_result = await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=sql_query, query_type="query")
        
        # 결과를 응답 모델에 맞게 변환
        result = []
        for row in db_result.get("rows", []):
            result.append({
                "chat_id": row["chat_id"],
                "chat_name": row["chat_name"]
            })
        
        return result
        
    except Exception as e:
        print(f"채팅 리스트 조회 실패: {e}")
        # 에러 발생 시 기본 데이터 반환
        return [
            {"chat_id": 1, "chat_name": "어제 저녁 식사 관련 문의"},
            {"chat_id": 2, "chat_name": "운동 후 혈당 변화"}
        ]

@app.post("/chat", status_code=201, tags=["LLM채팅"])
async def create_chat_room():
    """
    새로운 채팅방을 생성합니다.
    """
    try:
        # 1. 이 요청만을 위한 고유한 영수증 번호(UUID)를 생성
        new_uuid = str(uuid.uuid4())

        # 2. INSERT 쿼리에 생성한 UUID를 함께 저장
        insert_query = f"""
            INSERT INTO chat_rooms (id, chat_name, uuid)
            VALUES (1, '새로운 채팅방', '{new_uuid}')
        """
        await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=insert_query, query_type="query")

        # 3. LAST_INSERT_ID() 대신, 우리가 아는 UUID를 사용해 방금 생성된 chat_id를 안전하게 조회
        get_id_query = f"SELECT chat_id FROM chat_rooms WHERE uuid = '{new_uuid}'"
        id_result = await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=get_id_query, query_type="query")

        # 결과가 없는 경우에 대한 방어 코드
        if not id_result.get("rows"):
            raise Exception("새로 생성된 채팅방의 chat_id를 가져오는데 실패했습니다.")

        new_chat_id = id_result["rows"][0]["chat_id"]

        # 4. 조회한 올바른 chat_id를 클라이언트에 반환
        return {"message": "새로운 채팅방이 생성되었습니다.", "chat_id": new_chat_id}
    except Exception as e:
        print(f"채팅방 생성 실패: {e}")
        return {"message": "채팅방 생성 실패", "error": str(e)}

@app.get("/chat/{chat_id}", response_model=ChatDetailsResponse, tags=["LLM채팅"])
async def get_chat_messages(chat_id: int = Path(..., title="채팅방 ID")):
    """채팅별 상세 메시지 조회 API - MCP를 통해 데이터베이스에서 조회"""
    try:

        # 두 개의 쿼리 준비
        chat_name_query = f"SELECT chat_name FROM chat_rooms WHERE chat_id = {chat_id}"
        messages_query = f"""
            SELECT 
                created_at as date,
                message
            FROM chat_messages 
            WHERE chat_id = {chat_id}
            ORDER BY created_at ASC
        """
        
        # asyncio.gather를 사용하여 두 DB 조회를 병렬로 실행
        chat_name_result, messages_result = await asyncio.gather(
            query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=chat_name_query, query_type="query"),
            query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=messages_query, query_type="query")
        )

        # chat_name 조회 결과를 처리하고, 채팅방이 없는 경우 404 에러를 반환
        if not chat_name_result.get("rows"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat room with id {chat_id} not found")
        
        chat_name = chat_name_result["rows"][0].get("chat_name", "이름 없음")


        processed_messages = []
        idx = 0
        for row in messages_result.get("rows", []):
            idx += 1
            if row.get("message"):
                message_text = row["message"]
                
                try: # JSON 파싱 시도
                    parsed_data = json.loads(message_text)
                    if isinstance(parsed_data, dict) and 'role' in parsed_data:
                        role = parsed_data.get("role", "unknown")
                        content = parsed_data.get("content", "")
                        processed_messages.append(Message(msg_id=idx, date=row["date"], who=role, msg=content))
                    else:
                        processed_messages.append(Message(msg_id=idx, date=row["date"], who="unknown", msg=str(parsed_data)))
                except json.JSONDecodeError:
                    try: # 깨진 JSON에서 content 추출 시도
                        if message_text.startswith('{"') and '"content":' in message_text:
                            content_match = re.search(r'"content":\s*"([^"]*(?:\\.[^"]*)*)"', message_text)
                            if content_match:
                                content = content_match.group(1).replace('\\"', '"').replace('\\n', '\n')
                                who = "assistant" if 'assistant' in message_text else "user"
                                processed_messages.append(Message(msg_id=idx, date=row["date"], who=who, msg=content))
                                continue
                    except Exception as re_error:
                        print(f"WARN: 정규식 추출도 실패: {re_error}")
                    
                    # 모든 시도 실패 시 일반 텍스트로 처리
                    who = "user" if idx % 2 == 1 else "assistant"
                    processed_messages.append(Message(msg_id=idx, date=row["date"], who=who, msg=message_text))
        
        # 최종 결과를 새로운 응답 모델 형식에 맞춰 조합하여 반환
        return ChatDetailsResponse(
            chat_name=chat_name,
            messages=processed_messages
        )
        
    except HTTPException as e:
        # 의도된 404 에러는 그대로 다시 발생
        raise e
    except Exception as e:
        # 그 외 예상치 못한 모든 서버 에러를 처리
        print(f"채팅 메시지 조회 중 서버 오류 발생: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {e}"
        )

@app.delete("/chat/{chat_id}", tags=["LLM채팅"])
async def delete_chat_room(chat_id: int = Path(..., title="삭제할 채팅방 ID")):
    """
    채팅방과 관련된 모든 메시지를 삭제
    - chat_id: 삭제할 채팅방의 고유 ID
    """
    print(f"채팅방 삭제 요청: chat_id={chat_id}")

    try:
        # 삭제 전 채팅방이 실제로 존재하는지 확인
        check_query = f"SELECT COUNT(*) as count FROM chat_rooms WHERE chat_id = {chat_id}"
        check_result = await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=check_query)
        
        if not check_result.get("rows") or check_result["rows"][0]["count"] == 0:
            # 존재하지 않는 채팅방일 경우, 404 Not Found 에러를 반환
            return JSONResponse(
                content={"success": False, "error": f"Chat room with id {chat_id} not found."},
                status_code=status.HTTP_404_NOT_FOUND
            )

        # 해당 채팅방의 모든 메시지를 먼저 삭제
        delete_messages_query = f"DELETE FROM chat_messages WHERE chat_id = {chat_id}"
        await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=delete_messages_query)
        
        # 채팅방 자체를 삭제
        delete_room_query = f"DELETE FROM chat_rooms WHERE chat_id = {chat_id}"
        await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=delete_room_query)

        # 모든 과정이 성공적으로 끝나면 성공 응답을 반환
        return JSONResponse(
            content={"success": True, "error": None},
            status_code=status.HTTP_200_OK
        )

    except Exception as e:
        # DB 연결 오류 등 예상치 못한 에러가 발생했을 경우
        print(f"채팅방 삭제 중 서버 오류 발생: {e}")
        # 500 Internal Server Error를 반환
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while deleting the chat room: {e}"
        )

@app.post("/chat/{chat_id}/message", tags=["LLM채팅"])
async def send_chat_message(
    chat_id: int = Path(..., title="채팅방 ID"),
    new_message: NewMessage = None
):
    """채팅 메시지 전송 및 LLM 응답 생성 API
    
    input
    채팅 아이디 : int
    입력할 메시지 : NewMessage
    
    inside 
    [채팅 아이디를 통해 조사한 채팅 내역 Data].append(입력할 메시지, 모델 응답)
    
    Output
    모델 응답 : NewMessage
    
    Warnings
    모델 응답은 전체 AIMessage, ToolMessage 내용을 담고 있음."""
    if not new_message or not new_message.msg:
        return {"message": "메시지가 비어있습니다.", "llm_response": ""}

    chat_history = []
    try:
        import json
        #DB에서 전체 대화 기록 조회
        history_query_template = "SELECT message FROM chat_messages WHERE chat_id = %s ORDER BY created_at ASC"
        db_result = await query_db_mcp(
            db_id=config.GLUCOBEAT_DB_ID,
            query=history_query_template,
            params=(chat_id,), # 튜플 형태로 전달
            query_type="query"
        )
        
        for row in db_result.get("rows"):
            if row.get("message"):
                message_text = json.loads(row["message"])
                chat_history.append(message_text)
                
    except Exception as e:
        print(f"WARN: DB에서 채팅 기록 조회 실패: {e}")
        chat_history = []

    # LLM으로 응답 처리하기 (Process)
    # 사용자 메시지를 메모리에만 추가 (아직 DB에 저장하지 않음)
    user_message = {"role": "user", "content": new_message.msg}
    chat_history.append(user_message)

    llm_task = agent_chat_with_claude(chat_history)
    title_task = None

    # 첫 메시지인 경우, 제목 생성 작업을 병렬로 실행
    if len(chat_history) == 1:
        print("DEBUG: 첫 번째 메시지 감지 - 병렬 처리 시작")
        title_task = generate_and_update_chat_title(chat_id, new_message.msg)
        # asyncio.gather를 사용하여 두 작업을 동시에 실행
        results = await asyncio.gather(llm_task, title_task)
        new_ai_messages = results[0]
        # generated_title = results[1] # 필요 시 사용
    else:
        new_ai_messages = await llm_task

    
    # 모든 새 메시지 한번에 저장
    # 저장할 메시지 리스트 = [사용자 메시지] + [새 AI 메시지들]
    messages_to_save = [user_message] + new_ai_messages
    
    try:
        insert_sql = "INSERT INTO chat_messages (chat_id, message) VALUES (%s, %s)"
        for message_to_save in messages_to_save:
            message_json_string = json.dumps(message_to_save, ensure_ascii=False)
            await query_db_mcp(
                db_id=config.GLUCOBEAT_DB_ID,
                query=insert_sql,
                params=(chat_id, message_json_string),
                query_type="query"
            )
    except Exception as e:
        # 이 단계에서 에러가 나면 사용자에게는 응답을 주되, DB 저장 실패를 로깅
        print(f"ERROR: 새 메시지 DB 저장 실패: {e}")
        # 여기서 트랜잭션 롤백 등을 고려할 수 있음

    return {
        "message": "메시지 전송 및 응답 생성 성공", 
        "llm_response": new_ai_messages,  # 전체 AI/Tool 메시지 시퀀스
        "llm_full_context": chat_history, # 모델에게 주어진 전체 콘텍스트
        "chat_history_length": len(chat_history)  # 디버깅용
    }
    
@app.post("/chat/{chat_id}/message/stream", tags=["LLM채팅 (스트리밍 데모)"])
async def stream_chat_message(
    request: Request,
    background_tasks: BackgroundTasks,
    chat_id: int = Path(..., title="채팅방 ID"),
    new_message: NewMessage = None
):
    """LLM 응답을 스트리밍으로 전송하는 API (데모 버전)"""
    if not new_message or not new_message.msg:
        return {"message": "메시지가 비어있습니다."}

    # DB에서 기록 불러오기
    chat_history = []
    try:
        # 파라미터화된 쿼리로 이전 대화 기록을 안전하게 조회
        # 파라미터화된 쿼리로 이전 대화 기록을 안전하게 조회
        history_query = "SELECT message FROM chat_messages WHERE chat_id = %s ORDER BY created_at ASC"
        history_result = await query_db_mcp(
            db_id=config.GLUCOBEAT_DB_ID,
            query=history_query,
            params=(chat_id,),  # 파라미터 전달
            query_type="query"
        )
        for row in history_result.get("rows", []):
            chat_history.append(json.loads(row["message"]))
    except Exception as e:
        print(f"WARN: DB 조회 실패: {e}")

    # 첫 메시지인지 판단하고, 맞다면 진단 정보 추가
    
    # 사용자가 보낸 실제 메시지 내용을 먼저 정의
    # 사용자가 보낸 실제 메시지 내용을 먼저 정의
    user_content = new_message.msg
    is_first_message = not chat_history # 첫 메시지 판단 조건 수정 (길이가 0이면 True)
    is_first_message = not chat_history # 첫 메시지 판단 조건 수정 (길이가 0이면 True)

    if is_first_message:
        print(f"DEBUG: 첫 메시지 감지 (chat_id: {chat_id}). 진단 정보 추가 및 제목 생성 시작.")
        
        # 제목 생성은 백그라운드에서 실행
        # 제목 생성은 백그라운드에서 실행
        background_tasks.add_task(generate_and_update_chat_title, chat_id, new_message.msg)
        
        try:
            # 파라미터화된 쿼리로 진단 정보 조회
            # 파라미터화된 쿼리로 진단 정보 조회
            diag_query = "SELECT dia_message FROM diagnosis WHERE id = %s ORDER BY created_at DESC LIMIT 1"
            diagnosis_result = await query_db_mcp(
                db_id=config.GLUCOBEAT_DB_ID,
                query=diag_query,
                params=(1,) # user_id=1로 가정
            )
            
            # diagnosis_text = diagnosis_result["rows"][0]["dia_message"]
            system_message = {
                "role": "system",
                "content": (
                    "[시스템 참고사항: 아래는 의사 진단 내용입니다. 이 내용을 참고하여 다음 질문에 답변하세요.]\n"
                    f"[{diagnosis_result}]"
                )
            }
            chat_history.append(system_message) # 대화 목록 맨 앞에 추가
            
            print(f"첫 메시지 관련 처리 완료한 챗 히스토리 : {chat_history}")
        except Exception as e:
            print(f"WARN: 진단 정보 조회 또는 추가 실패: {e}")

    # 최종 메시지 객체 생성 및 스트리밍 시작
    user_message = {"role": "user", "content": user_content}
    chat_history.append(user_message)

    return StreamingResponse(
        _stream_generator(request, chat_id, user_message, chat_history),
        media_type="text/event-stream"
    )

async def _stream_generator(
    request: Request,
    chat_id: int,
    user_message: dict,
    chat_history: list
):
    """스트림을 생성하고, 종료 후 DB에 저장하는 생성기 함수"""
    
    new_messages_from_llm = [] # DB에 저장할 AI 메시지를 수집하는 리스트
    current_assistant_message = "" # 스트리밍 중인 텍스트 조각을 모으는 변수
    
    print(f"실제로 LLM이 보는 입력 : {chat_history}")

    try:
        # LLM 스트리밍 서비스 호출
        async for event_str in agent_chat_with_claude_stream(chat_history):
            # 클라이언트 연결이 끊어졌는지 확인
            if await request.is_disconnected():
                print("클라이언트 연결이 끊어졌습니다. 스트리밍을 중단합니다.")
                break

            # 백엔드에서 받은 이벤트 문자열(event_str)을 그대로 클라이언트에 전달
            yield event_str
            
            # DB 저장을 위해 내부적으로 메시지 수집
            # 'data: ' 접두사를 제거하고 JSON 파싱
            if event_str.strip().startswith("data:"):
                json_str = event_str.strip()[6:]
                try:
                    event_data = json.loads(json_str)
                    event_type = event_data.get("type")
                    content = event_data.get("content")

                    if event_type == "text":
                        current_assistant_message += content
                    elif event_type == "tool_call":
                        # Tool 사용 기록을 저장 형식에 맞게 추가
                        new_messages_from_llm.append({
                            "role": "tool_call", 
                            "content": str(content)
                        })
                    elif event_type == "tool_result":
                        # Tool 사용 결과도 저장 형식에 맞게 추가
                        new_messages_from_llm.append({
                            "role": "tool_result", 
                            "content": str(content)
                        })
                    # 필요 시 tool_result 등 다른 타입도 수집 가능
                except json.JSONDecodeError:
                    pass # 파싱 오류는 무시

    except Exception as e:
        print(f"스트리밍 생성 중 오류 발생: {e}")
        # 클라이언트에게 에러 이벤트를 전송
        error_event = {"type": "error", "content": "스트리밍 중 서버 오류가 발생했습니다."}
        yield f"data: {json.dumps(error_event)}\n\n"
    
    finally:
        # 스트림이 정상 또는 비정상 종료된 후 항상 실행 
        print("스트림이 종료되었습니다. DB 저장을 시도합니다.")
        
        # 지금까지 수집된 assistant 텍스트 메시지를 최종 저장 목록에 추가
        if current_assistant_message:
            new_messages_from_llm.append({"role": "assistant", "content": current_assistant_message})

        # 저장할 메시지 = [사용자 메시지] + [수집된 AI 메시지들]
        messages_to_save = [user_message] + new_messages_from_llm
        
        print(f"저장할 메시지 : {messages_to_save}")

        try:
            insert_sql = "INSERT INTO chat_messages (chat_id, message) VALUES (%s, %s)"
            for msg in messages_to_save:
                msg_str = json.dumps(msg, ensure_ascii=False)
                await query_db_mcp(
                    db_id=config.GLUCOBEAT_DB_ID,
                    query=insert_sql,
                    params=(chat_id, msg_str),
                    query_type="query"
                )
            print("DB 저장이 완료되었습니다.")
        except Exception as e:
            print(f"ERROR: 스트림 종료 후 DB 저장 실패: {e}")


@app.get("/reports", response_model=List[ReportInfo], tags=["리포트"])
async def get_reports_list(user_id: int):
    """특정 사용자의 모든 리포트 목록을 최신순으로 조회합니다."""
    try:
        # 특정 사용자의 리포트 목록을 최신 생성일 순으로 조회하는 쿼리
        sql_query = f"""
            SELECT report_id, report_title, created_at
            FROM user_reports
            WHERE id = {user_id}
            ORDER BY created_at DESC
        """
        
        db_result = await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=sql_query, query_type="query")
        
        # DB 조회 결과를 ReportInfo 모델 리스트로 변환
        reports = [ReportInfo(**row) for row in db_result.get("rows", [])]
        
        return reports

    except Exception as e:
        print(f"리포트 목록 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"리포트 목록을 조회하는 중 오류가 발생했습니다: {e}"
        )

@app.get("/reports/{report_id}", response_model=ReportDetail, tags=["리포트"])
async def get_report_detail(report_id: int = Path(..., title="조회할 리포트의 ID")):
    """특정 리포트의 상세 내용을 조회합니다."""
    try:
        # 특정 report_id에 해당하는 리포트의 모든 정보를 조회하는 쿼리
        sql_query = f"""
            SELECT report_id, id, report_title, report_contents, created_at
            FROM user_reports
            WHERE report_id = {report_id}
        """

        db_result = await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=sql_query, query_type="query")
        
        # 조회 결과가 없으면 404 Not Found 에러를 반환
        if not db_result.get("rows"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Report with id {report_id} not found")
        
        # DB 조회 결과를 ReportDetail 모델로 변환하여 반환
        report_data = db_result["rows"][0]
        return ReportDetail(**report_data)

    except HTTPException as e:
        # 404 에러는 그대로 다시 발생시킴
        raise e
    except Exception as e:
        print(f"리포트 상세 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"리포트를 조회하는 중 오류가 발생했습니다: {e}"
        )



# 리포트를 생성하고 바로 질문하는 새로운 API
@app.post("/reports", tags=["리포트"], status_code=status.HTTP_201_CREATED)
async def create_report_and_ask_question():
    """
    (수정됨) Request Body 없이 호출하면, LLM이 자동으로 주간 리포트와 제목을 생성하고,
    그 결과(DB 조회 결과 제외)를 DB에 저장합니다.
    """

    # 새로운 리포트 레코드 생성
    new_report_id = None
    try:
        new_uuid = str(uuid.uuid4())
        placeholder_title = "새로운 리포트 (생성 중...)"
        
        insert_sql = "INSERT INTO user_reports (uuid, id, report_title, report_contents) VALUES (%s, %s, %s, %s)"
        await query_db_mcp(
            db_id=config.GLUCOBEAT_DB_ID,
            query=insert_sql,
            params=(new_uuid, 1, placeholder_title, "리포트 생성 중..."),
            query_type="query"
        )
        get_id_query = "SELECT report_id FROM user_reports WHERE uuid = %s"
        id_result = await query_db_mcp(
            db_id=config.GLUCOBEAT_DB_ID,
            query=get_id_query,
            params=(new_uuid,),
            query_type="query"
        )
        if not id_result.get("rows"):
            raise Exception("새로 생성된 리포트의 ID를 가져오는데 실패했습니다.")
        new_report_id = id_result["rows"][0]["report_id"]
        print(f"새로운 리포트 레코드 생성 완료 (report_id: {new_report_id})")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB에 리포트 레코드 생성 실패: {e}")

    # LLM을 이용한 리포트 내용 생성
    report_generation_prompt = (
        "오늘로부터 일주일 간의 혈당 데이터를 분석해서, 사용자가 자신의 건강 상태를 "
        "한눈에 파악할 수 있는 주간 리포트를 작성해주세요. "
        "html 태그 제외한 부분에 '<','>' 쓰지 말아주세요. "
        "출력 형식은 반드시 React 컴포넌트(JSX)여야 해야해요. "
    )
    chat_history_for_report = [{"role": "user", "content": report_generation_prompt}]

    try:
        llm_full_trace = await agent_chat_with_claude(chat_history_for_report)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM으로 리포트 생성 중 오류 발생: {e}")
        
    # 생성된 리포트 내용을 기반으로 제목 자동 생성
    final_answer_message = {}
    if llm_full_trace:
        for message in reversed(llm_full_trace):
            if message.get("role") == "assistant" and message.get("content"):
                final_answer_message = message
                break
    
    report_content_for_title = final_answer_message.get("content", "")
    
    generated_title = await generate_and_update_report_title(
        report_id=new_report_id, 
        report_content=report_content_for_title
    )

    # DB 조회 결과를 제외하고 최종 내용 저장
    
    messages_to_save = [
        msg for msg in llm_full_trace if msg.get("role") != "tool"
    ]
    report_contents_json = json.dumps(messages_to_save, ensure_ascii=False)

    try:
        update_sql = "UPDATE user_reports SET report_title = %s, report_contents = %s WHERE report_id = %s"
        await query_db_mcp(
            db_id=config.GLUCOBEAT_DB_ID,
            query=update_sql,
            params=(generated_title, report_contents_json, new_report_id),
            query_type="query"
        )
        print(f"리포트 내용 및 제목 업데이트 완료 (report_id: {new_report_id}, title: '{generated_title}')")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"생성된 리포트 DB 업데이트 실패: {e}")

    # 최종 결과 반환
    return {
        "message": "새로운 리포트 및 제목 자동 생성 성공",
        "new_report_id": new_report_id,
        "generated_title": generated_title,
        "final_answer": final_answer_message,
    }

@app.delete("/reports/{report_id}", tags=["리포트"], status_code=status.HTTP_200_OK)
async def delete_report(report_id: int = Path(..., title="삭제할 리포트의 ID")):
    """
    특정 ID를 가진 리포트를 데이터베이스에서 삭제합니다.
    """
    print(f"리포트 삭제 요청: report_id={report_id}")

    try:
        # 삭제 전, 리포트가 실제로 존재하는지 확인
        check_query = f"SELECT COUNT(*) as count FROM user_reports WHERE report_id = {report_id}"
        check_result = await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=check_query)
        
        if not check_result.get("rows") or check_result["rows"][0].get("count", 0) == 0:
            # 존재하지 않는 리포트일 경우, 404 Not Found 에러를 반환
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report with id {report_id} not found."
            )

        # 리포트가 존재하면 삭제 쿼리를 실행
        delete_query = f"DELETE FROM user_reports WHERE report_id = {report_id}"
        await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=delete_query)

        # 모든 과정이 성공적으로 끝나면 성공 응답을 반환
        return JSONResponse(
            content={"success": True, "message": f"리포트(id: {report_id})가 성공적으로 삭제되었습니다."},
            status_code=status.HTTP_200_OK
        )

    except HTTPException as e:
        # 404 에러는 그대로 다시 발생시킴
        raise e
    except Exception as e:
        # 그 외 DB 연결 오류 등 예상치 못한 에러가 발생했을 경우 500 에러를 반환
        print(f"리포트 삭제 중 서버 오류 발생: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while deleting the report: {e}"
        )
  
@app.get("/diagnosis", response_model=List[DiagnosisInfo], tags=["진단서"])
async def get_diagnosis_list(user_id: int):
    """특정 사용자의 모든 진단서 목록을 최신순으로 조회합니다."""
    try:
        # 특정 사용자의 진단서 목록을 최신 생성일 순으로 조회
        sql_query = f"""
            SELECT dia_id, dia_message, created_at
            FROM diagnosis
            WHERE id = {user_id}
            ORDER BY dia_id DESC
        """
        
        db_result = await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=sql_query, query_type="query")
        
        processed_results = []
        for row in db_result.get("rows", []):
            # 진단 내용의 일부를 미리보기로 생성 : 앞 20자까지만 보여줌
            preview_text = (row['dia_message'][:20] + '...') if len(row['dia_message']) > 20 else row['dia_message']
            
            processed_results.append(
                DiagnosisInfo(
                    dia_id=row['dia_id'],
                    diagnosis_preview=preview_text,
                    created_at=row['created_at']
                )
            )
        return processed_results

    except Exception as e:
        print(f"진단서 목록 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"진단서 목록을 조회하는 중 오류가 발생했습니다: {e}"
        )

@app.get("/diagnosis/{dia_id}", response_model=DiagnosisDetail, tags=["진단서"])
async def get_diagnosis_detail(dia_id: int = Path(..., title="조회할 진단서의 ID")):
    """특정 진단서의 상세 내용을 조회합니다."""
    try:
        # 특정 dia_id에 해당하는 진단서의 정보를 조회하는 쿼리
        sql_query = f"""
            SELECT dia_id, dia_message, created_at, dia_llm_message
            FROM diagnosis
            WHERE dia_id = {dia_id}
        """

        db_result = await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=sql_query, query_type="query")
        
        if not db_result.get("rows"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Diagnosis with id {dia_id} not found")
        
        row = db_result["rows"][0]

        if row.get("dia_llm_message") is None:

            diagnosis_generation_prompt = (
            "당신의 역할: 건강 조언자로서, 기존 의사의 진단을 간단하고 평이한 언어로 설명하고, 그 진단에 엄격히 기반한 실생활 추천을 제공합니다."

            "- 새로운 분석, 추가 진단, 재해석, 또는 명시되지 않은 의학적 해석을 추가하지 마세요."
            "- 주어진 의사의 진단 메시지에만 충실히 따르세요."
            f"- 여기 의사의 진단 메시지가 있습니다: '{row['dia_message']}'."

            "출력 지침: "
            "- 진단을 쉬운 용어로 요약 설명한 후, 바로 이어서 식단 조절, 운동, 상담 등 진단 관련 상세 조언을 제공하세요. "
            "- 전체를 제목, bullet points, 목록 없이 연속된 자연스러운 단락으로 작성하세요. 하나의 흐르는 글처럼요. "
            "- 조언은 길고 상세하게, 일반적·비의학적으로 하되, 이는 전문 치료 대체가 아님을 강조하세요. "
            "- Markdown으로 **굵은 글씨**나 *기울임*을 사용하지 마세요. 색상도 사용하지 마세요. 아무 꾸밈도 없이 순수 텍스트로 작성하세요. "
            "- 출력은 순수 텍스트만, HTML 태그, '<', '>', JSX 없이. "
            )
            chat_history_for_diagnosis = [{"role": "user", "content": diagnosis_generation_prompt}]

            try:
                llm_full_trace = await agent_chat_with_claude(chat_history_for_diagnosis)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"LLM으로 리포트 생성 중 오류 발생: {e}")
            
            generated_diagnosis = llm_full_trace[0].get("content", "") if llm_full_trace else ""

            diagnosis_contents_json = json.dumps(generated_diagnosis, ensure_ascii=False)

            try:
                update_sql = "UPDATE diagnosis SET dia_llm_message = %s WHERE dia_id = %s"
                await query_db_mcp(
                    db_id=config.GLUCOBEAT_DB_ID,
                    query=update_sql,
                    params=(diagnosis_contents_json, dia_id),
                    query_type="query"
                )
                print(f"진단서 내용 업데이트 완료 (dia_id: {dia_id})")

                row["dia_llm_message"] = diagnosis_contents_json
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"생성된 진단서 DB 업데이트 실패: {e}")
        
        return DiagnosisDetail(**row)

    except HTTPException as e:
        # 404 에러는 그대로 다시 발생시킴
        raise e
    except Exception as e:
        print(f"진단서 상세 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"진단서를 조회하는 중 오류가 발생했습니다: {e}"
        )
    
if __name__ == "__main__":
        uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True # 개발 중에는 reload 옵션 활성화
    )
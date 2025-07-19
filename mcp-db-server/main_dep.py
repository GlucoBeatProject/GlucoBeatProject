# mcp-db-server/main.py
import uvicorn
import mysql.connector
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional

from config import settings, db_config

# --- Pydantic 모델 정의 ---
class RequestParams(BaseModel):
    query: str

class MCPRequest(BaseModel):
    method: str
    params: RequestParams
    context: Optional[Dict[str, Any]] = None

class ErrorDetail(BaseModel):
    code: int = Field(default=-32602, description="Invalid params")
    message: str

class ErrorResponse(BaseModel):
    error: ErrorDetail

# --- FastAPI 앱 생성 ---
app = FastAPI(
    title="MCP DB Server",
    version="1.0.0",
    description="A proxy server to securely access various databases.",
    swagger_ui_parameters={"docExpansion": "none"}
)

# --- 데이터베이스 연결 풀 관리 ---
# 앱 시작 시 연결 풀 생성, 종료 시 해제 (프로덕션 환경에 권장)
# 여기서는 간단하게 요청마다 연결/해제
def get_db_connection():
    """데이터베이스 연결을 생성하고 반환합니다."""
    try:
        conn = mysql.connector.connect(**db_config)
        if conn.is_connected():
            return conn
    except mysql.connector.Error as err:
        print(f"DB Connection Error: {err}")
        raise HTTPException(status_code=500, detail=f"Database connection failed: {err}")
    return None

# --- API 엔드포인트 ---
@app.post(
    "/mcp",
    summary="Execute DB Query via MCP",
    response_description="The result of the database query.",
)
async def execute_query(request: MCPRequest):
    """
    MCP 요청을 받아 데이터베이스 쿼리를 실행하고 결과를 반환합니다.

    - **method**: `query_{db_id}` 형식. 현재는 `db_id`를 사용하지 않지만 명세 호환성을 위해 유지.
    - **params**: `query` 필드에 실행할 SQL 쿼리 포함.
    """
    # 1. 요청 유효성 검사 (메서드 형식)
    if not request.method.startswith("query_"):
        return JSONResponse(
            status_code=400,
            content={"error": {"code": -32602, "message": "Invalid method format. Must be 'query_{db_id}'."}}
        )

    sql_query = request.params.query
    if not sql_query:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": -32602, "message": "Query parameter cannot be empty."}}
        )

    # 2. 데이터베이스 연결 및 쿼리 실행
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        # 결과를 딕셔너리 형태로 받기 위해 dictionary=True 설정
        cursor = conn.cursor(dictionary=True)
        
        print(f"Executing query: {sql_query}")
        cursor.execute(sql_query)

        # INSERT, UPDATE, DELETE 등 결과가 없는 쿼리 처리
        if cursor.description is None:
            # LAST_INSERT_ID() 같은 함수를 위해 rowcount는 확인 가능
            result_data = {"affected_rows": cursor.rowcount}
        else:
            rows = cursor.fetchall()
            result_data = {"columns": [i[0] for i in cursor.description], "rows": rows}
        
        # 성공 응답 반환
        return {"jsonrpc": "2.0", "result": result_data, "id": request.context.get("trace_id") if request.context else None}

    except mysql.connector.Error as err:
        print(f"Query Execution Error: {err}")
        # 실패 응답 반환
        return JSONResponse(
            status_code=500,
            content={"error": {"code": -32000, "message": f"Database query failed: {err}"}}
        )
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()

@app.get("/", summary="Server Health Check")
def health_check():
    return {"status": "ok", "message": "MCP DB Server is running."}

# --- 서버 실행 ---
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True # 개발 중에는 reload 옵션 활성화
    )

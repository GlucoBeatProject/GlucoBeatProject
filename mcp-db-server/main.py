# mcp-db-server/main.py
import uvicorn
import mysql.connector
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List, Union

from config import settings, db_config

# 1. RequestParams 모델 수정: 파라미터를 받을 수 있도록 'params' 필드 추가
class RequestParams(BaseModel):
    query: str
    params: Optional[Union[List[Any], tuple]] = None # 파라미터를 받을 수 있는 선택적 필드

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
    version="1.1.0", # 버전 업데이트
    description="A proxy server to securely access various databases. Now supports parameterized queries.",
    swagger_ui_parameters={"docExpansion": "none"}
)

# --- 데이터베이스 연결 풀 관리 ---
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

# --- API 엔드포인트 (수정됨) ---
@app.post(
    "/mcp", # 실제 엔드포인트에 맞게 수정
    summary="Execute DB Query via MCP",
    response_description="The result of the database query.",
)
async def execute_query(request: MCPRequest):
    """
    MCP 요청을 받아 데이터베이스 쿼리를 실행하고 결과를 반환합니다.
    - **새로운 기능**: 요청의 params에 'params' 리스트가 포함된 경우, 파라미터화된 쿼리를 안전하게 실행합니다.
    - **하위 호환성**: 'params' 리스트가 없는 경우, 기존 방식대로 전체 쿼리 문자열을 실행합니다.
    """
    if not request.method.startswith("query_"):
        return JSONResponse(
            status_code=400,
            content={"error": {"code": -32602, "message": "Invalid method format. Must be 'query_{db_id}'."}}
        )

    sql_query = request.params.query
    query_params = request.params.params # 새로운 파라미터 변수

    if not sql_query:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": -32602, "message": "Query parameter cannot be empty."}}
        )

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # --- 2. 파라미터화된 쿼리 실행 로직 (핵심 수정) ---
        if query_params:
            # 파라미터가 있는 경우 (안전한 방식)
            print(f"Executing parameterized query: {sql_query} with params: {query_params}")
            cursor.execute(sql_query, tuple(query_params)) # mysql-connector는 튜플을 요구
        else:
            # 파라미터가 없는 경우 (기존 방식, 하위 호환성)
            print(f"Executing raw query: {sql_query}")
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

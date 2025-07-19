from typing import Any, Dict, Optional, Union
import httpx
import json
from config import config

OREF0_SERVER_URL = config.OREF0_SERVER_URL
G2P2C_SERVER_URL = config.G2P2C_SERVER_URL
DB_MCP_SERVER_URL = config.DB_MCP_SERVER_URL

async def call_oref0_server(simglucose_input: dict) -> dict:
    """OpenAPS oref0 서버를 호출하여 계산 결과를 받습니다."""
    # Simglucose 입력에서 oref0에 필요한 데이터 추출
    async with httpx.AsyncClient() as client:
        response = await client.post(OREF0_SERVER_URL, json=simglucose_input)
        response.raise_for_status()
        return response.json()

# 수정된 call_g2p2c_server 함수 (패딩 로직 포함)

async def call_g2p2c_server(simglucose_input: dict) -> dict:
    """
    G2P2C RL 서버를 호출합니다.
    이 함수 내에서 직접 데이터 길이를 확인하고 12개로 패딩합니다.
    """
    
    # 1. simglucose_input에서 데이터 추출
    current_cgm = simglucose_input.get("current_cgm", 100.0)
    # .copy()를 사용하여 원본 리스트를 변경하지 않도록 합니다.
    cgm_history = simglucose_input.get("cgm_history", []).copy()
    insulin_history = simglucose_input.get("insulin_history", []).copy()
    smb_history = simglucose_input.get("smb_history", []).copy()
    algorithm_history = simglucose_input.get("algorithm_history", []).copy()

    # 2. 각 이력 리스트의 길이가 12 미만일 경우, 앞쪽에 기본값을 채워넣는 패딩 로직
    while len(cgm_history) < 12:
        cgm_history.insert(0, 160) # cgm 이력은 현재 cgm 값으로 채움

    while len(insulin_history) < 12:
        insulin_history.insert(0, 1.0) # 인슐린 이력은 0.0으로 채움

    # 3. G2P2C 서버의 Pydantic 모델과 일치하는 최종 요청 본문 생성
    g2p2c_request = {
        "current_cgm": current_cgm,
        "cgm_history": cgm_history,
        "insulin_history": insulin_history,
        "smb_history": smb_history,
        "algorithm_history": algorithm_history,
        "current_meal": simglucose_input.get("current_meal", 0.0),
        "patient_state": simglucose_input.get("patient_state", {}),
        "patient_name": simglucose_input.get("patient_name", "default-patient"),
        "timestamp": simglucose_input.get("timestamp", "2025-07-18T22:00:00.000000"),
    }

    # 4. G2P2C 서버로 최종 요청 전송
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(G2P2C_SERVER_URL, json=g2p2c_request, timeout=30.0)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            print(f"G2P2C Server returned an error: {e.response.status_code}")
            print(f"Response body: {e.response.text}")
            raise

async def query_db_mcp(
    db_id: str,
    query: str,
    params: Optional[Union[list, tuple]] = None, # 새로운 'params' 인자 추가
    query_type: str = "query"
) -> Dict:
    """
    DB MCP Server를 통해 데이터베이스에 쿼리를 실행합니다.
    이 버전은 하위 호환성을 유지하면서 파라미터화된 쿼리를 지원합니다.

    - 기존 방식 (params=None): query 인자에 완전한 SQL 문자열을 전달합니다. (보안에 취약할 수 있음)
    - 새로운 방식 (params 제공): query에는 SQL 템플릿을, params에는 값의 튜플/리스트를 전달합니다. (안전함)

    Args:
        db_id: 연결할 데이터베이스의 ID (예: "mysql1")
        query: 실행할 SQL 쿼리 문자열 또는 SQL 템플릿
        params: (선택 사항) 쿼리 템플릿에 바인딩할 파라미터 리스트 또는 튜플
        query_type: MCP에서 제공하는 도구의 종류 (예: "query", "schema")

    Returns:
        MCP 서버로부터 받은 결과 딕셔너리
    """
    # MCP 서버에 전달할 페이로드의 'params' 부분을 구성합니다.
    payload_params: Dict[str, Any] = {"query": query}

    # --- 하위 호환성 및 파라미터화 처리의 핵심 로직 ---
    # 만약 'params' 인자가 명시적으로 제공되었다면 (새로운 안전한 방식),
    # 페이로드에 'params' 키를 추가합니다.
    # 이는 DB MCP 서버가 {"query": "...", "params": [...]} 형태를 이해한다고 가정합니다.
    if params is not None:
        payload_params["params"] = params

    # 'params' 인자가 제공되지 않았다면 (기존의 불안전한 방식),
    # payload_params는 {"query": "완성된 SQL 문자열"} 형태를 유지하며,
    # 기존 코드와 완벽하게 동일하게 동작합니다.

    # 전체 HTTP 요청 페이로드를 구성합니다.
    payload = {
        "method": f"{query_type}_{db_id}",
        "params": payload_params,
        "context": {"trace_id": "unique-trace-id"}
    }
    
    headers = {"Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(DB_MCP_SERVER_URL, headers=headers, json=payload, timeout=30.0)
            response.raise_for_status()
            mcp_response = response.json()
            
            if "result" in mcp_response:
                return mcp_response["result"]
            elif "error" in mcp_response:
                raise Exception(f"DB MCP Error: {mcp_response['error']['message']}")
            else:
                raise Exception(f"Unexpected DB MCP response: {mcp_response}")

    except httpx.HTTPStatusError as e:
        print(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
        raise
    except httpx.RequestError as e:
        print(f"An error occurred while requesting {e.request.url!r}: {e}")
        raise
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise
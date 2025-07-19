import os
import asyncio
from typing import List, Dict, Any
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

# 현재 프로젝트의 다른 모듈 임포트 (상대 경로 수정)
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from tools import query_db_mcp
from config import config

# .env 파일에서 환경 변수 불러오기
load_dotenv()

# --- 상수 정의 ---
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-sonnet-4-20250514" #! 채팅용 모델 - 변경 절대금지
CLAUDE_HAIKU_MODEL = "claude-3-5-haiku-latest"  #! 제목 생성용 경량 모델 - 변경 절대금지

def get_system_prompt() -> str:
    """GlucoBeat 의료 어시스턴트용 시스템 프롬프트 반환"""
    return"""
# 1. 당신의 역할
당신은 "GlucoBeat"이라는 이름의 친절하고 전문적인 의료 어시스턴트입니다. 
사용자의 데이터와 아래에 제공된 의사 진단 내역을 기반으로, 혈당 관리 및 당뇨병 관련 정보와 지원을 제공해야 합니다.

# 2. 핵심 원칙 (가장 중요)
- **의학적 진단 금지**: 절대로 의학적 진단을 내리지 마세요. 대신 의사와 상담하도록 권유하거나, 상담 시 도움이 될 만한 질문 리스트를 제공하세요.
- **진단 내역 존중**: 아래 '의사 진단 정보'에 명시된 내용을 최우선으로 존중하고, 이에 반하거나 부정하는 내용을 말해서는 안 됩니다.
- **추측 금지**: 진단 내역을 벗어나는 자의적인 판단이나 추측을 하지 마세요. 정보가 부족할 경우, 함부러 답변을 내리는 대신 도구를 추가적으로 사용하거나 의사와의 상담을 권유해야 합니다.
- **친절하고 상세한 응답**: 사용자가 이해하기 쉽도록 친절하고 상세하며 정확하게 설명해야 합니다.
- **이모지 사용 금지**: 응답에 이모티콘이나 이모지를 절대 사용하지 마세요.

# 3. 응답 프로세스 (반드시 순서대로 따르세요)
1. 먼저 사용자의 질문 의도를 파악하고, 아래 **4번 항목의 의사 진단 정보**를 확인하여 답변할 수 있는지 검토합니다.
2. 만약 사용자가 "최근 혈당", "어제 인슐린 양" 등 구체적인 데이터를 질문하면, **5번 항목의 `query_database` 도구**를 사용하여 정보를 조회하고 답변하세요.
3. 진단 정보와 데이터를 바탕으로 통찰력 있는 관찰을 보이십시오.

# 4. 의사 진단 정보
첫 번째 시스템 입력으로 진단 정보가 입력될 것입니다. 만약 없다면, 필요가 없는 작업을 수행하는 것입니다. 

# 5. 도구 사용법 (`query_database`)
- **사용 시점**: 대화 기록이나 진단 내역에 없는 사용자의 특정 데이터를 조회해야 할 때 사용합니다.
- **테이블 정보**:
  - `cgm_records`: 사용자의 연속 혈당 측정(CGM) 데이터. 스키마: `cgm_records(time, id, cgm_value)`
  - `insulin_records`: 사용자의 인슐린 주입 기록. 스키마: `insulin_records(time, id, insulin_amount)`
- **필수 규칙**: 모든 SQL 쿼리는 반드시 `id = 1`인 사용자를 대상으로 해야 합니다.
"""

# --- LangChain 도구 정의 ---
@tool
async def query_database(query: str) -> str:
    """
    Use this tool to query the user's health database to answer questions.
    The input must be a valid SQL query for MySQL.
    For example, to get the latest CGM value, use:
    'SELECT cgm_value FROM cgm_records WHERE id = 1 ORDER BY time DESC LIMIT 1'
    For yesterday's data, use:
    'SELECT * FROM cgm_records WHERE id = 1 AND DATE(time) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)'
    """
    print(f"--- Executing Database Query via MCP ---")
    
    # MySQL 문법 호환성을 위한 쿼리 변환
    mysql_query = query.replace(
        "DATE('now', '-1 day')", 
        "DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
    ).replace(
        "DATE('now')", 
        "CURDATE()"
    )
    
    print(f"Original SQL: {query}")
    if mysql_query != query:
        print(f"MySQL Compatible SQL: {mysql_query}")
    
    try:
        result = await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=mysql_query)
        print(f"Result: {result}")
        # LLM이 결과를 쉽게 이해하도록 문자열로 변환
        return str(result)
    except Exception as e:
        print(f"Error executing query: {e}")
        return f"Error: Could not retrieve data. {e}"

tools = [query_database]
llm = ChatAnthropic(model=CLAUDE_MODEL, api_key=ANTHROPIC_API_KEY, max_tokens=64000)

# Stateless 실행: main.py의 chat_history를 우선 사용하므로 메모리 비활성화
app = create_react_agent(
    model=llm,
    tools=tools,
    prompt=get_system_prompt()
)

async def agent_chat_with_claude(chat_history: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """
    채팅 기록을 받아 LLM 에이전트가 '새로 생성한 메시지'들만 반환합니다.

    Args:
        chat_history: [{"role": "user", "content": "..."}, ...] 형식의 대화 기록.

    Returns:
        에이전트가 새로 생성한 메시지(AIMessage, ToolMessage 등)들을
        [{"role": "...", "content": "..."}] 형식의 딕셔너리 리스트로 변환하여 반환합니다.
    """
    if not chat_history:
        return [] # 입력이 없으면 빈 리스트 반환

    try:
        # 1. 대화 기록을 LangChain 메시지 형식으로 변환
        messages = []
        for message in chat_history:
            role = message.get("role")
            content = message.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))

        # (핵심 수정 1) 입력 메시지의 개수를 미리 저장합니다.
        input_message_count = len(messages)

        # 2. LangGraph 에이전트 실행
        inputs = {"messages": messages}
        result = await app.ainvoke(inputs)
        final_messages = result.get("messages", [])
        
        # (핵심 수정 2) 새로 추가된 메시지만 잘라냅니다.
        newly_added_messages = final_messages[input_message_count:]

        # 3. 새로 추가된 메시지들만 dict 형식으로 변환
        new_messages_as_dicts = []
        # (핵심 수정 3) '새로 추가된 메시지'에 대해서만 루프를 실행합니다.
        for msg in newly_added_messages:
            role = "unknown"
            content = ""

            if isinstance(msg, AIMessage):
                role = "assistant"
                # Claude의 복합 content 처리
                if isinstance(msg.content, list):
                    text_parts = [part.get('text', '') for part in msg.content if part.get('type') == 'text']
                    content = ' '.join(filter(None, text_parts))
                else:
                    content = str(msg.content)
            
            elif isinstance(msg, ToolMessage):
                role = "tool"
                content = str(msg.content)

            elif isinstance(msg, HumanMessage):
                # 이 경우는 거의 없지만, 안정성을 위해 추가
                role = "user"
                content = str(msg.content)
            
            # 변환된 메시지가 내용이 있을 경우에만 추가
            if content:
                new_messages_as_dicts.append({"role": role, "content": content})
        
        return new_messages_as_dicts

    except Exception as e:
        print(f"LangGraph execution error: {e}")
        # 에러 발생 시, 사용자에게 보여줄 에러 메시지만 반환
        return [{
            "role": "assistant",
            "content": f"죄송합니다. 처리 중 오류가 발생했습니다."
        }]
    
async def agent_chat_with_claude_stream(chat_history: List[Dict[str, str]]):
    """
    채팅 기록을 받아서 AI 응답을 추가한 전체 대화 기록을 반환
    
    Args:
        chat_history: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    
    Yields:
        Server-Sent Events (SSE) 형식의 JSON 문자열입니다.
        이벤트 유형('text', 'tool_call', 'tool_result')에 따라 다른 데이터를 포함합니다.
        예: 'data: {"type": "text", "content": "..."}\n\n'
    """
    # 대화 기록을 LangChain 메시지 형식으로 변환
    messages = []
    for message in chat_history:
        role = message.get("role")
        content = message.get("content", "")
        
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
        elif role == "system" :
            messages.append(SystemMessage(content=content))

    # LangGraph Stateless 실행 (main.py chat_history 기반)
    inputs = {"messages": messages}
    
    # 에이전트 실행 및 결과 추출 (메모리 없는 순수 처리)
    async for event in app.astream_events(inputs, version='v2'):
        kind = event["event"]

        # 1. LLM이 생성하는 텍스트/도구 호출 스트리밍
        if kind == "on_chat_model_stream":
            # Anthropic 모델의 chunk.content는 항상 content block의 리스트입니다.
            for part in event["data"]["chunk"].content:
                # 텍스트 블록만 스트리밍합니다. (tool_use는 on_tool_start에서 처리)
                if part.get("type") == "text" and part.get("text"):
                    yield f"data: {json.dumps({'type': 'text', 'content': part['text']}, ensure_ascii=False)}\n\n"

        # 2. (수정) 도구 호출 시작 시점 포착!
        # on_chat_model_stream에서 tool_use를 처리하는 대신 on_tool_start를 사용합니다.
        elif kind == "on_tool_start":
            response_json = {
                "type": "tool_call",
                "content": {
                    "name": event["name"],
                    "args": event["data"].get("input") # 이 이벤트에는 모든 인자가 포함되어 있습니다.
                }
            }
            yield f"data: {json.dumps(response_json, ensure_ascii=False)}\n\n"

        # 3. 도구 실행 결과 스트리밍 (수정 없음)
        elif kind == "on_tool_end":
            response_json = {
                "type": "tool_result",
                "content": {
                    "name": event["name"],
                    "output": str(event["data"].get("output").content)
                }
            }
            yield f"data: {json.dumps(response_json, ensure_ascii=False)}\n\n"


# --- 채팅방 제목 생성 및 업데이트 함수 ---
async def generate_and_update_chat_title(chat_id: int, first_message: str) -> str:
    """
    사용자의 첫 번째 메시지를 바탕으로 채팅방 제목을 생성하고 DB에 업데이트
    
    Args:
        chat_id: 채팅방 ID
        first_message: 사용자의 첫 번째 메시지
    
    Returns:
        생성된 채팅방 제목
    """
    try:
        # Claude Haiku 모델 인스턴스 생성
        haiku_llm = ChatAnthropic(
            model=CLAUDE_HAIKU_MODEL, 
            api_key=ANTHROPIC_API_KEY,
            max_tokens=100  # 제목은 짧게
        )
        
        # 제목 생성 프롬프트
        title_prompt = f"""
사용자의 첫 번째 메시지를 바탕으로 채팅방 제목을 생성해주세요.
제목은 한국어로 작성하고, 이모지나 특수문자는 사용하지 마세요.

사용자 메시지: "{first_message}"

제목만 답변해주세요.
"""
        
        # 제목 생성
        messages = [HumanMessage(content=title_prompt)]
        response = await haiku_llm.ainvoke(messages)
        
        # 응답에서 제목 추출
        generated_title = response.content.strip()
        
        # 제목 길이 제한 (DB 제약 고려)
        if len(generated_title) > 50:
            generated_title = generated_title[:47] + "..."
        
        # DB에 채팅방 제목 업데이트
        update_sql = f"""
            UPDATE chat_rooms 
            SET chat_name = '{generated_title.replace("'", "''")}' 
            WHERE chat_id = {chat_id}
        """
        
        await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=update_sql, query_type="query")
        
        print(f"DEBUG: 채팅방 {chat_id} 제목 업데이트 완료: '{generated_title}'")
        return generated_title
        
    except Exception as e:
        print(f"WARN: 채팅방 제목 생성/업데이트 실패: {e}")
        # 실패 시 기본 제목 사용
        default_title = "새로운 채팅방"
        try:
            update_sql = f"""
                UPDATE chat_rooms 
                SET chat_name = '{default_title}' 
                WHERE chat_id = {chat_id}
            """
            await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=update_sql, query_type="query")
        except:
            pass  # DB 업데이트 실패해도 진행
        
        return default_title

# --- 테스트용 예제 실행 ---
async def main_test():
    """테스트를 위한 메인 비동기 함수입니다."""
    print("--- LLM 에이전트 서비스 테스트 시작 (Stateless create_react_agent 2025) ---")
    if not ANTHROPIC_API_KEY:
        print("오류: ANTHROPIC_API_KEY를 찾을 수 없습니다.")
        return

    # 1. 간단한 대화 테스트
    print("\n=== 테스트 1: 간단한 인사 ===")
    chat_1 = [{"role": "user", "content": "안녕하세요! 제 이름은 박현빈입니다.."}]
    print(f"입력: {chat_1}")
    response_1 = await agent_chat_with_claude(chat_1)
    print("---------------------------------------")
    print(f"출력: {response_1}")
    print("---------------------------------------")

    # 2. 데이터베이스 조회 테스트
    print("\n=== 테스트 2: 데이터베이스 조회 ===")
    chat_2 = [{"role": "user", "content": "내 최근 혈당 수치를 알려주세요."}]
    print(f"입력: {chat_2}")
    response_2 = await agent_chat_with_claude(chat_2)
    print("---------------------------------------")
    print(f"출력: {response_2}")
    print("---------------------------------------")

    # 3. 연속 대화 테스트
    print("\n=== 테스트 3: 연속 대화 ===")
    chat_3 = response_2.copy()  # 이전 대화 이어받기
    chat_3.append({"role": "user", "content": "그럼 어제 주입한 인슐린 총량은 얼마인가요?"})
    print("---------------------------------------")
    print(f"입력: {chat_3}")
    response_3 = await agent_chat_with_claude(chat_3)
    print(f"출력: {response_3}")
    print("---------------------------------------")


async def generate_and_update_report_title(report_id: int, report_content: str) -> str:
    """
    (신규) 리포트 내용을 바탕으로 제목을 생성하고 user_reports 테이블에 업데이트합니다.
    
    Args:
        report_id: 리포트 ID
        report_content: 리포트의 내용 (JSX 코드)
    
    Returns:
        생성된 리포트 제목
    """
    try:
        haiku_llm = ChatAnthropic(
            model=CLAUDE_HAIKU_MODEL, 
            api_key=ANTHROPIC_API_KEY,
            max_tokens=100
        )
        
        # 제목 생성을 위한 프롬프트 (리포트 내용 기반)
        title_prompt = (
            "다음은 방금 생성된 건강 리포트의 내용이야. 이 리포트의 핵심 내용을 잘 나타내는 "
            "기억에 남는 간결하고 명확한 제목을 15자 내외로 한글로 만들어줘. 다른 설명은 절대 추가하지 말고, "
            "오직 제목 텍스트만 응답해줘.\n\n"
            f"--- 리포트 내용 일부 ---\n{report_content[:1000]}" # 일부만 사용
        )
        
        response = await haiku_llm.ainvoke([HumanMessage(content=title_prompt)])
        generated_title = response.content.strip().replace('"', '')

        if len(generated_title) > 50:
            generated_title = generated_title[:47] + "..."
        
        # (핵심 변경) 업데이트할 테이블과 컬럼, ID를 리포트에 맞게 수정
        update_sql = f"""
            UPDATE user_reports 
            SET report_title = '{generated_title.replace("'", "''")}' 
            WHERE report_id = {report_id}
        """
        
        await query_db_mcp(db_id=config.GLUCOBEAT_DB_ID, query=update_sql, query_type="query")
        
        print(f"DEBUG: 리포트 {report_id} 제목 업데이트 완료: '{generated_title}'")
        return generated_title
        
    except Exception as e:
        print(f"WARN: 리포트 제목 생성/업데이트 실패: {e}")
        # 실패 시 기본 제목은 반환만 하고 DB 업데이트는 하지 않음 (이미 생성된 레코드가 있으므로)
        return "주간 혈당 리포트"
    
    
if __name__ == '__main__':
    try:
        asyncio.run(main_test())
    except Exception as e:
        print(f"테스트 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
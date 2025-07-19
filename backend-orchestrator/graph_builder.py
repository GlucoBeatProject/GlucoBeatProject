from typing import TypedDict, Annotated,List, Dict, Any, Optional
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
# tools.py 파일의 함수들을 임포트
from tools import call_oref0_server, call_g2p2c_server, query_db_mcp
from config import config # config.py에서 db_id를 가져오기 위해 임포트

# --- 1. 상태(State) 정의: 워크플로우의 중앙 데이터 저장소 ---
class HubState(TypedDict):
    # 1. Simglucose에서 받은 초기 입력 데이터
    simglucose_input: Dict[str, Any]

    # 각 모델의 계산 결과
    oref0_result: Dict[str, Any]
    g2p2c_result: Dict[str, Any]

    # 3. 에이전트 간의 대화 기록 (LLM 감독관이 사용)
    messages: Annotated[List[Any], add_messages]

    # 4. 다음에 호출할 노드 이름
    next_node: str

    # 5. 최종 결정 
    final_decision: Dict[str, Any]

async def oref0_node(state: HubState) -> HubState:
    print("--- oref0 서버 호출 ---")
    simglucose_input = state['simglucose_input']
    result = await call_oref0_server(simglucose_input)
    state['oref0_result'] = result
    return state

async def g2p2c_node(state: HubState) -> HubState:
    print("--- G2P2C 서버 호출 ---")
    simglucose_input = state['simglucose_input']
    result = await call_g2p2c_server(simglucose_input)
    state['g2p2c_result'] = result
    return state

async def make_final_decision_node(state: HubState) -> HubState:
    print("--- 최종 결정 생성 ---")
    
    # Simglucose 환경 정보
    current_cgm = state['simglucose_input'].get('current_cgm')
    patient_name = state['simglucose_input'].get('patient_name')
    
    print(f"   Patient: {patient_name}, CGM: {current_cgm:.1f}")
    
    # OREF0과 G2P2C 결과 추출
    oref0_insulin = state['oref0_result'].get('temporaryBasalRate', 0.0)
    oref0_smb = state['oref0_result'].get('smb', 0.0)
    oref0 = {
        'basal': oref0_insulin,
        'smb': oref0_smb
    }
    g2p2c_insulin = state['g2p2c_result'].get('recommended_insulin', 0.0)
    
    print(f"   OREF0 recommendation: {oref0_insulin:.3f} units")
    print(f"   G2P2C recommendation: {g2p2c_insulin:.3f} units")
    
    if current_cgm >= 180 or current_cgm <= 130:
        final_insulin = oref0
        algorithm = "oref0"
    else:
        final_insulin = g2p2c_insulin
        algorithm = "g2p2c"

    state['final_decision'] = {
        "recommended_insulin": final_insulin,
        "oref0_recommendation": oref0_insulin,
        "g2p2c_recommendation": g2p2c_insulin,
        "algorithm": algorithm
    }
    return state

def supervisor_node(state: HubState) -> dict:
    """다음에 실행할 노드를 결정하는 라우터 역할을 합니다."""
    # 간단한 순차적 예시:
    if 'oref0_result' not in state:
        return {"next_node": "oref0"}
    if 'g2p2c_result' not in state:
        return {"next_node": "g2p2c"}
    return {"next_node": "make_final_decision"}


# --- 3. 그래프(Graph) 구축: 워크플로우 설계도 ---

def build_graph():
    graph_builder = StateGraph(HubState)

    # 1. 모든 노드를 그래프에 추가
    graph_builder.add_node("supervisor", supervisor_node)
    graph_builder.add_node("oref0", oref0_node)
    graph_builder.add_node("g2p2c", g2p2c_node)
    graph_builder.add_node("make_final_decision", make_final_decision_node)

    # 2. 엣지 연결
    graph_builder.add_edge(START, "supervisor") # 시작점은 supervisor

    # 3. 조건부 엣지 설정
    graph_builder.add_conditional_edges(
        "supervisor", # supervisor 노드의 결정에 따라
        lambda state: state["next_node"], # next_node 값으로 분기
        {
            "oref0": "oref0",
            "g2p2c": "g2p2c",
            "make_final_decision": "make_final_decision"
        }
    )

    # 4. 각 노드 실행 후 다시 supervisor로 돌아와 다음 할 일 결정
    graph_builder.add_edge("oref0", "supervisor")
    graph_builder.add_edge("g2p2c", "supervisor")
    graph_builder.add_edge("make_final_decision", END) # 최종 결정 후 종료
    
    # 5. 그래프 컴파일
    return graph_builder.compile()
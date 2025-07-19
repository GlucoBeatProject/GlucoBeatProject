# main.py

from datetime import datetime
import sys
from contextlib import asynccontextmanager
from typing import List, Dict, Any

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import uvicorn
from pathlib import Path

# G2P2C 모듈 경로 추가
g2p2c_path = Path(__file__).parent / "G2P2C"
if str(g2p2c_path) not in sys.path:
    sys.path.insert(0, str(g2p2c_path))

from G2P2C.Sim_CLI.g2p2c_agent_api import load_agent, infer_action
from G2P2C.utils.statespace import StateSpace


# --- 1. 전역 상태 변수 및 모델 로딩 ---

app_state: Dict[str, Any] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작 시 무거운 모델을 한 번만 로드합니다."""
    print("--- 서버 시작: G2P2C 에이전트 로드 시작 ---")
    
    agent = load_agent()
    agent.args.mealAnnounce = False
    agent.args.todAnnounce = False
    agent.args.use_carb_announcement = False
    agent.args.n_features = 2
    
    app_state["g2p2c_agent"] = agent
    
    print("--- G2P2C 에이전트 로드 완료 ---")
    yield
    print("--- 서버 종료 ---")
    app_state.clear()


# --- 2. FastAPI 앱 및 Pydantic 모델 정의 ---

app = FastAPI(
    title="G2P2C Inference Server",
    lifespan=lifespan
)

# simglucose_input = {
#     "current_cgm": current_cgm,
#     "cgm_history": self.cgm_history[-12:],  # 최근 12개
#     "insulin_history": self.insulin_history[-12:],  # 최근 12개
#     "smb_history" : self.smb_history[-12:], # 최근 12개
#     "algorithm_history" : self.algorithm_history[-12:], # 최근 12개
#     "current_meal" : current_meal,
#     "patient_state": patient_state,
#     "patient_name": patient_name,
#     "timestamp": current_time.isoformat() if hasattr(current_time, 'isoformat') else str(current_time)
# }

class G2P2CRequest(BaseModel):
    """/predict 엔드포인트의 요청 본문 모델 (클라이언트 형식에 맞게 수정됨)"""
    current_cgm: float
    cgm_history: List[float] = Field(..., description="과거 12개의 혈당 기록 (float 리스트)")
    insulin_history: List[float] = Field(..., description="과거 12개의 인슐린 기록 (float 리스트)")
    smb_history : List[float] = Field(..., description="과거 12개의 smb 기록 (float 리스트)")
    algorithm_history : List[str] = Field(..., description="과거 12개의 algorithm 기록 (str 리스트)")
    current_meal : float
    patient_state: Any
    patient_name: str
    timestamp: str # ISO 형식의 문자열 (예: "2025-07-18T21:40:57.123456")

class InferenceResponse(BaseModel):
    """/predict 엔드포인트의 응답 모델"""
    recommended_insulin: float


# --- 3. 핵심 추론 로직 (헬퍼 함수) ---

def run_g2p2c_inference(agent: Any, input_data: Dict[str, Any]) -> float:
    state_manager = StateSpace(agent.args)
    
    print("Hi")
    
    cgm_history = input_data["cgm_history"]
    insulin_history = input_data["insulin_history"]
    timestamp_str = input_data["timestamp"]
    
    print(cgm_history, insulin_history, timestamp_str)

    if len(cgm_history) < 12 or len(insulin_history) < 12:
        print("입력 데이터의 cgm_history와 insulin_history는 반드시 12개 이상의 항목을 포함해야 합니다.")
    # 최상위 timestamp에서 시간(hour) 정보를 한 번만 추출
    try:
        current_hour = datetime.fromisoformat(timestamp_str).hour
    except ValueError:
        print("timestamp는 반드시 ISO 8601 형식이어야 합니다.")
        raise ValueError("timestamp는 반드시 ISO 8601 형식이어야 합니다.")
    
    print("Hi")

    last_handcraft_features = None
    
    # 이력 데이터로 StateSpace를 순차적으로 업데이트
    for i in range(12):
        # ✅ cgm_history 리스트에서 숫자를 바로 가져와 사용합니다.
        cgm_value = cgm_history[i]
        insulin_value = insulin_history[i]
        
        # state_manager 업데이트 (모든 이력에 동일한 hour 정보 사용)
        _, handcraft_features = state_manager.update(
            cgm=float(cgm_value), ins=float(insulin_value), hour=current_hour
        )

    print(handcraft_features)
    
    # (이하 로직은 동일)
    state_hist_processed = state_manager.state

    insulin_hourly_rate = infer_action(
        agent=agent,
        state_hist_processed=state_hist_processed,
        hc_state_processed=handcraft_features
    )
    final_dose_5min = float(insulin_hourly_rate) / 12.0
    return final_dose_5min

# --- 4. API 엔드포인트 정의 ---

@app.post("/predict", response_model=InferenceResponse)
async def predict(request: G2P2CRequest):
    """
    혈당/인슐린 이력 데이터를 받아 G2P2C 모델을 통해 5분당 인슐린 주입량을 추론합니다.
    """
    try:
        agent = app_state.get("g2p2c_agent")
        if not agent:
            raise HTTPException(status_code=503, detail="에이전트가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.")
            
        recommended_insulin = run_g2p2c_inference(agent, request.dict())
        
        return InferenceResponse(recommended_insulin=recommended_insulin)

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        print(f"추론 중 오류 발생: {e}")
        raise HTTPException(status_code=500, detail="추론 중 서버 내부 오류가 발생했습니다.")
    
# --- 서버 실행 ---
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8002,
        reload=True # 개발 중에는 reload 옵션 활성화
    )
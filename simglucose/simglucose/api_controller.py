from simglucose.controller.base import Controller, Action
import httpx
import asyncio
import numpy as np
import json
from datetime import datetime
from typing import Dict, Any

def convert_numpy_to_json_serializable(obj):
    """NumPy 배열과 기타 JSON 직렬화 불가능한 객체를 변환"""
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, dict):
        return {key: convert_numpy_to_json_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_to_json_serializable(item) for item in obj]
    else:
        return obj

class BackendOrchestraController(Controller):
    """
    Backend-Orchestra 서버와 통신하는 Controller
    """
    
    def __init__(self, init_state=None, backend_url="http://localhost:4000"):
        self.init_state = init_state or 0
        self.state = self.init_state
        self.backend_url = backend_url
        self.cgm_history = []
        self.smb_history = []
        self.basal_history = []
        self.algorithm_history = []
        self.meal_history = []
        self.insulin_history = []
        
    def policy(self, observation, reward, done, **info):
        """
        Backend-Orchestra 서버에 현재 상태를 전송하고 인슐린 결정을 받아옴
        """
        try:
            
            # Simglucose 환경에서 제공하는 실제 데이터 추출
            current_cgm = observation.CGM  # CGM 측정값
            patient_name = info.get('patient_name')
            current_time = info.get('time')
            patient_state = info.get('patient_state', {})
            current_meal = info.get('meal', 0)
            # 데이터 히스토리 업데이트
            self.cgm_history.append(current_cgm)
            if len(self.cgm_history) > 12: 
                self.cgm_history.pop(0)
            
            
            # Simglucose 환경에 맞는 입력 데이터 구성
            simglucose_input = {
                "current_cgm": current_cgm,
                "cgm_history": self.cgm_history[-12:],  # 최근 12개
                "insulin_history": self.insulin_history[-12:],  # 최근 12개
                "smb_history" : self.smb_history[-12:], # 최근 12개
                "algorithm_history" : self.algorithm_history[-12:], # 최근 12개
                "current_meal" : current_meal,
                "patient_state": patient_state,
                "patient_name": patient_name,
                "timestamp": current_time.isoformat() if hasattr(current_time, 'isoformat') else str(current_time)
            }
            
            # JSON 직렬화 가능하도록 데이터 변환
            json_safe_input = convert_numpy_to_json_serializable(simglucose_input)
            
            # Backend-Orchestra 서버에 요청
            insulin_decision = self._call_backend_orchestra(json_safe_input)
            
            # 인슐린 결정 추출 (LangGraph 응답 형식)
            recommended_insulin = insulin_decision

            algorithm = recommended_insulin.get("algorithm")
            if algorithm == "oref0":
                basal_rate = recommended_insulin.get("basal")
                smb = recommended_insulin.get("smb")
                
            else:
                basal_rate = recommended_insulin.get("basal")
                smb = 0

            update_insulin = basal_rate + smb * 0.1

            
            print(f"Final decision: algorithm: {algorithm}, insulin: {basal_rate:.2f} units, smb: {smb:.2f} units")
            
            # 인슐린 히스토리 업데이트  
            self.insulin_history.append(update_insulin)
            if len(self.insulin_history) > 12:
                self.insulin_history.pop(0)
            
            self.smb_history.append(smb)
            if len(self.smb_history) > 12:
                self.smb_history.pop(0)

            self.basal_history.append(basal_rate)
            if len(self.basal_history) > 12:
                self.basal_history.pop(0)

            self.algorithm_history.append(algorithm)
            if len(self.algorithm_history) > 12:
                self.algorithm_history.pop(0)
            
            # Action 생성 (bolus로 인슐린 주입)
            action = Action(basal=basal_rate, bolus=smb)
            
            return action
            
        except Exception as e:
            print(f"Controller error: {e}")
            # 오류 시 안전한 기본값 반환
            return Action(basal=0, bolus=0)
    
    def _call_backend_orchestra(self, simglucose_input: Dict[str, Any]) -> Dict[str, Any]:
        """Backend-Orchestra 서버 호출 (동기 버전)"""
        try:
            # asyncio를 사용해서 비동기 호출을 동기로 변환
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(self._async_call_backend(simglucose_input))
                return result
            finally:
                loop.close()
        except Exception as e:
            print(f"Backend call failed: {e}")
            return {"final_decision": {"recommended_insulin": 0.0}}
    
    async def _async_call_backend(self, simglucose_input: Dict[str, Any]) -> Dict[str, Any]:
        """비동기 Backend-Orchestra 호출"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.backend_url}/calculate-decision",
                    json=simglucose_input,
                    timeout=30.0
                )
                
                response.raise_for_status()
                result = response.json()
                return result
                
        except httpx.TimeoutException:
            print(f"Backend request timed out")
            raise
        except httpx.HTTPStatusError as e:
            print(f"Backend HTTP error {e.response.status_code}: {e.response.text}")
            raise
        except Exception as e:
            print(f"Backend call failed: {e}")
            raise
    
    def add_meal(self, carbs: float):
        """식사 추가 (시뮬레이션 시작 전 설정용, 실제 식사는 scenario에서 자동 처리)"""
        print(f"Pre-simulation meal setup: {carbs}g carbs (actual meals will be handled by scenario + oref0)")
    
    def reset(self):
        """Controller 상태 리셋"""
        self.state = self.init_state
        self.cgm_history = []
        self.insulin_history = []
        self.meal_history = []
        self.smb_history = []
        self.basal_history = []
        self.algorithm_history = []
        print("Controller reset") 
#!/usr/bin/env python3
"""
Simglucose 시뮬레이션 실행 스크립트
Backend-Orchestra Controller를 사용
"""

import sys
import time
from datetime import datetime, timedelta
from simglucose.simulation.scenario import CustomScenario
import numpy as np

try:
    from simglucose.simulation.user_interface import simulate
    print("✅ Successfully imported simglucose.simulation.user_interface")
except ImportError as e:
    print(f"❌ Failed to import simglucose.simulation.user_interface: {e}")
    sys.exit(1)

try:
    from api_controller import BackendOrchestraController
    print("✅ Successfully imported BackendOrchestraController")
except ImportError as e:
    print(f"❌ Failed to import BackendOrchestraController: {e}")
    print("💡 Make sure httpx is installed: pip install httpx")
    sys.exit(1)

def create_custom_patient():
    """
    낮은 초기 혈당을 가진 커스텀 환자 생성
    """
    from simglucose.patient.t1dpatient import T1DPatient
    
    # 기본 환자 파라미터 가져오기
    base_patient = T1DPatient.withName('adolescent#001')
    
    # 초기 상태를 낮은 혈당으로 수정
    # x0_4: 혈장 포도당 (mg/kg), x0_5: 조직 포도당 (mg/kg), x0_13: 피하 포도당 (mg/kg)
    custom_init_state = np.copy(base_patient.init_state)
    
    # 혈당을 110 mg/dL 근처로 낮추기 (타겟 혈당과 비슷하게)
    # Vg (포도당 분포 용적) = 1.6818 dl/kg
    target_bg_mgdl = 110.0
    target_bg_mgkg = target_bg_mgdl * base_patient._params.Vg
    
    # 혈장, 조직, 피하 포도당을 모두 타겟 혈당에 맞게 조정
    custom_init_state[3] = target_bg_mgkg  # x0_4: 혈장 포도당
    custom_init_state[4] = target_bg_mgkg * 0.7  # x0_5: 조직 포도당 (혈장의 70%)
    custom_init_state[12] = target_bg_mgkg  # x0_13: 피하 포도당
    
    # 커스텀 환자 생성
    custom_patient = T1DPatient(
        params=base_patient._params,
        init_state=custom_init_state,
        random_init_bg=False
    )
    
    return custom_patient

def main():
    print("Starting Simglucose with Backend-Orchestra Controller")
    print("=" * 60)
    
    # Backend-Orchestra 서버 연결 확인
    import httpx
    try:
        with httpx.Client() as client:
            response = client.get("http://localhost:4000/docs", timeout=5.0)
            print("Backend-Orchestra server is running")
    except Exception as e:
        print(f"Backend-Orchestra server is not running: {e}")
        print("Please start the Backend-Orchestra server first:")
        print("   cd backend-orchestrator && python main.py")
        return
    
    # Backend-Orchestra Controller 생성
    controller = BackendOrchestraController(
        init_state=0,
        backend_url="http://localhost:4000",
        use_oref0_direct=True  # 새로운 oref0 엔드포인트 사용
    )
    
    print("Controller initialized")
    print("Backend URL: http://localhost:4000")
    print("")
    
    # 3번의 식사 시나리오 자동 설정
    print("Setting up 3 meals automatically:")
    print("   • 아침: 7시, 45g 탄수화물")
    print("   • 점심: 12시, 70g 탄수화물") 
    print("   • 저녁: 18시, 80g 탄수화물")
    print("")
    
    # 낮은 초기 혈당을 가진 커스텀 환자 생성
    print("Creating custom patient with lower initial BG (110 mg/dL)")
    custom_patient = create_custom_patient()
    print(f"   • Initial BG: {custom_patient.observation.Gsub:.1f} mg/dL")
    print("")
    
    # 시뮬레이션 시작 시간 설정 (오늘 자정부터)
    start_time = datetime.combine(datetime.now().date(), datetime.min.time())
    
    # CustomScenario로 3번의 식사 설정
    # (시간, 탄수화물 양) - 시간은 24시간 형식
    meal_scenario = [
        (7, 45),   # 아침 7시, 45g
        (12, 70),  # 점심 12시, 70g
        (18, 80)   # 저녁 18시, 80g
    ]
    
    scenario = CustomScenario(start_time=start_time, scenario=meal_scenario)
    
    print("Starting simulation...")
    print("Make sure Backend-Orchestra server is running on port 4000")
    print("")
    
    try:
        # 커스텀 환경 생성
        from simglucose.simulation.env import T1DSimEnv
        from simglucose.sensor.cgm import CGMSensor
        from simglucose.actuator.pump import InsulinPump
        from simglucose.simulation.sim_engine import SimObj, sim
        
        # 환경 구성요소 생성
        sensor = CGMSensor.withName('Dexcom', seed=1)
        pump = InsulinPump.withName('Insulet')
        
        # 커스텀 환경 생성
        env = T1DSimEnv(custom_patient, sensor, pump, scenario)
        
        # 시뮬레이션 객체 생성
        sim_obj = SimObj(env, controller, timedelta(hours=24), animate=True, path=None)
        
        # 시뮬레이션 실행
        results = sim(sim_obj)
        print("Simulation results:", results)
        
    except KeyboardInterrupt:
        print("\nSimulation stopped by user")
    except Exception as e:
        print(f"\nSimulation error: {e}")
        print("Make sure all servers are running:")
        print("   • Backend-Orchestra: http://localhost:4000")
        print("   • G2P2C Server: http://localhost:8002") 
        print("   • OREF0 Server: http://localhost:8001")
    
    print("\nSimulation completed")

if __name__ == "__main__":
    main() 
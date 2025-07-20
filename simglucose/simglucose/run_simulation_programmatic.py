#!/usr/bin/env python3
"""
Simglucose 시뮬레이션 코드 기반 설정 및 실행 스크립트
터미널 입력 없이 코드로 모든 설정을 직접 제어
"""

import sys
from datetime import datetime, timedelta, time

try:
    from simglucose.simulation.user_interface import simulate
    from simglucose.simulation.env import T1DSimEnv
    from simglucose.sensor.cgm import CGMSensor
    from simglucose.actuator.pump import InsulinPump
    from simglucose.patient.t1dpatient import T1DPatient
    from simglucose.simulation.scenario_gen import RandomScenario
    from simglucose.simulation.scenario import CustomScenario
    from simglucose.simulation.sim_engine import SimObj, sim, batch_sim
    print("Successfully imported simglucose components")
except ImportError as e:
    print(f"Failed to import simglucose components: {e}")
    sys.exit(1)

try:
    from api_controller import BackendOrchestraController
    print("Successfully imported BackendOrchestraController")
except ImportError as e:
    print(f"Failed to import BackendOrchestraController: {e}")
    print("Make sure httpx is installed: pip install httpx")
    sys.exit(1)

def check_backend_server():
    """Backend-Orchestra 서버 연결 확인"""
    import httpx
    try:
        with httpx.Client() as client:
            response = client.get("http://localhost:4000/docs", timeout=5.0)
            print("Backend-Orchestra server is running")
            return True
    except Exception as e:
        print(f"Backend-Orchestra server is not running: {e}")
        print("Please start the Backend-Orchestra server first:")
        print("   cd backend-orchestrator && python main.py")
        return False

def create_simulation_config():
    """시뮬레이션 설정을 코드로 직접 구성"""
    
    # 시뮬레이션 기본 설정
    config = {
        # 시뮬레이션 시간 (1일)
        'sim_time': timedelta(days=1),
        
        # 시작 시간 (오늘 오전 6시)
        'start_time': datetime.combine(datetime.now().date(), time(6, 0)),
        
        # 환자 선택 (adolescent#001~#010, adult#001~#010, child#001~#010)
        'patient_names': ['adolescent#001'],
        
        # CGM 센서 설정
        'cgm_name': 'Dexcom',
        'cgm_seed': 1,
        
        # 인슐린 펌프 설정
        'insulin_pump_name': 'Insulet',
        
        # 결과 저장 경로
        'save_path': './results',
        
        # 애니메이션 여부
        'animate': True,
        
        # 병렬 처리 여부
        'parallel': False
    }
    
    return config

def create_custom_scenario(start_time):
    """커스텀 시나리오 생성"""
    # 식사 시나리오: (시간, 탄수화물량)
    # 시간은 24시간 형식, 탄수화물량은 그램 단위
    meal_scenario = [
        (1, 45),   # 아침: 7시, 45g
        (6, 70),  # 점심: 12시, 70g
        (10, 15),  # 간식: 4시, 15g
        (12, 80),  # 저녁: 6시, 80g
        (17, 10)   # 야식: 11시, 10g
    ]
    
    return CustomScenario(start_time=start_time, scenario=meal_scenario)

def create_random_scenario(start_time):
    """랜덤 시나리오 생성"""
    return RandomScenario(start_time=start_time, seed=1)

def run_simulation_with_config(config, scenario_type='random', meals=None):
    """
    설정을 기반으로 시뮬레이션 실행
    
    Args:
        config: 시뮬레이션 설정 딕셔너리
        scenario_type: 'random' 또는 'custom'
        meals: 커스텀 시나리오용 식사 리스트 [(시간, 탄수화물량), ...]
    """
    
    print("Starting Programmatic Simglucose Simulation")
    print("=" * 60)
    
    # Backend-Orchestra 서버 확인
    if not check_backend_server():
        return False
    
    # 컨트롤러 생성
    controller = BackendOrchestraController(
        init_state=0,
        backend_url="http://localhost:4000"
    )
    
    # 시나리오 생성
    if scenario_type == 'custom':
        if meals:
            scenario = CustomScenario(start_time=config['start_time'], scenario=meals)
        else:
            scenario = create_custom_scenario(config['start_time'])
        print(f"Using custom scenario with {len(scenario.scenario)} meals")
    else:
        scenario = create_random_scenario(config['start_time'])
        print("Using random scenario")
    
    # 식사 추가 (컨트롤러에 알림)
    if scenario_type == 'custom':
        total_carbs = sum(carb for _, carb in scenario.scenario)
        controller.add_meal(total_carbs)
        print(f"Total carbs for the day: {total_carbs}g")
    
    print(f"Simulation time: {config['sim_time']}")
    print(f"Patient: {config['patient_names']}")
    print(f"CGM: {config['cgm_name']} (seed: {config['cgm_seed']})")
    print(f"Pump: {config['insulin_pump_name']}")
    print(f"Save path: {config['save_path']}")
    print(f"Animation: {config['animate']}")
    print(f"Parallel: {config['parallel']}")
    print("")
    
    try:
        # 시뮬레이션 실행
        print("Starting simulation...")
        
        simulate(
            sim_time=config['sim_time'],
            scenario=scenario,
            controller=controller,
            patient_names=config['patient_names'],
            cgm_name=config['cgm_name'],
            cgm_seed=config['cgm_seed'],
            insulin_pump_name=config['insulin_pump_name'],
            start_time=config['start_time'],
            save_path=config['save_path'],
            animate=config['animate'],
            parallel=config['parallel']
        )
        
        print("\nSimulation completed successfully!")
        print(f"Results saved to: {config['save_path']}")
        
        return True
        
    except KeyboardInterrupt:
        print("\nSimulation stopped by user")
        return False
    except Exception as e:
        print(f"\nSimulation error: {e}")
        print("Make sure all servers are running:")
        print("   • Backend-Orchestra: http://localhost:4000")
        print("   • G2P2C Server: http://localhost:8002") 
        print("   • OREF0 Server: http://localhost:8001")
        return False

def run_batch_simulation():
    """여러 환자에 대한 배치 시뮬레이션"""
    print("Running batch simulation for multiple patients...")
    
    config = create_simulation_config()
    config['patient_names'] = ['adolescent#001', 'adolescent#002', 'adult#001']
    config['parallel'] = True  # 배치 시뮬레이션에서는 병렬 처리 활성화
    
    return run_simulation_with_config(config, scenario_type='random')

def run_custom_meal_simulation():
    """커스텀 식사 시나리오 시뮬레이션"""
    print("Running custom meal scenario simulation...")
    
    config = create_simulation_config()
    
    # 커스텀 식사 시나리오
    custom_meals = [
        (1, 100),   # 아침: 8시, 100g
        (6, 130),  # 점심: 12시, 13g
        (10, 40), # 간식: 4시, 40g
        (12, 80), # 저녁: 7시, 80g
    ]
    
    return run_simulation_with_config(config, scenario_type='custom', meals=custom_meals)

def run_extended_simulation():
    """장기간 시뮬레이션 (7일)"""
    print("Running extended 7-day simulation...")
    
    config = create_simulation_config()
    config['sim_time'] = timedelta(days=7)  # 7일간 시뮬레이션
    
    return run_simulation_with_config(config, scenario_type='random')

def main():
    """메인 실행 함수"""
    
    print("GlucoBeat Simulation Options")
    print("=" * 40)
    print("1. Standard simulation (1 day, random scenario)")
    print("2. Custom meal simulation")
    print("3. Batch simulation (multiple patients)")
    print("4. Extended simulation (7 days)")
    print("5. Quick test (custom configuration)")
    print("")
    
    choice = input("Select simulation type (1-5): ").strip()
    
    if choice == '1':
        config = create_simulation_config()
        success = run_simulation_with_config(config, scenario_type='random')
        
    elif choice == '2':
        success = run_custom_meal_simulation()
        
    elif choice == '3':
        success = run_batch_simulation()
        
    elif choice == '4':
        success = run_extended_simulation()
        
    elif choice == '5':
        # 빠른 테스트용 설정
        config = create_simulation_config()
        config['sim_time'] = timedelta(hours=6)  # 6시간만
        config['patient_names'] = ['adolescent#001']
        success = run_simulation_with_config(config, scenario_type='custom')
        
    else:
        print("Invalid choice")
        return
    
    if success:
        print("\nAll simulations completed successfully!")
    else:
        print("\nSome simulations failed")

if __name__ == "__main__":
    main() 
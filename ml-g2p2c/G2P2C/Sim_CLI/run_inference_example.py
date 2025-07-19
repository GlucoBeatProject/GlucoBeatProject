# G2P2C/Sim_CLI/run_inference_example.py
"""G2P2C 에이전트의 전체 추론 과정을 보여주는 예제 스크립트 (수정본).

이 스크립트는 다음 과정을 시연합니다:
1. `g2p2c_agent_api.load_agent`를 사용하여 사전 훈련된 에이전트를 로드합니다.
2. **요구사항에 맞게 에이전트 설정을 변경**, 오직 혈당/인슐린 이력만 사용하도록 강제합니다.
3. `utils.statespace.StateSpace`를 사용하여 상태 관리자를 초기화합니다.
4. 가상의 환자 데이터(혈당, 인슐린, 탄수화물, 시간) 스트림을 시뮬레이션합니다.
5. 각 데이터 포인트에 대해 `StateSpace.update`를 호출하고, 반환된 **두 결과(상태, 핸드크래프트)**를 모두 받습니다.
6. `g2p2c_agent_api.infer_action`을 호출하여 최종 인슐린 주입량을 추론합니다.
"""

import sys
import time
from pathlib import Path
import numpy as np
import torch

# --- 프로젝트 루트 경로 설정 ---
_current_script_dir = Path(__file__).resolve().parent
_project_root = _current_script_dir.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))
# ------------------------------------------------

# --- 필요한 모듈 임포트 ---
try:
    from utils.statespace import StateSpace
    from utils import core # statespace.py가 사용하므로 임포트 필요
except ImportError as e:
    print(f"ERROR: 모듈 임포트 실패: {e}")
    print("PYTHONPATH가 올바르게 설정되었는지, 파일이 존재하는지 확인하세요.")
    sys.exit(1)

from Sim_CLI.g2p2c_agent_api import load_agent, infer_action


def run_inference_simulation_revised():
    """가상 데이터로 에이전트 추론 시뮬레이션을 실행합니다."""
    print("--- G2P2C 에이전트 추론 시뮬레이션 (수정본) 시작 ---")

    # --- 1. 에이전트 로드 ---
    print("[1/5] 'base' 모드로 에이전트(episode 195)를 로드합니다...")
    try:
        agent = load_agent()
        print("에이전트 로드 성공.")
    except Exception as e:
        print(f"에이전트 로드 실패: {e}")
        import traceback
        traceback.print_exc()
        return

    # --- 2. 에이전트 설정 변경 (요구사항 반영) ---
    print("[2/5] 에이전트 설정을 변경하여 오직 Glucose+Insulin 이력만 사용하도록 합니다...")
    # statespace.py에 따르면, 아래 플래그들이 False여야 상태가 (BG, Ins)로만 구성됩니다.
    agent.args.mealAnnounce = False
    agent.args.todAnnounce = False
    agent.args.use_carb_announcement = False
    # 이 설정에 따라, 모델에 들어갈 주 상태의 특징(feature) 개수는 2가 됩니다.
    agent.args.n_features = 2
    print(f"  - agent.args.mealAnnounce = {agent.args.mealAnnounce}")
    print(f"  - agent.args.todAnnounce = {agent.args.todAnnounce}")
    print(f"  - 주 상태 특징 개수 (n_features) = {agent.args.n_features}")


    # --- 3. 상태 공간(StateSpace) 관리자 초기화 ---
    print("[3/5] 변경된 설정으로 상태 공간(StateSpace) 관리자를 초기화합니다...")
    state_manager = StateSpace(agent.args)
    print("상태 관리자 초기화 성공.")

    # --- 4. 가상 환자 데이터 생성 ---
    print("[4/5] 시뮬레이션을 위한 가상 환자 데이터를 생성합니다...")
    # 시나리오: 오전 8시부터 안정 상태 -> 8시 10분에 탄수화물 50g 섭취 -> 혈당 상승
    # (혈당 mg/dL, 현재 인슐린 주입량 U/h, 섭취 탄수화물 g, 현재 시간(0-23))
    raw_patient_data = [
        (110, 0.5, 0, 8),   # t=0 min (08:00)
        (112, 0.5, 0, 8),   # t=5 min (08:05)
        (115, 0.5, 50, 8),  # t=10 min (08:10, 식사)
        (120, 0.5, 0, 8),   # t=15 min (08:15)
        (135, 0.5, 0, 8),   # t=20 min (08:20)
        (150, 0.5, 0, 8),   # t=25 min (08:25)
        (165, 0.5, 0, 9),   # t=30 min (09:30)
        (175, 0.5, 0, 9),   # t=35 min (09:35)
        (180, 0.5, 0, 9),   # t=40 min (09:40)
        (182, 0.5, 0, 9),   # t=45 min (09:45)
        (181, 0.5, 0, 9),   # t=50 min (09:50)
        (178, 0.5, 0, 9),   # t=55 min (09:55)
    ]
    print("가상 데이터 생성 완료.")

    # --- 5. 추론 루프 실행 ---
    print("[5/5] 5분 간격으로 추론 루프를 실행합니다...")
    history_length = agent.args.feature_history

    for i, data_point in enumerate(raw_patient_data):
        time.sleep(0.5) # 각 스텝 사이에 약간의 딜레이
        current_bg, current_insulin, current_carbs, current_hour = data_point
        
        print(f"--- 시간 t={i*5}분 (현재 시각: {current_hour:02d}:{(i*5)%60:02d}) ---")
        print(f"  - 입력 (원시): BG={current_bg}, Insulin={current_insulin}, Carbs={current_carbs}, Hour={current_hour}")

        # StateSpace.update는 (state, handcraft_features) 두 값을 반환합니다.
        state_hist_processed, hc_features_raw = state_manager.update(
            cgm=current_bg, ins=current_insulin, carbs=current_carbs, hour=current_hour
        )
        print("  - 상태 관리자(StateSpace) 업데이트 및 전처리 완료.")
        
        # `infer_action`은 두 번째 인자로 핸드크래프트 특징을 필요로 합니다.
        # `statespace.py`는 `[hour]`를 반환하므로, 이를 모델이 요구하는 형태로 변환합니다.
        # (n_handcrafted_features는 기본 모델에서 1로 설정되어 있음)
        hc_state_processed = np.array(hc_features_raw).reshape(1, agent.args.n_handcrafted_features)

        # 모델 입력에 필요한 12개 데이터가 모두 StateSpace에 채워졌을 때부터 추론 시작
        if i + 1 < history_length:
            print(f"  - 추론 건너뛰기: 데이터 수집 중... ({i + 1}/{history_length})")
            continue

        print(f"  - 전처리된 주 상태 shape: {state_hist_processed.shape}")
        print(f"  - 전처리된 핸드크래프트 특징 shape: {hc_state_processed.shape}")

        # 추론 실행
        try:
            inferred_action = infer_action(
                agent=agent,
                state_hist_processed=state_hist_processed,
                hc_state_processed=hc_state_processed
            )
            print(">>> 최종 결과 <<<")
            print(f"  ==============================================")
            print(f"  >>> 추론된 인슐린 주입량: {inferred_action:.4f} U/h <<<")
            print(f"  ==============================================")

        except Exception as e:
            print(f"추론 중 오류 발생: {e}")
            import traceback
            traceback.print_exc()
            break

    print("--- 시뮬레이션 종료 ---")


if __name__ == '__main__':
    run_inference_simulation_revised()

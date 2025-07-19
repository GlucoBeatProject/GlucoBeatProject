# Sim_CLI/g2p2_agent_api.py
"""G2P2C 에이전트를 로드하고 추론을 수행하기 위한 보조 모듈.

이 모듈은 ``load_agent`` 와 ``infer_action`` 두 함수를 제공한다. ``load_agent``
는 저장된 체크포인트 파일들을 읽어 ``G2P2C`` 객체를 생성하며, ``infer_action``
은 전처리된 상태 이력을 입력 받아 인슐린 주입률(U/h)을 반환한다. 
"""

import sys
from pathlib import Path

import numpy as np # numpy 임포트 확인 (infer_action 등에서 사용)
import torch

# --- 프로젝트 루트 경로 설정 (기존과 동일) ---
_current_script_dir = Path(__file__).resolve().parent
_project_root = _current_script_dir.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))
# --------------------------------------------
from utils.options import Options # Options 클래스 임포트 확인
from agents.g2p2c.g2p2c import G2P2C # G2P2C 클래스 임포트 확인

def load_agent() -> G2P2C:
    """저장된 체크포인트로부터 G2P2C 모델을 로드합니다.

    Returns
    -------
    G2P2C
        로드된 에이전트 인스턴스.
    """

    base_config_dir_name = "test" # 기본 모델의 설정 및 체크포인트가 있는 폴더 이름
    current_experiment_folder_name = base_config_dir_name
    results_base_path = _project_root / "results"
    current_experiment_path = results_base_path / current_experiment_folder_name
    checkpoints_dir_abs = current_experiment_path / "checkpoints"

    args = Options().parse([]) 
    device = torch.device('cpu')
    
    agent = G2P2C(args=args, device=device, load=False, path1=None, path2=None)
    
    episode_to_load = 195

    actor_path = checkpoints_dir_abs / f'episode_{episode_to_load}_Actor.pth'
    critic_path = checkpoints_dir_abs / f'episode_{episode_to_load}_Critic.pth'
    
    print(f"INFO: [load_agent] Loading weights from: {actor_path} and {critic_path}")
    
    agent.policy.Actor = torch.load(str(actor_path), map_location=device, weights_only=False)
    agent.policy.Critic = torch.load(str(critic_path), map_location=device, weights_only=False)

    agent.policy.Actor.eval()  # 평가 모드로 설정
    agent.policy.Critic.eval() # 평가 모드로 설정
    
    print(f"INFO: [load_agent] Agent successfully loaded with episode {episode_to_load} weights from '{current_experiment_folder_name}'.")
    return agent

def infer_action(
    agent: G2P2C,
    state_hist_processed: np.ndarray, # StateSpace를 거친 정규화된 상태 이력
    hc_state_processed: np.ndarray,   # StateSpace를 거친 정규화된 핸드크래프트 특징
) -> float:
    """전처리된 상태를 이용해 에이전트로부터 인슐린 주입률을 추론한다.

    Parameters
    ----------
    agent : G2P2C
        로드된 G2P2C 에이전트 인스턴스.
    state_hist_processed : np.ndarray
        ``StateSpace`` 로 전처리된 상태 이력 (``feature_history : 12`` × ``n_features : 2``).
    hc_state_processed : np.ndarray
        전처리된 핸드크래프트 특징 벡터.

    Returns
    -------
    float
        클리핑된 인슐린 주입률(U/h).
    """
    
    # # n_handcrafted_features는 agent.args에 의해 1로 설정됨 (agents/g2p2c/parameters.py)
    # hc_state_processed = hc_state_processed.reshape(1, agent.args.n_handcrafted_features)

    # 2. NumPy 배열을 PyTorch 텐서로 변환
    state_hist_tensor = torch.as_tensor(state_hist_processed, dtype=torch.float32, device=agent.device)
    hc_state_tensor = torch.as_tensor(hc_state_processed, dtype=torch.float32, device=agent.device)
    
    # 3. 에이전트 정책을 사용하여 추론
    with torch.no_grad():
        action_data_dict = agent.policy.get_action(state_hist_tensor, hc_state_tensor)
    
    raw_action_model_output = float(action_data_dict['action']) # 모델 출력은 -1 ~ 1 범위

    final_action_U_per_h = agent.args.action_scale * np.exp((raw_action_model_output - 0.2) * 4) 
    
    # 최종적으로 insulin_min, insulin_max 범위로 클리핑
    action_clipped = float(np.clip(final_action_U_per_h, agent.args.insulin_min, agent.args.insulin_max))
    # action_clipped *= 0
    # 만약 모델의 행동이 이루어지지 않을 경우 위와 같이 0을 곱하면 된다.
    print(f"\n\n-----------------------------\nDEBUG: Model raw output: {raw_action_model_output:.4f}, Scaled action: {final_action_U_per_h:.4f}, Clipped action: {action_clipped:.4f}")
    return action_clipped

if __name__ == '__main__':
    # 1. Load the agent
    # For mode='base', experiment_folder_name defaults to 'test' inside load_agent.
    agent_to_test = load_agent()

    # 2. Create dummy input data for infer_action
    hist_shape = (agent_to_test.args.feature_history, agent_to_test.args.n_features)
    hc_shape = (1, agent_to_test.args.n_handcrafted_features)

    print(f"[Test] Creating dummy state history with shape: {hist_shape}")
    print(f"[Test] Creating dummy handcrafted features with shape: {hc_shape}")

    dummy_state_hist = np.random.rand(*hist_shape).astype(np.float32)
    dummy_hc_state = np.random.rand(*hc_shape).astype(np.float32)

    # 3. Call infer_action
    inferred_action = infer_action(
        agent=agent_to_test,
        state_hist_processed=dummy_state_hist,
        hc_state_processed=dummy_hc_state
    )

    # 4. Print the result
    print(f"[Test] Inferred action (U/h): {inferred_action}")

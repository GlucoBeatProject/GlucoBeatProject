# GlucoBeat Project Scripts

이 폴더에는 GlucoBeat 프로젝트를 각 운영체제에서 실행하기 위한 스크립트들이 포함되어 있습니다.

## 폴더 구조

- `windows/` - Windows용 배치 스크립트 (.bat)
- `mac/` - macOS용 쉘 스크립트 (.sh)
- `linux/` - Linux용 쉘 스크립트 (.sh)

## 스크립트 종류

### 1. 환경 설정
- `setup_environments.*` - 모든 가상환경 및 의존성 설치 (한 번만 실행)

### 2. 프로젝트 실행
- `run_simulation.*` - 전체 시뮬레이션 환경 실행
- `run_web.*` - 웹 개발 환경 실행

## 사용 방법

1. 해당 운영체제 폴더로 이동
2. **최초 1회만** setup_environments 스크립트로 모든 환경 설정
3. run 스크립트로 원하는 프로젝트 실행

### Windows
```cmd
cd glucobeat-project\scripts\windows
# 최초 1회 환경 설정
setup_environments.bat

# 시뮬레이션 실행
run_simulation.bat
# 또는 웹 개발 실행
run_web.bat
```

### macOS / Linux
```bash
cd glucobeat-project/scripts/mac  # 또는 glucobeat-project/scripts/linux
chmod +x *.sh

# 최초 1회 환경 설정
./setup_environments.sh

# 시뮬레이션 실행
./run_simulation.sh
# 또는 웹 개발 실행
./run_web.sh
```

## 설치되는 환경

### Python 가상환경
- **backend_mcp**: 백엔드 서비스용 (backend_mcp_requirement.txt + requirement.txt)
- **simglucose_g2p2c**: ML 및 시뮬레이션용 (simglucose_g2p2c_requirements.txt)

### Node.js 의존성
- **frontend**: Next.js 웹 애플리케이션
- **algo-oref0**: OpenAPS 알고리즘 모듈
- **oref0-official**: 공식 OpenAPS 라이브러리

## 주의사항

- 스크립트 실행 전 glucobeat-project 디렉토리에 있는지 확인하세요
- Python 3.8+ 와 Node.js 14+ 가 시스템에 설치되어 있어야 합니다
- setup_environments는 최초 1회만 실행하면 됩니다
- 의존성 업데이트가 필요하면 setup_environments를 다시 실행하세요 
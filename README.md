# GlucoBeat Project

SW융합대학 디지털 경진대회 최종 출품작

## 목차
- [시스템 요구사항](#시스템-요구사항)
- [패키지 설치](#패키지-설치)
- [Python 가상환경 설정](#python-가상환경-설정)
- [프로젝트 실행](#프로젝트-실행)

## 시스템 요구사항

### 필수 프로그램 (Windows, Mac, Linux)
- **Python 3.10.11**
- **Python 3.12.10** 
- **Node.js 22.14.0**

## 패키지 설치

### Node.js 패키지

#### 1. algo-oref0/oref0 폴더
```bash
cd algo-oref0/oref0
npm install
npm install express
```

#### 2. frontend 폴더
```bash
cd frontend
npm install
```

## Python 가상환경 설정

### Windows 환경
```bash
cd scripts/windows
./run_setup.bat
```

### Mac/Linux 환경

#### 1단계: Backend/MCP 서버용 가상환경 (Python 3.12.10)
```bash
# 가상환경 생성 및 활성화
python3.12 -m venv backend_env
source backend_env/bin/activate  # Mac/Linux

# 패키지 설치
cd scripts
pip install -r backend_mcp_requirement.txt
```

#### 2단계: Simglucose/G2P2C용 가상환경 (Python 3.10.11)
```bash
# 가상환경 생성 및 활성화
python3.10 -m venv simglucose_env
source simglucose_env/bin/activate  # Mac/Linux

# 패키지 설치
cd scripts
pip install -r simglucose_g2p2c_requirement.txt
```

## 프로젝트 실행

### Windows 환경 (간단 실행)

#### Simglucose 시뮬레이션
```bash
cd scripts/windows
./run_simulation.bat
```

#### Web 프로젝트
```bash
cd scripts/windows
./run_web.bat
```

### 전체 환경 (Windows, Mac, Linux)

#### 1. Simglucose 시뮬레이션 실행

**터미널 1**: Backend Orchestrator
```bash
# backend_mcp_requirement.txt 가상환경 활성화
cd backend-orchestrator
python main.py
```

**터미널 2**: MCP Database Server
```bash
cd mcp-db-server
python main.py
```

**터미널 3**: Node.js Server
```bash
cd algo-oref0/oref0
node server.js
```

**터미널 4**: ML G2P2C
```bash
# 기존 가상환경 deactivate 후
# simglucose_g2p2c_requirement.txt 가상환경 활성화
cd ml-g2p2c
python main.py
```

**터미널 5**: Simglucose 실행
```bash
cd simglucose/simglucose
# 기본 설정으로 실행
python run_simulation_programmatic.py

# 또는 커스텀 설정으로 실행
python run_simulation.py
```

#### 2. Web 프로젝트 실행

**터미널 1**: Backend Orchestrator
```bash
# backend_mcp_requirement.txt 가상환경 활성화
cd backend-orchestrator
python main.py
```

**터미널 2**: MCP Database Server
```bash
cd mcp-db-server
python main.py
```

**터미널 3**: Frontend Server
```bash
cd frontend
npm run dev
```

**접속**: http://localhost:3000

## 참고사항

- **기본 시뮬레이터**: 환자, 식사 등이 미리 설정되어 있음
- **커스텀 시뮬레이터**: 직접 설정 가능
- **가상환경**: 각 구성요소별로 다른 Python 버전 필요


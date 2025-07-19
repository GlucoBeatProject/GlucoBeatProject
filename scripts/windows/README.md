# GlucoBeat Windows Scripts

## 사전 요구사항

- Python 3.8+ 설치
- Node.js 14+ 설치
- Git Bash 또는 Command Prompt

## 사용 방법

### 1. 환경 설정 (최초 1회만)

```cmd
# 모든 가상환경과 의존성 설치
setup_environments.bat
```

### 2. 프로젝트 실행

```cmd
# 시뮬레이션 실행
run_simulation.bat

# 웹 개발 서버 실행  
run_web.bat
```

## 실행되는 컴포넌트

### 시뮬레이션 프로젝트
- Backend Orchestrator (Python)
- MCP DB Server (Python)
- Algo-Oref0 Server (Node.js)
- ML-G2P2C (Python)
- SimGlucose (Python)

### 웹 개발 프로젝트
- Backend Orchestrator (Python)
- MCP DB Server (Python)
- Frontend Dev Server (Next.js)

## 종료 방법

- 실행 중인 스크립트에서 아무 키나 누르면 모든 서비스가 종료됩니다
- 또는 각 콘솔 창을 개별적으로 닫을 수 있습니다

## 문제 해결

- 포트 충돌이 발생하면 기존 프로세스를 종료하고 다시 실행하세요
- Python 가상환경이 제대로 생성되지 않으면 수동으로 삭제 후 다시 실행하세요 
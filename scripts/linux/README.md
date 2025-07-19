# GlucoBeat Linux Scripts

## 사전 요구사항

- Python 3.8+ 설치
- Node.js 14+ 설치
- Terminal

## 사용 방법

### 1. 실행 권한 부여

```bash
chmod +x *.sh
```

### 2. 환경 설정 (최초 1회만)

```bash
# 모든 가상환경과 의존성 설치
./setup_environments.sh
```

### 3. 프로젝트 실행

```bash
# 시뮬레이션 실행
./run_simulation.sh

# 웹 개발 서버 실행
./run_web.sh
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
- Frontend Dev Server (Next.js) - http://localhost:3000

## 종료 방법

- Terminal에서 `Ctrl+C`를 누르면 모든 서비스가 자동으로 종료됩니다

## 문제 해결

### 권한 오류
```bash
chmod +x *.sh
```

### 포트 충돌
```bash
# 사용 중인 포트 확인
netstat -tlnp | grep PORT_NUMBER
# 또는
ss -tlnp | grep PORT_NUMBER

# 프로세스 종료
kill -9 PID
```

### Python 가상환경 문제
```bash
# 가상환경 삭제 후 재생성
rm -rf backend_mcp simglucose_g2p2c
./setup_environments.sh
```

### Ubuntu/Debian 추가 패키지 설치
```bash
sudo apt update
sudo apt install python3-venv python3-pip nodejs npm
``` 
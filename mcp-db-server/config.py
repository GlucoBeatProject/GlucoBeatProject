# mcp-db-server/config.py
import os
from dotenv import load_dotenv

# .env 파일 로드 (mcp-db-server 디렉토리 기준)
# backend-orchestrator와 동일한 .env를 사용하기 위해 경로 조정
dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'backend-orchestrator', '.env')
load_dotenv(dotenv_path=dotenv_path)

class Settings:
    # 서버 설정
    HOST: str = "127.0.0.1"
    PORT: int = 5000 # orchestrator에서 호출하는 포트

    # 데이터베이스 연결 정보
    DB_HOST: str = os.getenv("DB_HOST")
    DB_USER: str = os.getenv("DB_USER")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD")
    DB_NAME: str = os.getenv("DB_NAME")
    DB_PORT: int = int(os.getenv("DB_PORT", 3306))
    SSL_CERT_PATH: str = os.getenv("SSL_CERT_PATH")

    # SSL 인증서 경로를 mcp-db-server 기준으로 재구성
    # backend-orchestrator와 mcp-db-server는 동일한 부모 디렉토리에 있다고 가정
    if SSL_CERT_PATH and not os.path.isabs(SSL_CERT_PATH):
        # 상대 경로인 경우, backend-orchestrator 폴더 기준으로 경로 재설정
        SSL_CERT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend-orchestrator', SSL_CERT_PATH))


settings = Settings()

# DB 연결을 위한 config 딕셔너리
db_config = {
    'host': settings.DB_HOST,
    'user': settings.DB_USER,
    'password': settings.DB_PASSWORD,
    'database': settings.DB_NAME,
    'port': settings.DB_PORT,
    'ssl_ca': settings.SSL_CERT_PATH,
    'raise_on_warnings': True,
    'autocommit': True,
}

if __name__ == '__main__':
    # 설정 값 확인용 테스트 코드
    print("--- MCP DB Server Configuration ---")
    print(f"Host: {settings.HOST}")
    print(f"Port: {settings.PORT}")
    print(f"DB Host: {settings.DB_HOST}")
    print(f"DB User: {settings.DB_USER}")
    print(f"DB Name: {settings.DB_NAME}")
    print(f"DB Port: {settings.DB_PORT}")
    print(f"SSL Cert Path: {settings.SSL_CERT_PATH}")
    print(f"Full db_config: {db_config}")

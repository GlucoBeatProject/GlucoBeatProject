# config.py
import os
from typing import Optional

class Config:
    """애플리케이션 설정 클래스"""
    
    # MCP Database Server Configuration
    DB_MCP_SERVER_URL: str = os.getenv("DB_MCP_SERVER_URL", "http://localhost:5000/mcp")
    
    # Database Connection IDs (MCP에서 사용할 데이터베이스 ID들)
    GLUCOBEAT_DB_ID: str = os.getenv("glucobeat_db")
    
    # Other Server URLs
    OREF0_SERVER_URL: str = os.getenv("OREF0_SERVER_URL", "http://localhost:8001/oref0")
    G2P2C_SERVER_URL: str = os.getenv("G2P2C_SERVER_URL", "http://localhost:8002/predict")
   
    
    # Server Configuration
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "4000"))

# 전역 설정 인스턴스
config = Config() 
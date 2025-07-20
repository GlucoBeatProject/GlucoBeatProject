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
from simglucose.simulation.user_interface import simulate
from simglucose.controller.base import Controller, Action
from api_controller import BackendOrchestraController


def main():
    print("Starting Simglucose with Backend-Orchestra Controller")
    print("=" * 60)
    
    # Backend-Orchestra 서버 연결 확인
    import httpx
    try:
        with httpx.Client() as client:
            client.get("http://localhost:4000/docs", timeout=5.0)
            print("Backend-Orchestra server is running")
    except Exception as e:
        print(f"Backend-Orchestra server is not running: {e}")
        print("Please start the Backend-Orchestra server first:")
        print("   cd backend-orchestrator && python main.py")
        return
    
    # Backend-Orchestra Controller 생성
    controller = BackendOrchestraController(
        init_state=0,
        backend_url="http://localhost:4000"
    )
    
    print("Controller initialized")
    print("Backend URL: http://localhost:4000")
    print("")
    

    print("Starting simulation...")
    print("Make sure Backend-Orchestra server is running on port 4000")
    print("")
    
    try:
        simulate(controller=controller)
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
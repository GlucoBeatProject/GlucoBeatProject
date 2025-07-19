#!/usr/bin/env python3
"""
실제 데이터베이스 스키마 확인 스크립트
"""

import requests
import json
from datetime import datetime

# MCP 서버 URL
MCP_SERVER_URL = "http://127.0.0.1:5000/mcp"

def execute_mcp_query(query, params=None):
    """MCP 서버를 통해 쿼리 실행"""
    payload = {
        "method": "query_glucobeat",
        "params": {
            "query": query,
            "params": params
        },
        "context": {"trace_id": f"schema_check_{datetime.now().timestamp()}"}
    }
    
    try:
        response = requests.post(MCP_SERVER_URL, json=payload, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"❌ MCP 쿼리 실행 오류: {e}")
        return {"error": str(e)}

def check_database_schema():
    """데이터베이스 스키마 확인"""
    print("=" * 60)
    print("🔍 실제 데이터베이스 스키마 확인")
    print("=" * 60)
    
    # 1. 모든 테이블 목록 확인
    print("\n1️⃣ 데이터베이스 테이블 목록:")
    print("-" * 40)
    
    result = execute_mcp_query("SHOW TABLES")
    if "error" not in result and "result" in result:
        tables = [row[list(row.keys())[0]] for row in result["result"]["rows"]]
        for table in tables:
            print(f"📋 {table}")
    else:
        print("❌ 테이블 목록 조회 실패")
        return
    
    # 2. 각 테이블의 구조 확인
    for table in tables:
        print(f"\n2️⃣ {table} 테이블 구조:")
        print("-" * 40)
        
        result = execute_mcp_query(f"DESCRIBE {table}")
        if "error" not in result and "result" in result:
            columns = result["result"]["rows"]
            for col in columns:
                print(f"  📝 {col['Field']} | {col['Type']} | {'NULL' if col['Null'] == 'YES' else 'NOT NULL'} | {col['Key']} | {col.get('Default', 'None')}")
        else:
            print(f"❌ {table} 테이블 구조 조회 실패")
    
    # 3. 기존 데이터 샘플 확인
    print(f"\n3️⃣ 기존 데이터 샘플 확인:")
    print("-" * 40)
    
    for table in tables:
        print(f"\n📊 {table} 테이블 샘플 (최대 3개):")
        result = execute_mcp_query(f"SELECT * FROM {table} LIMIT 3")
        if "error" not in result and "result" in result:
            rows = result["result"]["rows"]
            if rows:
                # 컬럼 헤더 출력
                headers = list(rows[0].keys())
                print(f"   📋 컬럼: {' | '.join(headers)}")
                
                # 데이터 출력
                for i, row in enumerate(rows, 1):
                    values = [str(row[col]) for col in headers]
                    print(f"   {i}. {' | '.join(values)}")
            else:
                print("   (데이터 없음)")
        else:
            print(f"   ❌ {table} 샘플 데이터 조회 실패")

if __name__ == "__main__":
    check_database_schema()
#!/usr/bin/env python3
"""
빠른 의료 데이터 삽입 (최적화 버전)
- 배치 삽입으로 속도 향상
- 7월 1일~7일 명시적 날짜 설정
- 더 적은 데이터로 테스트 최적화
"""

import requests
import json
from datetime import datetime, timedelta
import random

# MCP 서버 URL
MCP_SERVER_URL = "http://localhost:5000/mcp"

def execute_mcp_query(query, params=None):
    """MCP 서버를 통해 쿼리 실행"""
    payload = {
        "method": "query_glucobeat",
        "params": {
            "query": query,
            "params": params
        },
        "context": {"trace_id": f"fast_data_{datetime.now().timestamp()}"}
    }
    
    try:
        response = requests.post(MCP_SERVER_URL, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"❌ MCP 쿼리 실행 오류: {e}")
        return {"error": str(e)}

def ensure_users_exist():
    """사용자 1~10번 확인 및 생성 (빠른 버전)"""
    print("👥 사용자 데이터 확인")
    
    # 기존 사용자 확인
    result = execute_mcp_query("SELECT COUNT(*) as count FROM users WHERE id BETWEEN 1 AND 10")
    
    if "error" not in result and "result" in result:
        count = result["result"]["rows"][0]["count"]
        if count >= 10:
            print(f"✅ 사용자 {count}명 이미 존재")
            return True
    
    # 사용자 생성 (배치 생성은 안 되므로 개별 생성)
    user_names = ["김민수", "이지혜", "박준영", "최수연", "정도현", 
                  "한소영", "윤재원", "오미나", "임현우", "장예린"]
    
    print("사용자 생성 중...")
    for i in range(1, 11):
        query = "INSERT IGNORE INTO users (id, name) VALUES (%s, %s)"
        result = execute_mcp_query(query, [i, user_names[i-1]])
        if "error" in result:
            print(f"사용자 {i}번 생성 시도 중...")
    
    print("✅ 사용자 생성 완료")
    return True

def generate_fast_cgm_data():
    """빠른 CGM 데이터 생성 - 2시간 간격"""
    print("📈 CGM 데이터 생성 중...")
    
    # 7월 1일~7일 명시적 설정
    start_date = datetime(2025, 7, 1)
    
    # 시간대별 기본 혈당 패턴
    glucose_patterns = {
        6: 90, 10: 110, 14: 130, 
        18: 125, 22: 120, 0: 85
    }
    
    # 사용자별 오프셋
    user_offsets = {1: 0, 2: 15, 3: -10, 4: 25, 5: 5, 
                   6: -5, 7: 20, 8: 10, 9: -15, 10: 30}
    
    records = []
    
    for day in range(7):  # 7월 1일~7일
        current_date = start_date + timedelta(days=day)
        
        for hour in [6, 10, 14, 18, 22, 0]:  # 2~4시간 간격
            for user_id in range(1, 2):
                record_time = current_date + timedelta(hours=hour)
                
                base_glucose = glucose_patterns[hour]
                user_offset = user_offsets[user_id]
                final_glucose = base_glucose + user_offset + random.randint(-10, 15)
                final_glucose = max(60, min(300, final_glucose))
                
                records.append((
                    record_time.strftime("%Y-%m-%d %H:%M:%S"),
                    user_id,
                    round(final_glucose, 1)
                ))
    
    print(f"✅ CGM 데이터 {len(records)}개 생성 완료")
    return records

def generate_fast_insulin_data():
    """빠른 인슐린 데이터 생성 - 하루 2회"""
    print("💉 인슐린 데이터 생성 중...")
    
    # 7월 1일~7일 명시적 설정
    start_date = datetime(2025, 7, 1)
    
    # 사용자별 인슐린 패턴
    insulin_patterns = {1: 12, 2: 18, 3: 10, 4: 25, 5: 15,
                       6: 14, 7: 22, 8: 16, 9: 8, 10: 30}
    
    records = []
    
    for day in range(7):  # 7월 1일~7일
        current_date = start_date + timedelta(days=day)
        
        for user_id in range(1, 2):
            base_amount = insulin_patterns[user_id]
            
            # 아침 인슐린 (오전 8시)
            morning_time = current_date + timedelta(hours=8, minutes=random.randint(0, 30))
            morning_amount = max(5, base_amount // 2 + random.randint(-2, 3))
            records.append((
                morning_time.strftime("%Y-%m-%d %H:%M:%S"),
                user_id,
                morning_amount
            ))
            
            # 저녁 인슐린 (오후 10시)
            evening_time = current_date + timedelta(hours=22, minutes=random.randint(0, 30))
            evening_amount = max(8, base_amount + random.randint(-3, 5))
            records.append((
                evening_time.strftime("%Y-%m-%d %H:%M:%S"),
                user_id,
                evening_amount
            ))
    
    print(f"✅ 인슐린 데이터 {len(records)}개 생성 완료")
    return records

def batch_insert_data(table_name, columns, data, batch_size=50):
    """배치 단위로 데이터 삽입"""
    total = len(data)
    success_count = 0
    
    print(f"📊 {table_name} 데이터 삽입 중... (총 {total}개)")
    
    for i in range(0, total, batch_size):
        batch = data[i:i+batch_size]
        
        for record in batch:
            query = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({', '.join(['%s'] * len(columns))})"
            result = execute_mcp_query(query, list(record))
            
            if "error" not in result:
                success_count += 1
            else:
                print(f"    ❌ 삽입 실패: {result['error']}")
                break
        
        print(f"    진행률: {min(i+batch_size, total)}/{total} ({(min(i+batch_size, total)/total)*100:.1f}%)")
    
    print(f"✅ {table_name} 데이터 {success_count}개 삽입 완료")
    return success_count

def insert_fast_data():
    """빠른 데이터 삽입"""
    print("=" * 60)
    print("🚀 빠른 의료 데이터 삽입 (7월 1일~7일)")
    print("=" * 60)
    
    # 1. 사용자 확인
    if not ensure_users_exist():
        return
    
    # 2. CGM 데이터 생성 및 삽입
    cgm_data = generate_fast_cgm_data()
    cgm_success = batch_insert_data("cgm_records", ["time", "id", "cgm_value"], cgm_data)
    
    # 3. 인슐린 데이터 생성 및 삽입
    insulin_data = generate_fast_insulin_data()
    insulin_success = batch_insert_data("insulin_records", ["time", "id", "insulin_amount"], insulin_data)
    
    print("\n" + "=" * 60)
    print(f"✅ 빠른 삽입 완료!")
    print(f"   CGM: {cgm_success}개")
    print(f"   인슐린: {insulin_success}개")
    print("=" * 60)

def verify_date_range():
    """날짜 범위 확인"""
    print("\n📅 삽입된 데이터 날짜 범위 확인")
    print("-" * 40)
    
    # CGM 날짜 범위
    result = execute_mcp_query("SELECT MIN(time) as min_date, MAX(time) as max_date FROM cgm_records")
    if "error" not in result:
        dates = result["result"]["rows"][0]
        print(f"📈 CGM 기록: {dates['min_date']} ~ {dates['max_date']}")
    
    # 인슐린 날짜 범위
    result = execute_mcp_query("SELECT MIN(time) as min_date, MAX(time) as max_date FROM insulin_records")
    if "error" not in result:
        dates = result["result"]["rows"][0]
        print(f"💉 인슐린 기록: {dates['min_date']} ~ {dates['max_date']}")
    
    # 날짜별 데이터 수
    print(f"\n📊 날짜별 CGM 데이터 수:")
    result = execute_mcp_query("SELECT DATE(time) as date, COUNT(*) as count FROM cgm_records GROUP BY DATE(time) ORDER BY date")
    if "error" not in result:
        for row in result["result"]["rows"]:
            print(f"   {row['date']}: {row['count']}개")

def quick_stats():
    """빠른 통계"""
    print("\n📊 데이터 통계")
    print("-" * 40)
    
    queries = [
        ("총 사용자 수", "SELECT COUNT(*) as count FROM users WHERE id BETWEEN 1 AND 10"),
        ("총 CGM 기록", "SELECT COUNT(*) as count FROM cgm_records"),
        ("총 인슐린 기록", "SELECT COUNT(*) as count FROM insulin_records"),
        ("평균 혈당", "SELECT AVG(cgm_value) as avg_glucose FROM cgm_records"),
        ("평균 인슐린", "SELECT AVG(insulin_amount) as avg_insulin FROM insulin_records WHERE insulin_amount IS NOT NULL")
    ]
    
    for description, query in queries:
        result = execute_mcp_query(query)
        if "error" not in result:
            value = list(result["result"]["rows"][0].values())[0]
            if isinstance(value, float):
                print(f"📋 {description}: {value:.1f}")
            else:
                print(f"📋 {description}: {value}")

if __name__ == "__main__":
    start_time = datetime.now()
    
    try:
        insert_fast_data()
        verify_date_range()
        quick_stats()
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        print(f"\n⏱️ 실행 시간: {duration:.1f}초")
        print("🎉 빠른 데이터 삽입 완료!")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
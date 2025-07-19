#!/usr/bin/env python3
"""
기존 잘못 입력된 데이터 정리 스크립트
- 기존 데이터 백업 후 삭제
- 안전한 데이터 정리 과정
"""

import requests
import json
from datetime import datetime

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
        "context": {"trace_id": f"cleanup_{datetime.now().timestamp()}"}
    }
    
    try:
        response = requests.post(MCP_SERVER_URL, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"❌ MCP 쿼리 실행 오류: {e}")
        return {"error": str(e)}

def backup_existing_data():
    """기존 데이터 백업 (조회하여 파일로 저장)"""
    print("=" * 60)
    print("💾 기존 데이터 백업 시작")
    print("=" * 60)
    
    backup_data = {
        "backup_time": datetime.now().isoformat(),
        "cgm_records": [],
        "insulin_records": []
    }
    
    # CGM 데이터 백업
    print("\n📈 CGM 데이터 백업 중...")
    result = execute_mcp_query("SELECT * FROM cgm_records ORDER BY time")
    if "error" not in result and "result" in result:
        backup_data["cgm_records"] = result["result"]["rows"]
        print(f"✅ CGM 데이터 {len(backup_data['cgm_records'])}개 백업 완료")
    else:
        print("❌ CGM 데이터 백업 실패")
        return False
    
    # 인슐린 데이터 백업
    print("\n💉 인슐린 데이터 백업 중...")
    result = execute_mcp_query("SELECT * FROM insulin_records ORDER BY time")
    if "error" not in result and "result" in result:
        backup_data["insulin_records"] = result["result"]["rows"]
        print(f"✅ 인슐린 데이터 {len(backup_data['insulin_records'])}개 백업 완료")
    else:
        print("❌ 인슐린 데이터 백업 실패")
        return False
    
    # 백업 파일 저장
    backup_filename = f"data_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    try:
        with open(backup_filename, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, ensure_ascii=False, indent=2, default=str)
        print(f"\n💾 백업 파일 저장 완료: {backup_filename}")
        return True
    except Exception as e:
        print(f"❌ 백업 파일 저장 실패: {e}")
        return False

def analyze_current_data():
    """현재 데이터 분석"""
    print("\n🔍 현재 데이터 분석")
    print("-" * 40)
    
    # CGM 데이터 분석
    print("\n📈 CGM 데이터 분석:")
    queries = [
        ("총 레코드 수", "SELECT COUNT(*) as count FROM cgm_records"),
        ("ID 범위", "SELECT MIN(id) as min_id, MAX(id) as max_id FROM cgm_records"),
        ("시간 범위", "SELECT MIN(time) as min_time, MAX(time) as max_time FROM cgm_records"),
        ("혈당 범위", "SELECT MIN(cgm_value) as min_value, MAX(cgm_value) as max_value FROM cgm_records")
    ]
    
    for description, query in queries:
        result = execute_mcp_query(query)
        if "error" not in result and "result" in result:
            row = result["result"]["rows"][0]
            print(f"  {description}: {row}")
        else:
            print(f"  ❌ {description} 분석 실패")
    
    # 인슐린 데이터 분석
    print("\n💉 인슐린 데이터 분석:")
    queries = [
        ("총 레코드 수", "SELECT COUNT(*) as count FROM insulin_records"),
        ("ID 범위", "SELECT MIN(id) as min_id, MAX(id) as max_id FROM insulin_records"),
        ("시간 범위", "SELECT MIN(time) as min_time, MAX(time) as max_time FROM insulin_records"),
        ("투여량 범위", "SELECT MIN(insulin_amount) as min_amount, MAX(insulin_amount) as max_amount FROM insulin_records WHERE insulin_amount IS NOT NULL")
    ]
    
    for description, query in queries:
        result = execute_mcp_query(query)
        if "error" not in result and "result" in result:
            row = result["result"]["rows"][0]
            print(f"  {description}: {row}")
        else:
            print(f"  ❌ {description} 분석 실패")

def selective_cleanup():
    """선택적 데이터 정리"""
    print("\n🧹 선택적 데이터 정리 옵션")
    print("-" * 40)
    
    print("\n다음 중 어떤 정리 방법을 선택하시겠습니까?")
    print("1. 전체 데이터 삭제 (완전 초기화)")
    print("2. 특정 ID 범위 데이터만 삭제")
    print("3. 특정 날짜 이후 데이터만 삭제")
    print("4. 중복 데이터만 삭제")
    print("5. NULL 값 데이터만 삭제")
    print("0. 정리 취소")
    
    return input("\n선택하세요 (0-5): ").strip()

def cleanup_all_data():
    """모든 데이터 삭제"""
    print("\n🗑️ 전체 데이터 삭제 실행")
    print("-" * 40)
    
    # 확인 절차
    confirm = input("⚠️ 정말로 모든 데이터를 삭제하시겠습니까? (yes/no): ").strip().lower()
    if confirm != 'yes':
        print("❌ 데이터 삭제가 취소되었습니다.")
        return False
    
    # CGM 데이터 삭제
    print("\n📈 CGM 데이터 삭제 중...")
    result = execute_mcp_query("DELETE FROM cgm_records")
    if "error" not in result:
        print("✅ CGM 데이터 삭제 완료")
    else:
        print(f"❌ CGM 데이터 삭제 실패: {result['error']}")
        return False
    
    # 인슐린 데이터 삭제
    print("\n💉 인슐린 데이터 삭제 중...")
    result = execute_mcp_query("DELETE FROM insulin_records")
    if "error" not in result:
        print("✅ 인슐린 데이터 삭제 완료")
    else:
        print(f"❌ 인슐린 데이터 삭제 실패: {result['error']}")
        return False
    
    return True

def cleanup_by_id_range():
    """ID 범위로 데이터 삭제"""
    print("\n🔢 ID 범위별 데이터 삭제")
    print("-" * 40)
    
    try:
        min_id = int(input("삭제할 최소 ID: "))
        max_id = int(input("삭제할 최대 ID: "))
        
        if min_id > max_id:
            print("❌ 최소 ID가 최대 ID보다 클 수 없습니다.")
            return False
        
        confirm = input(f"⚠️ ID {min_id}~{max_id} 범위의 데이터를 삭제하시겠습니까? (yes/no): ").strip().lower()
        if confirm != 'yes':
            print("❌ 데이터 삭제가 취소되었습니다.")
            return False
        
        # CGM 데이터 삭제
        print(f"\n📈 CGM 데이터 삭제 중 (ID: {min_id}~{max_id})...")
        result = execute_mcp_query("DELETE FROM cgm_records WHERE id BETWEEN %s AND %s", [min_id, max_id])
        if "error" not in result:
            print("✅ CGM 데이터 삭제 완료")
        else:
            print(f"❌ CGM 데이터 삭제 실패: {result['error']}")
            return False
        
        # 인슐린 데이터 삭제
        print(f"\n💉 인슐린 데이터 삭제 중 (ID: {min_id}~{max_id})...")
        result = execute_mcp_query("DELETE FROM insulin_records WHERE id BETWEEN %s AND %s", [min_id, max_id])
        if "error" not in result:
            print("✅ 인슐린 데이터 삭제 완료")
        else:
            print(f"❌ 인슐린 데이터 삭제 실패: {result['error']}")
            return False
        
        return True
        
    except ValueError:
        print("❌ 올바른 숫자를 입력해주세요.")
        return False

def cleanup_by_date():
    """날짜로 데이터 삭제"""
    print("\n📅 날짜별 데이터 삭제")
    print("-" * 40)
    
    try:
        date_str = input("삭제할 날짜 이후 (YYYY-MM-DD HH:MM:SS): ").strip()
        datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")  # 날짜 형식 검증
        
        confirm = input(f"⚠️ {date_str} 이후의 데이터를 삭제하시겠습니까? (yes/no): ").strip().lower()
        if confirm != 'yes':
            print("❌ 데이터 삭제가 취소되었습니다.")
            return False
        
        # CGM 데이터 삭제
        print(f"\n📈 CGM 데이터 삭제 중 ({date_str} 이후)...")
        result = execute_mcp_query("DELETE FROM cgm_records WHERE time >= %s", [date_str])
        if "error" not in result:
            print("✅ CGM 데이터 삭제 완료")
        else:
            print(f"❌ CGM 데이터 삭제 실패: {result['error']}")
            return False
        
        # 인슐린 데이터 삭제
        print(f"\n💉 인슐린 데이터 삭제 중 ({date_str} 이후)...")
        result = execute_mcp_query("DELETE FROM insulin_records WHERE time >= %s", [date_str])
        if "error" not in result:
            print("✅ 인슐린 데이터 삭제 완료")
        else:
            print(f"❌ 인슐린 데이터 삭제 실패: {result['error']}")
            return False
        
        return True
        
    except ValueError:
        print("❌ 올바른 날짜 형식을 입력해주세요. (YYYY-MM-DD HH:MM:SS)")
        return False

def cleanup_null_data():
    """NULL 값 데이터만 삭제"""
    print("\n🗑️ NULL 값 데이터 삭제")
    print("-" * 40)
    
    confirm = input("⚠️ NULL 값이 포함된 데이터를 삭제하시겠습니까? (yes/no): ").strip().lower()
    if confirm != 'yes':
        print("❌ 데이터 삭제가 취소되었습니다.")
        return False
    
    # CGM NULL 데이터 삭제
    print("\n📈 CGM NULL 데이터 삭제 중...")
    result = execute_mcp_query("DELETE FROM cgm_records WHERE cgm_value IS NULL")
    if "error" not in result:
        print("✅ CGM NULL 데이터 삭제 완료")
    else:
        print(f"❌ CGM NULL 데이터 삭제 실패: {result['error']}")
        return False
    
    # 인슐린 NULL 데이터 삭제
    print("\n💉 인슐린 NULL 데이터 삭제 중...")
    result = execute_mcp_query("DELETE FROM insulin_records WHERE insulin_amount IS NULL")
    if "error" not in result:
        print("✅ 인슐린 NULL 데이터 삭제 완료")
    else:
        print(f"❌ 인슐린 NULL 데이터 삭제 실패: {result['error']}")
        return False
    
    return True

def verify_cleanup():
    """정리 후 데이터 확인"""
    print("\n✅ 정리 후 데이터 확인")
    print("-" * 40)
    
    # CGM 데이터 확인
    result = execute_mcp_query("SELECT COUNT(*) as count FROM cgm_records")
    if "error" not in result and "result" in result:
        count = result["result"]["rows"][0]["count"]
        print(f"📈 남은 CGM 기록: {count}개")
    
    # 인슐린 데이터 확인
    result = execute_mcp_query("SELECT COUNT(*) as count FROM insulin_records")
    if "error" not in result and "result" in result:
        count = result["result"]["rows"][0]["count"]
        print(f"💉 남은 인슐린 기록: {count}개")

def main():
    """메인 함수"""
    print("🧹 GlucoBeat 데이터 정리 도구")
    print("=" * 60)
    
    try:
        # 1. 현재 데이터 분석
        analyze_current_data()
        
        # 2. 백업 수행
        print(f"\n💾 데이터 백업을 수행하시겠습니까? (권장) (y/n): ", end="")
        backup_choice = input().strip().lower()
        
        if backup_choice == 'y':
            if not backup_existing_data():
                print("❌ 백업 실패로 정리를 중단합니다.")
                return
        else:
            print("⚠️ 백업 없이 진행합니다.")
        
        # 3. 정리 방법 선택
        choice = selective_cleanup()
        
        success = False
        if choice == "1":
            success = cleanup_all_data()
        elif choice == "2":
            success = cleanup_by_id_range()
        elif choice == "3":
            success = cleanup_by_date()
        elif choice == "4":
            print("🔄 중복 데이터 정리 기능은 준비 중입니다.")
        elif choice == "5":
            success = cleanup_null_data()
        elif choice == "0":
            print("❌ 정리 작업이 취소되었습니다.")
        else:
            print("❌ 올바른 선택지를 입력해주세요.")
        
        # 4. 정리 후 확인
        if success:
            verify_cleanup()
            print("\n🎉 데이터 정리가 완료되었습니다!")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
 #!/usr/bin/env python3
"""
oref0 FastAPI 엔드포인트 테스트 스크립트
높은 BG와 식사 데이터로 교정 인슐린이 제대로 계산되는지 확인
"""

import requests
import json
from datetime import datetime, timedelta

def test_oref0_endpoint():
    """oref0 엔드포인트 테스트"""
    
    # 테스트용 CGM 히스토리 생성 (높은 BG 시나리오)
    current_time = datetime.utcnow()
    cgm_history = []
    
    # 최근 10개의 CGM 데이터 (높은 BG로 시작)
    for i in range(10):
        time_offset = (9 - i) * 5  # 5분 간격, 최신부터
        history_time = current_time - timedelta(minutes=time_offset)
        
        # 높은 BG 시나리오: 200-250 mg/dL
        if i < 3:
            bg_value = 250 - (i * 5)  # 250, 245, 240
        else:
            bg_value = 235 - (i * 2)  # 점진적 감소
        
        cgm_history.append({
            "timestamp": history_time.isoformat(),
            "bg": bg_value
        })
    
    # 인슐린 히스토리 (최근 5개)
    insulin_history = []
    for i in range(5):
        time_offset = (4 - i) * 5
        history_time = current_time - timedelta(minutes=time_offset)
        insulin_history.append({
            "timestamp": history_time.isoformat(),
            "amount": 0.5,  # 작은 볼루스
            "type": "bolus"
        })
    
    # 테스트 데이터 구성
    test_data = {
        "current_cgm": 240.0,  # 높은 BG
        "cgm_history": cgm_history,
        "insulin_history": insulin_history,
        "carbs": 30.0,  # 식사 데이터
        "cob": 25.0,    # 남은 탄수화물
        "profile": None,  # 기본 프로필 사용
        "patient_name": "test_patient"
    }
    
    print("🧪 Testing oref0 FastAPI endpoint...")
    print(f"📊 Test data:")
    print(f"   Current CGM: {test_data['current_cgm']} mg/dL")
    print(f"   Carbs: {test_data['carbs']}g")
    print(f"   COB: {test_data['cob']}g")
    print(f"   CGM history length: {len(test_data['cgm_history'])}")
    print(f"   Insulin history length: {len(test_data['insulin_history'])}")
    
    # CGM 히스토리 출력
    print(f"📈 CGM History:")
    for entry in test_data['cgm_history'][-5:]:  # 최근 5개만
        print(f"   {entry['timestamp']}: {entry['bg']} mg/dL")
    
    try:
        # oref0 엔드포인트 호출
        response = requests.post(
            "http://localhost:4000/oref0/calculate",
            json=test_data,
            timeout=30
        )
        
        print(f"\n🌐 HTTP Response:")
        print(f"   Status: {response.status_code}")
        print(f"   Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ Success! oref0 Response:")
            print(f"   Recommended insulin: {result.get('recommended_insulin', 0)} units")
            print(f"   Basal rate: {result.get('basal_rate', 0)} U/hr")
            print(f"   Target BG: {result.get('target_bg', 0)} mg/dL")
            print(f"   Current BG: {result.get('current_bg', 0)} mg/dL")
            print(f"   Eventual BG: {result.get('eventual_bg', 0)} mg/dL")
            print(f"   IOB: {result.get('iob', 0)} units")
            print(f"   BGI: {result.get('bgi', 0)} mg/dL/5min")
            print(f"   Deviation: {result.get('deviation', 0)} mg/dL")
            print(f"   SMB enabled: {result.get('smb_enabled', False)}")
            print(f"   Reason: {result.get('reason', 'No reason')}")
            print(f"   Timestamp: {result.get('timestamp', 'N/A')}")
            
            # 교정 인슐린이 계산되었는지 확인
            if result.get('recommended_insulin', 0) > 0:
                print(f"\n🎉 SUCCESS: Correction insulin recommended!")
                print(f"   This means oref0 is working correctly with high BG.")
            else:
                print(f"\n⚠️  WARNING: No insulin recommended despite high BG.")
                print(f"   This might indicate an issue with the algorithm.")
                
        else:
            print(f"\n❌ Error: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Connection Error: Could not connect to server")
        print(f"   Make sure the FastAPI server is running on http://localhost:4000")
    except requests.exceptions.Timeout:
        print(f"\n⏰ Timeout: Request took too long")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")

def test_low_bg_scenario():
    """낮은 BG 시나리오 테스트 (인슐린 투여하지 않아야 함)"""
    
    current_time = datetime.utcnow()
    cgm_history = []
    
    # 낮은 BG 시나리오: 80-100 mg/dL
    for i in range(10):
        time_offset = (9 - i) * 5
        history_time = current_time - timedelta(minutes=time_offset)
        bg_value = 100 - (i * 2)  # 점진적 감소
        cgm_history.append({
            "timestamp": history_time.isoformat(),
            "bg": bg_value
        })
    
    test_data = {
        "current_cgm": 85.0,  # 낮은 BG
        "cgm_history": cgm_history,
        "insulin_history": [],
        "carbs": 0.0,  # 식사 없음
        "cob": 0.0,
        "profile": None,
        "patient_name": "test_patient_low_bg"
    }
    
    print(f"\n🧪 Testing low BG scenario...")
    print(f"   Current CGM: {test_data['current_cgm']} mg/dL")
    
    try:
        response = requests.post(
            "http://localhost:4000/oref0/calculate",
            json=test_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Low BG test result:")
            print(f"   Recommended insulin: {result.get('recommended_insulin', 0)} units")
            print(f"   Reason: {result.get('reason', 'No reason')}")
            
            if result.get('recommended_insulin', 0) == 0:
                print(f"🎉 SUCCESS: No insulin recommended for low BG (correct behavior)")
            else:
                print(f"⚠️  WARNING: Insulin recommended for low BG (might be incorrect)")
                
    except Exception as e:
        print(f"❌ Low BG test error: {e}")

if __name__ == "__main__":
    print("🚀 Starting oref0 FastAPI Endpoint Tests")
    print("=" * 50)
    
    # 높은 BG 테스트
    test_oref0_endpoint()
    
    # 낮은 BG 테스트
    test_low_bg_scenario()
    
    print("\n" + "=" * 50)
    print("🏁 Tests completed!")
"""
oref0 알고리즘 Python 포팅
OpenAPS oref0의 핵심 인슐린 투여 결정 로직을 Python으로 구현
"""

import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import json

class Oref0Service:
    def __init__(self):
        self.default_profile = {
            "current_basal": 0.5,  # U/hr (베이설 감소)
            "max_iob": 0.5,        # U (최대 IOB 감소)
            "min_bg": 120,         # mg/dL (저혈당 임계값 상향)
            "max_bg": 200,         # mg/dL
            "target_bg": 145,      # mg/dL (초기 혈당과 비슷하게 높임)
            "sens": 50,            # mg/dL/U (Insulin Sensitivity Factor)
            "carb_ratio": 15,      # g/U (Carb Ratio)
            "enableSMB_always": False,  # 초기에는 비활성화
            "enableSMB_with_COB": True,
            "enableSMB_after_carbs": True,
            "enableSMB_with_temptarget": False,
            "enableSMB_high_bg": True,
            "enableSMB_high_bg_target": 200,  # mg/dL
            "allowSMB_with_high_temptarget": False,
            "autosens_max": 1.2,
            "noisyCGMTargetMultiplier": 1.3,
            "maxRaw": 250,
            "out_units": "mg/dL"
        }
    
    def round_value(self, value: float, digits: int = 0) -> float:
        """값을 지정된 소수점 자리로 반올림"""
        if not digits:
            return round(value)
        scale = 10 ** digits
        return round(value * scale) / scale
    
    def calculate_expected_delta(self, target_bg: float, eventual_bg: float, bgi: float) -> float:
        """목표 BG와 예상 BG 간의 예상 변화율 계산"""
        # 2시간을 5분 단위로 나눔 = 24
        five_min_blocks = (2 * 60) / 5
        target_delta = target_bg - eventual_bg
        return self.round_value(bgi + (target_delta / five_min_blocks), 1)
    
    def convert_bg(self, value: float, profile: Dict) -> str:
        """BG 단위 변환 (mg/dL <-> mmol/L)"""
        if profile.get("out_units") == "mmol/L":
            return f"{self.round_value(value / 18, 1):.1f}"
        else:
            return str(round(value))
    
    def enable_smb(self, profile: Dict, micro_bolus_allowed: bool, meal_data: Dict, 
                   bg: float, target_bg: float, high_bg: Optional[float]) -> bool:
        """SMB (Super Micro Bolus) 활성화 조건 확인"""
        
        # 높은 임시 목표가 설정된 경우 SMB 비활성화
        if not micro_bolus_allowed:
            print("SMB disabled (!microBolusAllowed)")
            return False
        elif not profile.get("allowSMB_with_high_temptarget", False) and profile.get("temptargetSet") and target_bg > 100:
            print(f"SMB disabled due to high temptarget of {target_bg}")
            return False
        elif meal_data.get("bwFound") and not profile.get("A52_risk_enable", False):
            print("SMB disabled due to Bolus Wizard activity in the last 6 hours.")
            return False
        
        # 항상 활성화
        if profile.get("enableSMB_always"):
            if meal_data.get("bwFound"):
                print("Warning: SMB enabled within 6h of using Bolus Wizard")
            else:
                print("SMB enabled due to enableSMB_always")
            return True
        
        # COB가 있을 때 활성화
        if profile.get("enableSMB_with_COB") and meal_data.get("mealCOB"):
            if meal_data.get("bwCarbs"):
                print("Warning: SMB enabled with Bolus Wizard carbs")
            else:
                print(f"SMB enabled for COB of {meal_data.get('mealCOB')}")
            return True
        
        # 탄수화물 섭취 후 6시간 동안 활성화
        if profile.get("enableSMB_after_carbs") and meal_data.get("carbs"):
            if meal_data.get("bwCarbs"):
                print("Warning: SMB enabled with Bolus Wizard carbs")
            else:
                print("SMB enabled for 6h after carb entry")
            return True
        
        # 낮은 임시 목표가 설정된 경우 활성화
        if profile.get("enableSMB_with_temptarget") and profile.get("temptargetSet") and target_bg < 100:
            if meal_data.get("bwFound"):
                print("Warning: SMB enabled within 6h of using Bolus Wizard")
            else:
                print(f"SMB enabled for temptarget of {self.convert_bg(target_bg, profile)}")
            return True
        
        # 높은 BG가 감지된 경우 활성화
        if profile.get("enableSMB_high_bg") and high_bg is not None and bg >= high_bg:
            print(f"Checking BG to see if High for SMB enablement.")
            print(f"Current BG {bg} | High BG {high_bg}")
            if meal_data.get("bwFound"):
                print("Warning: High BG SMB enabled within 6h of using Bolus Wizard")
            else:
                print("High BG detected. Enabling SMB.")
            return True
        
        print("SMB disabled (no enableSMB preferences active or no condition satisfied)")
        return False
    
    def calculate_iob(self, insulin_history: List[Dict], current_time: datetime) -> Dict:
        """인슐린 온보드(IOB) 계산"""
        if not insulin_history:
            return {"iob": 0.0, "activity": 0.0}
        
        total_iob = 0.0
        total_activity = 0.0
        
        for insulin in insulin_history:
            # 인슐린 투여 시간
            insulin_time = datetime.fromisoformat(insulin["timestamp"].replace("Z", "+00:00"))
            time_diff = (current_time - insulin_time).total_seconds() / 60  # 분 단위
            
            # 인슐린 종류별 흡수 곡선 (단순화된 모델)
            if insulin["type"] == "bolus":
                # 볼루스: 4시간 동안 지속
                if time_diff < 240:  # 4시간 = 240분
                    # 지수 감소 모델
                    remaining = insulin["amount"] * math.exp(-time_diff / 180)  # 3시간 반감기
                    activity = insulin["amount"] * (1 - math.exp(-time_diff / 180)) / 180
                else:
                    remaining = 0.0
                    activity = 0.0
            else:  # basal
                # 베이설: 지속적 투여
                remaining = insulin["amount"] * (insulin.get("duration", 60) - time_diff) / insulin.get("duration", 60)
                activity = insulin["amount"] / insulin.get("duration", 60) if time_diff < insulin.get("duration", 60) else 0.0
            
            total_iob += max(0, remaining)
            total_activity += max(0, activity)
        
        return {
            "iob": self.round_value(total_iob, 2),
            "activity": self.round_value(total_activity, 3)
        }
    
    def calculate_glucose_status(self, cgm_history: List[Dict], current_time: datetime) -> Dict:
        """CGM 데이터로부터 혈당 상태 계산"""
        if not cgm_history or len(cgm_history) < 2:
            return {
                "glucose": 0,
                "delta": 0,
                "short_avgdelta": 0,
                "long_avgdelta": 0,
                "date": current_time.isoformat(),
                "noise": 0
            }
        
        # 최신 BG 값
        current_bg = cgm_history[-1]["bg"]
        
        # 5분 전 BG 값 (delta 계산용)
        five_min_ago = current_time - timedelta(minutes=5)
        five_min_bg = None
        for entry in reversed(cgm_history[:-1]):
            entry_time = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
            if entry_time <= five_min_ago:
                five_min_bg = entry["bg"]
                break
        
        # 15분 전 BG 값 (short_avgdelta 계산용)
        fifteen_min_ago = current_time - timedelta(minutes=15)
        fifteen_min_bg = None
        for entry in reversed(cgm_history[:-1]):
            entry_time = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
            if entry_time <= fifteen_min_ago:
                fifteen_min_bg = entry["bg"]
                break
        
        # 45분 전 BG 값 (long_avgdelta 계산용)
        forty_five_min_ago = current_time - timedelta(minutes=45)
        forty_five_min_bg = None
        for entry in reversed(cgm_history[:-1]):
            entry_time = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
            if entry_time <= forty_five_min_ago:
                forty_five_min_bg = entry["bg"]
                break
        
        # Delta 계산
        delta = 0
        if five_min_bg is not None:
            delta = self.round_value((current_bg - five_min_bg) / 5, 1)  # mg/dL/5min
        
        short_avgdelta = 0
        if fifteen_min_bg is not None:
            short_avgdelta = self.round_value((current_bg - fifteen_min_bg) / 15, 1)
        
        long_avgdelta = 0
        if forty_five_min_bg is not None:
            long_avgdelta = self.round_value((current_bg - forty_five_min_bg) / 45, 1)
        
        return {
            "glucose": current_bg,
            "delta": delta,
            "short_avgdelta": short_avgdelta,
            "long_avgdelta": long_avgdelta,
            "date": current_time.isoformat(),
            "noise": 0,  # 노이즈 계산은 복잡하므로 0으로 가정
            "device": "simglucose"
        }
    
    def determine_basal(self, glucose_status: Dict, iob_data: Dict, meal_data: Dict, 
                       profile: Optional[Dict] = None, current_time: Optional[datetime] = None) -> Dict:
        """oref0의 핵심 베이설 결정 로직"""
        
        if profile is None:
            profile = self.default_profile
        
        if current_time is None:
            current_time = datetime.utcnow()
        
        result = {}
        
        # BG 상태 확인
        bg = glucose_status["glucose"]
        
        # 기본 베이설
        basal = profile["current_basal"]
        target_bg = profile["target_bg"]
        min_bg = profile["min_bg"]
        max_bg = profile["max_bg"]
        high_bg = profile.get("enableSMB_high_bg_target", 160)
        
        # 저혈당 시 베이설 중단 및 복구 모드
        if bg < min_bg:
            basal = 0.0
            # 저혈당 복구 모드 - 긴급 상황
            if bg < 60:
                print(f"🚨 CRITICAL LOW BG: {bg} mg/dL - Emergency mode activated")
                return {
                    "recommended_insulin": 0.0,
                    "basal_rate": 0.0,  # 베이설 완전 중단
                    "target_bg": target_bg,
                    "current_bg": bg,
                    "eventual_bg": bg,
                    "iob": iob_data["iob"],
                    "bgi": 0.0,
                    "deviation": 0.0,
                    "smb_enabled": False,
                    "reason": f"CRITICAL LOW BG EMERGENCY: {bg} < 60 mg/dL - All insulin suspended",
                    "timestamp": current_time.isoformat()
                }
        delta = glucose_status["delta"]
        short_avgdelta = glucose_status["short_avgdelta"]
        long_avgdelta = glucose_status["long_avgdelta"]
        
        # 에러 조건 확인
        if bg <= 10 or bg == 38 or glucose_status.get("noise", 0) >= 3:
            return {
                "recommended_insulin": 0.0,
                "basal_rate": basal,
                "target_bg": target_bg,
                "current_bg": bg,
                "eventual_bg": bg,
                "iob": iob_data["iob"],
                "bgi": 0.0,
                "deviation": 0.0,
                "smb_enabled": False,
                "reason": "CGM is calibrating, in ??? state, or noise is high",
                "timestamp": current_time.isoformat()
            }
        
        # BG가 너무 평평한지 확인 (시뮬레이터 모드에서는 무시)
        too_flat = False
        if (bg > 60 and delta == 0 and 
            -1 < short_avgdelta < 1 and -1 < long_avgdelta < 1):
            if glucose_status.get("device") == "fakecgm" or glucose_status.get("device") == "simglucose":
                print(f"CGM data is unchanged ({bg}+{delta}) for 5m w/ {short_avgdelta} mg/dL ~15m change & {long_avgdelta} mg/dL ~45m change")
                print("Simulator mode detected: continuing anyway")
            else:
                too_flat = True
        
        if too_flat:
            return {
                "recommended_insulin": 0.0,
                "basal_rate": basal,
                "target_bg": target_bg,
                "current_bg": bg,
                "eventual_bg": bg,
                "iob": iob_data["iob"],
                "bgi": 0.0,
                "deviation": 0.0,
                "smb_enabled": False,
                "reason": f"CGM data is unchanged ({bg}+{delta}) for 5m w/ {short_avgdelta} mg/dL ~15m change & {long_avgdelta} mg/dL ~45m change",
                "timestamp": current_time.isoformat()
            }
        
        # BGI (Blood Glucose Impact) 계산
        sens = profile["sens"]
        bgi = self.round_value((-iob_data["activity"] * sens * 5), 2)
        
        # 최소 delta 계산
        min_delta = min(delta, short_avgdelta)
        min_avg_delta = min(short_avgdelta, long_avgdelta)
        
        # Deviation 계산 (30분 예측)
        deviation = self.round_value(30 / 5 * (min_delta - bgi))
        
        # Eventual BG 계산
        eventual_bg = self.round_value(bg + deviation)
        
        # SMB 활성화 확인
        smb_enabled = self.enable_smb(profile, True, meal_data, bg, target_bg, high_bg)
        
        # 인슐린 투여 결정
        recommended_insulin = 0.0
        reason = []
        
        # 저혈당 보호 - 혈당이 너무 낮으면 인슐린 주입 중단
        if bg < min_bg:
            return {
                "recommended_insulin": 0.0,
                "basal_rate": basal,
                "target_bg": target_bg,
                "current_bg": bg,
                "eventual_bg": bg,
                "iob": iob_data["iob"],
                "bgi": bgi,
                "deviation": deviation,
                "smb_enabled": False,
                "reason": f"Low BG protection: {bg} < {min_bg}",
                "timestamp": current_time.isoformat()
            }
        
        # 높은 BG에 대한 교정 인슐린
        if bg > target_bg:
            # 교정 인슐린 계산
            bg_excess = bg - target_bg
            correction_insulin = bg_excess / sens
            
            # 최대 IOB 제한 확인
            max_additional_iob = profile["max_iob"] - iob_data["iob"]
            if max_additional_iob > 0:
                recommended_insulin = min(correction_insulin, max_additional_iob)
                reason.append(f"High BG correction: {bg} > {target_bg}")
            
            # SMB가 활성화되지 않았어도 교정 인슐린은 주입
            if not smb_enabled:
                reason.append("SMB disabled, but correction insulin needed")
        
        # 탄수화물에 대한 인슐린
        if meal_data.get("carbs", 0) > 0:
            carb_insulin = meal_data["carbs"] / profile["carb_ratio"]
            recommended_insulin += carb_insulin
            reason.append(f"Meal insulin for {meal_data['carbs']}g carbs")
        
        # 결과 구성
        result = {
            "recommended_insulin": self.round_value(recommended_insulin, 2),
            "basal_rate": basal,
            "target_bg": target_bg,
            "current_bg": bg,
            "eventual_bg": eventual_bg,
            "iob": iob_data["iob"],
            "bgi": bgi,
            "deviation": deviation,
            "smb_enabled": smb_enabled,
            "reason": "; ".join(reason) if reason else "No insulin needed",
            "timestamp": current_time.isoformat()
        }
        
        return result
    
    def process_simglucose_request(self, simglucose_data: Dict) -> Dict:
        """Simglucose 데이터를 받아서 oref0 결정을 반환"""
        
        current_time = datetime.utcnow()
        
        # CGM 히스토리 추출
        cgm_history = simglucose_data.get("cgm_history", [])
        if not cgm_history:
            # 최소한 현재 BG는 필요
            current_bg = simglucose_data.get("current_cgm", 120)
            cgm_history = [
                {"timestamp": current_time.isoformat(), "bg": current_bg}
            ]
        
        # 인슐린 히스토리 추출
        insulin_history = simglucose_data.get("insulin_history", [])
        
        # 식사 데이터 추출
        meal_data = {
            "carbs": simglucose_data.get("carbs", 0),
            "mealCOB": simglucose_data.get("cob", 0),
            "bwFound": False,
            "bwCarbs": False
        }
        
        # 프로필 설정 (사용자 정의 또는 기본값)
        profile = simglucose_data.get("profile", self.default_profile)
        
        # 혈당 상태 계산
        glucose_status = self.calculate_glucose_status(cgm_history, current_time)
        
        # IOB 계산
        iob_data = self.calculate_iob(insulin_history, current_time)
        
        # 베이설 결정
        result = self.determine_basal(glucose_status, iob_data, meal_data, profile, current_time)
        
        return result

# 전역 인스턴스
oref0_service = Oref0Service() 
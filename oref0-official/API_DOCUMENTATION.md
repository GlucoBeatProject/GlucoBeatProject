# OpenAPS SMB & Temporary Basal Calculator API

## 알고리즘 정체성
이 시스템은 **OpenAPS (Open Artificial Pancreas System)** 의 oref0 구현체를 기반으로 합니다. 

### 핵심 알고리즘
- **determine_basal.js**: 메인 인슐린 투여 결정 알고리즘
- **autosens.js**: 자동 감도 조정 알고리즘  
- **iob/**: 체내 인슐린 잔량(IOB) 계산
- **meal/**: 체내 탄수화물 잔량(COB) 계산

### 주요 기능
1. **SMB (Super Micro Bolus)**: 소량의 빠른 인슐린 투여
2. **Temporary Basal**: 임시 기저 인슐린 조정
3. **Autosens**: 인슐린 민감도 자동 조정
4. **UAM (Unannounced Meals)**: 미신고 식사 감지
5. **COB/IOB 예측**: 향후 혈당 예측

## API 엔드포인트

### POST /calculate

혈당 데이터와 환자 정보를 받아 SMB와 임시 베이설 인슐린 레이트를 계산합니다.

#### 요청 URL
```
POST http://localhost:5000/calculate
```

#### 요청 헤더
```
Content-Type: application/json
```

#### 요청 본문 형식

```json
{
  "modelInputsToModObject": {
    "mealCarbsMgPerMin": 0,
    "highFatMealFlag": false,
    "highProteinMealFlag": false,
    "ignoreMealChoFlag": false,
    "fullMealCarbMgExpectedAtStart": 0,
    "glucOrDextIvInjMgPerMin": 0,
    "glucagonSqInjMg": 0,
    "exerciseIntensityAsFrac": 0,
    "glucoseTabletDoseMg": 0,
    "sqInsulinNormalBasal": 0.9,
    "ivInsulinNormalBasal": 0,
    "sqInsulinNormalBolus": 0,
    "ivInsulinNormalBolus": 0,
    "sqInsulinUltraRapidBolus": 0,
    "slowRelInsulinStandardLongActing": 0,
    "sqInsulinStandardLongActing": 0,
    "ivInsulinStandardLongActing": 0,
    "drugDoses": {},
    "prevControlOutputs": { /* 이전 제어 출력 */ },
    "prevModelInputs": { /* 이전 모델 입력 */ }
  },
  "nextMealObject": {
    "amountMg": 30000,           // 탄수화물 양 (mg) - 30000mg = 30g
    "durationInMinutes": 15,     // 식사 지속시간 (분)
    "minutesUntilNextMeal": 53,  // 다음 식사까지 시간 (분)
    "bolusMultiplier": 1         // 볼루스 배수
  },
  "sensorSigArray": [153.3, 153.3],  // 연속혈당측정기 값 (mg/dL)
  "subjObject": {
    "name": "adult#005",         // 환자 ID
    "type1": true,               // 1형 당뇨 여부
    "CR": 13,                    // 탄수화물 비율 (g/U)
    "CF": 48,                    // 교정 인자 (mg/dL/U)
    "Gb": 119.65,                // 기준 혈당 (mg/dL)
    "BW": 67.11,                 // 체중 (kg)
    "dailyBasalInsulin": 22.04,  // 일일 베이설 인슐린 (U)
    "OGTT": null
  },
  "timeObject": {
    "minutesPastSimStart": 727,    // 시뮬레이션 시작 후 경과 분
    "daysSinceJan1": 0,
    "daysSinceMonday": 0,
    "minutesPastMidnight": 727     // 자정 후 경과 분
  }
}
```

#### 주요 입력 파라미터 설명

| 필드 | 타입 | 설명 | 단위 |
|------|------|------|------|
| **sensorSigArray** | Array | 현재 혈당 값 | mg/dL |
| **subjObject.CR** | Number | 탄수화물 비율 (1U 인슐린이 처리하는 탄수화물) | g/U |
| **subjObject.CF** | Number | 교정 인자 (1U 인슐린이 낮추는 혈당) | mg/dL/U |
| **subjObject.dailyBasalInsulin** | Number | 하루 총 베이설 인슐린 | U |
| **nextMealObject.amountMg** | Number | 예정된 탄수화물 | mg |
| **modelInputsToModObject.sqInsulinNormalBasal** | Number | 현재 베이설 레이트 | U/hr |

#### 응답 형식

```json
{
  "temporaryBasalRate": 1.2,      // 임시 베이설 레이트 (U/hr)
  "basalDuration": 30,            // 베이설 지속시간 (분)
  "smb": 0.3,                     // SMB 단위 (U)
  "reason": "COB: 30, Dev: 5.2, BGI: -2.1, ISF: 48, CR: 13...",
  "additionalInfo": {
    "currentBG": 153.3,           // 현재 혈당
    "eventualBG": 142.5,          // 예상 혈당
    "iob": 1.2,                   // 체내 인슐린 잔량 (U)
    "cob": 30,                    // 체내 탄수화물 잔량 (g)
    "autosensRatio": 1.0,         // 자동감도 비율
    "insulinSensitivityFactor": 48, // 인슐린 민감도
    "carbRatio": 13,              // 탄수화물 비율
    "targetBG": 130               // 목표 혈당
  },
  "status": "success",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "patientId": "adult#005"
}
```

## 알고리즘 작동 원리

### 1. 혈당 예측 (BG Prediction)
알고리즘은 네 가지 시나리오로 혈당을 예측합니다:
- **IOB만 고려**: 인슐린 효과만 계산
- **COB만 고려**: 탄수화물 흡수만 계산  
- **UAM 고려**: 미신고 식사 영향 계산
- **Zero Temp**: 인슐린 중단 시 예측

### 2. SMB 결정 조건
SMB는 다음 조건에서 활성화됩니다:
- 혈당이 임계값(threshold) 이상
- COB가 있거나 고혈당 상태
- 마지막 볼루스 후 충분한 시간 경과
- 안전 조건 만족

### 3. 임시 베이설 계산
- **저혈당 예방**: 예상 혈당이 낮을 때 베이설 감소/중단
- **고혈당 교정**: 예상 혈당이 높을 때 베이설 증가
- **안전 제한**: 최대 베이설 레이트 및 IOB 제한 적용

### 4. 자동감도 조정 (Autosens)
- 최근 8시간 및 24시간 데이터 분석
- 혈당 편차를 통한 인슐린 민감도 계산
- ISF 및 베이설 레이트 자동 조정

## 사용 예시

### 서버 시작
```bash
cd lib
node server.js
```

### API 호출 예시 (curl)
```bash
curl -X POST http://localhost:5000/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "modelInputsToModObject": {
      "sqInsulinNormalBasal": 1.0
    },
    "nextMealObject": {
      "amountMg": 45000,
      "durationInMinutes": 20,
      "minutesUntilNextMeal": 30,
      "bolusMultiplier": 1
    },
    "sensorSigArray": [180, 180],
    "subjObject": {
      "name": "patient001",
      "type1": true,
      "CR": 12,
      "CF": 50,
      "Gb": 100,
      "BW": 70,
      "dailyBasalInsulin": 24,
      "OGTT": null
    },
    "timeObject": {
      "minutesPastSimStart": 480,
      "daysSinceJan1": 0,
      "daysSinceMonday": 0,
      "minutesPastMidnight": 480
    }
  }'
```

### JavaScript 예시
```javascript
const axios = require('axios');

const data = {
  modelInputsToModObject: {
    sqInsulinNormalBasal: 1.0
  },
  nextMealObject: {
    amountMg: 45000,  // 45g 탄수화물
    durationInMinutes: 20,
    minutesUntilNextMeal: 30,
    bolusMultiplier: 1
  },
  sensorSigArray: [180, 180],
  subjObject: {
    name: "patient001",
    type1: true,
    CR: 12,
    CF: 50,
    Gb: 100,
    BW: 70,
    dailyBasalInsulin: 24
  },
  timeObject: {
    minutesPastSimStart: 480,
    minutesPastMidnight: 480
  }
};

axios.post('http://localhost:5000/calculate', data)
  .then(response => {
    console.log('임시 베이설:', response.data.temporaryBasalRate, 'U/hr');
    console.log('SMB:', response.data.smb, 'U');
    console.log('이유:', response.data.reason);
  })
  .catch(error => {
    console.error('오류:', error.response.data);
  });
```

## 테스트 실행

포함된 테스트 스크립트를 사용하여 다양한 시나리오를 테스트할 수 있습니다:

```bash
node test_calculate_endpoint.js
```

이 스크립트는 다음 시나리오를 테스트합니다:
- 정상 혈당 (120 mg/dL)
- 고혈당 (200 mg/dL)
- 저혈당 (70 mg/dL)  
- 식사 예정 상황 (30g 탄수화물)

## 안전 고려사항

⚠️ **경고**: 이 시스템은 교육 및 연구 목적으로만 사용하세요. 실제 의료 상황에서는 반드시 의료진의 지도하에 사용해야 합니다.

### 내장된 안전 장치
- 최대 베이설 레이트 제한
- 최대 IOB 제한
- 저혈당 예방 로직
- SMB 안전 조건
- 혈당 데이터 유효성 검증

## 문제 해결

### 일반적인 오류

1. **"Invalid sensor data"**
   - 혈당 값이 40-400 mg/dL 범위를 벗어남
   - sensorSigArray가 비어있거나 유효하지 않음

2. **"Failed to calculate insulin dosing"**
   - 프로필 설정 오류
   - IOB/COB 계산 실패

3. **서버 연결 오류**
   - 서버가 실행 중인지 확인 (포트 5000)
   - 방화벽 설정 확인

### 로그 확인
서버 콘솔에서 상세한 계산 과정을 확인할 수 있습니다:
- 입력 데이터 검증
- 알고리즘 계산 과정
- 최종 결과 및 근거

## 기여 및 개발

이 프로젝트는 OpenAPS 커뮤니티의 오픈소스 프로젝트를 기반으로 합니다. 
원본 프로젝트: https://github.com/openaps/oref0 
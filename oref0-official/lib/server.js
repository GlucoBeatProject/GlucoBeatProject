const express = require("express");
const path = require('path');
const app = express();
const port = process.env.PORT || 5000;
const getLastGlucose = require('./glucose-get-last');
const determine_basal = require('./determine-basal/determine-basal');
const tempBasalFunctions = require('./basal-set-temp');
const generateIOB = require('./iob');  // IOB generate 함수 직접 import
const detectSensitivity = require('./determine-basal/autosens');  // 감도 분석 함수 import (원래대로 복원)

// 전역 변수로 Dictionary 선언
const bgHistoryDict = {};
const cobHistoryDict = {};
const pumpHistoryDict = {};
const profileDict = {};  // 환자별 프로필 관리
const lastCalculationResults = {};  // 🔧 마지막 계산 결과 저장
const lastCalculationTime = {};     // 🔧 마지막 계산 시간 저장
var tmppatientName;


// 정적 프로필 설정 (모든 환자에게 공통)
const staticProfile = {
    "max_bg": 180,                  // 최대 혈당 목표 (mg/dL)
    "min_bg": 100,                  // 🔧 최소 혈당 목표를 100으로 더 상향 조정 (적극적인 저혈당 대응)
    "out_units": "mg/dL",           // 혈당 단위
    "max_basal": 3.0,               // 최대 베이설 레이트 (U/hr)
    "min_5m_carbimpact": 8,         // 5분당 최소 탄수화물 영향
    "maxCOB": 120,                  // 최대 탄수화물 (g)
    "max_iob": 4.0,                 // 최대 인슐린 잔량 (U) - SMB를 위해 증가
    "max_daily_safety_multiplier": 3, // 일일 안전 승수 최대값
    "current_basal_safety_multiplier": 4, // 현재 베이설 안전 승수 - SMB를 위해 증가
    "autosens_max": 1.2,            // 자동 감도 최대값
    "autosens_min": 0.7,            // 자동 감도 최소값
    "remainingCarbsCap": 90,        // 남은 탄수화물 상한값
    "enableUAM": true,              // 미확인 식사 감지 활성화

    // 🔧 아래 SMB 관련 설정들을 모두 false로 변경합니다.
    "enableSMB_with_bolus": false,     // 볼루스와 함께 SMB 비활성화
    "enableSMB_with_COB": false,       // COB와 함께 SMB 비활성화
    "enableSMB_with_temptarget": false,// 임시 목표와 함께 SMB 비활성화
    "enableSMB_after_carbs": false,    // 탄수화물 섭취 후 SMB 비활성화
    "enableSMB_high_bg": false,        // 고혈당 시 SMB 비활성화
    "enableSMB_always": false,         // 항상 SMB 비활성화

    "enableSMB_high_bg_target": 160,  // 고혈당 SMB 활성화 임계값 (mg/dL)
    "maxDelta_bg_threshold": 0.5,     // 🔧 maxDelta 임계값을 50%로 대폭 완화 (고혈당 적극 교정)
    "prime_indicates_pump_site_change": false, // 프라임이 펌프 사이트 변경을 나타내는지
    "rewind_indicates_cartridge_change": false, // 리와인드가 카트리지 변경을 나타내는지
    "battery_indicates_battery_change": false, // 배터리가 배터리 변경을 나타내는지
    "maxSMBBasalMinutes": 180,        // 🔥 극도로 높은 SMB 한도 (3시간 분량!)
    "curve": "rapid-acting",          // 인슐린 곡선 타입
    "useCustomPeakTime": false,       // 사용자 정의 피크 시간 사용 여부
    "insulinPeakTime": 75,            // 인슐린 피크 시간 (분)
    "dia": 6,                         // 인슐린 작용 지속 시간 (시간)
    "max_daily_basal": 3.0,           // 일일 최대 베이설 (U/hr)
    "bolus_increment": 0.01,          // 🔥 최소 볼루스 단위를 0.01U로 극소화
    "SMBInterval": 0.5,               // 🔥 SMB 간격을 30초로 극단적 단축
    "maxUAMSMBBasalMinutes": 120,     // 🔥 UAM SMB도 2시간 분량으로 증가
    "A52_risk_enable": false,         // A52 위험 활성화
    "allowSMB_with_high_temptarget": false, // 🔧 고임시 목표에서 SMB 허용 (false로 변경)
    "carbsReqThreshold": 0.1,         // 🔥 탄수화물 요구량 임계값을 거의 0으로
    "maxDelta_bg_threshold": 0.9,     // 🔥 혈당 변화 임계값을 90%로 대폭 완화
    "max_iob": 10.0,                  // 🔥 최대 IOB를 10U로 대폭 증가 (기본 4U → 10U)
};

// JSON 형식의 요청 본문을 파싱할 수 있도록 express 미들웨어 설정
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 서버 상태 확인을 위한 루트 엔드포인트
app.get("/", (req, res) => {
    res.json({
        status: "running",
        message: "OpenAPS SMB & Temporary Basal Calculator API",
        version: "1.0.0",
        endpoints: {
            "POST /calculate": "SMB와 임시 베이설 계산 (새로운 형식)",
            "POST /trio": "기존 형식의 계산",
            "POST /debug": "데이터 디버깅 엔드포인트"
        },
        timestamp: new Date().toISOString()
    });
});

// 🔧 디버깅 엔드포인트 추가
app.post("/debug", (req, res) => {
    console.log("\n🐛 === DEBUG REQUEST ===");
    console.log("Headers:", req.headers);
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("Body keys:", Object.keys(req.body));
    
    if (req.body.sensorSigArray) {
        console.log("sensorSigArray:", req.body.sensorSigArray);
        console.log("sensorSigArray[0]:", req.body.sensorSigArray[0]);
        console.log("Type of sensorSigArray[0]:", typeof req.body.sensorSigArray[0]);
    }
    
    return res.json({
        status: "debug",
        received: req.body,
        analysis: {
            hasBody: !!req.body,
            bodyKeys: Object.keys(req.body),
            sensorSigArray: req.body.sensorSigArray,
            sensorSigArrayType: typeof req.body.sensorSigArray,
            firstValue: req.body.sensorSigArray?.[0],
            firstValueType: typeof req.body.sensorSigArray?.[0]
        },
        timestamp: new Date().toISOString()
    });
});

// 환자별 동적 프로필 초기화 함수
function initializePatientProfile(patientName, subjObject) {
    if (!profileDict[patientName]) {
        // 일일 베이설 인슐린을 기반으로 기본 베이설 레이트 계산
        const defaultBasalRate = Math.max(0.1, (subjObject.dailyBasalInsulin || 24) / 24);
        
        profileDict[patientName] = {
            ...staticProfile,
            "current_basal": defaultBasalRate,
            "max_basal": Math.max(3.0, defaultBasalRate * 3), // 기본 베이설의 3배 또는 최소 3.0
            "max_daily_basal": Math.max(2.0, defaultBasalRate * 2), // 기본 베이설의 2배 또는 최소 2.0
            "basalprofile": [{
                "minutes": 0,
                "rate": defaultBasalRate,
                "start": "00:00:00",
                "i": 0
            }],
            "carb_ratios": {
                "schedule": [{
                    "x": 0,
                    "i": 0,
                    "offset": 0,
                    "ratio": subjObject.CR || 12,
                    "r": subjObject.CR || 12,
                    "start": "00:00:00"
                }],
                "units": "grams"
            },
            "carb_ratio": subjObject.CR || 12,
            "isfProfile": {
                "first": 1,
                "sensitivities": [{
                    "endOffset": 1440,
                    "offset": 0,
                    "x": 0,
                    "sensitivity": subjObject.CF || 40,
                    "start": "00:00:00",
                    "i": 0
                }],
                "user_preferred_units": "mg/dL",
                "units": "mg/dL"
            },
            "sens": subjObject.CF || 40,
            "bg_targets": {
                "first": 1,
                "targets": [{
                    "max_bg": 180,
                    "min_bg": 100,     // 🔧 100으로 조정
                    "x": 0,
                    "offset": 0,
                    "low": 110,        // 🔧 low 임계값을 110으로 더 상향 조정
                    "start": "00:00:00",
                    "high": 170,
                    "i": 0
                }],
                "user_preferred_units": "mg/dL",
                "units": "mg/dL"
            }
        };

        console.log(`Initialized profile for ${patientName}:`, {
            basal_rate: defaultBasalRate,
            max_basal: profileDict[patientName].max_basal,
            carb_ratio: subjObject.CR || 12,
            isf: subjObject.CF || 40
        });
    }
}

// 프로필 업데이트 함수 추가
function updatePatientProfile(patientName, updates = {}) {
    if (!profileDict[patientName]) {
        console.error(`Profile not found for patient: ${patientName}`);
        return false;
    }

    try {
        // ISF 업데이트
        if (updates.isf) {
            profileDict[patientName].isfProfile.sensitivities[0].sensitivity = updates.isf;
            profileDict[patientName].sens = updates.isf;
            console.log(`📝 Profile ISF for ${patientName} successfully updated in profileDict to: ${updates.isf}`);
        }

        // 베이설 업데이트
        if (updates.basal) {
            profileDict[patientName].current_basal = updates.basal;
            profileDict[patientName].basalprofile[0].rate = updates.basal;
        }

        // 탄수화물 비율 업데이트
        if (updates.carbRatio) {
            profileDict[patientName].carb_ratio = updates.carbRatio;
            profileDict[patientName].carb_ratios.schedule[0].ratio = updates.carbRatio;
            profileDict[patientName].carb_ratios.schedule[0].r = updates.carbRatio;
        }

        // 혈당 목표 업데이트
        if (updates.bgTargets) {
            profileDict[patientName].bg_targets.targets[0] = {
                ...profileDict[patientName].bg_targets.targets[0],
                ...updates.bgTargets
            };
        }

        return true;
    } catch (err) {
        console.error(`Error updating profile for patient ${patientName}:`, err);
        return false;
    }
}

function validateInputData(data) {
    if (!data.subjObject || !data.subjObject.dailyBasalInsulin) {
        throw new Error("Invalid subject data: missing dailyBasalInsulin");
    }
    if (!data.sensorSigArray || data.sensorSigArray.length === 0) {
        throw new Error("Invalid sensor data");
    }
    // ... 추가 검증
}

// POST 요청을 처리하는 엔드포인트
app.post("/trio", async(req, res) => {
    const {
        sensorSigArray,
        bg,
        subjObject,
        modelInputsToModObject,
        nextMealObject,
        timeObject
    } = req.body;
    console.log(req.body);
    try {
        const patientName = subjObject.name;
        tmppatientName = patientName;
        
        // 환자별 히스토리 초기화
        if (!bgHistoryDict[patientName]) {
            bgHistoryDict[patientName] = [];
        }
        if (!pumpHistoryDict[patientName]) {
            pumpHistoryDict[patientName] = [];
        }
        if (!cobHistoryDict[patientName]) {
            cobHistoryDict[patientName] = [];
        }
        
        // 프로필 초기화
        if (!profileDict[patientName]) {
            initializePatientProfile(patientName, subjObject);
        }

        // 🔧 시뮬레이터 시간 처리 (실제 시간이 아닌 시뮬레이션 시간 사용)
        const simulationMinutes = timeObject.minutesPastSimStart;
        const currentTime = new Date(2024, 0, 1); // 기준 날짜 설정
        currentTime.setMinutes(simulationMinutes); // 시뮬레이션 분 설정
        const currentTimeMs = simulationMinutes * 60 * 1000; // 시뮬레이션 시간을 밀리초로 변환

        // 🔧 2단계: 5분 간격 계산 체크 (시뮬레이션 시간 기준)
        const timeSinceLastCalculation = simulationMinutes - (lastCalculationTime[patientName] / (60 * 1000)); // 분 단위로 계산
        const shouldCalculate = timeSinceLastCalculation >= 5; // 5분 간격

        console.log(`⏰ Simulation time: ${simulationMinutes}m | Last calc: ${Math.round(lastCalculationTime[patientName] / (60 * 1000))}m`);
        console.log(`⏰ Time since last calculation: ${Math.round(timeSinceLastCalculation)}m`);
        console.log(`🧮 Should calculate: ${shouldCalculate}`);

        // 🔧 1단계: 혈당 데이터 저장 (매번 수행)
        const lastGlucose = bgHistoryDict[patientName].length > 0 ? 
            bgHistoryDict[patientName][bgHistoryDict[patientName].length - 1] : null;
        
        const newGlucoseData = {
            glucose: bg,
            date: currentTime.toISOString(),
            display_time: currentTime.toISOString(),
            delta: lastGlucose ? bg - lastGlucose.glucose : 0,
            device: "dexcom",
            timestamp: currentTimeMs
        };
        bgHistoryDict[patientName].push(newGlucoseData);

        // 히스토리 크기 제한 (최대 100개)
        if (bgHistoryDict[patientName].length > 100) {
            bgHistoryDict[patientName] = bgHistoryDict[patientName].slice(-100);
        }

        let calculationResult;

        if (shouldCalculate || !lastCalculationResults[patientName]) {
            // 🔧 3단계: 새로운 계산 수행
            console.log("🔄 Performing new calculation...");
            
            calculationResult = await performInsulinCalculation(
                patientName, 
                currentTime, 
                bg, 
                nextMealObject, 
                modelInputsToModObject, 
                subjOb,
                timeObject
            );
            
            // 계산 결과 및 시간 저장 (시뮬레이션 시간으로)
            lastCalculationResults[patientName] = calculationResult;
            lastCalculationTime[patientName] = simulationMinutes * 60 * 1000; // 🔧 시뮬레이션 시간 저장
            
            console.log("💾 New calculation saved");
        } else {
            // 🔧 4단계: 이전 계산 결과 반환
            console.log("📋 Returning cached calculation");
            calculationResult = lastCalculationResults[patientName];
            
            // 현재 혈당 정보만 업데이트
            calculationResult.additionalInfo.currentBG = bg;
            calculationResult.additionalInfo.lastUpdated = currentTime.toISOString();
        }

        // 응답 반환
        console.log(`📤 Response: Basal ${calculationResult.temporaryBasalRate} U/hr | SMB ${calculationResult.smb} U`);
        return res.status(200).json(calculationResult);

    } catch (err) {
        console.error("Error in /trio:", err);
        return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// 새로운 엔드포인트: 올바른 데이터 흐름을 처리하는 계산 엔드포인트
app.post("/calculate", async(req, res) => {
    const {
        modelInputsToModObject,
        nextMealObject,
        sensorSigArray,
        subjObject,
        timeObject
    } = req.body;

    try {
        const patientName = subjObject.name;
        const currentBG = sensorSigArray[0]; // sensorSigArray[0] = sensorSigArray[1]
        
        console.log(`\n🩸 BG Data Received: ${patientName} | BG: ${currentBG} mg/dL`);
        console.log(`📋 Full sensorSigArray:`, sensorSigArray);
        console.log(`🔍 Request body keys:`, Object.keys(req.body));

        // 🔧 데이터 검증 강화
        if (!sensorSigArray || sensorSigArray.length === 0) {
            console.error("❌ sensorSigArray is empty or undefined:", sensorSigArray);
            return res.status(400).json({ 
                error: "Invalid sensor data: empty array",
                received: sensorSigArray,
                status: "error"
            });
        }

        if (currentBG === null || currentBG === undefined || isNaN(currentBG)) {
            console.error("❌ Invalid glucose value:", currentBG);
            console.error("📋 Full request body:", JSON.stringify(req.body, null, 2));
            return res.status(400).json({ 
                error: "Invalid glucose value",
                received: currentBG,
                sensorSigArray: sensorSigArray,
                status: "error"
            });
        }

        if (currentBG < 40 || currentBG > 400) {
            console.error("❌ Glucose value out of range:", currentBG);
            return res.status(400).json({ 
                error: "Glucose value out of range (40-400 mg/dL)",
                received: currentBG,
                status: "error"
            });
        }

        // 환자별 데이터 초기화
        if (!bgHistoryDict[patientName]) {
            bgHistoryDict[patientName] = [];
        }
        if (!pumpHistoryDict[patientName]) {
            pumpHistoryDict[patientName] = [];
        }
        if (!cobHistoryDict[patientName]) {
            cobHistoryDict[patientName] = [];
        }
        if (!lastCalculationResults[patientName]) {
            lastCalculationResults[patientName] = null;
        }
        if (!lastCalculationTime[patientName]) {
            lastCalculationTime[patientName] = 0;
        }
        
        // 프로필 초기화
        if (!profileDict[patientName]) {
            initializePatientProfile(patientName, subjObject);
        }

        // 🔧 시뮬레이터 시간 처리 (실제 시간이 아닌 시뮬레이션 시간 사용)
        const simulationMinutes = timeObject.minutesPastSimStart;
        const currentTime = new Date(2024, 0, 1); // 기준 날짜 설정
        currentTime.setMinutes(simulationMinutes); // 시뮬레이션 분 설정
        const currentTimeMs = simulationMinutes * 60 * 1000; // 시뮬레이션 시간을 밀리초로 변환

        // 🔧 2단계: 5분 간격 계산 체크 (시뮬레이션 시간 기준)
        const timeSinceLastCalculation = simulationMinutes - (lastCalculationTime[patientName] / (60 * 1000)); // 분 단위로 계산
        const shouldCalculate = timeSinceLastCalculation >= 5; // 5분 간격

        console.log(`⏰ Simulation time: ${simulationMinutes}m | Last calc: ${Math.round(lastCalculationTime[patientName] / (60 * 1000))}m`);
        console.log(`⏰ Time since last calculation: ${Math.round(timeSinceLastCalculation)}m`);
        console.log(`🧮 Should calculate: ${shouldCalculate}`);

        // 🔧 1단계: 혈당 데이터 저장 (매번 수행)
        const lastGlucose = bgHistoryDict[patientName].length > 0 ? 
            bgHistoryDict[patientName][bgHistoryDict[patientName].length - 1] : null;
        
        const newGlucoseData = {
            glucose: currentBG,
            date: currentTime.toISOString(),
            display_time: currentTime.toISOString(),
            delta: lastGlucose ? currentBG - lastGlucose.glucose : 0,
            device: "dexcom",
            timestamp: currentTimeMs
        };
        bgHistoryDict[patientName].push(newGlucoseData);

        // 히스토리 크기 제한 (최대 100개)
        if (bgHistoryDict[patientName].length > 100) {
            bgHistoryDict[patientName] = bgHistoryDict[patientName].slice(-100);
        }

        let calculationResult;

        if (shouldCalculate || !lastCalculationResults[patientName]) {
            // 🔧 3단계: 새로운 계산 수행
            console.log("🔄 Performing new calculation...");
            
            calculationResult = await performInsulinCalculation(
                patientName, 
                currentTime, 
                currentBG, 
                nextMealObject, 
                modelInputsToModObject, 
                subjObject,
                timeObject
            );
            
            // 계산 결과 및 시간 저장 (시뮬레이션 시간으로)
            lastCalculationResults[patientName] = calculationResult;
            lastCalculationTime[patientName] = simulationMinutes * 60 * 1000; // 🔧 시뮬레이션 시간 저장
            
            console.log("💾 New calculation saved");
        } else {
            // 🔧 4단계: 이전 계산 결과 반환
            console.log("📋 Returning cached calculation");
            calculationResult = lastCalculationResults[patientName];
            
            // 현재 혈당 정보만 업데이트
            calculationResult.additionalInfo.currentBG = currentBG;
            calculationResult.additionalInfo.lastUpdated = currentTime.toISOString();
        }

        // 응답 반환
        console.log(`📤 Response: Basal ${calculationResult.temporaryBasalRate} U/hr | SMB ${calculationResult.smb} U`);
        return res.status(200).json(calculationResult);

    } catch (err) {
        console.error("❌ Error in /calculate:", err);
        return res.status(500).json({ 
            error: "Internal Server Error", 
            details: err.message,
            status: "error",
            timestamp: new Date().toISOString()
        });
    }
});

// 🔧 인슐린 계산 수행 함수 (5분마다 실행)
async function performInsulinCalculation(patientName, currentTime, currentBG, nextMealObject, modelInputsToModObject, subjObject, timeObject) {
    console.log("🧮 === Starting Insulin Calculation ===");
    
    // 혈당 데이터 검증
    if (currentBG < 40 || currentBG > 400) {
        throw new Error(`Invalid glucose value: ${currentBG}`);
    }

    // IOB 계산
    const iobInputs = {
        history: pumpHistoryDict[patientName] || [],
        profile: profileDict[patientName],
        clock: currentTime.toISOString(),
        autosens: { ratio: 1 }
    };

    const iob_data_array = generateIOB(iobInputs);
    const iob_data = iob_data_array && iob_data_array.length > 0 ? iob_data_array : [{
        iob: 0,
        activity: 0,
        bolussnooze: 0,
        basaliob: 0,
        netbasalinsulin: 0,
        hightempinsulin: 0,
        lastBolusTime: 0,
        lastTemp: { rate: 0, duration: 0, date: 0 }
    }];

    // 감도 분석
    const detection_inputs = {
        iob_inputs: {
            history: pumpHistoryDict[patientName] || [],
            profile: profileDict[patientName],
            clock: currentTime.toISOString()
        },
        carbs: nextMealObject || {},
        glucose_data: getGlucoseDataForAutosens(patientName, currentTime, timeObject.minutesPastSimStart),
        basalprofile: profileDict[patientName].basalprofile,
        temptargets: {},
        retrospective: false
    };

    // 8시간 감도 계산
    detection_inputs.deviations = 96;
    const result8h = detectSensitivity(detection_inputs);
    
    // 24시간 감도 계산
    detection_inputs.deviations = 288;
    const result24h = detectSensitivity(detection_inputs);

    // 낮은 비율 선택
    const lowestRatio = Math.min(result8h.ratio || 1, result24h.ratio || 1);
    const autosens_data = { 
        ratio: lowestRatio,
        sensitivityRatio: lowestRatio
    };

    // 감도 분석 결과로 프로필 업데이트
    if (result8h.newisf && result8h.newisf !== profileDict[patientName].sens) {
        console.log(`🔄 Attempting to update ISF for ${patientName}. Current ISF: ${profileDict[patientName].sens}, New ISF from autosens: ${result8h.newisf}`);
        const oldIsf = profileDict[patientName].sens;
        profileDict[patientName].isfProfile.sensitivities[0].sensitivity = result8h.newisf;
        profileDict[patientName].sens = result8h.newisf;
        console.log(`✅ ISF for ${patientName} updated from ${oldIsf} to ${result8h.newisf} in performInsulinCalculation.`);
    } else if (result8h.newisf) {
        console.log(`ℹ️ ISF for ${patientName} unchanged. Current ISF: ${profileDict[patientName].sens}, Autosens ISF: ${result8h.newisf} (values are the same).`);
    } else {
        console.log(`ℹ️ ISF for ${patientName} not updated. Autosens did not return a new ISF value.`);
    }

    // 현재 혈당 상태 준비 (5분 간격의 평균 변화율 계산)
    const bgHistory = bgHistoryDict[patientName];
    const glucose_status = {
        glucose: currentBG,
        date: currentTime.toISOString(),
        delta: bgHistory.length >= 2 ? 
            currentBG - bgHistory[bgHistory.length - 2].glucose : 0,
        short_avgdelta: bgHistory.length >= 4 ?
            (currentBG - bgHistory[bgHistory.length - 4].glucose) / 3 : 0,
        long_avgdelta: bgHistory.length >= 10 ?
            (currentBG - bgHistory[bgHistory.length - 10].glucose) / 9 : 0,
        noise: 0,
        device: "dexcom"
    };

    // 현재 임시 베이설 상태
    const currenttemp = {
        temp: "absolute",
        rate: modelInputsToModObject.sqInsulinNormalBasal || profileDict[patientName].current_basal || 0.1,
        duration: 0
    };

    // SMB 계산을 위해 원래 베이설 레이트 보존
    const originalBasalRate = (subjObject.dailyBasalInsulin || 24) / 24;
    if (profileDict[patientName].current_basal <= 0) {
        profileDict[patientName].current_basal = originalBasalRate;
        profileDict[patientName].basalprofile[0].rate = originalBasalRate;
    }

    // 식사 데이터 준비
    const carbAmount = nextMealObject && nextMealObject.amountMg ? nextMealObject.amountMg / 1000 : 0;
    const hasCarbData = carbAmount > 0;
    
    const meal_data = {
        mealCOB: hasCarbData ? carbAmount : 0,
        carbs: hasCarbData ? carbAmount : 0,
        bwFound: false,
        bwCarbs: false,
        lastCarbTime: hasCarbData ? (currentTime.getTime() - (nextMealObject.minutesUntilNextMeal * 60000)) : 0,
        slopeFromMaxDeviation: bgHistory.length >= 2 ? 
            (bgHistory[bgHistory.length - 1].glucose - bgHistory[bgHistory.length - 2].glucose) / 5 : 0,
        slopeFromMinDeviation: bgHistory.length >= 2 ? 
            (bgHistory[bgHistory.length - 1].glucose - bgHistory[bgHistory.length - 2].glucose) / 5 : 0
    };

    console.log("📊 Calculation Inputs:");
    console.log(`   Glucose: ${glucose_status.glucose} mg/dL (Δ${glucose_status.delta})`);
    console.log(`   IOB: ${iob_data[0] ? iob_data[0].iob : 0} U`);
    console.log(`   COB: ${meal_data.mealCOB} g`);
    console.log(`   Autosens: ${autosens_data.ratio}`);

    // 베이설 계산 실행
    const result = await determine_basal(
        glucose_status,
        currenttemp,
        iob_data,
        profileDict[patientName],
        autosens_data,
        meal_data,
        tempBasalFunctions,
        false, // microBolusAllowed - SMB 활성화 -> false로 변경
        "50.0", // reservoir_data
        currentTime
    );

    console.log("📈 Calculation Results:");
    console.log(`   Basal: ${result.rate} U/hr`);
    console.log(`   Duration: ${result.duration} min`);
    console.log(`   SMB: ${result.units || 0} U`);
    console.log(`   Reason: ${result.reason}`);

    if (result.error) {
        throw new Error(`determine_basal error: ${result.error}`);
    }

    // 펌프 히스토리에 결과 추가 (베이설)
    if (result.rate !== undefined) {
        const pumpHistoryEntry = {
            timestamp: currentTime.toISOString(),
            _type: "TempBasal",
            temp: "absolute",
            rate: result.rate,
            started_at: currentTime,
            date: currentTime.getTime()
        };
        
        const durationEntry = {
            timestamp: currentTime.toISOString(),
            _type: "TempBasalDuration",
            "duration (min)": result.duration || 30,
            started_at: currentTime,
            date: currentTime.getTime()
        };
        
        pumpHistoryDict[patientName].push(pumpHistoryEntry);
        pumpHistoryDict[patientName].push(durationEntry);
    }

    // SMB가 있는 경우 히스토리에 추가
    if (result.units && result.units > 0) {
        const smbEntry = {
            timestamp: currentTime.toISOString(),
            _type: "Bolus",
            amount: result.units,
            programmed: result.units,
            unabsorbed: 0,
            duration: 0,
            started_at: currentTime,
            date: currentTime.getTime()
        };
        pumpHistoryDict[patientName].push(smbEntry);
    }

    // 펌프 히스토리 크기 제한
    if (pumpHistoryDict[patientName] && pumpHistoryDict[patientName].length > 200) {
        pumpHistoryDict[patientName] = pumpHistoryDict[patientName].slice(-200);
    }

    // 응답 객체 생성
    return {
        temporaryBasalRate: result.rate || profileDict[patientName].current_basal,
        basalDuration: result.duration || 30,
        smb: result.units || 0,
        reason: result.reason || "No specific reason provided",
        additionalInfo: {
            currentBG: currentBG,
            eventualBG: result.eventualBG,
            iob: iob_data[0] ? iob_data[0].iob : 0,
            cob: meal_data.mealCOB,
            autosensRatio: autosens_data.ratio,
            insulinSensitivityFactor: profileDict[patientName].sens,
            carbRatio: profileDict[patientName].carb_ratio,
            targetBG: (profileDict[patientName].min_bg + profileDict[patientName].max_bg) / 2,
            lastCalculated: currentTime.toISOString(),
            lastUpdated: currentTime.toISOString()
        },
        status: "success",
        timestamp: currentTime.toISOString(),
        patientId: patientName,
        calculationType: "new" // 새로운 계산임을 표시
    };
}

function getGlucoseDataForAutosens(patientName, currentTime, minutesPastSimStart) {
    const allGlucose = bgHistoryDict[patientName] || []; 
    console.error(`DEBUG getGlucoseDataForAutosens: Patient: ${patientName}, minutesPastSimStart: ${minutesPastSimStart}, initial allGlucose length: ${allGlucose.length}`);
    if (allGlucose.length > 0) {
        console.error(`DEBUG getGlucoseDataForAutosens: First glucose entry date: ${allGlucose[0].date}, Last glucose entry date: ${allGlucose[allGlucose.length - 1].date}`);
    }

    const twentyFourHoursAgoTimestamp = currentTime.getTime() - (24 * 60 * 60 * 1000);
    console.error(`DEBUG getGlucoseDataForAutosens: twentyFourHoursAgoTimestamp: ${new Date(twentyFourHoursAgoTimestamp).toISOString()}`);

    // Filter for the last 24 hours
    let relevantGlucose = allGlucose.filter(entry => new Date(entry.date).getTime() >= twentyFourHoursAgoTimestamp);
    console.error(`DEBUG getGlucoseDataForAutosens: relevantGlucose length after 24h filter: ${relevantGlucose.length}`);
    if (relevantGlucose.length > 0) {
        console.error(`DEBUG getGlucoseDataForAutosens: First relevant glucose date: ${relevantGlucose[0].date}, Last relevant glucose date: ${relevantGlucose[relevantGlucose.length - 1].date}`);
    }

    if (relevantGlucose.length === 0) {
        console.warn(`⚠️ Autosens for ${patientName}: No glucose points in the last 24h.`);
        return [];
    }

    // Downsample to roughly 5-minute intervals.
    // autosens.js internally reverses the array, so we provide data in chronological order (oldest first).
    const fiveMinIntervalData = [];
    let lastPushedTime = 0;
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    for (const entry of relevantGlucose) { // Iterate oldest to newest
        const entryTime = new Date(entry.date).getTime();
        // Push the first entry, or subsequent entries if they are >= 5 mins after the last pushed entry.
        if (fiveMinIntervalData.length === 0 || (entryTime - lastPushedTime >= FIVE_MINUTES_MS)) {
            fiveMinIntervalData.push({
                date: entry.date, // Preserve original timestamp
                glucose: Number(entry.glucose),
                dateString: new Date(entry.date).toISOString(), // Ensure dateString is in ISO format
                display_time: new Date(entry.date).toISOString() // Add display_time in ISO format
            });
            lastPushedTime = entryTime;
        }
    }

    if (fiveMinIntervalData.length < 12) { // Less than an hour of 5-min data (12 * 5 min = 60 min)
        console.warn(`⚠️ Autosens for ${patientName}: After 5-min sampling, only ${fiveMinIntervalData.length} glucose points for the last 24h. Might be insufficient for accurate ISF calculation.`);
    }
    
    // autosens.js expects properties like 'glucose' and 'dateString' or 'display_time'.
    // The prepGlucose function within autosens handles 'sgv' to 'glucose' mapping.
    return fiveMinIntervalData;
}

// 서버 시작
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

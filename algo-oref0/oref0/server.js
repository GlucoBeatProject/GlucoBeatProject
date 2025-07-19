const express = require("express");
const app = express();
const port = process.env.PORT || 8001;
const determine_basal = require('./lib/determine-basal/determine-basal');
const tempBasalFunctions = require('./lib/basal-set-temp');
const detectSensitivity = require('./lib/determine-basal/autosens');  // 감도 분석 함수 import (원래대로 복원)
const iobCalc = require('./lib/iob');  // IOB 계산 모듈 import
const detectCarbAbsorption = require('./lib/determine-basal/cob');  // COB 계산 모듈 import

// 전역 변수로 Dictionary 선언
const bgHistoryDict = {};
const cobHistoryDict = {};
const pumpHistoryDict = {};
const profileDict = {};  // 환자별 프로필 관리
const mealHistoryDict = {};  // 환자별 식사 히스토리

// Quest.csv 데이터 맵핑 (환자 이름별 CR, CF, TDI)
const QUEST_DATA = {
    'adolescent#001': { CR: 12, CF: 15.0360283441, TDI: 36.7339146827 },
    'adolescent#002': { CR: 5, CF: 13.1750891807, TDI: 62.031042736 },
    'adolescent#003': { CR: 23, CF: 33.5259913553, TDI: 24.2427803659 },
    'adolescent#004': { CR: 14, CF: 21.8224838663, TDI: 35.2528665417 },
    'adolescent#005': { CR: 12, CF: 20.9084301999, TDI: 34.0047207467 },
    'adolescent#006': { CR: 7, CF: 17.6966328214, TDI: 49.5812925714 },
    'adolescent#007': { CR: 8, CF: 12.4931832305, TDI: 43.638064 },
    'adolescent#008': { CR: 4, CF: 11.9355179763, TDI: 63.3866974592 },
    'adolescent#009': { CR: 21, CF: 20.013934775, TDI: 24.0781667718 },
    'adolescent#010': { CR: 14, CF: 31.8684843717, TDI: 33.1735076937 },
    'adult#001': { CR: 10, CF: 8.77310657487, TDI: 50.416652 },
    'adult#002': { CR: 8, CF: 9.21276345633, TDI: 57.86877688 },
    'adult#003': { CR: 9, CF: 17.9345522688, TDI: 56.4297186222 },
    'adult#004': { CR: 16, CF: 42.6533755134, TDI: 33.8079423727 },
    'adult#005': { CR: 5, CF: 8.23126750783, TDI: 68.315922352 },
    'adult#006': { CR: 10, CF: 18.21328135, TDI: 61.38880928 },
    'adult#007': { CR: 22, CF: 26.1530845971, TDI: 42.0066074109 },
    'adult#008': { CR: 13, CF: 12.2505850562, TDI: 42.7787865846 },
    'adult#009': { CR: 5, CF: 7.64317583896, TDI: 67.211482912 },
    'adult#010': { CR: 5, CF: 10.69260456, TDI: 64.448546656 },
    'child#001': { CR: 25, CF: 42.7177301243, TDI: 17.4729287744 },
    'child#002': { CR: 23, CF: 36.9153947641, TDI: 18.1778368801 },
    'child#003': { CR: 22, CF: 31.0525488428, TDI: 16.0218757795 },
    'child#004': { CR: 25, CF: 40.7235040865, TDI: 19.8151389176 },
    'child#005': { CR: 7, CF: 33.6312561084, TDI: 40.9345323552 },
    'child#006': { CR: 19, CF: 39.9807063565, TDI: 20.2240173973 },
    'child#007': { CR: 8, CF: 24.9969862972, TDI: 36.2128538724 },
    'child#008': { CR: 15, CF: 30.8823307429, TDI: 21.4944284585 },
    'child#009': { CR: 25, CF: 35.3170388027, TDI: 17.3942110251 },
    'child#010': { CR: 18, CF: 29.222745246, TDI: 20.6516964887 }
};

// 정적 프로필 설정 (임시 기저율 계산에만 집중)
const staticProfile = {
    "max_bg": 180,                    // 최대 혈당 목표 (mg/dL)
    "min_bg": 100,                    // 최소 혈당 목표 (mg/dL)
    "out_units": "mg/dL",             // 혈당 단위
    "max_basal": 3.0,                 // 최대 베이설 레이트 (U/hr)
    "min_5m_carbimpact": 8,           // 5분당 최소 탄수화물 영향
    "maxCOB": 120,                    // 최대 탄수화물 (g)
    "max_iob": 4.0,                   // 최대 인슐린 잔량 (U)
    "max_daily_safety_multiplier": 3, // 일일 안전 승수 최대값
    "current_basal_safety_multiplier": 4, // 현재 베이설 안전 승수
    "autosens_max": 1.2,              // 자동 감도 최대값
    "autosens_min": 0.7,              // 자동 감도 최소값
    "remainingCarbsCap": 90,          // 남은 탄수화물 상한값
    "enableUAM": false,               // 미확인 식사 감지 비활성화
    "enableSMB_with_bolus": true,     // SMB 활성화
    "enableSMB_with_COB": true,       // COB와 함께 SMB 활성화
    "enableSMB_with_temptarget": true, // 임시 목표와 함께 SMB 활성화
    "enableSMB_after_carbs": true,    // 탄수화물 섭취 후 SMB 활성화
    "enableSMB_always": true,         // 항상 SMB 활성화 (테스트용)
    "maxSMBBasalMinutes": 120,        // SMB 최대 베이설 분
    "curve": "rapid-acting",          // 인슐린 곡선 타입
    "useCustomPeakTime": false,       // 사용자 정의 피크 시간 사용 여부
    "insulinPeakTime": 75,            // 인슐린 피크 시간 (분)
    "dia": 6,                         // 인슐린 작용 지속 시간 (시간)
    "max_daily_basal": 3.0,           // 일일 최대 베이설 (U/hr)
    "bolus_increment": 0.1,           // 최소 볼루스 단위
    "A52_risk_enable": false,         // A52 위험 활성화
};

// JSON 형식의 요청 본문을 파싱할 수 있도록 express 미들웨어 설정
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 환자별 동적 프로필 초기화 함수
function initializePatientProfile(patientName, patient_state = null, questData = null) {
    if (!profileDict[patientName]) {
        // 기본값 설정
        let CR = 15;  // 기본 CR
        let CF = 50;  // 기본 CF
        let TDI = 24; // 기본 TDI
        
        // Quest.csv에서 환자 정보가 있으면 사용
        if (questData) {
            CR = questData.CR || 15;
            CF = questData.CF || 50;
            TDI = questData.TDI || 24;
        }
        
        // TDI를 기반으로 기본 베이설 레이트 계산
        const defaultBasalRate = TDI / 24; // TDI를 24시간으로 나눔
        
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
            "basal": [ // basal 배열도 추가 (일부 함수들이 이를 참조할 수 있음)
                {
                    "minutes": 0,
                    "rate": defaultBasalRate,
                    "start": "00:00:00",
                    "i": 0
                }
            ],
            "carb_ratios": {
                "schedule": [{
                    "x": 0,
                    "i": 0,
                    "offset": 0,
                    "ratio": CR,
                    "r": CR,
                    "start": "00:00:00"
                }],
                "units": "grams"
            },
            "carb_ratio": CR,
            "isfProfile": {
                "first": 1,
                "sensitivities": [{
                    "endOffset": 1440,
                    "offset": 0,
                    "x": 0,
                    "sensitivity": CF,
                    "start": "00:00:00",
                    "i": 0
                }],
                "user_preferred_units": "mg/dL",
                "units": "mg/dL"
            },
            "sens": CF,
            "bg_targets": {
                "first": 1,
                "targets": [{
                    "max_bg": 180,
                    "min_bg": 100,
                    "x": 0,
                    "offset": 0,
                    "low": 100,
                    "start": "00:00:00",
                    "high": 180,
                    "i": 0
                }],
                "user_preferred_units": "mg/dL",
                "units": "mg/dL"
            }
        };

    }
}

app.post("/oref0", async(req, res) => {
    const {
        current_cgm,
        cgm_history,
        insulin_history,
        smb_history,
        algorithm_history,
        current_meal,
        basal_history,
        patient_state,
        patient_name,
        timestamp
    } = req.body;

    try {
        const patientName = patient_name;
        const currentBG = current_cgm;

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
        if (!mealHistoryDict[patientName]) {
            mealHistoryDict[patientName] = [];
        }
        
        // 프로필 초기화 (QUEST_DATA에서 찾기)
        if (!profileDict[patientName]) {
            const questInfo = QUEST_DATA[patientName] || null;
            initializePatientProfile(patientName, patient_state, questInfo);
        }

        // 첫 실행이 아닌 경우 (기존 히스토리가 있는 경우)에만 이전 결과를 펌프 히스토리에 추가
        if (pumpHistoryDict[patientName] && pumpHistoryDict[patientName].length > 0) {
            // basal_history의 마지막 값과 smb_history의 마지막 값 사용
            const lastBasal = basal_history && basal_history.length > 0 ? basal_history[basal_history.length - 1] : 0;
            const lastSMB = smb_history && smb_history.length > 0 ? smb_history[smb_history.length - 1] : 0;
            
            addToPumpHistory(patientName, timestamp, {
                rate: lastBasal,
                duration: 5,
                units: lastSMB
            });
        }

        // 현재 CGM 값 추가 (중복 체크)
        const lastEntry = bgHistoryDict[patientName][bgHistoryDict[patientName].length - 1];
        if (!lastEntry || lastEntry.date !== timestamp) {
            bgHistoryDict[patientName].push({
                glucose: currentBG,
                date: timestamp,
                display_time: timestamp,
                device: "dexcom"
            });
        }

        // 식사 정보 처리 (current_meal이 0보다 클 때만 추가)
        if (current_meal && current_meal > 0) {
            mealHistoryDict[patientName].push({
                carbs: current_meal,
                created_at: timestamp,
                eventType: "Meal Bolus",
                insulin: 0,  // 식사 자체는 인슐린 0
                notes: `Simglucose meal: ${current_meal}g carbs`
            });
        }

        // 시간순 정렬
        bgHistoryDict[patientName].sort((a, b) => new Date(a.date) - new Date(b.date));

        // 히스토리 크기 제한 (24시간 데이터는 유지)
        const twentyFourHoursAgo = new Date(timestamp).getTime() - (24 * 60 * 60 * 1000);
        
        // CGM 히스토리 24시간 필터링
        bgHistoryDict[patientName] = bgHistoryDict[patientName].filter(entry => 
            new Date(entry.date).getTime() >= twentyFourHoursAgo
        );
        
        // 인슐린 히스토리도 24시간 필터링
        if (pumpHistoryDict[patientName]) {
            pumpHistoryDict[patientName] = pumpHistoryDict[patientName].filter(entry => {
                const entryTime = new Date(entry.timestamp || entry.date).getTime();
                return entryTime >= twentyFourHoursAgo;
            });
        }

        // 식사 히스토리도 24시간 필터링
        if (mealHistoryDict[patientName]) {
            mealHistoryDict[patientName] = mealHistoryDict[patientName].filter(entry => {
                const entryTime = new Date(entry.created_at).getTime();
                return entryTime >= twentyFourHoursAgo;
            });
        }

        // 인슐린 계산 수행
        const calculationResult = await performInsulinCalculation(
            patientName, 
            timestamp, 
            currentBG,
            patient_state
        );


        console.log(`\n=== CALCULATION COMPLETE ===`);
        console.log(`Temporary Basal: ${calculationResult.temporaryBasalRate} U/hr`);
        console.log(`SMB: ${calculationResult.smb} U`);
        console.log(`Reason: ${calculationResult.reason}`);

        return res.status(200).json(calculationResult);

    } catch (err) {
        console.error("Error in /oref0:", err);
        return res.status(500).json({ 
            error: "Internal Server Error", 
            details: err.message,
            status: "error",
            timestamp: new Date().toISOString()
        });
    }
});

// 인슐린 계산 수행 함수
async function performInsulinCalculation(patientName, currentTime, currentBG, patient_state) {
    
    const profile = profileDict[patientName];
    
    // 시간 객체 확인
    const currentTimeObj = typeof currentTime === 'string' ? new Date(currentTime) : currentTime;
    
    // 혈당 상태 준비
    const bgHistory = bgHistoryDict[patientName];
    const glucose_status = prepareGlucoseStatus(bgHistory, currentBG, currentTimeObj);

    // IOB 데이터 계산
    const iob_data = calculateIOB(patientName, profile, currentTimeObj);

    // 자동 감도 분석
    const autosens_data = await performAutosens(patientName, profile, currentTimeObj);
    
    // 현재 임시 베이설 상태
    const currenttemp = getCurrentTempBasal(pumpHistoryDict[patientName], profile);

    // 식사 데이터 및 COB 처리 - oref0 COB 모듈 사용
    const meal_data = calculateCOB(patientName, profile, currentTimeObj);


    // OpenAPS determine-basal 알고리즘 실행
    const result = await determine_basal(
        glucose_status,
        currenttemp,
        iob_data,
        profile,
        autosens_data,
        meal_data,
        tempBasalFunctions,
        true,  // microBolusAllowed (SMB 활성화)
        50,    // reservoir_data (충분한 인슐린)
        currentTimeObj
    );

    // 에러가 있으면 상세 로그 출력
    if (result.error) {
        console.error("determine_basal ERROR:", result.error);
    }

    // 결과 확인 및 기본값 설정
    const finalRate = (result.rate !== undefined && result.rate !== null) ? result.rate : profile.current_basal;
    const finalDuration = result.duration || 30;
    const finalSMB = result.units || 0;

    // Reason 처리 - 빈 문자열이거나 없으면 기본 메시지 설정
    let finalReason = result.reason || "";
    if (finalReason.trim() === "") {
        if (finalRate === profile.current_basal) {
            finalReason = `BG ${currentBG} mg/dL in target range. Maintaining current basal ${finalRate.toFixed(2)} U/hr`;
        } else {
            finalReason = `Adjusting basal to ${finalRate.toFixed(2)} U/hr for ${finalDuration} minutes`;
        }
    }
    // 단위 맞춰주기
    temporaryBasalRate = finalRate / 60;
    smb = finalSMB / 60;
    // 응답 객체 생성
    return {
        temporaryBasalRate: temporaryBasalRate,
        smb: smb,
        reason: finalReason,
        status: "success"
    };
}

// 혈당 상태 준비 함수
function prepareGlucoseStatus(bgHistory, currentBG, currentTime) {
    // 최근 혈당 데이터만 필터링 (최근 1시간)
    const oneHourAgo = currentTime.getTime() - (60 * 60 * 1000);
    const recentBG = bgHistory.filter(entry => {
        const entryTime = new Date(entry.date).getTime();
        return entryTime >= oneHourAgo;
    });

    // 시간순 정렬
    recentBG.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 변화율 계산을 위한 시간별 데이터 찾기
    const currentTimeMs = currentTime.getTime();
    let glucose5mAgo = null, glucose15mAgo = null, glucose45mAgo = null;

    // 5분, 15분, 45분 전 데이터 찾기
    recentBG.forEach(entry => {
        const entryTime = new Date(entry.date).getTime();
        const timeDiff = (currentTimeMs - entryTime) / (60 * 1000); // 분 단위

        if (timeDiff >= 4 && timeDiff <= 6 && !glucose5mAgo) {
            glucose5mAgo = entry.glucose;
        } else if (timeDiff >= 14 && timeDiff <= 16 && !glucose15mAgo) {
            glucose15mAgo = entry.glucose;
        } else if (timeDiff >= 44 && timeDiff <= 46 && !glucose45mAgo) {
            glucose45mAgo = entry.glucose;
        }
    });

    // 가장 최근 데이터가 없으면 마지막 데이터 사용
    if (!glucose5mAgo && recentBG.length > 1) {
        glucose5mAgo = recentBG[recentBG.length - 2]?.glucose;
    }

    // 변화율 계산
    const delta = glucose5mAgo ? currentBG - glucose5mAgo : 0;
    const short_avgdelta = glucose15mAgo ? (currentBG - glucose15mAgo) / 3 : delta / 3;
    const long_avgdelta = glucose45mAgo ? (currentBG - glucose45mAgo) / 9 : short_avgdelta;

    return {
        glucose: currentBG,
        date: currentTime.toISOString(),
        delta: Math.round(delta * 10) / 10,
        short_avgdelta: Math.round(short_avgdelta * 10) / 10,
        long_avgdelta: Math.round(long_avgdelta * 10) / 10,
        noise: 0,
        device: "dexcom"
    };
}

// 자동 감도 분석 함수
async function performAutosens(patientName, profile, currentTime) {
    try {
        const detection_inputs = {
            iob_inputs: {
                history: pumpHistoryDict[patientName] || [],
                profile: profile,
                clock: currentTime.toISOString()
            },
            carbs: cobHistoryDict[patientName] || [],
            glucose_data: getGlucoseDataForAutosens(patientName, currentTime),
            basalprofile: profile.basalprofile || profile.basal,
            temptargets: [],
            retrospective: false
        };

        // 8시간 감도 계산
        detection_inputs.deviations = 96;
        const result8h = detectSensitivity(detection_inputs);
        
        // 24시간 감도 계산
        detection_inputs.deviations = 288;
        const result24h = detectSensitivity(detection_inputs);

        // 더 보수적인 값 선택 (낮은 비율)
        const ratio = Math.min(result8h.ratio || 1, result24h.ratio || 1);
        
        return { 
            ratio: ratio,
            sensitivityRatio: ratio
        };
    } catch (err) {
        console.warn("Autosens failed, using default ratio 1.0:", err.message);
        return { ratio: 1.0, sensitivityRatio: 1.0 };
    }
}

// 현재 임시 베이설 상태 가져오기
function getCurrentTempBasal(pumpHistory, profile) {
    if (!pumpHistory || pumpHistory.length === 0) {
        return { 
            temp: "absolute", 
            rate: profile.current_basal, 
            duration: 0 
        };
    }

    // 최근 임시 베이설 찾기
    for (let i = pumpHistory.length - 1; i >= 0; i--) {
        const entry = pumpHistory[i];
        if (entry._type === "TempBasal") {
            // 다음 항목에서 duration 찾기
            for (let j = i; j < pumpHistory.length; j++) {
                if (pumpHistory[j]._type === "TempBasalDuration") {
                    // 시간이 만료되었는지 확인
                    const startTime = new Date(entry.timestamp).getTime();
                    const duration = pumpHistory[j]["duration (min)"] || 30;
                    const endTime = startTime + (duration * 60 * 1000);
                    const now = new Date().getTime();
                    
                    if (now < endTime) {
                        return {
                            temp: entry.temp || "absolute",
                            rate: entry.rate || profile.current_basal,
                            duration: Math.floor((endTime - now) / (60 * 1000))
                        };
                    }
                }
            }
        }
    }

    return { 
        temp: "absolute", 
        rate: profile.current_basal, 
        duration: 0 
    };
}

// 펌프 히스토리에 추가
function addToPumpHistory(patientName, currentTime, result) {
    if (!pumpHistoryDict[patientName]) {
        pumpHistoryDict[patientName] = [];
    }

    // 임시 베이설 추가
    if (result.rate !== undefined && result.rate !== null) {
        pumpHistoryDict[patientName].push({
            timestamp: currentTime.toISOString(),
            _type: "TempBasal",
            temp: "absolute",
            rate: result.rate,
            started_at: currentTime,
            date: currentTime.getTime()
        });
        
        pumpHistoryDict[patientName].push({
            timestamp: currentTime.toISOString(),
            _type: "TempBasalDuration",
            "duration (min)": result.duration || 30,
            started_at: currentTime,
            date: currentTime.getTime()
        });
    }

    // SMB 추가
    if (result.units && result.units > 0) {
        pumpHistoryDict[patientName].push({
            timestamp: currentTime.toISOString(),
            _type: "Bolus",
            amount: result.units,
            programmed: result.units,
            unabsorbed: 0,
            duration: 0,
            started_at: currentTime,
            date: currentTime.getTime()
        });
    }
}

// 펌프 히스토리를 oref0 treatments 형식으로 변환
function convertPumpHistoryToTreatments(pumpHistory, currentTime) {
    const treatments = [];
    const twentyFourHoursAgo = currentTime.getTime() - (24 * 60 * 60 * 1000);
    
    if (!pumpHistory || pumpHistory.length === 0) {
        return treatments;
    }

    pumpHistory.forEach(entry => {
        const entryTime = new Date(entry.timestamp || entry.date).getTime();
        
        // 24시간 이내 데이터만 처리
        if (entryTime < twentyFourHoursAgo) {
            return;
        }

        const treatment = {
            date: entryTime,
            started_at: entryTime,
            timestamp: entry.timestamp || new Date(entry.date).toISOString()
        };

        // 볼루스 처리
        if (entry._type === "Bolus" && entry.amount > 0) {
            treatment.insulin = entry.amount;
            treatment.eventType = "Correction Bolus";
            treatments.push(treatment);
        }
        
        // 임시 베이설 처리
        if (entry._type === "TempBasal" && entry.rate !== undefined) {
            // 다음 duration 찾기
            const durationEntry = pumpHistory.find(d => 
                d._type === "TempBasalDuration" && 
                Math.abs(new Date(d.timestamp).getTime() - entryTime) < 60000 // 1분 이내
            );
            
            treatment.rate = entry.rate;
            treatment.duration = durationEntry ? (durationEntry["duration (min)"] || 30) : 30;
            treatment.eventType = "Temp Basal";
            treatments.push(treatment);
        }
    });

    // 시간순 정렬
    treatments.sort((a, b) => a.date - b.date);
    
    return treatments;
}

// COB 계산 함수
function calculateCOB(patientName, profile, currentTime) {
    try {
        const mealHistory = mealHistoryDict[patientName] || [];
        const bgHistory = bgHistoryDict[patientName] || [];
        
        if (mealHistory.length === 0 || bgHistory.length === 0) {
            return {
                mealCOB: 0,
                carbs: 0,
                bwFound: false,
                bwCarbs: false,
                lastCarbTime: 0,
                slopeFromMaxDeviation: 0,
                slopeFromMinDeviation: 0
            };
        }

        // 최근 식사 찾기 (6시간 이내)
        const sixHoursAgo = currentTime.getTime() - (6 * 60 * 60 * 1000);
        const recentMeals = mealHistory.filter(meal => {
            const mealTime = new Date(meal.created_at).getTime();
            return mealTime >= sixHoursAgo;
        });

        if (recentMeals.length === 0) {
            return {
                mealCOB: 0,
                carbs: 0,
                bwFound: false,
                bwCarbs: false,
                lastCarbTime: 0,
                slopeFromMaxDeviation: 0,
                slopeFromMinDeviation: 0
            };
        }

        // 가장 최근 식사
        const lastMeal = recentMeals[recentMeals.length - 1];
        const lastMealTime = new Date(lastMeal.created_at);
        
        // COB 입력 데이터 준비
        const cobInputs = {
            glucose_data: getGlucoseDataForAutosens(patientName, currentTime),
            iob_inputs: {
                profile: profile,
                clock: currentTime.toISOString(),
                history: pumpHistoryDict[patientName] || []
            },
            basalprofile: profile.basalprofile || profile.basal,
            mealTime: lastMealTime.toISOString(),
            ciTime: lastMealTime.toISOString()
        };

        // oref0 COB 모듈 사용
        const cobResult = detectCarbAbsorption(cobInputs);
        
        // 총 탄수화물량 계산
        const totalCarbs = recentMeals.reduce((sum, meal) => sum + meal.carbs, 0);
        const remainingCarbs = Math.max(0, totalCarbs - (cobResult.carbsAbsorbed || 0));

        return {
            mealCOB: remainingCarbs,
            carbs: remainingCarbs,
            bwFound: false,
            bwCarbs: false,
            lastCarbTime: lastMealTime.getTime(),
            slopeFromMaxDeviation: cobResult.slopeFromMaxDeviation || 0,
            slopeFromMinDeviation: cobResult.slopeFromMinDeviation || 0
        };

    } catch (error) {
        console.warn("COB calculation failed, using default values:", error.message);
        return {
            mealCOB: 0,
            carbs: 0,
            bwFound: false,
            bwCarbs: false,
            lastCarbTime: 0,
            slopeFromMaxDeviation: 0,
            slopeFromMinDeviation: 0
        };
    }
}

// IOB 계산 함수
function calculateIOB(patientName, profile, currentTime) {
    try {
        // 펌프 히스토리를 treatments로 변환
        const treatments = convertPumpHistoryToTreatments(pumpHistoryDict[patientName], currentTime);
        
        // IOB 계산을 위한 입력 데이터 준비
        const iobInputs = {
            profile: profile,
            clock: currentTime.toISOString()
        };

        // oref0 IOB 모듈을 사용하여 IOB 계산 (treatments 직접 전달)
        const iobArray = iobCalc(iobInputs, true, treatments); // true = currentIOBOnly

        // 계산된 IOB 데이터가 있으면 사용, 없으면 기본값
        if (iobArray && iobArray.length > 0) {
            const currentIOB = iobArray[0];
            
            return [{
                iob: currentIOB.iob || 0,
                activity: currentIOB.activity || 0,
                bolussnooze: currentIOB.bolussnooze || 0,
                basaliob: currentIOB.basaliob || 0,
                netbasalinsulin: currentIOB.netbasalinsulin || 0,
                hightempinsulin: currentIOB.hightempinsulin || 0,
                lastBolusTime: currentIOB.lastBolusTime || 0,
                lastTemp: currentIOB.lastTemp || { 
                    rate: profile.current_basal, 
                    duration: 0, 
                    date: currentTime.getTime() 
                }
            }];
        } else {
            // 기본값 반환
            return [{
                iob: 0,
                activity: 0,
                bolussnooze: 0,
                basaliob: 0,
                netbasalinsulin: 0,
                hightempinsulin: 0,
                lastBolusTime: 0,
                lastTemp: { 
                    rate: profile.current_basal, 
                    duration: 0, 
                    date: currentTime.getTime() 
                }
            }];
        }
    } catch (error) {
        console.warn("IOB calculation failed, using default values:", error.message);
        // 에러 시 기본값 반환
        return [{
            iob: 0,
            activity: 0,
            bolussnooze: 0,
            basaliob: 0,
            netbasalinsulin: 0,
            hightempinsulin: 0,
            lastBolusTime: 0,
            lastTemp: { 
                rate: profile.current_basal, 
                duration: 0, 
                date: currentTime.getTime() 
            }
        }];
    }
}

// 자동 감도를 위한 혈당 데이터 가져오기
function getGlucoseDataForAutosens(patientName, currentTime) {
    const allGlucose = bgHistoryDict[patientName] || [];
    if (allGlucose.length === 0) return [];

    const twentyFourHoursAgo = currentTime.getTime() - (24 * 60 * 60 * 1000);
    
    // 24시간 이내 데이터 필터링
    const relevantGlucose = allGlucose.filter(entry => {
        const entryTime = new Date(entry.date).getTime();
        return entryTime >= twentyFourHoursAgo;
    });

    // 5분 간격으로 다운샘플링
    const fiveMinIntervalData = [];
    let lastPushedTime = 0;

    relevantGlucose.forEach(entry => {
        const entryTime = new Date(entry.date).getTime();
        if (lastPushedTime === 0 || (entryTime - lastPushedTime >= 5 * 60 * 1000)) {
            fiveMinIntervalData.push({
                date: entry.date,
                glucose: Number(entry.glucose),
                dateString: new Date(entry.date).toISOString(),
                display_time: new Date(entry.date).toISOString()
            });
            lastPushedTime = entryTime;
        }
    });
    return fiveMinIntervalData;
}

// 서버 시작
app.listen(port, () => {
    console.log(`OREF0 Algorithm Server running on port ${port}`);
    console.log(`Ready to receive data from Simglucose simulator`);
});

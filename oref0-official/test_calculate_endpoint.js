const axios = require('axios');

// 테스트용 데이터 - 사용자가 제공한 형식
const testData = {
  modelInputsToModObject: {
    mealCarbsMgPerMin: 0,
    highFatMealFlag: false,
    highProteinMealFlag: false,
    ignoreMealChoFlag: false,
    fullMealCarbMgExpectedAtStart: 0,
    glucOrDextIvInjMgPerMin: 0,
    glucagonSqInjMg: 0,
    exerciseIntensityAsFrac: 0,
    glucoseTabletDoseMg: 0,
    sqInsulinNormalBasal: 0.9,  // 현재 베이설 레이트 (U/hr)
    ivInsulinNormalBasal: 0,
    sqInsulinNormalBolus: 0,
    ivInsulinNormalBolus: 0,
    sqInsulinUltraRapidBolus: 0,
    slowRelInsulinStandardLongActing: 0,
    sqInsulinStandardLongActing: 0,
    ivInsulinStandardLongActing: 0,
    drugDoses: {},
    prevControlOutputs: {
      mealCarbsMgPerMin: 0,
      highFatMealFlag: false,
      highProteinMealFlag: false,
      ignoreMealChoFlag: false,
      fullMealCarbMgExpectedAtStart: 0,
      glucOrDextIvInjMgPerMin: 0,
      glucagonSqInjMg: 0,
      exerciseIntensityAsFrac: 0,
      glucoseTabletDoseMg: 0,
      sqInsulinNormalBasal: 0,
      ivInsulinNormalBasal: 0,
      sqInsulinNormalBolus: 0,
      ivInsulinNormalBolus: 0,
      sqInsulinUltraRapidBolus: 5,
      slowRelInsulinStandardLongActing: 0,
      sqInsulinStandardLongActing: 0,
      ivInsulinStandardLongActing: 0,
      drugDoses: {}
    },
    prevModelInputs: {
      mealCarbsMgPerMin: 0,
      highFatMealFlag: false,
      highProteinMealFlag: false,
      ignoreMealChoFlag: false,
      fullMealCarbMgExpectedAtStart: 0,
      glucOrDextIvInjMgPerMin: 0,
      glucagonSqInjMg: 0,
      exerciseIntensityAsFrac: 0,
      glucoseTabletDoseMg: 0,
      sqInsulinNormalBasal: 0,
      ivInsulinNormalBasal: 0,
      sqInsulinNormalBolus: 0,
      ivInsulinNormalBolus: 0,
      sqInsulinUltraRapidBolus: 5,
      slowRelInsulinStandardLongActing: 0,
      sqInsulinStandardLongActing: 0,
      ivInsulinStandardLongActing: 0,
      drugDoses: {}
    }
  },
  nextMealObject: {
    amountMg: 30000,  // 30g 탄수화물
    durationInMinutes: 15,
    minutesUntilNextMeal: 53,
    bolusMultiplier: 1
  },
  sensorSigArray: [153.3, 153.3],  // 현재 혈당 값 (mg/dL)
  subjObject: {
    name: 'adult#005',
    type1: true,
    CR: 13,         // 탄수화물 비율 (g/U)
    CF: 48,         // 교정 인자 (mg/dL/U)
    Gb: 119.65,     // 기준 혈당 (mg/dL)
    BW: 67.11,      // 체중 (kg)
    dailyBasalInsulin: 22.04,  // 일일 베이설 인슐린 (U)
    OGTT: null
  },
  timeObject: {
    minutesPastSimStart: 727,      // 시뮬레이션 시작 후 분
    daysSinceJan1: 0,
    daysSinceMonday: 0,
    minutesPastMidnight: 727       // 자정 후 분
  }
};

// 테스트 시나리오들
const testScenarios = [
    {
        name: "정상 혈당",
        patientName: "adult#001", 
        currentBG: 120,
        previousBG: 118, // 🔧 이전 혈당 추가로 delta 생성 (+2)
        nextMeal: { amountMg: 0, durationInMinutes: 15, minutesUntilNextMeal: 53, bolusMultiplier: 1 },
        expected: "베이설 유지"
    },
    {
        name: "고혈당", 
        patientName: "adult#002", 
        currentBG: 200,
        previousBG: 120, // 🔧 큰 상승폭 (+80) 생성
        nextMeal: { amountMg: 0, durationInMinutes: 15, minutesUntilNextMeal: 53, bolusMultiplier: 1 },
        expected: "높은 베이설 + SMB"
    },
    {
        name: "저혈당",
        patientName: "adult#003",   
        currentBG: 70,
        previousBG: 140, // 🔧 큰 하락폭 (-70) 생성
        nextMeal: { amountMg: 0, durationInMinutes: 15, minutesUntilNextMeal: 53, bolusMultiplier: 1 },
        expected: "베이설 중단"
    },
    {
        name: "식사 예정 (30g)",
        patientName: "adult#004", 
        currentBG: 130, 
        previousBG: 123, // 🔧 완만한 상승 (+7) 생성
        nextMeal: { amountMg: 30000, durationInMinutes: 15, minutesUntilNextMeal: 53, bolusMultiplier: 1 },
        expected: "베이설 증가 + SMB"
    }
];

async function testCalculateEndpoint() {
  console.log("=== OpenAPS SMB & Basal Calculator Test ===\n");
  
  for (const scenario of testScenarios) {
    try {
      console.log(`\n🧪 Testing: ${scenario.name}`);
      console.log(`   Current BG: ${scenario.currentBG} mg/dL`);
      console.log(`   Previous BG: ${scenario.previousBG} mg/dL`);
      console.log(`   Next Meal: ${scenario.nextMeal.amountMg / 1000}g carbs`);
      
      // 🔧 1단계: 이전 혈당을 먼저 보내서 히스토리 생성
      await axios.post('http://localhost:5000/calculate', {
        ...testData,
        sensorSigArray: [scenario.previousBG],
        nextMealObject: { amountMg: 0, durationInMinutes: 15, minutesUntilNextMeal: 53, bolusMultiplier: 1 },
        subjObject: {
          ...testData.subjObject,
          name: scenario.patientName
        },
        timeObject: {
          ...testData.timeObject,
          minutesPastSimStart: 720 + (testScenarios.indexOf(scenario) * 10) // 5분 전
        }
      });
      
      // 🔧 2단계: 현재 혈당으로 실제 테스트 수행 (delta 생성됨)
      const response = await axios.post('http://localhost:5000/calculate', {
        ...testData,
        sensorSigArray: [scenario.currentBG, scenario.previousBG],
        nextMealObject: scenario.nextMeal,
        subjObject: {
          ...testData.subjObject,
          name: scenario.patientName
        },
        timeObject: {
          ...testData.timeObject,
          minutesPastSimStart: 727 + (testScenarios.indexOf(scenario) * 10) // 🔧 각 시나리오마다 10분씩 시간 차이
        }
      });
      
      if (response.data.status === 'success') {
        console.log("✅ Success!");
        console.log(`   📊 Temporary Basal: ${response.data.temporaryBasalRate} U/hr for ${response.data.basalDuration} min`);
        console.log(`   💉 SMB: ${response.data.smb} U`);
        console.log(`   🎯 Target BG: ${response.data.additionalInfo.targetBG} mg/dL`);
        console.log(`   📈 Eventual BG: ${response.data.additionalInfo.eventualBG} mg/dL`);
        console.log(`   💊 IOB: ${response.data.additionalInfo.iob} U`);
        console.log(`   🍎 COB: ${response.data.additionalInfo.cob} g`);
        console.log(`   🔄 Autosens Ratio: ${response.data.additionalInfo.autosensRatio}`);
        console.log(`   📝 Reason: ${response.data.reason.substring(0, 100)}...`);
      } else {
        console.log("❌ Failed:", response.data.error);
      }
      
    } catch (error) {
      console.log(`❌ Error testing ${scenario.name}:`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Error: ${error.response.data.error}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }
    
    // 각 테스트 간 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// 서버가 실행 중인지 확인
async function checkServer() {
  try {
    await axios.get('http://localhost:5000');
    return true;
  } catch (error) {
    return false;
  }
}

// 메인 실행
async function main() {
  console.log("🔍 Checking if server is running...");
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log("❌ Server is not running. Please start the server first:");
    console.log("   cd lib && node server.js");
    return;
  }
  
  console.log("✅ Server is running!");
  await testCalculateEndpoint();
  
  console.log("\n🎉 Testing completed!");
  console.log("\n📚 API Documentation:");
  console.log("   Endpoint: POST http://localhost:5000/calculate");
  console.log("   Input: JSON object with modelInputsToModObject, nextMealObject, sensorSigArray, subjObject, timeObject");
  console.log("   Output: temporaryBasalRate, basalDuration, smb, reason, additionalInfo");
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testCalculateEndpoint, testData }; 
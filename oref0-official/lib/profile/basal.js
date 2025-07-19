//runIteration function parameter descriptions:
// subjObject properties:
//   name:  subject name, as displayed in the subject selection tab (e.g. adult#001).
//   type1:  boolean indicating true if the subject is type 1
//   CR:  Carbohydrate ratio (g/Unit)
//   CF:  Correction Factor (mg/dL/Unit)
//   Gb:  Basal (fasting) glucose concentration (mg/dL)
//   BW:  bodyweight (kg)
//   dailyBasalInsulin:  Daily amount of basal "normal" insulin needed to maintain the basal fasting glucose concentration, Gb (Units)
//   OGTT:  The subject's 2-hour OGTT result -- only applicable to T2 and prediabetic subjects (mg/dL)
// sensorSigArray structure:
//   an array of values from sensor signals configured for this Plugin Control.  The order of signals in this array matches
//   the order as entered via the "Edit Input Signals" dialog box within the configuration of this control.
// nextMealObject properties:
//   amountMg
//   durationInMinutes
//   minutesUntilNextMeal
//   bolusMultiplier
// nextExerciseObject properties:
//   intensityFrac:  a value from 0.0 to 1.0, where the following values correspond to the indicated levels:
//                                   0:      No exercise
//                                   0.25:   Light exercise
//                                   0.5:    Moderate exercise
//                                   0.655:  Intense exercise
//   durationInMinutes
//   minutesUntilNextSession
// timeObject properties:
//   minutesPastSimStart:  number of minutes since the start of the simulation
//   daysSinceJan1:  number of days since Jan 1 (0 for Jan 1, 1 for Jan 2, etc.) -- can be used for time of year, to handle possible seasonal effects
//   daysSinceMonday:  number of days since Monday (0 for Monday, 1 for Tuesday, etc.) -- can be used for handling weekly schedules
//   minutesPastMidnight:  time of day, in minutes since midnight (0=midnight, 360=6AM, 720=noon, etc.)
// modelInputsToModObject properties:
//   mealCarbsMgPerMin:  rate of consumption of meal carbohydrates (mg/minute)
//   fullMealCarbMgExpectedAtStart:  value indicated only at start of meal (0 at all other times), representing total carbs in upcoming meal (mg).
//   highFatMealFlag:  boolean (true or false) value to be set at the same time as fullMealCarbMgExpectedAtStart, indicating whether this meal is high in fat
//   highProteinMealFlag:  boolean (true or false) value to be set at the same time as fullMealCarbMgExpectedAtStart, indicating whether this meal is high in protein
//   glucOrDextIvInjMgPerMin:  glucose or dextrose provided by IV (mg/minute)
//   glucagonSqInjMg:  rate of glucagon being provided subcutaneously (mg/minute)
//   exerciseIntensityAsFrac:  intensity of exercise as a fraction of full intensity (1.0 = full intensity, 0.0 = no exercise)
//   glucoseTabletDoseMg:  size (in mg) of a glucose tablet being provided at this instant.
//   sqInsulinNormalBasal:  subcutaneous delivery rate of normal insulin being used for basal insulin (pmol/minute)
//   ivInsulinNormalBasal:  intraveneous delivery rate of normal insulin being used for basal insulin (pmol/minute)
//   sqInsulinNormalBolus:  subcutaneous delivery rate of normal insulin being used as a bolus (pmol/minute) -- usually the whole bolus is given in 1 minute
//   ivInsulinNormalBolus:  intraveneous delivery rate of normal insulin being used as a bolus (pmol/minute) -- usually the whole bolus is given in 1 minute
//   sqInsulinUltraRapidBolus:  intraveneous delivery rate of ultra-rapid insulin being used as a bolus (pmol/minute) -- usually the whole bolus is given in 1 minute
//   slowRelInsulinStandardLongActing:  delivery rate of the standard long-acting insulin (pmol/minute) -- usually the whole dose is given in 1 minute
//   sqCustomInsulin1:       subcutaneous delivery rate of the 1st user-defined insulin (pmol/minute), only to be used when this insulin is not of a "slow release" variety
//   ivCustomInsulin1:       intraveneous delivery rate of the 1st user-defined insulin (pmol/minute), only to be used when this insulin is not of a "slow release" variety
//   slowRelCustomInsulin1:  delivery rate of the 1st user-defined insulin, to be used when this insulin is of a slow release variety.
//   sqCustomInsulin2:       subcutaneous delivery rate of the 2nd user-defined insulin (pmol/minute), only to be used when this insulin is not of a "slow release" variety
//   ivCustomInsulin2:       intraveneous delivery rate of the 2nd user-defined insulin (pmol/minute), only to be used when this insulin is not of a "slow release" variety
//   slowRelCustomInsulin2:  delivery rate of the 1st user-defined insulin, to be used when this insulin is of a slow release variety.
//   ...etc.
//  The order in which custom insulins are associated with the ...CustomInsulin1, 2, etc. properties will correspond to the order in the "insulin definitions"
//  configuration page.
//
//  The following are deprecated properties of modelInputsToModObject.  These remain for backward compatibility, but have been replaced by slowRelInsulinStandardLongActing,
//  because slow release insulins are defined to release into a specific compartment (e.g. subcutaneous or plasma).  If either of the following properties
//  are used, the insulin will be released into the compartment designeated for the insulin's release profile, just as will be the case when
//  slowRelInsulinStandardLongActing is uesd:
//   sqInsulinStandardLongActing:  subcutaneous delivery rate of the standard long-acting insulin (pmol/minute) -- usually the whole dose is given in 1 minute
//   ivInsulinStandardLongActing:  intraveneous delivery rate of the standard long-acting insulin (pmol/minute) -- usually the whole dose is given in 1 minute
//
// modelInputsToModObject sub-objects (snapshots of earlier modelInputs):
//   prevControlOutputs:  contains all modelInputsToModObject properties, as described above, where values represent a snapshot from the
//                        previous iteration, immediately after completion of all control elements' runIteration function
//   prevModelInputs:     contains all modelInputsToModObject properties, as described above, where values represent a snapshot from the
//                        previous iteration, immediately after completion of all delivery elements' runIteration function
//
// inNamedSignals:
//   This is an optional parameter that can be used to receive signals generated from other control elements as output signals (in their
//   outSigArray parameter -- see below)
//
// outSigArray:
//   This is an optional parameter that can be populated with values that will be contributed to the recorded state history files, in the same way that sensor
//   signals are.  When such output signals are to be contributed in this way, the user must also implement the numOutSignals and outSignalName functions.
//   The values in outSigArray will be made available to control elements running after this control element, via their inNamedSignals parameter
//
// outRunStopStatus:
//   This is an optional parameter that can be populated with values in the following fields, to indicate whether the simulation should be stopped
//   and why:
//      stopRun:  boolean (true or false) value indicating whether the simulation should stop after returning from the runIteration function
//      error:    boolean value indicating whether an error condition is responsible for stopping the simulation
//      message:  text message giving an explanation of why the simulation is to be stopped.
//
function runIteration(
    subjObject,
    sensorSigArray,
    nextMealObject,
    nextExerciseObject,
    timeObject,
    modelInputsToModObject,
    inNamedSignals,
    outSigArray,
    outRunStopStatus
  ) {
    bg = sensorSigArray[0];
    cgm = sensorSigArray[1];
  
    // 여기부터 서버와의 통신 시작
    // sentData에 dmms.r에서 받아온 아무 정보를 그냥 넣었어.
    // trio 알고리즘에 필요한 정보를 찾아서 넣어줘야 해.
    var sentData = {
    //   rescueCarbsDelivered: outSigArray[0], // 응급 탄수화물
    //   correctionBolusDelivered: outSigArray[1], // 보정 인슐린
    //   subject: {
    //     CR: subjObject.CR || 0,
    //     CF: subjObject.CF || 0,
    //     dailyBasalInsulin: subjObject.dailyBasalInsulin || 0,
    //   },
        sensorSigArray: sensorSigArray,
        subjObject: subjObject,
        modelInputsToModObject: modelInputsToModObject,
        nextMealObject: nextMealObject,
        //nextExerciseObject: nextExerciseObject,
        timeObject: timeObject,
        //inNamedSignals: inNamedSignals,
        //outSigArray: outSigArray, 이건 서버에서 받아와야함
        //outRunStopStatus: outRunStopStatus
    };
  
    // 위의 sentData를 JSON 형식으로 반환해서 넘겨줘야해서 변환한 걸 requestBody에 저장한거야
    var requestBody = JSON.stringify(sentData); // JSON 형식으로 변환
  
    // 이건 통신을 할때 이거 json이야 라고 형식 표기를 서버에 넘겨줄 때 필요한 애야.
    var contentType = "application/json"; // 콘텐츠 타입을 JSON으로 설정
  
    try {
      // 얘가 중요한건데 httpWebServiceInvoker 얘가 http://127.0.0.1:5000/predict_action 이 주소로
      // 아까 우리 위에서(line 136) json 으로 변환한 거(requestBody)를 contentType(line 139) - json으로 보낸다 이거야. 뒤에 숫자는 서버를 기다리는 시간.
      // success는 서버에서 응답한 걸 저장한 변수야
      var success = httpWebServiceInvoker.performPostRequest(
        "http://127.0.0.1:5000/trio",
        requestBody,
        contentType,
        5000
      );
  
      // 아래는 서버에 정보가 잘 갔고 정보를 잘 받았는 지 오류를 잡아내는 코드라고 보면 돼.
      // 응답 상태 코드 확인 (200-299 범위이면 성공)
      if (
        success &&
        httpWebServiceInvoker.responseStatusCode() >= 200 &&
        httpWebServiceInvoker.responseStatusCode() < 300
      ) {
        // 서버 응답에서 basalRes 받기
        var basalRes = JSON.parse(httpWebServiceInvoker.responseBody());
        modelInputsToModObject.sqInsulinNormalBasal = basalRes.insulin_value;
        modelInputsToModObject.sqInsulinUltraRapidBolus = 5;
        //modelInputsToModObject.sqInsulinNormalBasal = 100;
        // 받은 basalRes를 outSigArray에 추가
        // outSigArray.push({
        //   val : basalRes.insulin_value,
        //   msg : basalRes.message
        // });
        // 응답이 성공적으로 왔으면 로그 기록
        debugLog += "\n 응답 성공 : " + basalRes.message;
      } else {
        // 응답이 실패한 경우 (상태 코드가 200-299가 아닌 경우)
        debugLog +=
          "\n 응답 실패, 상태 코드(200이 아니면 에러임): " +
          httpWebServiceInvoker.responseStatusCode();
      }
    } catch (e) {
      // 오류가 발생한 경우
      debugLog += "\n 웹서버랑 통신이 안되는 오류 발생 : " + e;
    }
  
    // 그래서 소영이가 해야할 고쳐야할 부분은 line 128~ 133에 들어갈 trio 알고리즘에 필요한 변수를 찾아서 넣기.
  }
  
  //initialization function to perform tasks required before the first invocation of runIteration
  //this may involve initializing variables, reading settings from a file, or opening a file for writing
  //data that may be recorded on each runIteration call.
  //parameters are as follows:
  //  popName -- name of the population associated with the currently running subject
  //  subjName -- name of the currently running subject.  Often, this (and the population name) may be useful
  //              in building the name of a file to which we want to record data
  //  simDuration -- number of minutes in the full simulation.
  //  configDir -- default configuration directory, as set in the DMMS under the Tools/Settings menu.
  //  baseResultsDir -- default base directory for simulation results to be recoreded, as set in the DMMS under the Tools/Settings menu.
  //  simName -- Simulation name, as configured in the "General" tab of the DMMS.R's GUI
  function initialize(
    popName,
    subjName,
    simDuration,
    configDir,
    baseResultsDir,
    simName
  ) {}
  
  //initialization function for setting up randomized functionality.  This provides the plugin with
  //random number generation seeds that allow the plugin to be consistent with the choices made in the configuration
  //GUI under the "General" tab's "Randomization" section ("use random seed common to all elements", "base seed", and
  //"make unique seed for each subject").
  //When "useUniversalSeed" is true, the plugin should always use the universalSeed provided as the 2nd parameter
  //to this function.  Otherwise, the plugin is free to use a seed of its own choosing.
  function initializeRandomization(useUniversalSeed, universalSeed) {}
  
  //cleanup function to be called after the final call of runIteration.
  //This can be used to close files that may need to remain open through all invocations of the runIteration function.
  //It can also be used to add final statistical information to files written by the plugin.
  function cleanup() {}
  
  //This function is used to let the plugin declare how many sensor signals it needs to be given (in the sensorSigArray parameter of the runIteration function).
  function numSignals() {
    return 2;
  }
  //This function lets the plugin provide a description for each of the sensor signals it needs.  These descriptions will be presented in the DMMS' GUI
  //for selecting the actual sensor signal to be used in the "role" expressed by each description.  For example, in the case of this samplePluginControlElement,
  //based on the below implementation of the signalDescription() function, the user will get to pick which sensor signal is used for "SMBG measurement" within
  //this plugin.
  function signalDescription(signalIndex) {
    switch (signalIndex) {
      case 0:
        return "SMBG measurement";
      case 1:
        return "CGM reading";
    }
  }
  
  //optional functions to allow the plugin control element to contribute signals to the recorded state histories (in the same way that sensor signals
  //are included in these histories).  If these functions are not included, the assumed number of output signals will be 0, and the outSigArray of the
  //runIteration function will be ignored by the DMMS.
  //The names defined here are ones that can be used to access these values in other control elements' runIteration function, as:
  //    inNamedSignals.<name as returned by outSignalName function>

  //numOutSignals 함수는 플러그인이 몇 개의 출력 신호를 제공할지를 정의합니다. 이 숫자는 outSigArray 배열에 포함될 항목의 개수를 결정합니다. 나현
  function numOutSignals() {
    return 2;
  }
  function outSignalName(signalIndex) {
    switch (signalIndex) {
      case 0:
        return "rescueCarbsMg";
      case 1:
        return "correctionBolusPmol";
    }
  }
  
  function requiresSqInsulinSupport() {
    return true;
  }
  function requiresSqGlucoseSupport() {
    return false;
  }
  function requiresInsulinDosingSupport() {
    return false;
  }
  function requiresCPeptideSupport() {
    return false;
  }
  function requiresSqGlucagonSupport() {
    return false;
  }
  function debugLoggingEnabled() {
    return true;
  }
  
  // Basal profile lookup functions
  function basalLookup(basalprofile, time) {
    if (!basalprofile || basalprofile.length === 0) {
        return 0;
    }
    
    // If only basalprofile is provided (for current basal)
    if (!time) {
        var now = new Date();
        return basalLookup(basalprofile, now);
    }
    
    var minutesPastMidnight = time.getHours() * 60 + time.getMinutes();
    var currentRate = basalprofile[0].rate;
    
    for (var i = 0; i < basalprofile.length; i++) {
        var entry = basalprofile[i];
        var entryMinutes = entry.minutes || (entry.i * 30); // fallback calculation
        
        if (minutesPastMidnight >= entryMinutes) {
            currentRate = entry.rate;
        } else {
            break;
        }
    }
    
    return currentRate;
  }

  function maxDailyBasal(inputs) {
    if (!inputs.basals || inputs.basals.length === 0) {
        return 0;
    }
    
    var maxRate = 0;
    for (var i = 0; i < inputs.basals.length; i++) {
        if (inputs.basals[i].rate > maxRate) {
            maxRate = inputs.basals[i].rate;
        }
    }
    
    return maxRate;
  }

  function maxBasalLookup(inputs) {
    // Usually max_basal is configured as 3x the highest scheduled basal rate
    var maxDaily = maxDailyBasal(inputs);
    var maxBasal = inputs.settings && inputs.settings.max_basal ? inputs.settings.max_basal : maxDaily * 3;
    return maxBasal;
  }

  // Export the functions
  module.exports = {
    basalLookup: basalLookup,
    maxDailyBasal: maxDailyBasal,
    maxBasalLookup: maxBasalLookup
  };
  
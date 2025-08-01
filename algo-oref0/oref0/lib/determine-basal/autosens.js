'use strict';

var basal = require('../profile/basal');
var get_iob = require('../iob');
var find_insulin = require('../iob/history');
var isf = require('../profile/isf');
var find_meals = require('../meal/history');
var tz = require('moment-timezone');
var percentile = require('../percentile');

function detectSensitivity(inputs) {

    //console.error(inputs.glucose_data[0]);
    var glucose_data = inputs.glucose_data.map(function prepGlucose (obj) {
        //Support the NS sgv field to avoid having to convert in a custom way
        obj.glucose = obj.glucose || obj.sgv;
        return obj;
    });
    //console.error(glucose_data[0]);
    var iob_inputs = inputs.iob_inputs;
    var basalprofile = inputs.basalprofile;
    var profile = inputs.iob_inputs.profile;

    if (inputs.retrospective) {
        //console.error(glucose_data[0]);
        // Ensure glucose_data[0] exists and has a valid date
        if (glucose_data && glucose_data.length > 0 && glucose_data[0] && glucose_data[0].date) {
            var lastSiteChange = new Date(new Date(glucose_data[0].date).getTime() - (24 * 60 * 60 * 1000));
        } else {
            // Fallback if glucose_data is problematic, use clock like the non-retrospective case.
            console.error("Error: retrospective is true but glucose_data[0] is invalid or has no date. Falling back for lastSiteChange using inputs.iob_inputs.clock.");
            var lastSiteChange = new Date(new Date(inputs.iob_inputs.clock).getTime() - (24 * 60 * 60 * 1000));
        }
    } else {
        // Use the provided clock input for current time, not the system's wall clock time.
        //console.error(`DEBUG: autosens - Calculating lastSiteChange: inputs.iob_inputs.clock is ${inputs.iob_inputs.clock ? new Date(inputs.iob_inputs.clock).toISOString() : 'undefined'}`);
        var lastSiteChange = new Date(new Date(inputs.iob_inputs.clock).getTime() - (24 * 60 * 60 * 1000));
    }
    // Add a log to see what lastSiteChange is set to initially.
    // console.error(`DEBUG: autosens - Initial lastSiteChange: ${lastSiteChange ? lastSiteChange.toISOString() : 'undefined'}, retrospective: ${inputs.retrospective}`);

    if (inputs.iob_inputs.profile.rewind_resets_autosens === true ) {
        // scan through pumphistory and set lastSiteChange to the time of the last pump rewind event
        // if not present, leave lastSiteChange unchanged at 24h ago.
        var history = inputs.iob_inputs.history;
        for (var h=1; h < history.length; ++h) {
            if ( ! history[h]._type || history[h]._type !== "Rewind" ) {
                //process.stderr.write("-");
                continue;
            }
            if ( history[h].timestamp ) {
                lastSiteChange = new Date( history[h].timestamp );
                console.error("Setting lastSiteChange to",lastSiteChange,"using timestamp",history[h].timestamp);
                break;
            }
        }
    }

    // get treatments from pumphistory once, not every time we get_iob()
    var treatments = find_insulin(inputs.iob_inputs);

    var mealinputs = {
        history: inputs.iob_inputs.history
    , profile: profile
    , carbs: inputs.carbs
    , glucose: inputs.glucose_data
    //, prepped_glucose: prepped_glucose_data
    };
    var meals = find_meals(mealinputs);
    meals.sort(function (a, b) {
        var aDate = new Date(tz(a.timestamp));
        var bDate = new Date(tz(b.timestamp));
        //console.error(aDate);
        return bDate.getTime() - aDate.getTime();
    });
    //console.error(meals);

    var avgDeltas = [];
    var bgis = [];
    var deviations = [];
    var deviationSum = 0;
    var bucketed_data = [];
    glucose_data.reverse();

    // Added logs to inspect glucose_data after reverse
    // console.error(`DEBUG: autosens - After reverse. glucose_data.length: ${glucose_data.length}`);
    //if (glucose_data.length > 0) {
    //    console.error(`DEBUG: autosens - First element of reversed glucose_data: ${JSON.stringify(glucose_data[0])}`);
    //    if (glucose_data.length > 1) {
    //        console.error(`DEBUG: autosens - Second element of reversed glucose_data: ${JSON.stringify(glucose_data[1])}`);
    //    }
    //}

    bucketed_data[0] = glucose_data[0];
    //console.error(bucketed_data[0]);
    var j=0;
    // go through the meal treatments and remove any that are older than the oldest glucose value
    //console.error(meals);
    for (var i=1; i < glucose_data.length; ++i) {
        var bgTime;
        var lastbgTime;
        if (glucose_data[i].display_time) {
            bgTime = new Date(glucose_data[i].display_time);
        } else if (glucose_data[i].dateString) {
            bgTime = new Date(glucose_data[i].dateString);
        } else if (glucose_data[i].xDrip_started_at) {
            continue;
        } else { console.error("Could not determine BG time"); }
        if (glucose_data[i-1].display_time) {
            lastbgTime = new Date(glucose_data[i-1].display_time);
        } else if (glucose_data[i-1].dateString) {
            lastbgTime = new Date(glucose_data[i-1].dateString);
        } else if (glucose_data[0] && glucose_data[0].display_time) {
            //console.error("DEBUG: autosens - Using glucose_data[0].display_time for lastbgTime"); 
            lastbgTime = new Date(glucose_data[0].display_time);
        } else if (glucose_data[i-1].xDrip_started_at) {
            continue;
        } else { console.error("Could not determine last BG time"); }

        // Log bgTime and lastbgTime before calculating elapsed_minutes
        //console.error(`DEBUG: autosens - Loop i=${i}: bgTime: ${bgTime ? bgTime.toISOString() : 'undefined'}, lastbgTime: ${lastbgTime ? lastbgTime.toISOString() : 'undefined'}`);

        if (!glucose_data[i] || typeof glucose_data[i].glucose === 'undefined' || !glucose_data[i-1] || typeof glucose_data[i-1].glucose === 'undefined') {
            //console.error(`DEBUG: autosens - Loop i=${i}: Skipping due to undefined glucose. glucose[i]: ${JSON.stringify(glucose_data[i])}, glucose[i-1]: ${JSON.stringify(glucose_data[i-1])}`);
            continue;
        }

        if (glucose_data[i].glucose < 39 || glucose_data[i-1].glucose < 39) {
            //console.error(`DEBUG: autosens - Loop i=${i}: Skipping due to glucose < 39. glucose[i]: ${glucose_data[i].glucose}, glucose[i-1]: ${glucose_data[i-1].glucose}`);
            continue;
        }
        // only consider BGs since lastSiteChange
        if (lastSiteChange) {
            var hoursSinceSiteChange = (bgTime-lastSiteChange)/(60*60*1000);
            if (hoursSinceSiteChange < 0) {
                //console.error(hoursSinceSiteChange, bgTime, lastSiteChange);
                //console.error(`DEBUG: autosens - Loop i=${i}: Skipping due to hoursSinceSiteChange < 0.`);
                continue;
            }
        }
        var elapsed_minutes = (bgTime - lastbgTime)/(60*1000);
        // Log elapsed_minutes
        //console.error(`DEBUG: autosens - Loop i=${i}: elapsed_minutes: ${elapsed_minutes}`);

        if(Math.abs(elapsed_minutes) > 2) {
            j++;
            bucketed_data[j]=glucose_data[i];
            bucketed_data[j].date = bgTime.getTime();
            //console.error(`DEBUG: autosens - Loop i=${i}: Added to bucketed_data. j=${j}, bucketed_data.length=${bucketed_data.length}, elapsed_minutes=${elapsed_minutes}`);
        } else {
            // This case should ideally not happen often if data is already 5-min spaced
            bucketed_data[j].glucose = (bucketed_data[j].glucose + glucose_data[i].glucose)/2;
            //console.error(`DEBUG: autosens - Loop i=${i}: Averaged glucose in bucketed_data[${j}]. j=${j}, bucketed_data.length=${bucketed_data.length}, elapsed_minutes=${elapsed_minutes}`);
        }
    }

    // Log bucketed_data before shift
    //console.error(`DEBUG: autosens - Before shift. bucketed_data.length: ${bucketed_data.length}`);
    //if (bucketed_data.length > 0) {
        //console.error(`DEBUG: autosens - First element of bucketed_data before shift: ${JSON.stringify(bucketed_data[0])}`);
        // console.error(`DEBUG: autosens - All bucketed_data before shift: ${JSON.stringify(bucketed_data)}`); // For very detailed view if needed
    //}

    bucketed_data.shift();

    // Log bucketed_data after shift
    //console.error(`DEBUG: autosens - After shift. bucketed_data.length: ${bucketed_data.length}`);
    //if (bucketed_data.length > 0) {
    //    console.error(`DEBUG: autosens - First element of bucketed_data after shift: ${JSON.stringify(bucketed_data[0])}`);
    //}

    //console.error(bucketed_data[0]);
    for (i=meals.length-1; i>0; --i) {
        var treatment = meals[i];
        //console.error(treatment);
        if (treatment) {
            var treatmentDate = new Date(tz(treatment.timestamp));
            var treatmentTime = treatmentDate.getTime();
            var glucoseDatum = bucketed_data[0];
            //console.error(glucoseDatum);
            if (! glucoseDatum || ! glucoseDatum.date) {
              //console.error("No date found on: ",glucoseDatum);
              continue;
            }
            var BGDate = new Date(glucoseDatum.date);
            var BGTime = BGDate.getTime();
            if ( treatmentTime < BGTime ) {
                //console.error("Removing old meal: ",treatmentDate);
                meals.splice(i,1);
            }
        }
    }
    var absorbing = 0;
    var uam = 0; // unannounced meal
    var mealCOB = 0;
    var mealCarbs = 0;
    var mealStartCounter = 999;
    var type="";
    var lastIsfResult = null;
    //console.error(bucketed_data);
    //console.error(`DEBUG: autosens - Before main loop. bucketed_data.length: ${bucketed_data.length}`);
    for (i=3; i < bucketed_data.length; ++i) {
        bgTime = new Date(bucketed_data[i].date);
        var sens;
        [sens, lastIsfResult] = isf.isfLookup(profile.isfProfile, bgTime, lastIsfResult);

        //console.error(bgTime , bucketed_data[i].glucose);
        var bg;
        var avgDelta;
        var delta;
        if (typeof(bucketed_data[i].glucose) !== 'undefined') {
            bg = bucketed_data[i].glucose;
            var last_bg = bucketed_data[i-1].glucose;
            var old_bg = bucketed_data[i-3].glucose;
            if ( isNaN(bg) || !bg || bg < 40 || isNaN(old_bg) || !old_bg || old_bg < 40 || isNaN(last_bg) || !last_bg || last_bg < 40) {
                process.stderr.write("!");
                continue;
            }
            avgDelta = (bg - old_bg)/3;
            delta = (bg - last_bg);
        } else {
            console.error("Could not find glucose data");
            continue;
        }

        avgDelta = avgDelta.toFixed(2);
        iob_inputs.clock=bgTime;
        iob_inputs.profile.current_basal = basal.basalLookup(basalprofile, bgTime);
        // make sure autosens doesn't use temptarget-adjusted insulin calculations
        iob_inputs.profile.temptargetSet = false;
        //console.log(JSON.stringify(iob_inputs.profile));
        //console.error("Before: ", new Date().getTime());
        var iob = get_iob(iob_inputs, true, treatments)[0];
        //console.error("After: ", new Date().getTime());
        //console.log(JSON.stringify(iob));

        var bgi = Math.round(( -iob.activity * sens * 5 )*100)/100;
        bgi = bgi.toFixed(2);
        //console.error(delta);
        var deviation;
        if (isNaN(delta) ) {
            console.error("DEBUG: Bad delta: ",delta, bg, last_bg, old_bg);
        } else {
            deviation = delta-bgi;
        }
        //if (!deviation) { console.error(deviation, delta, bgi); }
        // set positive deviations to zero if BG is below 80
        if ( bg < 80 && deviation > 0 ) {
            //console.error(`DEBUG: Deviation ${deviation} set to 0 because BG ${bg} < 80`);
            deviation = 0;
        }
        deviation = parseFloat(deviation.toFixed(2)); // Ensure deviation is a number

        // 추가된 로그: deviation 계산 과정 확인
//        console.error(`DEBUG: Calculated deviation: ${deviation} (delta: ${delta}, bgi: ${bgi}, bg: ${bg})`);

        glucoseDatum = bucketed_data[i];
        //console.error(glucoseDatum);
        BGDate = new Date(glucoseDatum.date);
        BGTime = BGDate.getTime();
        // As we're processing each data point, go through the treatment.carbs and see if any of them are older than
        // the current BG data point.  If so, add those carbs to COB.
        treatment = meals[meals.length-1];
        if (treatment) {
            treatmentDate = new Date(tz(treatment.timestamp));
            treatmentTime = treatmentDate.getTime();
            if ( treatmentTime < BGTime ) {
                if (treatment.carbs >= 1) {
            //console.error(treatmentDate, treatmentTime, BGTime, BGTime-treatmentTime);
                    mealCOB += parseFloat(treatment.carbs);
                    mealCarbs += parseFloat(treatment.carbs);
                    var displayCOB = Math.round(mealCOB);
                    //console.error(displayCOB, mealCOB, treatment.carbs);
                    process.stderr.write(displayCOB.toString()+"g");
                }
                meals.pop();
            }
        }

        // calculate carb absorption for that 5m interval using the deviation.
        if ( mealCOB > 0 ) {
            //var profile = profileData;
            var ci = Math.max(deviation, profile.min_5m_carbimpact);
            var absorbed = ci * profile.carb_ratio / sens;
            if (absorbed) {
                mealCOB = Math.max(0, mealCOB-absorbed);
            } else {
                console.error(absorbed, ci, profile.carb_ratio, sens, deviation, profile.min_5m_carbimpact);
            }
        }

        // If mealCOB is zero but all deviations since hitting COB=0 are positive, exclude from autosens
        //console.error(mealCOB, absorbing, mealCarbs);
        //console.error(`DEBUG: Before type decision - mealCOB: ${mealCOB}, absorbing: ${absorbing}, mealCarbs: ${mealCarbs}, type: ${type}, mealStartCounter: ${mealStartCounter}, uam: ${uam}`);
        if (mealCOB > 0 || absorbing || mealCarbs > 0) {
            if (deviation > 0 ) {
                absorbing = 1;
            } else {
                absorbing = 0;
            }
            // stop excluding positive deviations as soon as mealCOB=0 if meal has been absorbing for >5h
            if ( mealStartCounter > 60 && mealCOB < 0.5 ) {
                displayCOB = Math.round(mealCOB);
                process.stderr.write(displayCOB.toString()+"g");
                absorbing = 0;
            }
            if ( ! absorbing && mealCOB < 0.5 ) {
                mealCarbs = 0;
            }
            // check previous "type" value, and if it wasn't csf, set a mealAbsorption start flag
            //console.error(type);
            if ( type !== "csf" ) {
                process.stderr.write("(");
                mealStartCounter = 0;
                //glucoseDatum.mealAbsorption = "start";
                //console.error(glucoseDatum.mealAbsorption,"carb absorption");
            }
            mealStartCounter++;
            type="csf";
            //console.error(`DEBUG: Type set to 'csf'. mealStartCounter: ${mealStartCounter}`);
            glucoseDatum.mealCarbs = mealCarbs;
            //if (i == 0) { glucoseDatum.mealAbsorption = "end"; }
            //CSFGlucoseData.push(glucoseDatum);
        } else {
          // check previous "type" value, and if it was csf, set a mealAbsorption end flag
          if ( type === "csf" ) {
            process.stderr.write(")");
            //CSFGlucoseData[CSFGlucoseData.length-1].mealAbsorption = "end";
            //console.error(CSFGlucoseData[CSFGlucoseData.length-1].mealAbsorption,"carb absorption");
          }

          var currentBasal = iob_inputs.profile.current_basal;
          // always exclude the first 45m after each carb entry using mealStartCounter
          //if (iob.iob > currentBasal || uam ) {
          //console.error(`DEBUG: Entering 'else' for type decision. iob.iob: ${iob.iob}, currentBasal: ${currentBasal}, uam: ${uam}, mealStartCounter: ${mealStartCounter}`);
          if ((!inputs.retrospective && iob.iob > 2 * currentBasal) || uam || mealStartCounter < 9 ) {
            mealStartCounter++;
            if (deviation > 0) {
                uam = 1;
            } else {
                uam = 0;
            }
            if ( type !== "uam" ) {
                process.stderr.write("u(");
                //glucoseDatum.uamAbsorption = "start";
                //console.error(glucoseDatum.uamAbsorption,"uannnounced meal absorption");
            }
            //console.error(mealStartCounter);
            type="uam";
            //console.error(`DEBUG: Type set to 'uam'. mealStartCounter: ${mealStartCounter}, uam: ${uam}`);
          } else {
            if ( type === "uam" ) {
                process.stderr.write(")");
                //console.error("end unannounced meal absorption");
            }
            type = "non-meal";
            //console.error(`DEBUG: Type set to 'non-meal'.`);
          }
        }

        // Exclude meal-related deviations (carb absorption) from autosens
        //console.error(`DEBUG: Final type for deviation push: ${type}`);
        if ( type === "non-meal" ) {
            if ( deviation > 0 ) {
                //process.stderr.write(" "+bg.toString());
                process.stderr.write("+");
            } else if ( deviation === 0 ) {
                process.stderr.write("=");
            } else {
                //process.stderr.write(" "+bg.toString());
                process.stderr.write("-");
            }
            avgDeltas.push(avgDelta);
            bgis.push(bgi);
            deviations.push(deviation);
            deviationSum += parseFloat(deviation);
        } else {
            process.stderr.write("x");
        }
        // add an extra negative deviation if a high temptarget is running and exercise mode is set
        if (profile.high_temptarget_raises_sensitivity === true || profile.exercise_mode === true) {
            var tempTarget = tempTargetRunning(inputs.temptargets, bgTime)
            if (tempTarget) {
                //console.error(tempTarget)
            }
            if ( tempTarget > 100 ) {
                // for a 110 temptarget, add a -0.5 deviation, for 160 add -3
                var tempDeviation=-(tempTarget-100)/20;
                process.stderr.write("-");
                //console.error(tempDeviation)
                deviations.push(tempDeviation);
            }
        }

        var minutes = bgTime.getMinutes();
        var hours = bgTime.getHours();
        if ( minutes >= 0 && minutes < 5 ) {
            //console.error(bgTime);
            process.stderr.write(hours.toString()+"h");
            // add one neutral deviation every 2 hours to help decay over long exclusion periods
            if ( hours % 2 === 0 ) {
                deviations.push(0);
                process.stderr.write("=");
            }
        }
        var lookback = inputs.deviations;
        if (!lookback) { lookback = 96; }
        // only keep the last 96 non-excluded data points (8h+ for any exclusions)
        if (deviations.length > lookback) {
            deviations.shift();
        }
    }
    //console.error("");
    process.stderr.write(" ");
    //console.log(JSON.stringify(avgDeltas));
    //console.log(JSON.stringify(bgis));
    // when we have less than 8h worth of deviation data, add up to 90m of zero deviations
    // this dampens any large sensitivity changes detected based on too little data, without ignoring them completely
    console.error("");
    console.error("Using most recent",deviations.length,"deviations since",lastSiteChange);
    if (deviations.length < 96) {
        var pad = Math.round((1 - deviations.length/96) * 18);
        console.error("Adding",pad,"more zero deviations");
        for (var d=0; d<pad; d++) {
            //process.stderr.write(".");
            deviations.push(0);
        }
    }
    avgDeltas.sort(function(a, b){return a-b});
    bgis.sort(function(a, b){return a-b});
    deviations.sort(function(a, b){return a-b});
    for (i=0.9; i > 0.1; i = i - 0.01) {
        //console.error("p="+i.toFixed(2)+": "+percentile(avgDeltas, i).toFixed(2)+", "+percentile(bgis, i).toFixed(2)+", "+percentile(deviations, i).toFixed(2));
        if ( percentile(deviations, (i+0.01)) >= 0 && percentile(deviations, i) < 0 ) {
            //console.error("p="+i.toFixed(2)+": "+percentile(avgDeltas, i).toFixed(2)+", "+percentile(bgis, i).toFixed(2)+", "+percentile(deviations, i).toFixed(2));
            var lessThanZero = Math.round(100*i);
            console.error(lessThanZero+"% of non-meal deviations negative (>50% = sensitivity)");
        }
        if ( percentile(deviations, (i+0.01)) > 0 && percentile(deviations, i) <= 0 ) {
            //console.error("p="+i.toFixed(2)+": "+percentile(avgDeltas, i).toFixed(2)+", "+percentile(bgis, i).toFixed(2)+", "+percentile(deviations, i).toFixed(2));
            var greaterThanZero = 100-Math.round(100*i);
            console.error(greaterThanZero+"% of non-meal deviations positive (>50% = resistance)");
        }
    }
    var p5 = percentile(deviations, 0.05);
    var p95 = percentile(deviations, 0.95);
    // cap filter range at +2 to -2 mg/dL/5m
    p5 = Math.max(-2, p5);
    p95 = Math.min(2, p95);

    // 추가된 로그: p5, p95 값 확인
    //console.error(`DEBUG: p5: ${p5}, p95: ${p95} from deviations array (length: ${deviations.length})`);

    var oldEnough = false;
    var newEnough = false;
    var avgDeviation = deviationSum / deviations.length;
    // 추가된 로그: avgDeviation 값 확인
    //console.error(`DEBUG: avgDeviation: ${avgDeviation}, deviationSum: ${deviationSum}, deviations.length: ${deviations.length}`);

    var basalOff = 0;

    if(p5 < 0) { // sensitive
        basalOff = p5 * (60/5) / profile.sens;
        process.stderr.write("Insulin sensitivity detected: ");
    } else if (p95 > 0) { // resistant
        basalOff = p95 * (60/5) / profile.sens;
        process.stderr.write("Insulin resistance detected: ");
    } else {
        console.error("Sensitivity normal.");
    }
    var ratio = 1 + (basalOff / profile.max_daily_basal);
    //console.error(basalOff, profile.max_daily_basal, ratio);

    // don't adjust more than 1.2x by default (set in preferences.json)
    var rawRatio = ratio;
    ratio = Math.max(ratio, profile.autosens_min);
    ratio = Math.min(ratio, profile.autosens_max);

    if (ratio !== rawRatio) {
      console.error('Ratio limited from ' + rawRatio + ' to ' + ratio);
    }

    ratio = Math.round(ratio*100)/100;
    var newisf = Math.round(profile.sens / ratio);
    //console.error(profile, newisf, ratio);
    console.error("ISF adjusted from "+profile.sens+" to "+newisf);
    //console.error("Basal adjustment "+basalOff.toFixed(2)+"U/hr");
    //console.error("Ratio: "+ratio*100+"%: new ISF: "+newisf.toFixed(1)+"mg/dL/U");
    return {
        "ratio": ratio,
        "newisf": newisf
    }
}

function detectSensitivityWrapper(inputs) {
    //console.error("DEBUG: Entering detectSensitivity with inputs:", JSON.stringify(inputs.glucose_data.slice(-5))); // Log last 5 glucose data points
    const result = detectSensitivity(inputs);
    //console.error("DEBUG: Exiting detectSensitivity with result:", JSON.stringify(result));
    return result;
}

module.exports = detectSensitivity;

function tempTargetRunning(temptargets_data, time) {
    // sort tempTargets by date so we can process most recent first
    try {
        temptargets_data.sort(function (a, b) { return new Date(a.created_at) < new Date(b.created_at) });
    } catch (e) {
        //console.error("Could not sort temptargets_data.  Optional feature temporary targets disabled.");
    }
    //console.error(temptargets_data);
    //console.error(time);
    for (var i = 0; i < temptargets_data.length; i++) {
        var start = new Date(temptargets_data[i].created_at);
        //console.error(start);
        var expires = new Date(start.getTime() + temptargets_data[i].duration * 60 * 1000);
        //console.error(expires);
        if (time >= new Date(temptargets_data[i].created_at) && temptargets_data[i].duration === 0) {
            // cancel temp targets
            //console.error(temptargets_data[i]);
            return 0;
        } else if (time >= new Date(temptargets_data[i].created_at) && time < expires ) {
            //console.error(temptargets_data[i]);
            var tempTarget = ( temptargets_data[i].targetTop + temptargets_data[i].targetBottom ) / 2;
            //console.error(tempTarget);
            return tempTarget;
        }
    }
}

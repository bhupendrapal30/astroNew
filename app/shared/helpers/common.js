var config = require('../../config/config');
var moment = require('moment');
var models = require('../../../models');
var CurrencyMaster = models.CurrencyMaster;
var ratecheckcurrency = models.ratecheckcurrency;
var currencyliverate = models.currencyliverate;
var rm_exp_notification = models.rm_exp_notification;
var AWS = require('aws-sdk');
var s3 = new AWS.S3({
    accessKeyId: config.awsAccessKeyId,
    secretAccessKey: config.awsSecretAccessKey,
    region: config.awsRegion
});
var ExpSheet = models.ExpSheet;

//notification mail
var path = require('path');
var mail = require(__basedir + '/app/shared/helpers/mail');
var sms = require(__basedir + '/app/shared/helpers/sms');
var history = require(__basedir + '/app/shared/helpers/history');
var notification = require(__basedir + '/app/shared/helpers/notification');

var masters = require(__basedir + '/models/api/masters');
var apiModel = require(__basedir + '/models/api/apiModel');

exports.sayHello = function (name) {
    return "hello! " + name;
};

exports.getLength = function (text) {
    return text.length;
};

//upload file to aws bucket
exports.bucketUpload = (params, bucket) => {
    s3.putObject(params, function (err, data) {
        if (err)
            return false;
        else
            return true;
    });
}

//get aws bucket file link
exports.bucketDownload = (params, bucket) => {
    return config.awsBucketAccessPath + params.key;
}

// dateformate 
exports.dateformate = function (date) {
    return moment(date).format('DD-MMM-YYYY');
}
exports.million = function (labelValue) {
    var x = labelValue;
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
exports.lacandcrore = function (value) {
    var x = Math.round(value);
    x = x.toString();
    var lastThree = x.substring(x.length - 3);
    var otherNumbers = x.substring(0, x.length - 3);
    if (otherNumbers != '')
        lastThree = ',' + lastThree;
    var res = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
    return res;
}

exports.millionWithDecimal = function (value) {
    var result = value.toString().split('.');
    var output = result[0].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    // if (result.length > 1) {
    //     output += "." + result[1];
    // }

    return output;
}

exports.lacandcroreWithDecimal = function (value) {
    var result = value.toString().split('.');

    var lastThree = result[0].substring(result[0].length - 3);
    var otherNumbers = result[0].substring(0, result[0].length - 3);
    if (otherNumbers != '')
        lastThree = ',' + lastThree;
    var output = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
    if (result.length > 1) {
        output += "." + result[1];
    }

    return output;
}

var noofdays = exports.noofdays = async function (mdate, cdate) {
    const startDate = mdate;
    const endDate = cdate;
    const timeDiff = (new Date(startDate)) - (new Date(endDate));
    const days = timeDiff / (1000 * 60 * 60 * 24);
    return { 'days': days };

}

exports.dateDiff = function (date, serach_date) {
    date = date.split('-');
    var serachdate = new Date(serach_date);
    var year = serachdate.getFullYear();
    var month = serachdate.getMonth() + 1;
    var day = serachdate.getDate();
    var yy = parseInt(date[0]);
    var mm = parseInt(date[1]);
    var dd = parseInt(date[2]);
    var years, months, days;
    // months
    months = month - mm;
    if (day < dd) {
        months = months - 1;
    }
    // years
    years = year - yy;
    if (month * 100 + day < mm * 100 + dd) {
        years = years - 1;
        months = months + 12;
    }
    // days
    days = Math.floor((serachdate.getTime() - (new Date(yy + years, mm + months - 1, dd)).getTime()) / (24 * 60 * 60 * 1000));
    return { years: years, months: months, days: days };
}

// calculate currency pair name
exports.currencyPairName = async function (currency_from, currency_to) {
    const currFromData = await CurrencyMaster.findAll({ attributes: ['id', 'currency_name'], raw: true, where: { id: currency_from, status: '1', delete_status: '0' } }).catch((err) => console.log(err));
    var currFromName = '';
    if (currFromData.length > 0) {
        currFromName = currFromData[0].currency_name;
    }
    const currToData = await CurrencyMaster.findAll({ attributes: ['id', 'currency_name'], raw: true, where: { id: currency_to, status: '1', delete_status: '0' } }).catch((err) => console.log(err));
    var currToName = '';
    if (currToData.length > 0) {
        currToName = currToData[0].currency_name;
    }
    var currencyPairName = currFromName + '/' + currToName;

    return currencyPairName;
}
//calculate forward rate
var forwardrate = exports.forwardrate = async function (maturitydate, exp_imp, currency_from, currency_to, margin = "0") {
    var importexport = exp_imp;
   // var spot_date = await onTxnDate(3);
    where = { transaction_type:3};
    var data = await masters.get_definecol_bytbl_cond(['date'], 'ctsdate', where);
    var spot_date = data[0].date;
    var current_date = moment(spot_date).format('YYYY-MM-DD')
    var dates = dateDiff1(current_date, maturitydate);
    if (dates.years < 0) {
        return { 'current_forward': null, 'current_spot': null, 'premium': null };
    }
    var RemainingMonths = dates.months;

    var RemainingDays = dates.days;
    var PlusOneMonth = RemainingMonths + 1;
    if (dates.years > 0) {
        var RemainingMonths = 11;

        var RemainingDays = 30;
        var PlusOneMonth = 12;
    }
    if (exp_imp == 1) {
        var expimptype = 'ASK';

    } else {
        var expimptype = 'BID';
    }
    var mcolname = RemainingMonths + 'M';
    var mat_sql = "SELECT `" + mcolname + "` as m from ratecheck_maturitydays";

    var mat_data = await models.sequelize.query(mat_sql, { type: sequelize.QueryTypes.SELECT });

    var monthenddate = mat_data[0].m;
    var rc_res = await ratecheckcurrency.findAll({ attributes: ['id', 'pair', 'primarycurrency', 'type', 'crossvalue'], raw: true, where: { currency_from_id: currency_from, currency_to_id: currency_to, status: '1' } }).catch((err) => console.log(err));
    //console.log(rc_res);
    if (rc_res.length > 0) {
        var primarycurrency = rc_res[0].primarycurrency
        var crossvalue = rc_res[0].crossvalue;
        var currencypair = rc_res[0].pair;
        var type = rc_res[0].type;
      // const cur_liverate_sql = await currencyliverate.findAll({ attributes: ['id', 'PAIR', 'SPOTASK', 'SPOTBID'], raw: true, where: { PAIR: currencypair } }).catch((err) => console.log(err));
        const cur_liverate_sql = await spotrates(currency_from, currency_to, true);
        if (importexport == 1) {
            var spot_rate = cur_liverate_sql.spotask;
        } else {
            var spot_rate = cur_liverate_sql.spotbid;
        }
        if (RemainingMonths < 1) {
            var cur_data = await onRemainL1M(expimptype, primarycurrency, primarycurrency);
            var curr1 = cur_data[0];

            var spotrate = curr1.spotrate;
            if (spotrate <= 9.9) {
                var val = 10000;
            } else {
                var val = 100;
            }
          //  var currentmontprem = curr1.currentmontprem / val;
            var currentmontprem = curr1.currentmontprem;
           // var currentmontprem = parseFloat(currentmontprem) + parseFloat(spotrate);
            var noofdaysprm = (currentmontprem) / monthenddate * RemainingDays;
            var usdvalue = parseFloat(noofdaysprm) + parseFloat(spotrate);
            var usdvalue = usdvalue.toFixed(4)
            if (type == 1 || type == 3 || type == 2 || type == 4) {
                var finalvalue = usdvalue;
                if (type == 3 || type == 4) {
                    var finalvalue = 1 / finalvalue;
                }
                let premium = parseFloat(finalvalue) - parseFloat(spot_rate);
                return { 'current_forward': finalvalue, 'current_spot': spot_rate, 'premium': premium.toFixed(4) };
            }

        } else {

            var curr1 = await onRemainG1M(expimptype, primarycurrency, RemainingMonths, PlusOneMonth, primarycurrency);
            var curr1 = curr1[0];

            var spotrate = curr1.spotrate;
            if (spotrate <= 9.9) {
                val = 10000;
            } else {
                val = 100;
            }
            // var currentmontprem = curr1.currentmontprem / val;
            // var firstmonthdata = curr1.firstmonthdata / val;
            // var secondmonth = curr1.secondmonth / val;
            var currentmontprem = curr1.currentmontprem;
            var firstmonthdata = curr1.firstmonthdata;
            var secondmonth = curr1.secondmonth;

            var noofdaysprm = (secondmonth - firstmonthdata) / monthenddate * RemainingDays;
            var usdvalue = parseFloat(noofdaysprm) + parseFloat(spotrate) + parseFloat(firstmonthdata);
            if (type == 1 || type == 3 || type == 2 || type == 4) {
                var finalvalue = usdvalue;
                if (type == 3 || type == 4) {
                    var finalvalue = 1 / finalvalue;
                }
                let premium = parseFloat(finalvalue) - parseFloat(spot_rate);
                return { 'current_forward': finalvalue, 'current_spot': spot_rate, 'premium': premium.toFixed(4) };
            }
        }

        if (RemainingMonths < 1) {
            if (type == '5' || type == '6') {

                if (importexport == '1') {
                    var exp_imp_type = 'BID';
                } else {
                    var exp_imp_type = 'ASK';
                }
                var curr1 = await onRemainL1M(exp_imp_type, currencypair, crossvalue);
            } else {
                var curr1 = await onRemainL1M(expimptype, currencypair, crossvalue);
            }

            var curr1 = curr1[0];
            var spotrate = curr1.spotrate;
            if (spotrate <= 9.9) {
                val = 10000;
            } else {
                val = 100;
            }
           // var currentmontprem = curr1.currentmontprem / val + spotrate;
            var currentmontprem = curr1.currentmontprem  + spotrate;
            var noofdaysprm = (currentmontprem - spotrate) / monthenddate * RemainingDays;

            var finalcrossvalue = parseFloat(noofdaysprm) + parseFloat(spotrate);
            var finalcrossvalue = finalcrossvalue.toFixed(4);
            if (type == '5' || type == '6') {
                var finalvalue = usdvalue / finalcrossvalue;
                if (type == '6') {
                    var finalvalue = 1 / finalvalue;
                }
            }

            if (type == '7' || type == '8') {
                var finalvalue = finalcrossvalue * usdvalue;
                if (type == '8') {
                    var finalvalue = 1 / finalvalue;
                }
            }

            if (type == '9' || type == '10') {
                var finalvalue = usdvalue / finalcrossvalue;
                if (type == '10') {
                    var finalvalue = 1 / finalvalue;
                }
            }
            let premium = parseFloat(finalvalue) - parseFloat(spot_rate);
            return { 'current_forward': finalvalue, 'current_spot': spot_rate, 'premium': premium.toFixed(4) };
        } else {

            if (type == '5' || type == '6') {
                if (importexport == '1') {
                    var exp_imp_type = 'BID';
                } else {
                    var exp_imp_type = 'ASK';
                }
                var curr1 = await onRemainG1M(exp_imp_type, currencypair, RemainingMonths, PlusOneMonth, crossvalue);
            } else {
                var curr1 = await onRemainG1M(expimptype, currencypair, RemainingMonths, PlusOneMonth, crossvalue);
            }

            var curr1 = curr1[0];
            var spotrate = curr1.spotrate;
            var usdrate = curr1.usdrate;


            if (spotrate <= 9.9) {
                var val = 10000;
            } else {
                var val = 100;
            }
            // var currentmontprem = curr1.currentmontprem / val;
            // var firstmonthdata = curr1.firstmonthdata / val;
            // var secondmonth = curr1.secondmonth / val;

            var currentmontprem = curr1.currentmontprem;
            var firstmonthdata = curr1.firstmonthdata;
            var secondmonth = curr1.secondmonth;
            var noofdaysprm = (secondmonth - firstmonthdata) / monthenddate * RemainingDays;
            var finalcrossvalue = parseFloat(noofdaysprm) + parseFloat(spotrate) + parseFloat(firstmonthdata);
            if (type == '5' || type == '6') {
                var finalvalue = usdvalue / finalcrossvalue;
                if (type == '6') {
                    var finalvalue = 1 / finalvalue;
                }
            }
            if (type == '7' || type == '8') {
                var finalvalue = finalcrossvalue * usdvalue;
                if (type == '8') {
                    var finalvalue = 1 / finalvalue;
                }
            }

            if (type == '9' || type == '10') {
                var finalvalue = usdvalue / finalcrossvalue;
                if (type == '10') {
                    var finalvalue = 1 / finalvalue;
                }
            }
            let premium = parseFloat(finalvalue) - parseFloat(spot_rate);
            return { 'current_forward': finalvalue, 'current_spot': spot_rate, 'premium': premium.toFixed(4) };
        }
    } else {
        return { 'current_forward': null, 'current_spot': null, 'premium': null };
    }

}

async function onRemainL1M(expimptype = '', primarycurrency = '', crossvalue = '') {
  
    if (crossvalue == 'USDINR') {
        $ndfusdinr = 'NDF USDINR';
        var currentdate = moment(Date.now()).format('YYYY-MM-DD');
        const spot = 'SPOT' + expimptype
        const pem = 'PEM' + expimptype + '1M';
        var $is_holiday = await holiday_list(currentdate);
        var crtime = moment(Date.now()).format('HH:mm:ss');
        var today = new Date().getHours();
        var date1 = new Date().getTime();
        var minDate = new Date();
        minDate = minDate.setHours(10, 0, 0);
        var maxDate = new Date();
        maxDate = maxDate.setHours(15, 30, 0);
        var currDateTime = moment(date1).utcOffset("+05:30").format('HH:mm:ss');
        var minDate = moment(minDate).format('HH:mm:ss');
        var maxDate = moment(maxDate).format('HH:mm:ss');
        if ($is_holiday == 0) {
            $spotpair = $ndfusdinr;
        }
        else if ((currDateTime >= minDate) && (currDateTime <= maxDate)) {
            $spotpair = crossvalue;
        } else {
            
            $spotpair = $ndfusdinr;
        }
       // const spot = 'SPOT' + expimptype
        //const pem = 'PEM' + expimptype + '1M';
        var rate = await currencyliverate.findAll({ attributes: [[spot, 'spotrate']], raw: true, where: { PAIR: $spotpair } }).catch((err) => console.log(err));
        var rate1 = await currencyliverate.findAll({ attributes: [[pem, 'currentmontprem']], raw: true, where: { PAIR: crossvalue } }).catch((err) => console.log(err));

        rate[0].currentmontprem = rate1[0].currentmontprem;
        return rate;
    } else {
        const spot = 'SPOT' + expimptype
        const pem = 'PEM' + expimptype + '1M';
        return await currencyliverate.findAll({ attributes: [[spot, 'spotrate'], [pem, 'currentmontprem']], raw: true, where: { PAIR: crossvalue } }).catch((err) => console.log(err));
    }

    }
async function onRemainG1M(expimptype = '', currencypair = '', RemainingMonths = '', PlusOneMonth = '', crossvalue = '') {
    if (crossvalue == 'USDINR') {
        $ndfusdinr = 'NDF USDINR';
        var currentdate = moment(Date.now()).format('YYYY-MM-DD');
       
        var $is_holiday = await holiday_list(currentdate);
        var crtime = moment(Date.now()).format('HH:mm:ss');
        var today = new Date().getHours();
        var date1 = new Date().getTime();
        var minDate = new Date();
        minDate = minDate.setHours(10, 0, 0);
        var maxDate = new Date();
        maxDate = maxDate.setHours(15, 30, 0);
        var currDateTime = moment(date1).utcOffset("+05:30").format('HH:mm:ss');
        var minDate = moment(minDate).format('HH:mm:ss');
        var maxDate = moment(maxDate).format('HH:mm:ss');
        if ($is_holiday == 0) {
            $spotpair = $ndfusdinr;
        }
        else if ((currDateTime >= minDate) && (currDateTime <= maxDate)) {
            $spotpair = crossvalue;
        } else {

            $spotpair = $ndfusdinr;
        }
        // const spot = 'SPOT' + expimptype
        //const pem = 'PEM' + expimptype + '1M';
       // var rate = await currencyliverate.findAll({ attributes: [[spot, 'spotrate'], [pem, 'currentmontprem']], raw: true, where: { PAIR: $spotpair } }).catch((err) => console.log(err));
       // var rate1 = await currencyliverate.findAll({ attributes: [[pem, 'currentmontprem']], raw: true, where: { PAIR: crossvalue } }).catch((err) => console.log(err));

        var spot = 'SPOT' + expimptype;
        var pem = 'PEM' + expimptype + '1M';
        var firstmonthdata = 'PEM' + expimptype + RemainingMonths + 'M';
        var secondmonth = 'PEM' + expimptype + PlusOneMonth + 'M';
        var rate =  await currencyliverate.findAll({ attributes: [ [pem, 'currentmontprem'], [firstmonthdata, 'firstmonthdata'], [secondmonth, 'secondmonth']], raw: true, where: { PAIR: crossvalue } }).catch((err) => console.log(err));
        var rate1 = await currencyliverate.findAll({ attributes: [[spot, 'spotrate']], raw: true, where: { PAIR: $spotpair } }).catch((err) => console.log(err));
        rate[0].spotrate = rate1[0].spotrate;
        return rate;
    } else {
        var spot = 'SPOT' + expimptype;
        var pem = 'PEM' + expimptype + '1M';
        var firstmonthdata = 'PEM' + expimptype + RemainingMonths + 'M';
        var secondmonth = 'PEM' + expimptype + PlusOneMonth + 'M';
        var rate =  await currencyliverate.findAll({ attributes: [[spot, 'spotrate'], [pem, 'currentmontprem'], [firstmonthdata, 'firstmonthdata'], [secondmonth, 'secondmonth']], raw: true, where: { PAIR: crossvalue } }).catch((err) => console.log(err));
        return rate;
    }

}
function dateDiff1(date, serach_date) {
    date = date.split('-');
    var serachdate = new Date(serach_date);
    var year = serachdate.getFullYear();
    var month = serachdate.getMonth() + 1;
    var day = serachdate.getDate();
    var yy = parseInt(date[0]);
    var mm = parseInt(date[1]);
    var dd = parseInt(date[2]);
    var years, months, days;
    // months
    months = month - mm;
    if (day < dd) {
        months = months - 1;
    }
    // years
    years = year - yy;
    if (month * 100 + day < mm * 100 + dd) {
        years = years - 1;
        months = months + 12;
    }
    // days
    days = Math.floor((serachdate.getTime() - (new Date(yy + years, mm + months - 1, dd)).getTime()) / (24 * 60 * 60 * 1000));
    return { years: years, months: months, days: days };
}
exports.addexp_alert = async function (replacements, exp_id, sess_user_id = 0, action = '') {

    //DELETE ALL THE NOTIFICATION TRIGGERS
    var remStatus = await notification.removePreviousNotification(exp_id, replacements.user_id, sess_user_id, 'exposure details updated');
    //console.log(remStatus);

    var budget_benchmark_rate = replacements.budget_benchmark_rate;
    var super_user_id = replacements.user_id;
    var exp_imp = replacements.exposure;
    var company_id = replacements.company_id;
    var status = 1;
    var rule_end_date = moment(Date.now()).format('YYYY-MM-DD');
    //CURRENCY
    var currency_from = replacements.currency_from;
    var currency_to = replacements.currency_to;
    var role_query = await knex('rm_user_rules').whereRaw("super_user_id=? AND status=? AND  exp_imp=? AND (rule_period = 1 or rule_end_date>=?) and company_id = ? and rule_activated = 1 and currency_from = ? and currency_to = ? and delete_status = 0", [super_user_id, status, exp_imp, rule_end_date, company_id, currency_from, currency_to]);
    if (role_query.length == 0) {
        return false;
    }
    var ruleresult = role_query[0];
    var rm_user_rule_id = ruleresult.id;
    var target_hedge_cost = ruleresult.fdfr_target_hedge_cost;
    //CURRENCY
    var rule_currency = ruleresult.currency;
    var rule_currency_from = ruleresult.currency_from;
    var rule_currency_to = ruleresult.currency_to;

    var current_date = moment(replacements.exposure_start_date).format('YYYY-MM-DD')
    var dates = await dateDiff1(current_date, replacements.maturity);
    if (dates.months == 0) {
        var month = 1;
    } else {
        var month = dates.months;
    }
    var result = await forwardrate(replacements.maturity, exp_imp, replacements.currency_from, replacements.currency_to)
    var months_annualized_hedge_cost = (result.premium / result.current_spot) * 12 * 100 / month;
    if (ruleresult.rule_id == '1') {
        var date = replacements.exposure_start_date;
        var start_date = moment(date).format('YYYY-MM-DD');
        if (exp_imp == 1) {
            var target_hedge_cost_saving = months_annualized_hedge_cost - target_hedge_cost;
            var target_hedge_forward_rate = parseFloat(result.current_spot) + parseFloat(target_hedge_cost * result.current_spot * month / 1200);
            var stop_loss_hedge_cost = parseFloat(months_annualized_hedge_cost) + parseFloat(ruleresult.fdfr_max_additional_hedge_cost);
            var stop_loss_forward_rate = parseFloat(result.current_spot) + parseFloat(result.current_spot * stop_loss_hedge_cost * month) / 1200;
        } else {
            var target_hedge_cost_saving = target_hedge_cost + months_annualized_hedge_cost;
            var target_hedge_forward_rate = parseFloat(result.current_forward) + parseFloat(target_hedge_cost * result.current_forward * month) / 1200;
            var stop_loss_hedge_cost = parseFloat(months_annualized_hedge_cost) - parseFloat(ruleresult.fdfr_max_additional_hedge_cost);
            var stop_loss_forward_rate = parseFloat(result.current_forward) - parseFloat(result.current_forward * ruleresult.fdfr_max_additional_hedge_cost * month) / 1200;
        }

        let mdata = {
            user_id: replacements.user_id,
            company_id: replacements.company_id,
            rule_id: ruleresult.rule_id,
            currency_from: replacements.currency_from,
            currency_to: replacements.currency_to,
            currencyname: replacements.currencyPair,
            maturitydate: replacements.maturity,
            spot_rate: result.current_spot,
            premium_rate: result.premium,
            forward_rate: result.current_forward,
            months_annualized_hedge_cost: months_annualized_hedge_cost,
            target_hedge_cost_saving: target_hedge_cost_saving,
            target_hedge_cost: target_hedge_cost,
            target_hedge_forward_rate: target_hedge_forward_rate,
            maximum_additional_hedge_cost: ruleresult.fdfr_max_additional_hedge_cost,
            stop_loss_hedge_cost: stop_loss_hedge_cost,
            stop_loss_forward_rate: stop_loss_forward_rate,
            exposure: ruleresult.exp_imp,
            mfe_identifier: replacements.mfe_identifier,
            amount: replacements.remaining_hedge_amount,
            rule_currency: rule_currency,
            rule_currency_from: rule_currency_from,
            rule_currency_to: rule_currency_to,
            rule_period: ruleresult.rule_period,
            rule_end_date: moment(new Date(ruleresult.rule_end_date)).format('YYYY-MM-DD'),
            start_date: start_date,
            exp_id: exp_id,
            rm_user_rule_id: rm_user_rule_id,
            updated_by: sess_user_id,
            hedge_amount: replacements.remaining_hedge_amount
        }

        await rm_exp_notification.create(mdata).catch((err) => console.log(err));
    } else if (ruleresult.rule_id == '2') {
        var date = replacements.exposure_start_date;
        var start_date = moment(date).format('YYYY-MM-DD');
        role_ladder = []
        //HEDGING ON DAY ONE
        if (action != 'update') {
            var hedge_amount = replacements.remaining_hedge_amount * ruleresult.la_hedge_day_one / 100;
            let hedge_data = {
                company_id: replacements.company_id,
                user_id: replacements.user_id,
                exp_id: exp_id,
                particulars: replacements.particulars,
                mfe_identifier: replacements.mfe_identifier,
                date_of_hedge: moment(new Date()).format('YYYY-MM-DD'),
                currency: replacements.currencyPair,
                hedge_amount: hedge_amount,
                hedged_spot_rate: result.current_spot,
                hedged_rate: result.current_forward,
                hedge_maturity: moment(replacements.maturity).format('YYYY-MM-DD'),
                hedge_percentage: ruleresult.la_hedge_day_one,
                forward_premium: result.current_forward,
                bank_margin: 0,
                inramount: hedge_amount * result.current_forward,
                exp_imp: replacements.exp_imp,
                budget_benchmark_rate: replacements.budget_benchmark_rate,
                currency_from: replacements.currency_from,
                currency_to: replacements.currency_to,
                created_by: replacements.user_id,
                updated_by: sess_user_id
            }
            await knex('exp_hedge')
                .insert(hedge_data)
                .then((result) => { });

            //update remaining amount
            const checkExpData = await ExpSheet.findAll({ attributes: ['id', 'remaining_hedge_amount'], raw: true, where: { id: exp_id } }).catch((err) => console.log(err));
            var remainingHedgeAmount = parseFloat(checkExpData[0].remaining_hedge_amount);
            var totalRemainingHedgeAmt = remainingHedgeAmount - hedge_amount;
            var updateQuery = "update exp_sheet set remaining_hedge_amount =:totalRemainingHedgeAmt where id =:expId and status=1";
            var resUpdate = await sequelize.query(updateQuery, { replacements: { totalRemainingHedgeAmt: totalRemainingHedgeAmt, expId: exp_id } }).catch(err => console.log(err));
        }
        //HEDGING ON DAY ONE

        var role_ladder = await knex('rm_user_rules_ladder').whereRaw("rm_user_rule_id=? AND status=? AND (rule_period = 1 or rule_end_date>=?)", [rm_user_rule_id, status, rule_end_date]);
        for (const roleresult of role_ladder) {
            var target_hedge_cost = roleresult.target_saving;

            if (action != 'update') {
                var amount = totalRemainingHedgeAmt * roleresult.hedge_on_target_rate / 100;
            }
            else {
                var amount = replacements.remaining_hedge_amount * roleresult.hedge_on_target_rate / 100;
            }

            if (exp_imp == 1) {
                var target_hedge_cost_saving = target_hedge_cost;
                var target_hedge_forward_rate = parseFloat(budget_benchmark_rate) - parseFloat(budget_benchmark_rate * target_hedge_cost / 100);
                var stop_loss_hedge_cost = 0;
                var stop_loss_forward_rate = 0;
            } else {
                var target_hedge_cost_saving = target_hedge_cost;
                var target_hedge_forward_rate = parseFloat(budget_benchmark_rate) + parseFloat(budget_benchmark_rate * target_hedge_cost / 100);
                var stop_loss_hedge_cost = 0;
                var stop_loss_forward_rate = 0;
            }
            let mdata = {
                user_id: replacements.user_id,
                company_id: replacements.company_id,
                rule_id: roleresult.rule_id,
                currency_from: replacements.currency_from,
                currency_to: replacements.currency_to,
                currencyname: replacements.currencyPair,
                maturitydate: replacements.maturity,
                spot_rate: result.current_spot,
                premium_rate: result.premium,
                forward_rate: result.current_forward,
                months_annualized_hedge_cost: months_annualized_hedge_cost,
                target_hedge_cost_saving: target_hedge_cost_saving,
                target_hedge_cost: target_hedge_cost,
                target_hedge_forward_rate: target_hedge_forward_rate,
                maximum_additional_hedge_cost: 0,
                stop_loss_hedge_cost: stop_loss_hedge_cost,
                stop_loss_forward_rate: stop_loss_forward_rate,
                exposure: roleresult.exp_imp,
                mfe_identifier: replacements.mfe_identifier,
                amount: (action != 'update') ? totalRemainingHedgeAmt : replacements.remaining_hedge_amount,
                rule_currency: rule_currency,
                rule_currency_from: rule_currency_from,
                rule_currency_to: rule_currency_to,
                rule_period: roleresult.rule_period,
                rule_end_date: moment(new Date(roleresult.rule_end_date)).format('YYYY-MM-DD'),
                start_date: start_date,
                exp_id: exp_id,
                rm_user_rule_id: rm_user_rule_id,
                updated_by: sess_user_id,
                hedge_amount: amount
            }
            await rm_exp_notification.create(mdata).catch((err) => console.log(err));
        }

    } else if (ruleresult.rule_id == '3') {
        var date = replacements.exposure_start_date;
        var start_date = moment(date).format('YYYY-MM-DD');

        role_ladder = []
        var role_ladder = await knex('rm_user_rules_target_based').whereRaw("rm_user_rule_id=? AND status=? AND (rule_period = 1 or rule_end_date>=?)", [rm_user_rule_id, status, rule_end_date]);

        for (const roleresult of role_ladder) {
            var spot_value = result.current_spot;

            var target_hedge_cost = roleresult.target_rate_percent;
            var amount = replacements.remaining_hedge_amount * roleresult.hedge_on_target_rate / 100;
            if (exp_imp == 1) {
                var target_hedge_cost_saving = 0;
                //  var target_hedge_forward_rate = parseFloat(spot_value) - parseFloat(spot_value * target_hedge_cost / 100);
                var target_hedge_forward_rate = target_hedge_cost;
                var stop_loss_hedge_cost = 0;
                var stop_loss_forward_rate = 0;
            } else {
                var target_hedge_cost_saving = 0;
                var target_hedge_forward_rate = target_hedge_cost;
                var stop_loss_hedge_cost = 0;
                var stop_loss_forward_rate = 0;
            }
            let mdata = {
                user_id: replacements.user_id,
                company_id: replacements.company_id,
                rule_id: roleresult.rule_id,
                currency_from: replacements.currency_from,
                currency_to: replacements.currency_to,
                currencyname: replacements.currencyPair,
                maturitydate: replacements.maturity,
                spot_rate: result.current_spot,
                premium_rate: result.premium,
                forward_rate: result.current_forward,
                months_annualized_hedge_cost: months_annualized_hedge_cost,
                target_hedge_cost_saving: target_hedge_cost_saving,
                target_hedge_cost: target_hedge_cost,
                target_hedge_forward_rate: target_hedge_forward_rate,
                maximum_additional_hedge_cost: 0,
                stop_loss_hedge_cost: stop_loss_hedge_cost,
                stop_loss_forward_rate: stop_loss_forward_rate,
                exposure: roleresult.exp_imp,
                mfe_identifier: replacements.mfe_identifier,
                amount: replacements.remaining_hedge_amount,
                rule_currency: rule_currency,
                rule_currency_from: rule_currency_from,
                rule_currency_to: rule_currency_to,
                rule_period: roleresult.rule_period,
                rule_end_date: moment(new Date(roleresult.rule_end_date)).format('YYYY-MM-DD'),
                start_date: start_date,
                exp_id: exp_id,
                rm_user_rule_id: rm_user_rule_id,
                updated_by: sess_user_id,
                hedge_amount: amount
            }
            await rm_exp_notification.create(mdata).catch((err) => console.log(err));
        }
    } else if (ruleresult.rule_id == '4') {

        role_ladder = []
        var role_ladder = await knex('rm_user_rules_forward_start').whereRaw("rm_user_rule_id=? AND status=? AND (rule_period = 1 or rule_end_date>=?)", [rm_user_rule_id, status, rule_end_date]);
        for (const roleresult of role_ladder) {
            var spot_value = result.current_spot;
            var target_hedge_cost = roleresult.target_rate_percent;
            var amount = replacements.remaining_hedge_amount * roleresult.hedge_on_target_rate / 100;
            if (exp_imp == 1) {
                var target_hedge_cost_saving = 0;
                var target_hedge_forward_rate = target_hedge_cost;
                var stop_loss_hedge_cost = 0;
                var stop_loss_forward_rate = 0;
            } else {
                var target_hedge_cost_saving = target_hedge_cost;
                var target_hedge_forward_rate = target_hedge_cost;
                var stop_loss_hedge_cost = 0;
                var stop_loss_forward_rate = 0;
            }
            var date = replacements.maturity;
            var days = ruleresult.hedge_start_before_days;
            var startdate = moment(date, "YYYY-MM-DD").subtract(days, 'days');
            var start_date = moment(startdate).format('YYYY-MM-DD');

            let mdata = {
                user_id: replacements.user_id,
                company_id: replacements.company_id,
                rule_id: roleresult.rule_id,
                currency_from: replacements.currency_from,
                currency_to: replacements.currency_to,
                currencyname: replacements.currencyPair,
                maturitydate: replacements.maturity,
                spot_rate: result.current_spot,
                premium_rate: result.premium,
                forward_rate: result.current_forward,
                months_annualized_hedge_cost: months_annualized_hedge_cost,
                target_hedge_cost_saving: target_hedge_cost_saving,
                target_hedge_cost: target_hedge_cost,
                target_hedge_forward_rate: target_hedge_forward_rate,
                maximum_additional_hedge_cost: 0,
                stop_loss_hedge_cost: stop_loss_hedge_cost,
                stop_loss_forward_rate: stop_loss_forward_rate,
                exposure: roleresult.exp_imp,
                mfe_identifier: replacements.mfe_identifier,
                amount: replacements.remaining_hedge_amount,
                rule_currency: rule_currency,
                rule_currency_from: rule_currency_from,
                rule_currency_to: rule_currency_to,
                rule_period: roleresult.rule_period,
                rule_end_date: moment(new Date(roleresult.rule_end_date)).format('YYYY-MM-DD'),
                start_date: start_date,
                exp_id: exp_id,
                rm_user_rule_id: rm_user_rule_id,
                updated_by: sess_user_id,
                hedge_amount: amount
            }

            await rm_exp_notification.create(mdata).catch((err) => console.log(err));
        }
    }
    await knex('exp_sheet')
        .update({ set_rule_id: rm_user_rule_id, notification_status: 1, updated_by: sess_user_id })
        .where({ id: exp_id })
        .then((result) => { });
}

// update notification data
exports.update_exp_alert = async function (replacements, sess_user_id = 0) {
    var notificationData = replacements.notification;
    var budget_benchmark_rate = replacements.budget_benchmark_rate;
    var super_user_id = replacements.user_id;
    var exp_imp = replacements.exposure;
    var company_id = replacements.company_id;
    var target_hedge_cost = '';
    var fdfr_max_additional_hedge_cost = '';
    if (replacements.updateField == 'targetHedgeCost') {
        target_hedge_cost = replacements.updateFieldValue;
    }
    else if (replacements.updateField == 'maximumAdditionalHedgeCost') {
        fdfr_max_additional_hedge_cost = replacements.updateFieldValue;
    }

    var current_date = moment(replacements.exposure_start_date).format('YYYY-MM-DD')
    var dates = await dateDiff1(current_date, replacements.maturity);
    if (dates.months == 0) {
        var month = 1;
    } else {
        var month = dates.months;
    }
    //var result = await forwardrate(replacements.maturity, exp_imp, replacements.currency_from, replacements.currency_to)
    //var months_annualized_hedge_cost = (result.premium / result.current_spot) * 12 * 100 / month;

    //history data
    var dataTable = "rm_exp_notification";
    var historyTable = "rm_zhistory_notification_target_update";

    if (replacements.rule_id == '1') {

        var finalData = [];
        var updatedFieldName = "";
        var updatedFieldValue = "";
        var oldValue = "";

        //make history
        await history.save_history(dataTable, historyTable, notificationData.id, 'notification target rate updated', sess_user_id);

        var date = replacements.exposure_start_date;
        var start_date = moment(date).format('YYYY-MM-DD');
        if (exp_imp == 1) {

            if (replacements.updateField == 'targetHedgeCost') {

            }
            else if (replacements.updateField == 'maximumAdditionalHedgeCost') {

            }
            else if (replacements.updateField == 'targetHedgeForwardRate') {

                let notificationId = replacements.notification.id;
                let updatedValue = parseFloat(replacements.updateFieldValue).toFixed(4);

                let mdata = {
                    target_hedge_forward_rate: updatedValue,
                    updated_by: sess_user_id
                }

                await knex('rm_exp_notification')
                    .update(mdata)
                    .where({ id: notificationId, user_id: super_user_id })
                    .then((settings) => {
                        finalData[0] = { newValue: updatedValue };
                        updatedFieldName = "Target Hedge Forward Rate";
                        updatedFieldValue = updatedValue;
                        oldValue = notificationData.target_hedge_forward_rate;
                    }, (error) => { console.log(error); });

            }
            else if (replacements.updateField == 'stopLossForwardRate') {

                let notificationId = replacements.notification.id;
                let updatedValue = parseFloat(replacements.updateFieldValue).toFixed(4);

                let mdata = {
                    stop_loss_forward_rate: updatedValue,
                    updated_by: sess_user_id
                }

                await knex('rm_exp_notification')
                    .update(mdata)
                    .where({ id: notificationId, user_id: super_user_id })
                    .then((settings) => {
                        finalData[0] = { newValue: updatedValue };
                        updatedFieldName = "Stop Loss Forward Rate";
                        updatedFieldValue = updatedValue;
                        oldValue = notificationData.stop_loss_forward_rate;
                    }, (error) => { console.log(error); });

            }
        } else {

            if (replacements.updateField == 'targetHedgeCost') {

            }
            else if (replacements.updateField == 'maximumAdditionalHedgeCost') {

            }
            else if (replacements.updateField == 'targetHedgeForwardRate') {

                let notificationId = replacements.notification.id;
                let updatedValue = parseFloat(replacements.updateFieldValue).toFixed(4);

                let mdata = {
                    target_hedge_forward_rate: updatedValue,
                    updated_by: sess_user_id
                }

                await knex('rm_exp_notification')
                    .update(mdata)
                    .where({ id: notificationId, user_id: super_user_id })
                    .then((settings) => {
                        finalData[0] = { newValue: updatedValue };
                        updatedFieldName = "Target Hedge Forward Rate";
                        updatedFieldValue = updatedValue;
                        oldValue = notificationData.target_hedge_forward_rate;
                    }, (error) => { console.log(error); });

            }
            else if (replacements.updateField == 'stopLossForwardRate') {

                let notificationId = replacements.notification.id;
                let updatedValue = parseFloat(replacements.updateFieldValue).toFixed(4);

                let mdata = {
                    stop_loss_forward_rate: updatedValue,
                    updated_by: sess_user_id
                }

                await knex('rm_exp_notification')
                    .update(mdata)
                    .where({ id: notificationId, user_id: super_user_id })
                    .then((settings) => {
                        finalData[0] = { newValue: updatedValue };
                        updatedFieldName = "Stop Loss Forward Rate";
                        updatedFieldValue = updatedValue;
                        oldValue = notificationData.stop_loss_forward_rate;
                    }, (error) => { console.log(error); });

            }
        }

        //mail start
        replacements.updatedFieldName = updatedFieldName;
        replacements.updatedFieldValue = updatedFieldValue;
        replacements.oldValue = oldValue;
        //mail.insert_cron_mail(replacements, "Target Rate Updated", "target rate updated", notificationData.id);        
        //mail end 

        return finalData;
    }
    else if (replacements.rule_id == '2') {

        var finalData = [];
        var updatedFieldName = "";
        var updatedFieldValue = "";
        var oldValue = "";

        //make history
        await history.save_history(dataTable, historyTable, notificationData.id, 'notification target rate updated', sess_user_id);

        if (exp_imp == 1) {

            if (replacements.updateField == 'targetHedgeForwardRate') {

                let notificationId = replacements.notification.id;
                let updatedValue = parseFloat(replacements.updateFieldValue).toFixed(4);

                let mdata = {
                    target_hedge_forward_rate: updatedValue,
                    updated_by: sess_user_id
                }

                await knex('rm_exp_notification')
                    .update(mdata)
                    .where({ id: notificationId, user_id: super_user_id })
                    .then((settings) => {
                        finalData[0] = { newValue: updatedValue };
                        updatedFieldName = "Target Hedge Forward Rate";
                        updatedFieldValue = updatedValue;
                        oldValue = notificationData.target_hedge_forward_rate;
                    }, (error) => { console.log(error); });

            }
        } else {

            if (replacements.updateField == 'targetHedgeForwardRate') {

                let notificationId = replacements.notification.id;
                let updatedValue = parseFloat(replacements.updateFieldValue).toFixed(4);

                let mdata = {
                    target_hedge_forward_rate: updatedValue,
                    updated_by: sess_user_id
                }

                await knex('rm_exp_notification')
                    .update(mdata)
                    .where({ id: notificationId, user_id: super_user_id })
                    .then((settings) => {
                        finalData[0] = { newValue: updatedValue };
                        updatedFieldName = "Target Hedge Forward Rate";
                        updatedFieldValue = updatedValue;
                        oldValue = notificationData.target_hedge_forward_rate;
                    }, (error) => { console.log(error); });

            }
        }

        //mail start
        replacements.updatedFieldName = updatedFieldName;
        replacements.updatedFieldValue = updatedFieldValue;
        replacements.oldValue = oldValue;
        //mail.insert_cron_mail(replacements, "Target Rate Updated", "target rate updated", notificationData.id);        
        //mail end 

        return finalData;

    } else if (replacements.rule_id == '3') {

        var finalData = [];
        var updatedFieldName = "";
        var updatedFieldValue = "";
        var oldValue = "";

        //make history
        await history.save_history(dataTable, historyTable, notificationData.id, 'notification target rate updated', sess_user_id);

        if (exp_imp == 1) {

            if (replacements.updateField == 'targetHedgeForwardRate') {

                let notificationId = replacements.notification.id;
                let updatedValue = parseFloat(replacements.updateFieldValue).toFixed(4);

                let mdata = {
                    target_hedge_forward_rate: updatedValue,
                    updated_by: sess_user_id
                }

                await knex('rm_exp_notification')
                    .update(mdata)
                    .where({ id: notificationId, user_id: super_user_id })
                    .then((settings) => {
                        finalData[0] = { newValue: updatedValue };
                        updatedFieldName = "Target Hedge Forward Rate";
                        updatedFieldValue = updatedValue;
                        oldValue = notificationData.target_hedge_forward_rate;
                    }, (error) => { console.log(error); });

            }
        } else {

            if (replacements.updateField == 'targetHedgeForwardRate') {

                let notificationId = replacements.notification.id;
                let updatedValue = parseFloat(replacements.updateFieldValue).toFixed(4);

                let mdata = {
                    target_hedge_forward_rate: updatedValue,
                    updated_by: sess_user_id
                }

                await knex('rm_exp_notification')
                    .update(mdata)
                    .where({ id: notificationId, user_id: super_user_id })
                    .then((settings) => {
                        finalData[0] = { newValue: updatedValue };
                        updatedFieldName = "Target Hedge Forward Rate";
                        updatedFieldValue = updatedValue;
                        oldValue = notificationData.target_hedge_forward_rate;
                    }, (error) => { console.log(error); });

            }
        }

        //mail start
        replacements.updatedFieldName = updatedFieldName;
        replacements.updatedFieldValue = updatedFieldValue;
        replacements.oldValue = oldValue;
        //mail.insert_cron_mail(replacements, "Target Rate Updated", "target rate updated", notificationData.id);        
        //mail end 

        return finalData;

    } else if (replacements.rule_id == '4') {

        var finalData = [];
        var updatedFieldName = "";
        var updatedFieldValue = "";
        var oldValue = "";

        //make history
        await history.save_history(dataTable, historyTable, notificationData.id, 'notification target rate updated', sess_user_id);

        if (exp_imp == 1) {

            if (replacements.updateField == 'targetHedgeForwardRate') {

                let notificationId = replacements.notification.id;
                let updatedValue = parseFloat(replacements.updateFieldValue).toFixed(4);

                let mdata = {
                    target_hedge_forward_rate: updatedValue,
                    updated_by: sess_user_id
                }

                await knex('rm_exp_notification')
                    .update(mdata)
                    .where({ id: notificationId, user_id: super_user_id })
                    .then((settings) => {
                        finalData[0] = { newValue: updatedValue };
                        updatedFieldName = "Target Hedge Forward Rate";
                        updatedFieldValue = updatedValue;
                        oldValue = notificationData.target_hedge_forward_rate;
                    }, (error) => { console.log(error); });

            }
        } else {

            if (replacements.updateField == 'targetHedgeForwardRate') {

                let notificationId = replacements.notification.id;
                let updatedValue = parseFloat(replacements.updateFieldValue).toFixed(4);

                let mdata = {
                    target_hedge_forward_rate: updatedValue,
                    updated_by: sess_user_id
                }

                await knex('rm_exp_notification')
                    .update(mdata)
                    .where({ id: notificationId, user_id: super_user_id })
                    .then((settings) => {
                        finalData[0] = { newValue: updatedValue };
                        updatedFieldName = "Target Hedge Forward Rate";
                        updatedFieldValue = updatedValue;
                        oldValue = notificationData.target_hedge_forward_rate;
                    }, (error) => { console.log(error); });

            }
        }

        //mail start
        replacements.updatedFieldName = updatedFieldName;
        replacements.updatedFieldValue = updatedFieldValue;
        replacements.oldValue = oldValue;
        //mail.insert_cron_mail(replacements, "Target Rate Updated", "target rate updated", notificationData.id);        
        //mail end 

        return finalData;
    }
}
// update notification data

exports.annualized_hedge_cost = async function (imp_exp, ratetype, currency_from, currency_to) {
    //   var exp_imp = (req.body.exp_imp == '') ? 1 : req.body.exp_imp;
    var exp_imp = imp_exp;
    var status = 1;
    if (currency_from != null && currency_from != '' && currency_to != null && currency_to != '') {
        var list = await knex.select('*').from('rm_annualized_hedge_currency').whereRaw("status=? AND currency_from=? AND currency_to=?", [status, currency_from, currency_to])
    } else {
        var list = await knex.select('*').from('rm_annualized_hedge_currency').whereRaw("status=?", [status])
    }
    var ratetype = ratetype;
    //console.log(list);
    if (list.length > 0) {
        myData = [];
        var spot_date = await onTxnDate(3);
        var current_date = moment(spot_date).format('YYYY-MM-DD')
        for (const item of list) {
            final = {}
            final['currency'] = item['currencyname'];
            var days = item.days.split(",");
            for (const day of days) {
                var startdate = moment(current_date, "YYYY-MM-DD").add(day, 'days');
                var hedge_maturity = moment(startdate).format('YYYY-MM-DD');
                var rates = await forwardrate(hedge_maturity, exp_imp, item.currency_from, item.currency_to);
                if (ratetype == 1) {
                    var key = '';
                    switch (day) {
                        case '30':
                            key = '1M';
                            break;
                        case '90':
                            key = '3M';
                            break;
                        case '180':
                            key = '6M';
                            break;
                        case '360':
                            key = '12M';
                            break;
                        default:
                        // code block
                    }
                    var Hedge_Cost_absolute = rates.premium * 100 / rates.current_spot;
                    final[key] = Hedge_Cost_absolute.toFixed(4);
                } else if (ratetype == 2) {
                    switch (day) {
                        case '30':
                            key = '1MA';
                            break;
                        case '90':
                            key = '3MA';
                            break;
                        case '180':
                            key = '6MA';
                            break;
                        case '360':
                            key = '12MA';
                            break;
                        default:
                        // code block
                    }
                    var daysper = 365 / day;
                    var hedge_Cost_annualized = (rates.premium / rates.current_spot) * daysper * 100;
                    final[key] = hedge_Cost_annualized.toFixed(4);
                }
                else if (ratetype == 3) {
                    var key = '';
                    switch (day) {
                        case '30':
                            key = '1M';
                            keyA = '1MA';
                            break;
                        case '90':
                            key = '3M';
                            keyA = '3MA';
                            break;
                        case '180':
                            key = '6M';
                            keyA = '6MA';
                            break;
                        case '360':
                            key = '12M';
                            keyA = '12MA';
                            break;
                        default:
                        // code block
                    }
                    var Hedge_Cost_absolute = rates.premium * 1;
                    final[key] = Hedge_Cost_absolute.toFixed(4);
                    var daysper = 365 / day;
                    var hedge_Cost_annualized = (rates.premium / rates.current_spot) * daysper * 100;
                    final[keyA] = hedge_Cost_annualized.toFixed(4);


                }
            }
            myData.push(final);
        }
    } else {
        myData = [];
    }
    return myData;
    //return res.status(200).json({ status: true, message: 'data fetched successfully', data: myData });
}
var onTxnDate = exports.onTxnDate = async function (id) {
    var today = moment(Date.now()).format('YYYY-MM-DD')
    if (id == 2) {
        var date = moment(today, "YYYY-MM-DD").add(1, 'days');
        var finaldate = await gettxnDate(date);
        return finaldate;
    } else if (id == 3) {
        var date = moment(today, "YYYY-MM-DD").add(1, 'days');
        var date = await gettxnDate(date);
        var date = moment(date, "YYYY-MM-DD").add(1, 'days');
        var finaldate = await gettxnDate(date);
        return finaldate;
    } else {
        return today;
    }
}

var gettxnDate = exports.gettxnDate = async function (currentDate = "") {
    if (currentDate === "") {
        currentDate = moment(Date.now()).format('YYYY-MM-DD')
    }
    var currentDate1 = await holiday_list(currentDate);
    if (currentDate1) {
        return currentDate;
    } else {
        var h = 0;
        while (h != 1) {
            h = await holiday_list(currentDate);
            currentDate = moment(currentDate, "YYYY-MM-DD").add(1, 'days');
        }
        return moment(currentDate, "YYYY-MM-DD").subtract(1, 'days');
    }
}
var holiday_list = exports.holiday_list = async function (currentdate = "") {
    var currentdate = moment(currentdate).format('YYYY-MM-DD');
    var day = moment(currentdate).format('ddd');
    if (currentdate !== "") {
        if (day == "Sat" || day == "Sun") {
            return 0;
        } else {
            var isHoliday = await knex('Holiday').whereRaw("holiday_date=?", [currentdate]);
            if (isHoliday.length > 0) {

                return 0;
            } else {
                return 1;
            }
        }
    } else {
        return 0;
    }
}
var holiday_list_ind = exports.holiday_list_ind = async function (currentdate = "") {
    var currentdate = moment(currentdate).format('YYYY-MM-DD');
    var day = moment(currentdate).format('ddd');
    if (currentdate !== "") {
        if (day == "Sat" || day == "Sun") {
            return 0;
        } else {
            var isHoliday = await knex('Holiday').whereRaw("holiday_date=? AND type=?", [currentdate,'IND']);
            if (isHoliday.length > 0) {

                return 0;
            } else {
                return 1;
            }
        }
    } else {
        return 0;
    }
}

var premiumdateformate = exports.premiumdateformate = function (date) {
    return moment(date).format('DD-MMM-YY');
}

var getNext12MonthNamesWithYear = exports.getNext12MonthNamesWithYear = async function () {

    var monthNames = new Array();

    monthNames[0] = "Jan";
    monthNames[1] = "Feb";
    monthNames[2] = "Mar";
    monthNames[3] = "Apr";
    monthNames[4] = "May";
    monthNames[5] = "Jun";
    monthNames[6] = "Jul";
    monthNames[7] = "Aug";
    monthNames[8] = "Sep";
    monthNames[9] = "Oct";
    monthNames[10] = "Nov";
    monthNames[11] = "Dec";


    var months = [];
    var today = new Date();
    var spot_date = await onTxnDate(3);
    var current_date = moment(spot_date).format('YYYY-MM-DD');
    var tmpDate = new Date(current_date);
    var tmpYear = tmpDate.getFullYear();
    var tmpMonth = tmpDate.getMonth();
    var monthLiteral;
    var monthNumber;
    for (var i = 0; i < 12; i++) {
        monthLiteral = monthNames[tmpMonth];
        monthNumber = parseInt(tmpMonth + 1);
        monthNumber = monthNumber < 10 ? '0' + monthNumber : monthNumber;
        months.push('"' + tmpYear + '-' + monthNumber + '"');
        tmpMonth = (tmpMonth == 11) ? 0 : tmpMonth + 1;
        tmpYear = (tmpMonth == 0) ? tmpYear + 1 : tmpYear;
    }

    return months;
};

var monthenddate_permium = exports.monthenddate_permium = async function (ratetype, currency_from, currency_to) {
    status = 1;
    var monthYearData = await getNext12MonthNamesWithYear();
    monthYearData = monthYearData.toString();

    var data = await knex('ratecheckmonthenddate').whereRaw("status=? and yearmonth in(" + monthYearData + ")", [status]).orderBy('yearmonth', 'ASC');
    myData = [];
    for (const item of data) {
        final = {}
        var hedge_maturity = moment(item.date).format('YYYY-MM-DD');
        var bid = await forwardrate(hedge_maturity, 2, currency_from, currency_to);
        var ask = await forwardrate(hedge_maturity, 1, currency_from, currency_to);
        if (ratetype == 1) {
            final['month'] = premiumdateformate(item.date);
            var hedge_cost_absolute_bid = bid.premium * 1;
            final['absolutebid'] = hedge_cost_absolute_bid.toFixed(4);
            var hedge_cost_absolute_ask = ask.premium * 1;
            final['absoluteask'] = hedge_cost_absolute_ask.toFixed(4);
        } else if (ratetype == 2) {
            final['month'] = premiumdateformate(item.date);
            var spot_date = await onTxnDate(3);
            var current_date = moment(spot_date).format('YYYY-MM-DD')
            var remaingdays = await noofdays(hedge_maturity, current_date);
            var daysper = 365 / remaingdays.days;
            var hedge_cost_annualized_bid = (bid.premium * 1 / bid.current_spot) * daysper * 100;;
            final['annualizedbid'] = hedge_cost_annualized_bid.toFixed(2);
            var hedge_cost_annualized_ask = (ask.premium * 1 / ask.current_spot) * daysper * 100;
            final['annualizedask'] = hedge_cost_annualized_ask.toFixed(2);
        } else if (ratetype == 3) {
            final['month'] = premiumdateformate(item.date);
            var hedge_cost_absolute_bid = bid.premium * 1;
            final['absolutebid'] = hedge_cost_absolute_bid.toFixed(4);
            var hedge_cost_absolute_ask = ask.premium * 1;
            final['absoluteask'] = hedge_cost_absolute_ask.toFixed(4);
            var spot_date = await onTxnDate(3);
            var current_date = moment(spot_date).format('YYYY-MM-DD')
            var remaingdays = await noofdays(hedge_maturity, current_date);
            var daysper = 365 / remaingdays.days;
            var hedge_cost_annualized_bid = (bid.premium * 1 / bid.current_spot) * daysper * 100;;
            final['annualizedbid'] = hedge_cost_annualized_bid.toFixed(2);
            var hedge_cost_annualized_ask = (ask.premium * 1 / ask.current_spot) * daysper * 100;
            final['annualizedask'] = hedge_cost_annualized_ask.toFixed(2);

        }
        //final['test'] = rates;
        myData.push(final);
    }

    return myData;
}
var exact_month_premium = exports.exact_month_premium = async function (ratetype, currency_from, currency_to) {
    status = 1;
    var data = await knex('exact_month_premium').whereRaw("status=?", [status]);
    myData = [];
    if (data.length > 0) {
        var spot_date = await onTxnDate(3);
        var current_date = moment(spot_date).format('YYYY-MM-DD');
        for (const item of data) {
            final = {}
            var day = item.day;
            var startdate = moment(current_date, "YYYY-MM-DD").add(day, 'days');
            var hedge_maturity = moment(startdate).format('YYYY-MM-DD');
            var bid = await forwardrate(hedge_maturity, 2, currency_from, currency_to);
            var ask = await forwardrate(hedge_maturity, 1, currency_from, currency_to);
            final['month'] = item.name;
            if (ratetype == 1) {
                var hedge_cost_absolute_bid = bid.premium * 1;
                final['absolutebid'] = hedge_cost_absolute_bid.toFixed(4);
                var hedge_cost_absolute_ask = ask.premium * 1;
                final['absoluteask'] = hedge_cost_absolute_ask.toFixed(4);
            }
            else if (ratetype == 2) {
                var remaingdays = await noofdays(hedge_maturity, current_date);
                var daysper = 365 / remaingdays.days;
                var hedge_cost_annualized_bid = (bid.premium * 1 / bid.current_spot) * daysper * 100;;
                final['annualizedbid'] = hedge_cost_annualized_bid.toFixed(2);
                var hedge_cost_annualized_ask = (ask.premium * 1 / ask.current_spot) * daysper * 100;
                final['annualizedask'] = hedge_cost_annualized_ask.toFixed(2);
            }
            else if (ratetype == 3) {
                var hedge_cost_absolute_bid = bid.premium * 1;
                final['absolutebid'] = hedge_cost_absolute_bid.toFixed(4);
                var hedge_cost_absolute_ask = ask.premium * 1;
                final['absoluteask'] = hedge_cost_absolute_ask.toFixed(4);
                var remaingdays = await noofdays(hedge_maturity, current_date);
                var daysper = 365 / remaingdays.days;
                var hedge_cost_annualized_bid = (bid.premium * 1 / bid.current_spot) * daysper * 100;;
                final['annualizedbid'] = hedge_cost_annualized_bid.toFixed(2);
                var hedge_cost_annualized_ask = (ask.premium * 1 / ask.current_spot) * daysper * 100;
                final['annualizedask'] = hedge_cost_annualized_ask.toFixed(2);

            }
            myData.push(final);

        }
    }
    return myData;


}
var update_exposure_notification = exports.update_exposure_notification = async function (rule_id, sessUserId = 0, update = '') {

    var status = 1;
    var rule_end_date = moment(Date.now()).format('YYYY-MM-DD');
    var maturity = moment(Date.now()).format('YYYY-MM-DD');
    var query_rule = await knex('rm_user_rules').select('id', 'rule_id', 'company_id', 'exp_imp', 'currency', 'currency_from', ' currency_to', 'fdfr_target_hedge_cost', 'fdfr_max_additional_hedge_cost', 'la_hedge_day_one', 'hedge_start_before_days', 'rule_period', 'rule_activated', 'super_user_id', 'rule_end_date').whereRaw("id=? AND status=?  AND (rule_period = 1 or rule_end_date>=?) ", [rule_id, status, rule_end_date]);
    if (query_rule.length > 0) {
        ruleresult = query_rule[0];
        var company_id = ruleresult.company_id
        var user_id = ruleresult.super_user_id;
        var exp_imp = ruleresult.exp_imp;
        var rule_type = ruleresult.rule_id;
        var rm_user_rule_id = ruleresult.id;
        var target_hedge_cost = ruleresult.fdfr_target_hedge_cost;
        //CURRENCY
        var rule_currency = ruleresult.currency;
        var rule_currency_from = ruleresult.currency_from;
        var rule_currency_to = ruleresult.currency_to;

        //FOR UPDATE EXPOSURE NOTIFICATION STATUS
        if (update == 'update') {
            var update_exposure_data = await knex('exp_sheet').select().whereRaw('company_id=? AND user_id=? AND exposure=? AND currency_from=? AND currency_to=? AND maturity>=? AND set_rule_id=? and status = 1', [company_id, user_id, exp_imp, rule_currency_from, rule_currency_to, maturity, rule_id]);

            for (const update_item of update_exposure_data) {
                await knex('exp_sheet')
                    .update({ set_rule_id: 0, notification_status: 0, updated_by: sessUserId })
                    .where({ id: update_item.id })
                    .then((result) => { }, (error) => handleError(error));
            }
        }

        var set_rule_id = 0;
        var notification_status = 0;
        var query_exposure = await knex('exp_sheet').select().whereRaw('company_id=? AND user_id=? AND exposure=? AND currency_from=? AND currency_to=? AND maturity>=? AND set_rule_id=? AND notification_status=? and status = 1', [company_id, user_id, exp_imp, rule_currency_from, rule_currency_to, maturity, set_rule_id, notification_status]);
        if (query_exposure.length > 0) {
            for (const replacements of query_exposure) {

                //DELETE ALL THE NOTIFICATION TRIGGERS
                if (update == 'update') {
                    var remStatus = await notification.removePreviousNotification(replacements.id, replacements.user_id, sessUserId, 'exposure rule details updated');
                }
                var current_date = moment(replacements.exposure_start_date).format('YYYY-MM-DD')
                var dates = await dateDiff1(current_date, replacements.maturity);
                if (dates.months == 0) {
                    var month = 1;
                } else {
                    var month = dates.months;
                }
                var result = await forwardrate(replacements.maturity, exp_imp, replacements.currency_from, replacements.currency_to)
                var months_annualized_hedge_cost = (result.premium / result.current_spot) * 12 * 100 / month;
                if (rule_type == 1) {
                    var date = replacements.exposure_start_date;
                    var start_date = moment(date).format('YYYY-MM-DD');
                    if (exp_imp == 1) {
                        var target_hedge_cost_saving = months_annualized_hedge_cost - target_hedge_cost;
                        var target_hedge_forward_rate = parseFloat(result.current_spot) + parseFloat(target_hedge_cost * result.current_spot * month / 1200);
                        var stop_loss_hedge_cost = parseFloat(months_annualized_hedge_cost) + parseFloat(ruleresult.fdfr_max_additional_hedge_cost);
                        var stop_loss_forward_rate = parseFloat(result.current_spot) + parseFloat(result.current_spot * stop_loss_hedge_cost * month) / 1200;
                    } else {
                        var target_hedge_cost_saving = target_hedge_cost + months_annualized_hedge_cost;
                        var target_hedge_forward_rate = parseFloat(result.current_forward) + parseFloat(target_hedge_cost * result.current_forward * month) / 1200;
                        var stop_loss_hedge_cost = parseFloat(months_annualized_hedge_cost) - parseFloat(ruleresult.fdfr_max_additional_hedge_cost);
                        var stop_loss_forward_rate = parseFloat(result.current_forward) - parseFloat(result.current_forward * ruleresult.fdfr_max_additional_hedge_cost * month) / 1200;
                    }

                    let mdata = {
                        user_id: replacements.user_id,
                        company_id: replacements.company_id,
                        rule_id: ruleresult.rule_id,
                        currency_from: replacements.currency_from,
                        currency_to: replacements.currency_to,
                        currencyname: replacements.currency,
                        maturitydate: moment(replacements.maturity).format('YYYY-MM-DD'),
                        spot_rate: result.current_spot,
                        premium_rate: result.premium,
                        forward_rate: result.current_forward,
                        months_annualized_hedge_cost: months_annualized_hedge_cost,
                        target_hedge_cost_saving: target_hedge_cost_saving,
                        target_hedge_cost: target_hedge_cost,
                        target_hedge_forward_rate: target_hedge_forward_rate,
                        maximum_additional_hedge_cost: ruleresult.fdfr_max_additional_hedge_cost,
                        stop_loss_hedge_cost: stop_loss_hedge_cost,
                        stop_loss_forward_rate: stop_loss_forward_rate,
                        exposure: ruleresult.exp_imp,
                        mfe_identifier: replacements.mfe_identifier,
                        amount: replacements.remaining_hedge_amount,
                        rule_currency: rule_currency,
                        rule_currency_from: rule_currency_from,
                        rule_currency_to: rule_currency_to,
                        rule_period: ruleresult.rule_period,
                        rule_end_date: moment(new Date(ruleresult.rule_end_date)).format('YYYY-MM-DD'),
                        start_date: start_date,
                        exp_id: replacements.id,
                        rm_user_rule_id: rm_user_rule_id,
                        updated_by: sessUserId,
                        hedge_amount: replacements.remaining_hedge_amount
                    }

                    await rm_exp_notification.create(mdata).catch((err) => console.log(err));
                } else if (rule_type == '2') {
                    var budget_benchmark_rate = replacements.budget_benchmark_rate;
                    var date = replacements.exposure_start_date;
                    var start_date = moment(date).format('YYYY-MM-DD');
                    role_ladder = []

                    //HEDGING ON DAY ONE
                    var hedge_amount = replacements.remaining_hedge_amount * ruleresult.la_hedge_day_one / 100;
                    let hedge_data = {
                        company_id: replacements.company_id,
                        user_id: replacements.user_id,
                        exp_id: replacements.id,
                        particulars: replacements.particulars,
                        mfe_identifier: replacements.mfe_identifier,
                        date_of_hedge: moment(new Date()).format('YYYY-MM-DD'),
                        currency: replacements.currency,
                        hedge_amount: hedge_amount,
                        hedged_spot_rate: result.current_spot,
                        hedged_rate: result.current_forward,
                        hedge_maturity: moment(replacements.maturity).format('YYYY-MM-DD'),
                        hedge_percentage: ruleresult.la_hedge_day_one,
                        forward_premium: result.current_forward,
                        bank_margin: 0,
                        inramount: hedge_amount * result.current_forward,
                        exp_imp: replacements.id,
                        budget_benchmark_rate: replacements.budget_benchmark_rate,
                        currency_from: replacements.currency_from,
                        currency_to: replacements.currency_to,
                        created_by: replacements.user_id,
                        updated_by: replacements.user_id
                    }
                    await knex('exp_hedge')
                        .insert(hedge_data)
                        .then((result) => { });

                    //update remaining amount
                    const checkExpData = await ExpSheet.findAll({ attributes: ['id', 'remaining_hedge_amount'], raw: true, where: { id: replacements.id } }).catch((err) => console.log(err));

                    var remainingHedgeAmount = parseFloat(checkExpData[0].remaining_hedge_amount);
                    var totalRemainingHedgeAmt = remainingHedgeAmount - hedge_amount;
                    var updateQuery = "update exp_sheet set remaining_hedge_amount =:totalRemainingHedgeAmt where id =:expId and status=1";
                    var resUpdate = await sequelize.query(updateQuery, { replacements: { totalRemainingHedgeAmt: totalRemainingHedgeAmt, expId: replacements.id } }).catch(err => console.log(err));
                    //HEDGING ON DAY ONE

                    var role_ladder = await knex('rm_user_rules_ladder').whereRaw("rm_user_rule_id=? AND status=? AND (rule_period = 1 or rule_end_date>=?)", [rm_user_rule_id, status, rule_end_date]);
                    for (const roleresult of role_ladder) {

                        var target_hedge_cost = roleresult.target_saving;
                        var amount = totalRemainingHedgeAmt * roleresult.hedge_on_target_rate / 100;
                        if (exp_imp == 1) {
                            var target_hedge_cost_saving = target_hedge_cost;
                            var target_hedge_forward_rate = parseFloat(budget_benchmark_rate) - parseFloat(budget_benchmark_rate * target_hedge_cost / 100);
                            var stop_loss_hedge_cost = 0;
                            var stop_loss_forward_rate = 0;
                        } else {
                            var target_hedge_cost_saving = target_hedge_cost;
                            var target_hedge_forward_rate = parseFloat(budget_benchmark_rate) + parseFloat(budget_benchmark_rate * target_hedge_cost / 100);
                            var stop_loss_hedge_cost = 0;
                            var stop_loss_forward_rate = 0;
                        }
                        let mdata = {
                            user_id: replacements.user_id,
                            company_id: replacements.company_id,
                            rule_id: roleresult.rule_id,
                            currency_from: replacements.currency_from,
                            currency_to: replacements.currency_to,
                            currencyname: replacements.currency,
                            maturitydate: moment(replacements.maturity).format('YYYY-MM-DD'),
                            spot_rate: result.current_spot,
                            premium_rate: result.premium,
                            forward_rate: result.current_forward,
                            months_annualized_hedge_cost: months_annualized_hedge_cost,
                            target_hedge_cost_saving: target_hedge_cost_saving,
                            target_hedge_cost: target_hedge_cost,
                            target_hedge_forward_rate: target_hedge_forward_rate,
                            maximum_additional_hedge_cost: 0,
                            stop_loss_hedge_cost: stop_loss_hedge_cost,
                            stop_loss_forward_rate: stop_loss_forward_rate,
                            exposure: roleresult.exp_imp,
                            mfe_identifier: replacements.mfe_identifier,
                            amount: totalRemainingHedgeAmt,
                            rule_currency: rule_currency,
                            rule_currency_from: rule_currency_from,
                            rule_currency_to: rule_currency_to,
                            rule_period: roleresult.rule_period,
                            rule_end_date: moment(new Date(rule_end_date)).format('YYYY-MM-DD'),
                            start_date: start_date,
                            exp_id: replacements.id,
                            rm_user_rule_id: rm_user_rule_id,
                            updated_by: sessUserId,
                            hedge_amount: amount
                        }
                        await rm_exp_notification.create(mdata).catch((err) => console.log(err));
                    }
                } else if (rule_type == '3') {

                    var exp_id = replacements.id;
                    var date = replacements.exposure_start_date;
                    var start_date = moment(date).format('YYYY-MM-DD');

                    role_ladder = []
                    var role_ladder = await knex('rm_user_rules_target_based').whereRaw("rm_user_rule_id=? AND status=? AND (rule_period = 1 or rule_end_date>=?)", [rm_user_rule_id, status, rule_end_date]);

                    for (const roleresult of role_ladder) {
                        var spot_value = result.current_spot;

                        var target_hedge_cost = roleresult.target_rate_percent;
                        var amount = replacements.remaining_hedge_amount * roleresult.hedge_on_target_rate / 100;
                        if (exp_imp == 1) {
                            var target_hedge_cost_saving = 0;
                            //  var target_hedge_forward_rate = parseFloat(spot_value) - parseFloat(spot_value * target_hedge_cost / 100);
                            var target_hedge_forward_rate = target_hedge_cost;
                            var stop_loss_hedge_cost = 0;
                            var stop_loss_forward_rate = 0;
                        } else {
                            var target_hedge_cost_saving = 0;
                            var target_hedge_forward_rate = target_hedge_cost;
                            var stop_loss_hedge_cost = 0;
                            var stop_loss_forward_rate = 0;
                        }
                        let mdata = {
                            user_id: replacements.user_id,
                            company_id: replacements.company_id,
                            rule_id: roleresult.rule_id,
                            currency_from: replacements.currency_from,
                            currency_to: replacements.currency_to,
                            currencyname: replacements.currency,
                            maturitydate: moment(replacements.maturity).format('YYYY-MM-DD'),
                            spot_rate: result.current_spot,
                            premium_rate: result.premium,
                            forward_rate: result.current_forward,
                            months_annualized_hedge_cost: months_annualized_hedge_cost,
                            target_hedge_cost_saving: target_hedge_cost_saving,
                            target_hedge_cost: target_hedge_cost,
                            target_hedge_forward_rate: target_hedge_forward_rate,
                            maximum_additional_hedge_cost: 0,
                            stop_loss_hedge_cost: stop_loss_hedge_cost,
                            stop_loss_forward_rate: stop_loss_forward_rate,
                            exposure: roleresult.exp_imp,
                            mfe_identifier: replacements.mfe_identifier,
                            amount: replacements.remaining_hedge_amount,
                            rule_currency: rule_currency,
                            rule_currency_from: rule_currency_from,
                            rule_currency_to: rule_currency_to,
                            rule_period: roleresult.rule_period,
                            rule_end_date: moment(new Date(rule_end_date)).format('YYYY-MM-DD'),
                            start_date: start_date,
                            exp_id: exp_id,
                            rm_user_rule_id: rm_user_rule_id,
                            updated_by: sessUserId,
                            hedge_amount: amount
                        }
                        await rm_exp_notification.create(mdata).catch((err) => console.log(err));
                    }
                } else if (ruleresult.rule_id == '4') {
                    var exp_id = replacements.id;
                    role_ladder = []
                    var role_ladder = await knex('rm_user_rules_forward_start').whereRaw("rm_user_rule_id=? AND status=? AND (rule_period = 1 or rule_end_date>=?)", [rm_user_rule_id, status, rule_end_date]);
                    for (const roleresult of role_ladder) {
                        var spot_value = result.current_spot;
                        var target_hedge_cost = roleresult.target_rate_percent;
                        var amount = replacements.remaining_hedge_amount * roleresult.hedge_on_target_rate / 100;
                        if (exp_imp == 1) {
                            var target_hedge_cost_saving = 0;
                            var target_hedge_forward_rate = target_hedge_cost;
                            var stop_loss_hedge_cost = 0;
                            var stop_loss_forward_rate = 0;
                        } else {
                            var target_hedge_cost_saving = target_hedge_cost;
                            var target_hedge_forward_rate = target_hedge_cost;
                            var stop_loss_hedge_cost = 0;
                            var stop_loss_forward_rate = 0;
                        }
                        var date = replacements.maturity;
                        var days = ruleresult.hedge_start_before_days;
                        var startdate = moment(date, "YYYY-MM-DD").subtract(days, 'days');
                        var start_date = moment(startdate).format('YYYY-MM-DD');

                        let mdata = {
                            user_id: replacements.user_id,
                            company_id: replacements.company_id,
                            rule_id: roleresult.rule_id,
                            currency_from: replacements.currency_from,
                            currency_to: replacements.currency_to,
                            currencyname: replacements.currency,
                            maturitydate: moment(replacements.maturity).format('YYYY-MM-DD'),
                            spot_rate: result.current_spot,
                            premium_rate: result.premium,
                            forward_rate: result.current_forward,
                            months_annualized_hedge_cost: months_annualized_hedge_cost,
                            target_hedge_cost_saving: target_hedge_cost_saving,
                            target_hedge_cost: target_hedge_cost,
                            target_hedge_forward_rate: target_hedge_forward_rate,
                            maximum_additional_hedge_cost: 0,
                            stop_loss_hedge_cost: stop_loss_hedge_cost,
                            stop_loss_forward_rate: stop_loss_forward_rate,
                            exposure: roleresult.exp_imp,
                            mfe_identifier: replacements.mfe_identifier,
                            amount: replacements.remaining_hedge_amount,
                            rule_currency: rule_currency,
                            rule_currency_from: rule_currency_from,
                            rule_currency_to: rule_currency_to,
                            rule_period: roleresult.rule_period,
                            rule_end_date: moment(new Date(rule_end_date)).format('YYYY-MM-DD'),
                            start_date: start_date,
                            exp_id: exp_id,
                            rm_user_rule_id: rm_user_rule_id,
                            updated_by: sessUserId,
                            hedge_amount: amount
                        }

                        await rm_exp_notification.create(mdata).catch((err) => console.log(err));
                    }
                }
                await knex('exp_sheet')
                    .update({ set_rule_id: rm_user_rule_id, notification_status: 1 })
                    .where({ id: replacements.id })
                    .then((result) => { });
            }
        }
    }


}


exports.currency_pairlabel = async function (pid, res_format) {
    var curr_list = {};
    var arr = null;

    var cpwhr = { id: pid, status: '1', delete_status: '0' };
    var result = await masters.getdata_by_table_cond('currencypair_master', cpwhr);
    if (result.length > 0) {
        var swhr = { status: '1', delete_status: '0' };
        var currency = await masters.getdata_by_table_cond('currency_master', swhr);

        for (let cvalue of currency) {
            curr_list[cvalue.id] = cvalue.currency_name;
        }

        if (res_format == '1') {
            if (curr_list[result[0].from_curr] && curr_list[result[0].to_curr]) {
                arr = curr_list[result[0].from_curr] + '/' + curr_list[result[0].to_curr];
            }
            else {
                arr = false;
            }
        }
        else if (res_format == '2') {
            if (curr_list[result[0].from_curr] && curr_list[result[0].to_curr]) {
                var fromkey = result[0].from_curr;
                var fromvalue = curr_list[result[0].from_curr];

                var tokey = result[0].to_curr;
                var tovalue = curr_list[result[0].to_curr];

                arr = {};
                arr[fromkey] = fromvalue
                arr[tokey] = tovalue
            }
            else {
                arr = false;
            }
        }
        else {
            arr = false;
        }
    }
    else {
        arr = false;
    }

    return arr;
}
var ctsrates = exports.ctsrates = async function (currency_from_id, currency_to_id, exp_imp, margin = "0") {
    var where = { currency_from_id: currency_from_id, currency_to_id: currency_to_id };
    var data = await masters.get_definecol_bytbl_cond(['id', 'pair', 'type', 'crossvalue', 'primarycurrency', 'crrencyto', 'crrencyfrom'], 'ratecheckcurrency', where);
    var type = String(data[0].type);
    if (exp_imp == '1') {
        var spot_col = 'SPOTASK as spot';
        var cash_col = 'CASHRATEASK as cash';
        var tom_col = 'TOMRATEASK as tom';
    } else {
        var spot_col = 'SPOTBID as spot';
        var cash_col = 'CASHRATEBID as cash';
        var tom_col = 'TOMRATEBID as tom';
    }
    var currencypair = String(data[0].pair);
    var primarycurrency = data[0].primarycurrency;
    var crossvalue = data[0].crossvalue;
    if (type == '3' || type == '4' || type == '6' || type == '8') {
        var currencypair = data[0].crrencyto + '' + data[0].crrencyfrom;
    }
    if (type == '9') {
        var currencypair = data[0].primarycurrency;
    }

    var rate_query = await masters.get_definecol_bytbl_cond([spot_col, cash_col, tom_col], 'currencyliverate', { PAIR: currencypair });
    var id = String(data[0].id);
    if (rate_query) {
        var cash = rate_query[0].cash.toFixed(4);
        var tom = rate_query[0].tom.toFixed(4);
        var spot = rate_query[0].spot.toFixed(4);
    } else {
        var cash = 0;
        var tom = 0;
        var spot = 0;
    }
    if (type == '3' || type == '4' || type == '6' || type == '8') {
        var id = String(data[0].id);

        cash = 1 / cash;
        tom = 1 / tom;
        spot = 1 / spot;
        var details = { 'id': id, 'cash': cash.toFixed(4), 'tom': tom.toFixed(4), 'spot': spot.toFixed(4) };
    }
    else if (type == '9' || type == '10') {
        var current1_query = await masters.get_definecol_bytbl_cond([spot_col, cash_col, tom_col], 'currencyliverate', { PAIR: primarycurrency });
        var current2_query = await masters.get_definecol_bytbl_cond([spot_col, cash_col, tom_col], 'currencyliverate', { PAIR: crossvalue });
        var current1 = current1_query[0];
        var current2 = current2_query[0];
        cash = current1.cash / current2.cash;
        tom = current1.tom / current2.tom;
        spot = current1.spot / current2.spot;
        if (type == '10') {
            cash = 1 / cash;
            tom = 1 / tom;
            spot = 1 / spot;
        }
        var id = String(data[0].id);
        var details = { 'id': id, 'cash': cash.toFixed(4), 'tom': tom.toFixed(4), 'spot': spot.toFixed(4) };
    } else {
        var id = String(data[0].id);
        var details = { 'id': id, 'cash': cash, 'tom': tom, 'spot': spot };
    }
    return details;

}

var dateformatewithtime = exports.dateformatewithtime = async function (date) {
    return moment(date).format('DD-MMM-YYYY h:MM');
}

var plainAmount = exports.plainAmount = async function (amount) {
    var x = amount;
    return x.toString().replace(/,/g, "");
}

var currency_pair = exports.currency_pair = async function (sid, res_format, smenu = '') {
    var curr_list = '';
    var arr = '';
    var service_pair = {};
    service_pair = { '1': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15, 17, 18], '2': [1, 2, 3, 4], '3': [1, 2, 3, 4], '4': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], '5': { '10': [1, 2], '55': [1, 2, 3, 4], '60': [1, 2, 3] }, '8': [1, 2, 3, 4], '13': [1, 2, 3, 4], '14': [1, 2, 3, 4], '15': [1, 2, 3, 4] };

    if (sid in service_pair) {
        if ((smenu != '')) {
            var service_pairs = service_pair[sid][smenu];
        }
        else {
            if (sid == '5')
                var service_pairs = service_pair[sid][10];
            else
                var service_pairs = service_pair[sid];
        }

        var whr = service_pairs.join(',');
        var result = [];

        await knex.select('*').from('currencypair_master')
            .whereRaw("status = '1' AND delete_status = '0' and id IN(" + whr + ")")
            .then((response) => {
                result = response;
            }, (error) => { console.log(error); });

        var swhr = { status: '1', delete_status: '0' };
        var currency = [];
        await knex.select('*').from('currency_master')
            .where(swhr)
            .then((response) => {
                currency = response;
            }, (error) => { console.log(error); });

        curr_list = {};
        arr = {};

        for (let cvalue of currency) {
            curr_list[cvalue.id] = cvalue.currency_name;
        }

        if (res_format == '1') {
            for (let value of result) {
                if (curr_list[value.from_curr] && curr_list[value.to_curr]) {
                    arr[value.id] = curr_list[value.from_curr] + '/' + curr_list[value.to_curr];
                }
            }
        }
        else if (res_format == '2') {
            for (let value of result) {
                if (curr_list[value.from_curr] && curr_list[value.to_curr]) {
                    var fromKey = value.from_curr;
                    var fromValue = curr_list[value.from_curr];

                    var toKey = value.to_curr;
                    var toValue = curr_list[value.to_curr];

                    var data = {};
                    data[fromKey] = fromValue;
                    data[toKey] = toValue;

                    arr[value.id] = data;
                }
            }
        }
        else if (res_format == '3') {
            for (let svalue of service_pairs) {
                arr[svalue] = curr_list[svalue];
            }
        }
        else {
            arr = false;
        }
    }
    else {
        arr = false;
    }

    return arr;
}

var onTxnDateFwd = exports.onTxnDateFwd = async function (date) {
    var calcdate = date;
    var date = moment(calcdate, "YYYY-MM-DD").add(1, 'days');
    var finaldate = await gettxnDate(date);

    return finaldate;
}
// var spotrates = exports.spotrates = async function (currency_from_id, currency_to_id, user_id = '') {
//     var nechangetable = 'curriencynetchange';
//     var currencyliverate = 'currencyliverate';
//     var site_currencyliverate_all = 'site_currencyliverate_all';
//     var limit = 1;
//     var offset = 30;
//     var where = { currency_from_id: currency_from_id, currency_to_id: currency_to_id };
//     var data = await masters.get_definecol_bytbl_cond(['id', 'pair', 'type', 'crossvalue', 'primarycurrency', 'crrencyto', 'crrencyfrom'], 'ratecheckcurrency', where);
//     var type = String(data[0].type);
//     var spot_ask = 'SPOTASK as spotask';
//     var spot_bid = 'SPOTBID as spotbid';
//     var NETCHANGE = 'NETCHANGE';
//     var PERCENTAGE = 'PERCENTAGE';
//     var OPENPRICE = 'OPENPRICE';
//     var HIGHPRICE = 'HIGHPRICE';
//     var LOWPRICE = 'LOWPRICE';
//     var CLOSEPRICE = 'CLOSEPRICE';
//     var datetime = 'DATE as datetime';
//     var currencypair = String(data[0].pair);
//     var primarycurrency = data[0].primarycurrency;
//     var crossvalue = data[0].crossvalue;
//     if (type == '3' || type == '4' || type == '6' || type == '8') {
//         var currencypair = data[0].crrencyto + '' + data[0].crrencyfrom;
//     }
//     if (type == '9') {
//         var currencypair = data[0].primarycurrency;
//     }
//     if (user_id == '') {
//         var rate_query = await knex.select([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, OPENPRICE, HIGHPRICE, LOWPRICE, CLOSEPRICE, datetime]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [currencypair]).orderBy('id', 'desc').limit(limit).offset(offset);

//     } else {
//         var currentdate = moment(Date.now()).format('YYYY-MM-DD');
//         var checkservice = await knex.select("id").from('user_service_assigned').whereRaw('user_id=? AND service_id=? AND status=? AND end_date>=?', [user_id, 2, 1, currentdate]);
//         if (checkservice.length < 1) {
//             var rate_query = await knex.select([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, HIGHPRICE, LOWPRICE, datetime]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [currencypair]).orderBy('id', 'desc').limit(limit).offset(offset);
//         } else {
//             var rate_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, HIGHPRICE, LOWPRICE, datetime], currencyliverate, { PAIR: currencypair });
//         }
//     }
//     var id = String(data[0].id);
//     if (rate_query.length > 0) {
//         var spotask = rate_query[0].spotask.toFixed(4);
//         var spotbid = rate_query[0].spotbid.toFixed(4);
//         var where = { PAIR: currencypair };
//         var ch_data = await masters.get_definecol_bytbl_cond(['OPENPRICE', 'CLOSEPRICE'], nechangetable, where);
//         if (currencypair == 'USDINR') {
//             var crtime = moment(Date.now()).format('HH:mm:ss');
//             var today = new Date().getHours();
//             var date1 = new Date().getTime();
//             var minDate = new Date();
//             minDate = minDate.setHours(10, 0, 0);

//             var maxDate = new Date();
//             maxDate = maxDate.setHours(14, 0, 0);

//             var currDateTime = moment(date1).utcOffset("+05:30").format('HH:mm:ss');
//             var minDate = moment(minDate).format('HH:mm:ss');
//             var maxDate = moment(maxDate).format('HH:mm:ss');
//             if (currDateTime > '10:00:00' && currDateTime < '10:00:59') {
//                 var currentprice = ch_data[0].OPENPRICE;
//             }
//             else if ((currDateTime >= minDate) && (currDateTime <= maxDate)) {
//                 var currentprice = spotbid;
              
//             } else {
            
//                 var currentprice = ch_data[0].CLOSEPRICE;
//             }
//             var currentprice = spotask;
//         } else {
//             var currentprice = spotask;
//         }

//         var prdaysclosedprice = ch_data[0].CLOSEPRICE;
//         var currentprice = currentprice;
//         var highprice = rate_query[0].HIGHPRICE.toFixed(4);
//         var lowprice = rate_query[0].LOWPRICE.toFixed(4);
//         var date_time = rate_query[0].datetime;


//     } else {
//         var spotask = 0;
//         var spotbid = 0;
//         var date_time = '0';
//         var netchange = 0;
//         var percentage = 0;
//         var highprice = 0;
//         var lowprice = 0;
//         var currentprice = 0;
//         var prdaysclosedprice = 0;

//     }
//     if (type == '3' || type == '4') {
//         var id = String(data[0].id);

//         if (spotask != 0) {
//             spotask = 1 / spotask;
//         }
//         if (spotbid != 0) {
//             spotbid = 1 / spotbid;
//         }
//         if (netchange != 0) {
//             netchange = 1 / netchange;
//         }
//         if (percentage != 0) {
//             percentage = 1 / percentage;
//         }
//         if (highprice != 0) {
//             highprice = 1 / highprice;
//         }
//         if (lowprice != 0) {
//             lowprice = 1 / lowprice;
//         }
//     }
//     else {
//         if (type == '5' || type == '6' || type == '7' || type == '8' || type == '9' || type == '10') {

//             var where1 = { PAIR: primarycurrency };
//             var ch_data1 = await masters.get_definecol_bytbl_cond(['OPENPRICE', 'CLOSEPRICE'], nechangetable, where1);
//             var where2 = { PAIR: crossvalue };
//             var ch_data2 = await masters.get_definecol_bytbl_cond(['OPENPRICE', 'CLOSEPRICE'], nechangetable, where2);
//             if (user_id == '') {
//                 var current1_query = await knex.select([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, OPENPRICE, HIGHPRICE, LOWPRICE, CLOSEPRICE, datetime]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [primarycurrency]).orderBy('id', 'desc').limit(limit).offset(offset);
//                 var current2_query = await knex.select([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, OPENPRICE, HIGHPRICE, LOWPRICE, CLOSEPRICE, datetime]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [crossvalue]).orderBy('id', 'desc').limit(limit).offset(offset);
              
//             } else {
//                 var currentdate = moment(Date.now()).format('YYYY-MM-DD');
//                 var checkservice = await knex.select("id").from('user_service_assigned').whereRaw('user_id=? AND service_id=? AND status=? AND end_date>=?', [user_id, 2, 1, currentdate]);

//                 if (checkservice.length < 1) {


//                     var current1_query = await knex.select([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, OPENPRICE, HIGHPRICE, LOWPRICE, CLOSEPRICE, datetime]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [primarycurrency]).orderBy('id', 'desc').limit(limit).offset(offset);

//                     var current2_query = await knex.select([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, OPENPRICE, HIGHPRICE, LOWPRICE, CLOSEPRICE, datetime]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [crossvalue]).orderBy('id', 'desc').limit(limit).offset(offset);
                  
//                 } else {

//                     var current1_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, HIGHPRICE, LOWPRICE, datetime], currencyliverate, { PAIR: primarycurrency });
//                     var current2_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, HIGHPRICE, LOWPRICE], currencyliverate, { PAIR: crossvalue });
//                 }
//             }

//             if (current1_query.length > 0 && current2_query.length > 0) {
//                 var current1 = current1_query[0];
//                 var current2 = current2_query[0];
//                 var date_time = current1_query[0].datetime;
//                 var closeprice1 = ch_data1[0].CLOSEPRICE;
//                 var closeprice2 = ch_data2[0].CLOSEPRICE;
//                 if (type == '5' || type == '6') {
//                     spotask = current1.spotask / current2.spotbid;
//                     spotbid = current1.spotbid / current2.spotask;
//                     spot = current1.spot / current2.spot;
//                     highprice = current1.HIGHPRICE / current2.HIGHPRICE;
//                     lowprice = current1.LOWPRICE / current2.LOWPRICE;
//                     prdaysclosedprice = closeprice1 / closeprice2;
//                     if (type == '6') {
//                         spotask = 1 / spotask;
//                         spotbid = 1 / spotask;
//                         spot = 1 / spot;
//                         prdaysclosedprice = 1 / prdaysclosedprice;
//                     }
//                 }
//                 if (type == '7' || type == '8') {
//                     spotask = current1.spotask * current2.spotask;
//                     spotbid = current1.spotbid * current2.spotbid;
//                     spot = current1.spot / current2.spot;
//                     netchange = current1.NETCHANGE * current2.NETCHANGE;
//                     percentage = current1.PERCENTAGE * current2.PERCENTAGE;
//                     highprice = current1.HIGHPRICE * current2.HIGHPRICE;
//                     lowprice = current1.LOWPRICE * current2.LOWPRICE;
//                     prdaysclosedprice = closeprice1 * closeprice2;
//                     if (type == '8') {
//                         spotask = 1 / spotask;
//                         spotbid = 1 / spotbid;
//                         spot = 1 / spot;
//                         prdaysclosedprice = 1 / prdaysclosedprice;
//                     }
//                 }
//                 if (type == '9' || type == '10') {
//                     spotask = current1.spotask / current2.spotbid;
//                     spotbid = current1.spotbid / current2.spotask;
//                     spot = current1.spot / current2.spot;
//                     netchange = current1.NETCHANGE / current2.NETCHANGE;
//                     percentage = current1.PERCENTAGE / current2.PERCENTAGE;
//                     highprice = current1.HIGHPRICE / current2.HIGHPRICE;
//                     lowprice = current1.LOWPRICE / current2.LOWPRICE;
//                     prdaysclosedprice = closeprice1 / closeprice2;
//                     if (type == '10') {
//                         spotask = 1 / spotask;
//                         spotbid = 1 / spotbid;
//                         spot = 1 / spot;
//                         prdaysclosedprice = 1 / prdaysclosedprice;
//                     }
//                 }
//             }
//             var currentprice = spotask;
//         }
//     }
//     var id = String(data[0].id);
    
//     var netchange = currentprice - prdaysclosedprice;
//     var percentage = (netchange / prdaysclosedprice) * 100;
//     var details = { 'id': id, 'spotask': spotask, 'spotbid': spotbid, 'netchange': netchange, 'percentage': percentage, 'highprice': highprice, 'lowprice': lowprice, 'currentprice': currentprice, 'prdaysclosedprice': prdaysclosedprice, 'date_time': date_time };

//     return details;

// }

var spotrates = exports.spotrates = async function (currency_from_id, currency_to_id, user_id = '') {
    var currencyliverate_filter_date = 'currencyliverate_filter_date'
    var nechangetable = 'curriencynetchange';
    var currencyliverate = 'currencyliverate';
    var site_currencyliverate_all = 'currencyliverate_history';
    var limit = 1;
    var offset = 3;
    var where = { currency_from_id: currency_from_id, currency_to_id: currency_to_id };
    var data = await masters.get_definecol_bytbl_cond(['id', 'pair', 'type', 'crossvalue', 'primarycurrency', 'crrencyto', 'crrencyfrom'], 'ratecheckcurrency', where);
    var type = String(data[0].type);
    var spot_ask = 'SPOTASK as spotask';
    var spot_bid = 'SPOTBID as spotbid';
    var NETCHANGE = 'NETCHANGE';
    var PERCENTAGE = 'PERCENTAGE';
    var OPENPRICE = 'OPENPRICE';
    var HIGHPRICE = 'HIGHPRICE';
    var LOWPRICE = 'LOWPRICE';
    var CLOSEPRICE = 'CLOSEPRICE';
    var datetime = 'DATE as datetime';
    var NDF = 'NDF';
    var closedprice = 'closedprice as CLOSEPRICE'
    var currencypair = String(data[0].pair);
    var primarycurrency = data[0].primarycurrency;
    var crossvalue = data[0].crossvalue;
    var NDFUSDINR = 'NDF USDINR'
    var ndfval = 0;
    if (type == '3' || type == '4' || type == '6' || type == '8') {
        var currencypair = data[0].crrencyto + '' + data[0].crrencyfrom;
    }
    // if (type == '9') {
    //     var currencypair = data[0].primarycurrency;
    // }
    if (user_id == 'true') {
       
        var rate_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, HIGHPRICE, LOWPRICE, datetime, NDF], currencyliverate, { PAIR: currencypair });

    } else  {
        if (user_id == '') {
            var rate_query = await knex.select([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, OPENPRICE, HIGHPRICE, LOWPRICE, CLOSEPRICE, datetime, NDF]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [currencypair]).orderBy('id', 'desc').limit(limit).offset(offset);
        } else {
            //    var currentdate = moment(Date.now()).format('YYYY-MM-DD');
            // var checkservice = await knex.select("id").from('user_service_assigned').whereRaw('user_id=? AND service_id=? AND status=? AND end_date>=?', [user_id, 2, 1, currentdate]);
            var currentdate = moment(Date.now()).format('YYYY-MM-DD');
            var checkservice = await knex.select("id").from('user_subscriptions').whereRaw('user_id=?  AND status=? AND end_date>=?', [user_id, 1, currentdate]);

            if (checkservice.length < 1) {
                var rate_query = await knex.select([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, HIGHPRICE, LOWPRICE, datetime, NDF]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [currencypair]).orderBy('id', 'desc').limit(limit).offset(offset);
            } else {
                var rate_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, HIGHPRICE, LOWPRICE, datetime, NDF], currencyliverate, { PAIR: currencypair });
            }
        }
    }
    var id = String(data[0].id);
    if (rate_query.length > 0) {
        var spotask = rate_query[0].spotask.toFixed(4);
        var spotbid = rate_query[0].spotbid.toFixed(4);
        var where = { PAIR: currencypair };
        var ch_data = await masters.get_definecol_bytbl_cond(['OPENPRICE',closedprice], nechangetable, where);
        if (currencypair == 'USDINR') {
            var finaldate = await holiday_list_ind(currentdate);
            var crtime = moment(Date.now()).format('HH:mm:ss');
            var today = new Date().getHours();
            var date1 = new Date().getTime();
            var minDate = new Date();
            minDate = minDate.setHours(10, 0, 0);
            var maxDate = new Date();
            maxDate = maxDate.setHours(15, 30, 0);
            var currDateTime = moment(date1).utcOffset("+05:30").format('HH:mm:ss');
            var minDate = moment(minDate).format('HH:mm:ss');
            var maxDate = moment(maxDate).format('HH:mm:ss');
            if (finaldate == 0) {
                var rate_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, HIGHPRICE, LOWPRICE, datetime, NDF], currencyliverate, { PAIR: NDFUSDINR });
                var spotask = rate_query[0].spotask.toFixed(4);
                var spotbid = rate_query[0].spotbid.toFixed(4);
            }
//else if (currDateTime > '10:00:00' && currDateTime < '10:00:59') {
                // console.log('10 am')
               // var currentprice = ch_data[0].OPENPRICE;
           // }
            else if ((currDateTime >= minDate) && (currDateTime <= maxDate)) {
                var currentprice = spotbid;

                // console.log('with 2 pm');
            } else {
            // console.log('After 2 Pm');
                var currentprice = ch_data[0].CLOSEPRICE;
                var rate_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, NETCHANGE, PERCENTAGE, HIGHPRICE, LOWPRICE, datetime, NDF], currencyliverate, { PAIR: NDFUSDINR });
                var spotask = rate_query[0].spotask.toFixed(4);
                var spotbid = rate_query[0].spotbid.toFixed(4);
            }
            //var currentprice = spotbid;
        } else {
            var currentprice = spotbid;
        }
     
        var prdaysclosedprice = ch_data[0].CLOSEPRICE;
        var currentprice = currentprice;
        var netchange = rate_query[0].NETCHANGE.toFixed(4);
        var percentage = rate_query[0].PERCENTAGE.toFixed(2);
        var highprice = rate_query[0].HIGHPRICE.toFixed(4);
        var lowprice = rate_query[0].LOWPRICE.toFixed(4);
        var date_time = rate_query[0].datetime;
        var ndfval = rate_query[0].NDF;
       
    } else {
        var spotask = 0;
        var spotbid = 0;
        var date_time = '0';
        var netchange = 0;
        var percentage = 0;
        var highprice = 0;
        var lowprice = 0;
        var currentprice = 0;
        var prdaysclosedprice = 0;
        var ndfval = 0;

    }
    if (type == '3' || type == '4') {
        var id = String(data[0].id);

        if (spotask != 0) {
            spotask = 1 / spotask;
        }
        if (spotbid != 0) {
            spotbid = 1 / spotbid;
        }
        if (netchange != 0) {
            netchange = 1 / netchange;
        }
        if (percentage != 0) {
            percentage = 1 / percentage;
        }
        if (highprice != 0) {
            highprice = 1 / highprice;
        }
        if (lowprice != 0) {
            lowprice = 1 / lowprice;
        }
    }
    else {
        if (type == '5' || type == '6' || type == '7' || type == '8' || type == '9' || type == '10') {
            var where1 = { PAIR: primarycurrency };
            var ch_data1 = await masters.get_definecol_bytbl_cond(['OPENPRICE', closedprice], nechangetable, where1);
            var where2 = { PAIR: crossvalue };
            var ch_data2 = await masters.get_definecol_bytbl_cond(['OPENPRICE',closedprice], nechangetable, where2);
            if (user_id == '') {
                var current1_query = await knex.select([spot_ask, spot_bid, datetime]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [primarycurrency]).orderBy('id', 'desc').limit(limit).offset(offset);
                var current2_query = await knex.select([spot_ask, spot_bid, datetime]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [crossvalue]).orderBy('id', 'desc').limit(limit).offset(offset);
                //  console.log()
                //   console.log(current2_query[0]);
                // var curr_data = moment(current2_query[0].datetime).format('YYYY-MM-DD');
                // if (current2_query.length > 0) {
                //     var curr_data = moment(current2_query[0].datetime).format('YYYY-MM-DD');
                // }
            } else {
                var currentdate = moment(Date.now()).format('YYYY-MM-DD');
                var checkservice = await knex.select("id").from('user_subscriptions').whereRaw('user_id=?  AND status=? AND end_date>=?', [user_id, 1, currentdate]);
                if (checkservice.length < 1) {
                    var current1_query = await knex.select([spot_ask, spot_bid, datetime]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [primarycurrency]).orderBy('id', 'desc').limit(limit).offset(offset);
                    var current2_query = await knex.select([spot_ask, spot_bid, datetime]).from(site_currencyliverate_all).whereRaw('PAIR = ?', [crossvalue]).orderBy('id', 'desc').limit(limit).offset(offset);
                    // if (current2_query.length > 0) {
                    //     var curr_data = moment(current2_query[0].datetime).format('YYYY-MM-DD');
                    // }
                } else {
                    if (primarycurrency == 'USDINR') {
                        var finaldate = await holiday_list(currentdate);
                        var crtime = moment(Date.now()).format('HH:mm:ss');
                        var today = new Date().getHours();
                        var date1 = new Date().getTime();
                        var minDate = new Date();
                        minDate = minDate.setHours(10, 0, 0);
                        var maxDate = new Date();
                        maxDate = maxDate.setHours(15, 30, 0);
                        var currDateTime = moment(date1).utcOffset("+05:30").format('HH:mm:ss');
                        var minDate = moment(minDate).format('HH:mm:ss');
                        var maxDate = moment(maxDate).format('HH:mm:ss');
                        if (finaldate == 0) {
                            var current1_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, datetime], currencyliverate, { PAIR: NDFUSDINR });

                        }
                        
                        else if ((currDateTime >= minDate) && (currDateTime <= maxDate)) {
                            var current1_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, datetime], currencyliverate, { PAIR: primarycurrency });

                            // console.log('with 2 pm');
                        } else {
                            var current1_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, datetime], currencyliverate, { PAIR: NDFUSDINR });
                        }
                    } else {
                        var current1_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, datetime], currencyliverate, { PAIR: primarycurrency });
                    }
                   
                    var current2_query = await masters.get_definecol_bytbl_cond([spot_ask, spot_bid, datetime], currencyliverate, { PAIR: crossvalue });
                   // var curr_data = moment(current2_query[0].datetime).format('YYYY-MM-DD');
                   // var date_time_h_l = await curdatetime(site_currencyliverate_all, crossvalue, curr_data, 'DESC');
                    //  console.log(moment(curr_data).format('YYYY-MM-DD'));
                    
                }
            }
              
            
            if (current1_query.length > 0 && current2_query.length > 0) {
                var current1 = current1_query[0];
                var current2 = current2_query[0];
                var date_time = current2_query[0].datetime;
                var closeprice1 = ch_data1[0].CLOSEPRICE;
                var closeprice2 = ch_data2[0].CLOSEPRICE;
                if (type == '5' || type == '6') {
                    spotask = current1.spotask / current2.spotbid;
                    spotbid = current1.spotbid / current2.spotask;
                    spot = current1.spot / current2.spot;
                    // highprice = current1.HIGHPRICE / current2.HIGHPRICE;
                    // lowprice = current1.LOWPRICE / current2.LOWPRICE;
                    prdaysclosedprice = closeprice1 / closeprice2;
                    if (type == '6') {
                        spotask = 1 / spotask;
                        spotbid = 1 / spotbid;
                        spot = 1 / spot;
                        //  highprice = 1 / highprice;
                        // lowprice = 1 / lowprice;
                        //  prdaysclosedprice = 1 / prdaysclosedprice;
                    }
                }
                if (type == '7' || type == '8') {
                    spotask = current1.spotask * current2.spotask;
                    spotbid = current1.spotbid * current2.spotbid;
                    spot = current1.spot / current2.spot;
                    // highprice = current1.HIGHPRICE * current2.HIGHPRICE;
                    // lowprice = current1.LOWPRICE * current2.LOWPRICE;
                    prdaysclosedprice = closeprice1 * closeprice2;
                    if (type == '8') {
                        spotask = 1 / spotask;
                        spotbid = 1 / spotbid;
                        spot = 1 / spot;
                        //   highprice = 1 / highprice;
                        // lowprice = 1 / lowprice;
                        //  prdaysclosedprice = 1 / prdaysclosedprice;
                    }
                }
                if (type == '9' || type == '10') {
                    spotask = current1.spotask / current2.spotbid;
                    spotbid = current1.spotbid / current2.spotask;
                    spot = current1.spot / current2.spot;
                    // highprice = current1.HIGHPRICE / current2.HIGHPRICE;
                    //  lowprice = current1.LOWPRICE / current2.LOWPRICE;
                    prdaysclosedprice = closeprice1 / closeprice2;
                    if (type == '10') {
                        spotask = 1 / spotask;
                        spotbid = 1 / spotbid;
                        spot = 1 / spot;
                        //  highprice = 1 / highprice;
                        //lowprice = 1 / lowprice;
                        // prdaysclosedprice = 1 / prdaysclosedprice;
                    }
                }
            }
          
            // var date_time_h_l = await curdatetime(site_currencyliverate_all, currencypair, 'DESC');
            // if (date_time_h_l != '') {
            //     var date_time_h_l = moment(date_time_h_l.DATE).format('YYYY-MM-DD');
            // } else {
            //     var date_time_h_l = '';
            // }
            //     if (date_time_h_l!= '') { 
            //     var high = await knex(site_currencyliverate_all).max({ HIGHPRICE: 'HIGHPRICE' }).where('PAIR', currencypair).where('DATE', 'like', '%' + date_time_h_l + '%');
            //     var highprice = high[0].HIGHPRICE;
            //     var low = await knex(site_currencyliverate_all).min({ LOWPRICE: 'LOWPRICE' }).where('PAIR', currencypair).where('DATE', 'like', '%' + date_time_h_l + '%');
            //     var lowprice = low[0].LOWPRICE;
            // } else { 
            //     var highprice = 0;
            //     var lowprice = 0;
            // }
            var date_time_h_l = await knex.select('start_date', 'end_date').table(currencyliverate_filter_date)
            if (date_time_h_l.length > 0) {
                var start_date = date_time_h_l[0].start_date;
                var end_date = date_time_h_l[0].end_date;
                var high = await knex(site_currencyliverate_all).max({ HIGHPRICE: 'HIGHPRICE' }).where('PAIR', currencypair).where('DATE', '>=', start_date)
                    .where('DATE', '<', end_date);
                if (high.length > 0) {
                    var highprice = high[0].HIGHPRICE;
                } else { 
                    var highprice = 0;
                }
                var low = await knex(site_currencyliverate_all).min({ LOWPRICE: 'LOWPRICE' }).where('PAIR', currencypair).where('DATE', '>=', start_date)
                    .where('DATE', '<', end_date);
                if (low.length > 0) {
                    var lowprice = low[0].LOWPRICE;
                } else { 
                    var lowprice = 0;
                }
            } else { 
                var highprice = 0;
                var lowprice = 0;
            }
          
        }
        var netpair = { PAIR: currencypair };
       
        var closeprice = await masters.get_definecol_bytbl_cond([closedprice], nechangetable, netpair);
        prdaysclosedprice = closeprice[0].CLOSEPRICE;
            var currentprice = spotbid;
            var netchange = currentprice - prdaysclosedprice;
        var percentage = (netchange / prdaysclosedprice) * 100;
        if (type == '6' || type == '8' || type == '10') { 
            if (netchange != 0) {
                var netchange = 1 / netchange;
            } else { 
                var netchange  =0  
            }
            if (percentage!=0) {
                var percentage = 1 / percentage;
            } else { 
                var percentage = 0;
            }
            if (highprice !=0) {
                var highprice = 1 / highprice;
            } 
            if(lowprice!=0){
                var lowprice = 1 / lowprice;
            }
        }
    }
    var id = String(data[0].id);
    if (currencypair == 'USDINR') {
        var ndfval = ndfval;
    } else { 
        var ndfval = 0;
    }
   
    var details = { 'id': id, 'spotask': spotask, 'spotbid': spotbid, 'netchange': netchange, 'percentage': percentage, 'highprice': highprice, 'lowprice': lowprice, 'currentprice': currentprice, 'prdaysclosedprice': prdaysclosedprice, 'date_time': date_time,'NDF':ndfval };
    return details;
}
var dateformatewithtime = exports.dateformatewithtime = async function (date) {
    return moment(date).format('DD-MMM-YYYY h:MM');
}
var get_liverates = exports.get_liverates = async function (code) {
    var item = await masters.get_definecol_bytbl_cond(['SPOTBID', 'SPOTASK', 'PAIR', 'DATE'], 'currencyliverate', { CODE: code });
    return item;
}

//FOR OPEN LOW HIGH CLOSE RATE |START
var otherRates = exports.otherRates = async function (pair = '', currency_pair_id = '', currency_from_id = '', currency_to_id = '') {
    var otherRatesData = [];
    var currPairName = pair;
    var currPairId = currency_pair_id;
    var currencyFromId = currency_from_id;
    var currencyToId = currency_to_id;

    var response = { open: '-', low: '-', high: '-', close: '-' };

    if (pair != '') {
        var table_name = 'site_currencyliverate_all';
        var joins = [];
        var columns = ['id', 'PAIR', 'SPOTBID', 'SPOTASK'];
        var where = [];
        var time_stamp = moment(new Date()).format('YYYY-MM-DD');
        var extra_where = "DATE(`DATE`) = '" + time_stamp + "' and PAIR = '" + pair + "'";
        var limit = {};
        limit['offset'] = 0;
        limit['limit'] = 1;

        //GET OPEN RATE       
        var result = await apiModel.get_joins_records(table_name, columns, joins, where, 'DATE asc', extra_where, limit, '');
        if (result.length > 0) {
            response['open'] = (result[0].SPOTBID).toFixed(4);
        }

        //GET LOW RATE
        var columns = ['id', 'PAIR', knex.raw('MIN(SPOTBID) as SPOTBID'), 'SPOTASK'];
        var result = await apiModel.get_joins_records(table_name, columns, joins, where, '', extra_where, {}, '');
        if (result.length > 0) {
            if (result[0].SPOTBID) {
                response['low'] = (result[0].SPOTBID).toFixed(4);
            }
        }

        //GET HIGH RATE
        var columns = ['id', 'PAIR', knex.raw('MAX(SPOTBID) as SPOTBID'), 'SPOTASK'];
        var result = await apiModel.get_joins_records(table_name, columns, joins, where, '', extra_where, {}, '');
        if (result.length > 0) {
            if (result[0].SPOTBID) {
                response['high'] = (result[0].SPOTBID).toFixed(4);
            }
        }
    }

    otherRatesData[0] = response;

    return otherRatesData;
}
//FOR OPEN LOW HIGH CLOSE RATE |END

// For Inr Value
var inrvale = exports.inrvale = async function (currency_from_id, currency_to_id, exp_imp, amount = "0") {
    var where = { currency_from_id: currency_from_id, currency_to_id: currency_to_id };
    var amount;
    var response = {};
    var exp_imp = exp_imp;
    var data = await masters.get_definecol_bytbl_cond(['id', 'pair', 'type', 'crossvalue', 'primarycurrency', 'crrencyto', 'crrencyfrom'], 'ratecheckcurrency', where);
    var crossvalue = data[0].crossvalue;
    //console.log(crossvalue);
    var type = data[0].type;
    if (type == 1 || type == 2 || type == 3 || type == 4) {
        response['amount'] = amount;
    } else {
        var current1_query = await masters.get_definecol_bytbl_cond(['SPOTBID', 'SPOTASK'], 'currencyliverate', { PAIR: crossvalue });
        if (exp_imp == 1) {
            var spotrate = current1_query[0].SPOTASK;
        } else {
            var spotrate = current1_query[0].SPOTBID;
        }
        if (type == 5 || type == 6 || type == 9 || type == 10) {
            response['amount'] = amount / spotrate;
        } else {
            response['amount'] = amount * spotrate;
        }
        // if()

    }

    return response;
}
var curdatetime = exports.curdatetime = async function (table, pair, order) { 
    // var cur_query = await knex(table).select('DATE').where('PAIR', pair).orderBy('DATE', 'DESC').limit(1).offset(0);
    // console.log(cur_query[0]);
    
    // date = "2021-02-15";
    // var datee = '%' + date + '%';
    // if (pair == 'JPYINR') {
    //     console.log(pair+datee);
    // }
    var current1_query = await knex(table).select('DATE').where('PAIR', pair).orderBy('DATE', 'DESC').limit(1).offset(0);;
    if (current1_query.length > 0) {
        return current1_query[0];
    } else { 
        return current1_query ='';
    }
    
}

var ctsrateval = exports.ctsrateval = async function ($request) {
    var hedgeMaturity = $request.hedgeMaturity;
   var currency_from_id = $request.currencyFrom;
    var currency_to_id = $request.currencyTo;
    var where = { date: hedgeMaturity};
  
    var $data = await masters.get_definecol_bytbl_cond(['transaction_type'], 'ctsdate', where);
    if ($data.length > 0) {
        var rate_where = { currency_from_id: currency_from_id, currency_to_id: currency_to_id };
        var $res = await masters.get_definecol_bytbl_cond(['pair', 'primarycurrency', 'type', 'crossvalue', 'currencyid', 'currency_from_id', 'currency_to_id', 'crrencyfrom', 'crrencyto'], 'ratecheckcurrency', rate_where);
        $type = $res[0].type;
        $transactiontype = $data[0].transaction_type;
        $currencypair = $res[0].pair;
        $primarycurrency = $res[0].primarycurrency;
        $crossvalue = $res[0].crossvalue;
        $importexport = $request.expimpType;
        $crrencyto = $res[0].crrencyto;
        $crrencyfrom = $res[0].crrencyfrom;
        $ndfusdinr = 'NDF USDINR';
        $table = 'currencyliverate';
        if ($importexport == '2') {
            if ($transactiontype == '3') {
                $colname = 'SPOTBID';
                $colname1 = 'SPOTBID';
            }
            if ($transactiontype == '2') {
                $colname = 'SPOTBID';
                $colname1 = 'TOMSPOTASK';
            }
            if ($transactiontype == '1') {
                $colname = 'SPOTBID';
                $colname1 = 'CASHSPOTASK';
            }
        } else {
            if ($transactiontype == '3') {
                $colname = 'SPOTASK';
                $colname1 = 'SPOTASK';
            }
            if ($transactiontype == '2') {
                $colname = 'SPOTASK';
                $colname1 = 'TOMSPOTBID';
            }
            if ($transactiontype == '1') {
                $colname = 'SPOTASK';
                $colname1 = 'CASHSPOTBID';
            }
        }
        if ($type == '3' || $type == '4' || $type == '6' || $type == '8') {
            $currencypair = $crrencyto + '' + $crrencyfrom;
        }
        if ($type == '9') {
            $currencypair = $primarycurrency;
        }
        if ($currencypair == 'USDINR') {
     
            var currentdate = moment(Date.now()).format('YYYY-MM-DD');
            var finaldate = await holiday_list_ind(currentdate);
            var crtime = moment(Date.now()).format('HH:mm:ss');
            var today = new Date().getHours();
            var date1 = new Date().getTime();
            var minDate = new Date();
            minDate = minDate.setHours(10, 0, 0);
            var maxDate = new Date();
            maxDate = maxDate.setHours(15, 30, 0);
            var $currDateTime = moment(date1).utcOffset("+05:30").format('HH:mm:ss');
            var $minDate = moment(minDate).format('HH:mm:ss');
            var $maxDate = moment(maxDate).format('HH:mm:ss');
            if (finaldate == 0) {
          
                $spotpair = $ndfusdinr;
                $wher_pair = { 'PAIR': $spotpair }
                $wher_cashpair = { 'PAIR': $currencypair }
                var col = $colname + ' as value';
                var col1 = $colname1 + ' as per_value';
                var $spot = await masters.get_definecol_bytbl_cond([col, 'DATE'], $table, $wher_pair);
                var $cash = await masters.get_definecol_bytbl_cond([col, col1, 'DATE'], $table, $wher_cashpair);
                $current = {
                    value: $spot[0].value,
                    DATE: $spot[0].DATE,
                    per_value: $cash[0].per_value
                };
            } else if ($currDateTime >= $minDate && $currDateTime <= $maxDate) {
                $wher_cashpair = { 'PAIR': $currencypair }
                var col = $colname + ' as value';
                var col1 = $colname1 + ' as per_value';
                var $current_query = await masters.get_definecol_bytbl_cond([col, col1, 'DATE'], $table, $wher_cashpair);
                $current = {
                    value: $current_query[0].value,
                    DATE: $current_query[0].DATE,
                    per_value: $current_query[0].per_value
                };
            } else {
                $spotpair = $ndfusdinr;
                $wher_pair = { 'PAIR': $spotpair }
                $wher_cashpair = { 'PAIR': $currencypair }
                var col = $colname + ' as value';
                var col1 = $colname1 + ' as per_value';
                var $spot = await masters.get_definecol_bytbl_cond([col, 'DATE'], $table, $wher_pair);
                var $cash = await masters.get_definecol_bytbl_cond([col, col1, 'DATE'], $table, $wher_cashpair);
                $current = {
                    value: $spot[0].value,
                    DATE: $spot[0].DATE,
                    per_value: $cash[0].per_value
                };
            }
   
   
        } else {
            $wher_cashpair = { 'PAIR': $currencypair }
            var col = $colname + ' as value';
            var col1 = $colname1 + ' as per_value';
            var $current_query = await masters.get_definecol_bytbl_cond([col, col1, 'DATE'], $table, $wher_cashpair);
            $current = {
                value: $current_query[0].value,
                DATE: $current_query[0].DATE,
                per_value: $current_query[0].per_value
            };
        }
        if ($transactiontype == 3) {
            var $value = $current.value;
        } else {
            var $value = $current.value - $current.per_value;
        }
        //console.log($value);
        $per_value = $current.per_value;
        $date_time = $current.DATE;
        if ($type == '3' || $type == '4') {
            var $value = 1 / $value;
        }
        if ($type == '5' || $type == '6' || $type == '7' || $type == '8' || $type == '9' || $type == '10') {
            if ($primarycurrency == 'USDINR') {
                var currentdate = moment(Date.now()).format('YYYY-MM-DD');
                var finaldate = await holiday_list_ind(currentdate);
                var crtime = moment(Date.now()).format('HH:mm:ss');
                var today = new Date().getHours();
                var date1 = new Date().getTime();
                var minDate = new Date();
                minDate = minDate.setHours(10, 0, 0);
                var maxDate = new Date();
                maxDate = maxDate.setHours(15, 30, 0);
                var $currDateTime = moment(date1).utcOffset("+05:30").format('HH:mm:ss');
                var $minDate = moment(minDate).format('HH:mm:ss');
                var $maxDate = moment(maxDate).format('HH:mm:ss');
                if (finaldate == 0) {

                    $spotpair = $ndfusdinr;
                    $wher_pair = { 'PAIR': $spotpair }
                    $wher_cashpair = { 'PAIR': $currencypair }
                    var col = $colname + ' as value';
                    var col1 = $colname1 + ' as per_value';
                    var $spot = await masters.get_definecol_bytbl_cond([col, 'DATE'], $table, $wher_pair);
                    var $cash = await masters.get_definecol_bytbl_cond([col, col1, 'DATE'], $table, $wher_cashpair);
                    var $current1 = {
                        value: $spot[0].value,
                        DATE: $spot[0].DATE,
                        per_value: $cash[0].per_value
                    };
                } else if ($currDateTime >= $minDate && $currDateTime <= $maxDate) {
                    $wher_cashpair = { 'PAIR': $primarycurrency }
                    var col = $colname + ' as value';
                    var col1 = $colname1 + ' as per_value';
                    var $current_query = await masters.get_definecol_bytbl_cond([col, col1, 'DATE'], $table, $wher_cashpair);
                    var $current1 = {
                        value: $current_query[0].value,
                        DATE: $current_query[0].DATE,
                        per_value: $current_query[0].per_value
                    };
                } else {
                    $spotpair = $ndfusdinr;
                    $wher_pair = { 'PAIR': $spotpair }
                    $wher_cashpair = { 'PAIR': $primarycurrency }
                    var col = $colname + ' as value';
                    var col1 = $colname1 + ' as per_value';
                    var $spot = await masters.get_definecol_bytbl_cond([col, 'DATE'], $table, $wher_pair);
                    var $cash = await masters.get_definecol_bytbl_cond([col, col1, 'DATE'], $table, $wher_cashpair);
                    var $current1 = {
                        value: $spot[0].value,
                        DATE: $spot[0].DATE,
                        per_value: $cash[0].per_value
                    };
                }
            } else {
                $wher_cashpair = { 'PAIR': $primarycurrency }
                var col = $colname + ' as value';
                var col1 = $colname1 + ' as per_value';
                var $current_query = await masters.get_definecol_bytbl_cond([col, col1, 'DATE'], $table, $wher_cashpair);
                var $current1 = {
                    value: $current_query[0].value,
                    DATE: $current_query[0].DATE,
                    per_value: $current_query[0].per_value
                };
            }
            if ($type == '5' || $type == '6' || $type == '9' || $type == '10') {
         
                if ($importexport == '1') {
                    if ($transactiontype == '3') {
                        $colname = 'SPOTBID';
                        $colname1 = 'SPOTBID';
                    }
                    if ($transactiontype == '2') {
                        $colname = 'SPOTBID';
                        $colname1 = 'TOMSPOTASK';
                    }
                    if ($transactiontype == '1') {
                        $colname = 'SPOTBID';
                        $colname1 = 'CASHSPOTASK';
                    }
                } else {
                    if ($transactiontype == '3') {
                        $colname = 'SPOTASK';
                        $colname1 = 'SPOTASK';
                    }
                    if ($transactiontype == '2') {
                        $colname = 'SPOTASK';
                        $colname1 = 'TOMSPOTBID';
                    }
                    if ($transactiontype == '1') {
                        $colname = 'SPOTASK';
                        $colname1 = 'CASHSPOTBID';
                    }
                }
                $wher_cashpair = { 'PAIR': $crossvalue }
                var col = $colname + ' as value';
                var col1 = $colname1 + ' as per_value';
                var $current_query2 = await masters.get_definecol_bytbl_cond([col, col1, 'DATE'], $table, $wher_cashpair);
                var $current2 = {
                    value: $current_query2[0].value,
                    DATE: $current_query2[0].DATE,
                    per_value: $current_query2[0].per_value
                };
            } else {
                $wher_cashpair = { 'PAIR': $crossvalue }
                var col = $colname + ' as value';
                var col1 = $colname1 + ' as per_value';
                var $current_query2 = await masters.get_definecol_bytbl_cond([col, col1, 'DATE'], $table, $wher_cashpair);
                var $current2 = {
                    value: $current_query2[0].value,
                    DATE: $current_query2[0].DATE,
                    per_value: $current_query2[0].per_value
                };
            }

            if ($type == '5' || $type == '6') {
                if ($transactiontype == '3') {
                    var $value = $current1.value / $current2.value;
                } else {
                    var $value = ($current1.value - $current1.per_value) / ($current2.value - $current2.per_value);
                }
                var $per_value = $current1.per_value / $current2.per_value;
                var $date_time = $current1.DATE;
                if ($type == '6') {
                    var $value = 1 / $value;
                    var $per_value = 1 / $per_value;
                }
            } else if ($type == '7' || $type == '8') {
                if ($transactiontype == '3') {
                    var $value = $current1.value * $current2.value;
                } else {
                    var $value = ($current1.value - $current1.per_value) * ($current2.value - $current2.per_value);
                }
                var $per_value = $current1.per_value * $current2.per_value;
                $date_time = $current1.DATE;
                if ($type == '8') {
                    var $value = 1 / $value;
                    var $per_value = 1 / $per_value;
                }
            } else if ($type == '9' || $type == '10') {
                if ($transactiontype == '3') {
                    var $value = $current1.value / $current2.value;
                } else {
                    var $value = ($current1.value - $current1.per_value) / ($current2.value - $current2.per_value);
                }
                var $per_value = $current1.per_value / $current2.per_value;
                var $date_time = $current1.DATE;
                if ($type == '10') {
                    var $value = 1 / $value;
                    var $per_value = 1 / $per_value;
                }
            }

        }
    } else {
        var $value = '';
        var $per_value = '';
        var $date_time
    }
    var $result_array = {
        value: $value,
        per_value: $per_value,
        date: $date_time
    };
    //console.log($result_array);
    return $result_array;
}
// End INR Value

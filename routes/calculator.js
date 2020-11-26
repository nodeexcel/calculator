const express = require('express');
const router = express.Router();
const math = require("mathjs")
const config = require("../config.json")


router.post('/mortgage', async (req, res) => {
  try {
    console.log(config.CMHCcalculationData)
    let homePrice = req.body.homePrice; //a
    let downPayment = req.body.downPayment; //B
    let paymentFrequency = req.body.paymentFrequency; //n
    let interestRate = req.body.interestRate; //r
    let term = req.body.term;
    let amortizationPeriod = req.body.amortizationPeriod;
    let mortgageAmount = req.body.mortgageAmount; //t
    let i = interestRate / paymentFrequency;
    let iDash = 1 + i;
    let downPaymentPercentage = (downPayment / homePrice) * 100;
    let chmcData = config.CMHCcalculationData.find(val => {
      return val.downPaymentRangePercentageStart <= downPaymentPercentage && val.downPaymentRangePercentageEnd >= downPaymentPercentage
    })
    let cmhc = (mortgageAmount * chmcData.CMHCPercent) / 100;
    let principal = homePrice - downPayment + cmhc; //P

    // console.log(`(${principal} * ${i} * [${iDash}^${paymentFrequency}(${amortizationPeriod})])/([${iDash}^${paymentFrequency}(${amortizationPeriod})] - 1)`)
    let monthlyPayment = math.evaluate(`(${principal} * ${i} * [${iDash}^${paymentFrequency}*(${term})])/([${iDash}^${paymentFrequency}*(${term})] - 1)`)
    let pMax = principal / (1 + cmhc);
    let n = amortizationPeriod * paymentFrequency;
    let remainingMoney;
    let m = 1;
    let countArray = [];
    let extraYearlyMoney = req.body.extraYearlyMoney;
    let extraMonthlyMoney = req.body.extraMonthlyMoney;
    let newPayment = await math.evaluate(`(${principal} * ${iDash}^${n} * ${i})/(${iDash}^${n} - 1)`)
    let normalPaymentMethod = await calculatePayment(m, principal, iDash, newPayment, i, remainingMoney)
    if (req.body.extraMoneyPlan == true && req.body.numberOfyears == "Yearly") {
      let extraPaymentMethod = await calculateYearlyExtraPayment(m, principal, iDash, newPayment, i, remainingMoney, extraYearlyMoney, countArray)
      let withoutExtraPay = await math.evaluate(`((${normalPaymentMethod.totalMonths} - 1 ) * ${newPayment} + ${normalPaymentMethod.lastRemainingMoney})`)
      let withExtraPay = await math.evaluate(`((((${extraPaymentMethod.totalMonths} - ${extraPaymentMethod.noOfTimesExtraPay}) - 1 )*${newPayment}) + (${extraPaymentMethod.noOfTimesExtraPay} * ${extraPaymentMethod.extraPaid}) +  ${extraPaymentMethod.lastRemainingMoney})`)
      let userMoneyProfit = await math.evaluate(`${withoutExtraPay} - ${withExtraPay}`)
      let saveMonth = await math.evaluate(`${normalPaymentMethod.totalMonths} - ${extraPaymentMethod.totalMonths}`)
      let yearProfit = Math.floor(saveMonth / 12);
      let monthProfit = (saveMonth % 12);
      let newAmortizationYear = (req.body.amortizationPeriod - (yearProfit + 1));
      let newAmortizationMonth = ((12 - monthProfit) % 12)
      res.json({
        message: "success!",
        principal,
        MoneySaved: parseFloat(userMoneyProfit.toFixed(2)),
        monthSaved: yearProfit + " Years " + monthProfit + " Months",
        newAmortizationPeriod: newAmortizationYear + " Years " + newAmortizationMonth + " Months"
      })
    } else if (req.body.extraMoneyPlan == true && req.body.numberOfyears == "Monthly") {
      let monthlyExtraPaymentMethod = await calculateMonthlyExtraPayment(m, principal, iDash, newPayment, i, remainingMoney, extraMonthlyMoney)
      let withoutExtraPay = await math.evaluate(`((${normalPaymentMethod.totalMonths} - 1 ) * ${newPayment} + ${normalPaymentMethod.lastRemainingMoney})`)
      let totalPayment = req.body.extraMonthlyMoney + newPayment;
      let withExtraPay = await math.evaluate(`((${monthlyExtraPaymentMethod.totalMonths} - 1 ) * ${totalPayment} + ${monthlyExtraPaymentMethod.lastRemainingMoney})`)
      let userMoneyProfit = await math.evaluate(`${withoutExtraPay} - ${withExtraPay}`)
      let saveMonth = await math.evaluate(`${normalPaymentMethod.totalMonths} - ${monthlyExtraPaymentMethod.totalMonths}`)
      let yearProfit = Math.floor(saveMonth / 12);
      let monthProfit = (saveMonth % 12);
      let newAmortizationYear = (req.body.amortizationPeriod - (yearProfit + 1));
      let newAmortizationMonth = ((12 - monthProfit) % 12)
      res.json({
        message: "success!",
        principal,
        MoneySaved: parseFloat(userMoneyProfit.toFixed(2)),
        monthSaved: yearProfit + " Years " + monthProfit + " Months",
        newAmortizationPeriod: newAmortizationYear + " Years " + newAmortizationMonth + " Months"
      })
    } else {
      let withoutExtraPay = await math.evaluate(`((${normalPaymentMethod.totalMonths} - 1 ) * ${newPayment} + ${normalPaymentMethod.lastRemainingMoney})`)
      res.json({
        message: "success!",
        principal,
        totalPay: parseFloat(withoutExtraPay.toFixed(2))
      })
    }
  } catch (error) {
    res.status(error).json({
      error: 1,
      data: error
    })
  }

});


async function calculatePayment(m, principal, iDash, monthlyPayment, i, remainingMoney) {
  if (principal > 0) {
    let interest = principal * i;
    let totalMoney = principal + interest;
    if (totalMoney >= monthlyPayment) {
      let newPay = totalMoney - monthlyPayment;
      return calculatePayment(m + 1, newPay, iDash, monthlyPayment, i, 0)
    } else {
      let lastValue = totalMoney;
      let result = lastValue - totalMoney;
      return calculatePayment(m, result, iDash, monthlyPayment, i, lastValue)
    }
  } else {
    let obj = {
      totalMonths: m,
      lastRemainingMoney: remainingMoney
    }
    return obj;
  }
}

async function calculateMonthlyExtraPayment(m, principal, iDash, monthlyPayment, i, remainingMoney, extraMoneyPay) {
  if (principal > 0) {
    let interest = principal * i;
    let totalMoney = principal + interest;
    let totalPayment = monthlyPayment + extraMoneyPay;
    if (totalMoney >= totalPayment) {
      let newPay = totalMoney - totalPayment;
      return calculateMonthlyExtraPayment(m + 1, newPay, iDash, monthlyPayment, i, 0, extraMoneyPay)
    } else {
      let lastValue = totalMoney;
      let result = lastValue - totalMoney;
      return calculateMonthlyExtraPayment(m, result, iDash, monthlyPayment, i, lastValue, extraMoneyPay)
    }
  } else {
    let obj = {
      totalMonths: m,
      lastRemainingMoney: remainingMoney
    }
    return obj;
  }
}


async function calculateYearlyExtraPayment(m, principal, iDash, monthlyPayment, i, remainingMoney, extraMoneyPay, countArray) {
  if (principal > 0) {
    let interest = principal * i;
    let totalMoney = principal + interest;
    let extraMoney = extraMoneyPay + monthlyPayment;
    if (totalMoney >= extraMoney && (m % 12 == 0)) {
      countArray.push(m)
      let remainingPay = totalMoney - extraMoney;
      return calculateYearlyExtraPayment(m + 1, remainingPay, iDash, monthlyPayment, i, 0, extraMoneyPay, countArray)
    } else if (totalMoney >= monthlyPayment) {
      let newPay = totalMoney - monthlyPayment;
      return calculateYearlyExtraPayment(m + 1, newPay, iDash, monthlyPayment, i, 0, extraMoneyPay, countArray)
    } else {
      let lastValue = totalMoney;
      let result = lastValue - totalMoney;
      return calculateYearlyExtraPayment(m, result, iDash, monthlyPayment, i, lastValue, extraMoneyPay, countArray)
    }
  } else {
    let obj = {
      extraPaid: extraMoneyPay + monthlyPayment,
      noOfTimesExtraPay: countArray.length,
      totalMonths: m,
      lastRemainingMoney: remainingMoney
    }
    return obj;
  }
}

module.exports = router;

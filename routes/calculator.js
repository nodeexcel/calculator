const express = require('express');
const router = express.Router();
const math = require("mathjs")
const config = require("../config.json")


router.post('/mortgage', async (req, res) => {
  try {
    // console.log(config.CMHCcalculationData)
    let homePrice = req.body.homePrice; //a
    let downPayment = req.body.downPayment; //B
    let paymentFrequency = req.body.paymentFrequency; //n
    let interestRate = req.body.interestRate; //r
    let term = req.body.term;
    let amortizationPeriod = req.body.amortizationPeriod;
    let i = interestRate / paymentFrequency;
    let iDash = 1 + i;
    let downPaymentPercentage = (downPayment / homePrice) * 100;
    let chmcData = config.CMHCcalculationData.find(val => {
      return val.downPaymentRangePercentageStart <= downPaymentPercentage && val.downPaymentRangePercentageEnd >= downPaymentPercentage
    })
    let cmhcPercent = chmcData ? chmcData.CMHCPercent : 0;
    let cmhcDefaultInsurance = homePrice * cmhcPercent;
    console.log(cmhcDefaultInsurance,"909090909090909099090909090990")
    let principal = homePrice - downPayment + cmhcDefaultInsurance; //P
    console.log(principal,"8989898989898989898998")
    // console.log(`(${principal} * ${i} * [${iDash}^${paymentFrequency}(${amortizationPeriod})])/([${iDash}^${paymentFrequency}(${amortizationPeriod})] - 1)`)
    // let monthlyPayment = math.evaluate(`(${principal} * ${i} * [${iDash}^${paymentFrequency}*(${term})])/([${iDash}^${paymentFrequency}*(${term})] - 1)`)
    // let pMax = principal / (1 + cmhc);
    // console.log(principal,"asasakls")
    let n = amortizationPeriod * paymentFrequency;
    let remainingMoney;
    let totalInterest = 0;
    let m = 1;
    let countArray = [];
    let extraYearlyMoney = req.body.extraYearlyMoney;
    let extraMonthlyMoney = req.body.extraMonthlyMoney;
    let extraWeeklyMoney = req.body.extraWeeklyMoney;
    let newPayment = await math.evaluate(`(${principal} * ${iDash}^${n} * ${i})/(${iDash}^${n} - 1)`)
    newPayment = parseFloat(newPayment.toFixed(4))
    let normalPaymentMethod = await calculatePayment(m, principal, iDash, newPayment, i, remainingMoney, totalInterest)

    if (req.body.extraMoneyPlan == true && req.body.numberOfyears == "Yearly") {
      let extraPaymentMethod = await calculateYearlyExtraPayment(m, principal, iDash, newPayment, i, remainingMoney, extraYearlyMoney, countArray, totalInterest)
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
        totalPay: parseFloat(withExtraPay.toFixed(2)),
        SumOfInterest: parseFloat(normalPaymentMethod.interest.toFixed(2)),
        extraPayment: extraPaymentMethod.extraPayment,
        Payment: parseFloat(newPayment.toFixed(2)),
        MoneySaved: parseFloat(userMoneyProfit.toFixed(2)),
        monthSaved: yearProfit + " Years " + monthProfit + " Months",
        newAmortizationPeriod: newAmortizationYear + " Years " + newAmortizationMonth + " Months",
        totalMortgageAmount:principal,
        cmhcDefaultInsurance
      })
    } else if (req.body.extraMoneyPlan == true && req.body.numberOfyears == "Monthly") {
      let monthlyExtraPaymentMethod = await calculateMonthlyExtraPayment(m, principal, iDash, newPayment, i, remainingMoney, extraMonthlyMoney, totalInterest)
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
        totalPay: parseFloat(withExtraPay.toFixed(2)),
        SumOfInterest: parseFloat(monthlyExtraPaymentMethod.interest.toFixed(2)),
        Payment: parseFloat(newPayment.toFixed(2)),
        extraPayment: monthlyExtraPaymentMethod.extraPayment,
        MoneySaved: parseFloat(userMoneyProfit.toFixed(2)),
        monthSaved: yearProfit + " Years " + monthProfit + " Months",
        newAmortizationPeriod: newAmortizationYear + " Years " + newAmortizationMonth + " Months",
        totalMortgageAmount:principal,
        cmhcDefaultInsurance
      })
    } else if (req.body.extraMoneyPlan == true && req.body.numberOfyears == "Weekly") {
      let WeeklyExtraPaymentMethod = await calculateWeeklyExtraPayment(m, principal, iDash, newPayment, i, remainingMoney, extraWeeklyMoney, countArray, totalInterest)
      let withoutExtraPay = await math.evaluate(`((${normalPaymentMethod.totalMonths} - 1 ) * ${newPayment} + ${normalPaymentMethod.lastRemainingMoney})`)
      let withExtraPay = await math.evaluate(`((((${WeeklyExtraPaymentMethod.totalWeeks} - ${WeeklyExtraPaymentMethod.noOfTimesExtraPay}) - 1 )*${newPayment}) + (${WeeklyExtraPaymentMethod.noOfTimesExtraPay} * ${WeeklyExtraPaymentMethod.extraPaid}) +  ${WeeklyExtraPaymentMethod.lastRemainingMoney})`)
      let userMoneyProfit = await math.evaluate(`${withoutExtraPay} - ${withExtraPay}`)
      let saveWeeks = await math.evaluate(`${normalPaymentMethod.totalMonths} - ${WeeklyExtraPaymentMethod.totalWeeks}`)
      let yearProfit = Math.floor(saveWeeks / 53);
      let monthProfit = (saveWeeks % 4);
      let newAmortizationYear = (req.body.amortizationPeriod - (yearProfit + 1));
      let newAmortizationMonth = ((12 - monthProfit) % 12)
      res.json({
        message: "success!",
        principal,
        totalPay: parseFloat(withExtraPay.toFixed(2)),
        SumOfInterest: parseFloat(WeeklyExtraPaymentMethod.interest.toFixed(2)),
        Payment: parseFloat(newPayment.toFixed(2)),
        extraPayment: WeeklyExtraPaymentMethod.extraPayment,
        MoneySaved: parseFloat(userMoneyProfit.toFixed(2)),
        monthSaved: yearProfit + " Years " + monthProfit + " Months",
        newAmortizationPeriod: newAmortizationYear + " Years " + newAmortizationMonth + " Months",
        totalMortgageAmount:principal,
        cmhcDefaultInsurance
      })
    } else {
      let withoutExtraPay = await math.evaluate(`((${normalPaymentMethod.totalMonths} - 1 ) * ${newPayment} + ${normalPaymentMethod.lastRemainingMoney})`)
      res.json({
        message: "success!",
        principal,
        SumOfInterest: parseFloat(normalPaymentMethod.interest.toFixed(2)),
        Payment: parseFloat(newPayment.toFixed(2)),
        totalPay: parseFloat(withoutExtraPay.toFixed(2)),
        totalMortgageAmount:principal,
        cmhcDefaultInsurance
      })
    }
  } catch (error) {
    console.log(error)
    res.status(500).json({
      error: 1,
      data: error
    })
  }

});

router.post('/affordability', async (req, res) => {
  try {
    let houseHoldIncome = req.body.houseHoldIncome; //I
    let utilities = req.body.utilities; //U
    let propertyTax = req.body.propertyTax; //T
    let maintenance = req.body.maintenance; //R
    let loansOnCards = req.body.loansOnCards; //D
    let downPayment = req.body.downPayment; //B
    let interestRate = req.body.interestRate; //r
    let paymentFrequency = req.body.paymentFrequency; //n
    let amortization = req.body.amortization; //t
    let mortgageAmount = req.body.mortgageAmount; //t
    let downPaymentPercentage = (downPayment / houseHoldIncome) * 100;

    let chmcData = config.CMHCcalculationData.find(val => {
      return val.downPaymentRangePercentageStart <= downPaymentPercentage && val.downPaymentRangePercentageEnd >= downPaymentPercentage
    })
    let cmhcPercent = chmcData ? chmcData.CMHCPercent : 0;
    let cmhc = (mortgageAmount * cmhcPercent) / 100;

    let monthlyMorgagePaymentforGds = (0.35 * houseHoldIncome) - utilities - propertyTax - (0.5 * maintenance)
    let monthlyMorgagePaymentforTds = (0.42 * houseHoldIncome) - utilities - propertyTax - (0.5 * maintenance) - loansOnCards
    // [A+U+T+(0.5R)]/I = 35%
    console.log(monthlyMorgagePaymentforGds, monthlyMorgagePaymentforTds)
    let GDS = await math.evaluate(`(${monthlyMorgagePaymentforGds}+${utilities}+${propertyTax}+(0.5*${maintenance}))/${houseHoldIncome}`)
    // [A+U+T+(0.5R)+D]/I = 42%
    let TDS = await math.evaluate(`(${monthlyMorgagePaymentforTds}+${utilities}+${propertyTax}+(0.5*${maintenance})+${loansOnCards})/${houseHoldIncome}`)
    console.log(GDS, TDS)
    //If your down payment is less than 20%, we calculate your results based 
    //on the minimum qualifying rate (MQR) of 4.79% or your interest rate
    //whichever is higher. If your down payment is 20% or more, 
    //we calculate your results based on the MQR or your interest rate plus 2%, whichever is higher.
    let MQR = 4.79;
    let r;
    if (downPaymentPercentage < 20) {
      console.log("12121212121212")
      r = Math.max(MQR, interestRate);
    } else {
      console.log("23232333")
      r = Math.max(MQR, interestRate + 2);
    }
    console.log(r, "kkkkk")
    r = r / 100;
    let A = Math.min(monthlyMorgagePaymentforGds, monthlyMorgagePaymentforTds)
    // console.log(r, "============", monthlyMorgagePaymentforGds, monthlyMorgagePaymentforTds)
    let i = r / paymentFrequency;
    let iDash = 1 + i;
    // A x [i'^n(t)]-1 / i x i'^n(t)
    console.log(`${A} * (${iDash}^${paymentFrequency}(${paymentFrequency}))-1 / ${i} * ${iDash}^${paymentFrequency}(${paymentFrequency})`)
    let P = math.evaluate(`${A} * (${iDash}^${paymentFrequency}(${paymentFrequency}))-1 / ${i} * ${iDash}^${paymentFrequency}(${paymentFrequency})`);
    let pmax = (P / (1 + cmhc)) + downPayment;
    let maximumAffordability;
    if (downPayment <= 25000) {
      maximumAffordability = downPayment / (5 / 100)
    } else if (downPayment > 25000) {
      maximumAffordability = (downPayment - 25000) / (10 / 100) + 500000
    }

    res.json({
      GDS,
      TDS,
      maximumAffordability,
      A,
      P,
      pmax
    })
  } catch (error) {
    console.log(error)
    res.status(500).json({
      error: 1,
      data: error
    })
  }
})

router.post('/stressTest', async (req, res) => {
  try {
    let houseHoldIncome = req.body.houseHoldIncome; //I
    let utilities = req.body.utilities; //U
    let propertyTax = req.body.propertyTax; //T
    let maintenance = req.body.maintenance; //R
    let loansOnCards = req.body.loansOnCards; //D
    let fixedMonthlyExpenses = req.body.fixedMonthlyExpenses
    let variableMonthlyExpenses = req.body.variableMonthlyExpenses
    let transportationExpenses = req.body.transportationExpenses
    let otherExpenses = req.body.otherExpenses
    let downPayment = req.body.downPayment; //B
    let purchasePrice = req.body.purchasePrice; //a
    let term = req.body.term;
    let interestRate = req.body.interestRate; //r
    let amortizationPeriod = req.body.amortization; //t
    let paymentFrequency = req.body.paymentFrequency; //n
    let mortgageAmount = req.body.mortgageAmount; //t
    let downPaymentPercentage = (downPayment / purchasePrice) * 100;
    let n = amortizationPeriod * paymentFrequency;
    let i = interestRate / paymentFrequency;
    let iDash = 1 + i;
    let chmcData = config.CMHCcalculationData.find(val => {
      return val.downPaymentRangePercentageStart <= downPaymentPercentage && val.downPaymentRangePercentageEnd >= downPaymentPercentage
    })
    let cmhcPercent = chmcData ? chmcData.CMHCPercent : 0;
    let cmhcDefaultInsurance = purchasePrice * cmhcPercent;
    console.log(cmhcDefaultInsurance,"909090909090909099090909090990")
    let principal = purchasePrice - downPayment + cmhcDefaultInsurance; //P
    console.log(principal,"8989898989898989898998")
    let newPayment = await math.evaluate(`(${principal} * ${iDash}^${n} * ${i})/(${iDash}^${n} - 1)`)
    let maximumAffordability;
    let monthlyMorgagePaymentforGds = ((0.35 * houseHoldIncome) - utilities - propertyTax - (0.5 * maintenance)) * 100
    let monthlyMorgagePaymentforTds = ((0.42 * houseHoldIncome) - utilities - propertyTax - (0.5 * maintenance) - loansOnCards) * 100
    // [A+U+T+(0.5R)]/I = 35%
    if (downPayment <= 25000) {
      maximumAffordability = downPayment / (5 / 100)
    } else if (downPayment > 25000) {
      maximumAffordability = (downPayment - 25000) / (10 / 100) + 500000
    }

    console.log(maximumAffordability)
    let GDS = await math.evaluate(`(${monthlyMorgagePaymentforGds}+${utilities}+${propertyTax}+(0.5*${maintenance}))/${houseHoldIncome}`)
    // [A+U+T+(0.5R)+D]/I = 42%
    let TDS = math.evaluate(`(${monthlyMorgagePaymentforTds}+${utilities}+${propertyTax}+(0.5*${maintenance})+${loansOnCards})/${houseHoldIncome}`)
    let incomeAccordingToFrequency = houseHoldIncome / paymentFrequency;
    let totalExpenses = newPayment + utilities + propertyTax + maintenance + loansOnCards + fixedMonthlyExpenses + variableMonthlyExpenses + transportationExpenses + otherExpenses
    res.json({
      GDS: (GDS <= 35) ? "PASS" : "FAIL",
      TDS: (TDS <= 42) ? "PASS" : "FAIL",
      minDownPayment: (maximumAffordability >= purchasePrice) ? "PASS" : "FAIL",
      totalExpenses: (incomeAccordingToFrequency > totalExpenses) ? "PASS" : "FAIL",
      totalMortgageAmount:principal,
      cmhcDefaultInsurance
    })
  } catch (error) {
    console.log(error)
    res.status(500).json({
      error: 1,
      data: error
    })
  }
})

router.post('/penalty', async (req, res) => {
  let remainingPayment = req.body.remainingPayment;
  let startDate = new Date(req.body.startDate);
  let term = req.body.term;
  let existingInterestRate = req.body.existingInterestRate;
  let newInterestRate = req.body.newInterestRate;
  // ((300000*3.25)/100)*(3/12)
  console.log(new Date())
  let currentDate = new Date()
  let totalMonths = term * 12
  let differenceInMonths = currentDate.getMonth() - startDate.getMonth() + (12 * (currentDate.getFullYear() - startDate.getFullYear()))
  console.log(totalMonths,differenceInMonths,"asdkadskl")
  // currentDate.getMonth() - startDate.getMonth() + (12 * (currentDate.getFullYear() - startDate.getFullYear()));
  console.log(differenceInMonths)
  let rateType = req.body.rateType;
  console.log(`((${remainingPayment} * ${existingInterestRate}) / 100) * 3 / 12`)
  if (rateType == "variable" || existingInterestRate<=newInterestRate) {
    // console.log(new Date())
    console.log("asdnasldad------------------")
    let penalty = ((remainingPayment * existingInterestRate) / 100) * 3 / 12
    res.json(penalty)
  } else {
    console.log(((existingInterestRate / 12) - (newInterestRate / 12)),"sasasasasasas")
    let penalty = ((((existingInterestRate / 12) - (newInterestRate / 12)) / 100) * (totalMonths - differenceInMonths)) * remainingPayment
    res.json(Math.ceil(penalty))
  }
})

router.post('/lifeBudget', async (req, res) => {
  try {
    let houseHoldIncome = req.body.houseHoldIncome / 12; //I
    console.log(houseHoldIncome, "========")
    delete req.body.houseHoldIncome;
    let total = 0
    for (let key in req.body) {
      if (typeof req.body[key] == "object") {
        if (req.body[key].frequency == "yearly") {
          req.body[key].amount = req.body[key].amount / 12;
          req.body[key].frequency = "monthly"
          total += req.body[key].amount / 12;
        } else if (req.body[key].frequency == "weekly") {
          req.body[key].amount = (req.body[key].amount * 52) / 12;
          req.body[key].frequency = "monthly"
          total += (req.body[key].amount * 52) / 12;
        } else if (req.body[key].frequency == "daily") {
          req.body[key].amount = (req.body[key].amount * 365) / 12;
          req.body[key].frequency = "monthly"
          total += (req.body[key].amount * 365) / 12;
        } else {
          req.body[key].amount = req.body[key].amount
          total += req.body[key].amount
        }
      } else {
        total += req.body[key]
      }
    }
    let savings = req.body.longTermSaving.amount +
      req.body.vecationSaving.amount +
      req.body.investments.amount;
    let trasportation = req.body.vehicalPayment.amount +
      req.body.gas.amount +
      req.body.transportInsurance.amount +
      req.body.registrations.amount +
      req.body.maintenances.amount +
      req.body.repair.amount +
      req.body.parking.amount +
      req.body.publicTransport.amount;
    let variableExpenses = req.body.groceries.amount +
      req.body.entertainment.amount +
      req.body.personalCare.amount +
      req.body.recreation.amount +
      req.body.coffeeAndFastFood.amount +
      req.body.other.amount +
      req.body.otherDiscretionary.amount;
    let fixedExpenses = req.body.childCare +
      req.body.tvOrInternet +
      req.body.phone +
      req.body.subscriptions +
      req.body.homeOrLifeInsurences +
      req.body.otherFixedExpenses
    let obligationPayments = req.body.utilities +
      req.body.propertyTax +
      req.body.maintenance +
      req.body.loansOnCards

    res.json({
      monthlyData: {
        houseHoldIncome: houseHoldIncome,
        obligationPayments,
        mortgagePayment: req.body.mortgagePayment,
        trasportation,
        variableExpenses,
        fixedExpenses,
        savings,
        overOrUnderBudget: houseHoldIncome-total,
      }
    })
  } catch (error) {
    console.log(error)
    res.status(500).json({
      error: 1,
      data: error
    })
  }
})

async function getInterestRate(downPaymentPercentage, MQR, interestRate) {

}

async function calculatePayment(m, principal, iDash, monthlyPayment, i, remainingMoney, totalInterest) {
  if (principal > 0) {
    let interest = principal * i;
    totalInterest = totalInterest + interest;
    let totalMoney = principal + interest;
    totalMoney = parseFloat(totalMoney.toFixed(4))

    if (totalMoney >= monthlyPayment) {
      let newPay = totalMoney - monthlyPayment;
      return calculatePayment(m + 1, newPay, iDash, monthlyPayment, i, 0, totalInterest)
    } else {
      let lastValue = totalMoney;
      let result = lastValue - totalMoney;
      return calculatePayment(m, result, iDash, monthlyPayment, i, lastValue, totalInterest)
    }
  } else {
    let obj = {
      interest: totalInterest,
      totalMonths: m,
      lastRemainingMoney: remainingMoney
    }
    return obj;
  }
}

async function calculateMonthlyExtraPayment(m, principal, iDash, monthlyPayment, i, remainingMoney, extraMoneyPay, totalInterest) {
  if (principal > 0) {
    let interest = principal * i;
    totalInterest = totalInterest + interest;
    let totalMoney = principal + interest;
    let totalPayment = monthlyPayment + extraMoneyPay;
    if (totalMoney >= totalPayment) {
      let newPay = totalMoney - totalPayment;
      return calculateMonthlyExtraPayment(m + 1, newPay, iDash, monthlyPayment, i, 0, extraMoneyPay, totalInterest)
    } else {
      let lastValue = totalMoney;
      let result = lastValue - totalMoney;
      return calculateMonthlyExtraPayment(m, result, iDash, monthlyPayment, i, lastValue, extraMoneyPay, totalInterest)
    }
  } else {
    let obj = {
      totalMonths: m,
      interest: totalInterest,
      extraPayment: m * extraMoneyPay,
      lastRemainingMoney: remainingMoney
    }
    return obj;
  }
}

async function calculateWeeklyExtraPayment(m, principal, iDash, monthlyPayment, i, remainingMoney, extraMoneyPay, countArray, totalInterest) {
  if (principal > 0) {
    let interest = principal * i;
    totalInterest = totalInterest + interest;
    let totalMoney = principal + interest;
    totalMoney = parseFloat(totalMoney.toFixed(4))
    let extraMoney = extraMoneyPay + monthlyPayment;
    extraMoney = parseFloat(extraMoney.toFixed(4))
    monthlyPayment = parseFloat(monthlyPayment.toFixed(4))
    if (totalMoney >= extraMoney && (m % 7 == 0)) {
      countArray.push(m)
      let remainingPay = totalMoney - extraMoney;
      return calculateWeeklyExtraPayment(m + 1, remainingPay, iDash, monthlyPayment, i, 0, extraMoneyPay, countArray, totalInterest)
    } else if (totalMoney >= monthlyPayment) {
      let newPay = totalMoney - monthlyPayment;
      return calculateWeeklyExtraPayment(m + 1, newPay, iDash, monthlyPayment, i, 0, extraMoneyPay, countArray, totalInterest)
    } else {
      let lastValue = totalMoney;
      let result = lastValue - totalMoney;
      return calculateWeeklyExtraPayment(m, result, iDash, monthlyPayment, i, lastValue, extraMoneyPay, countArray, totalInterest)
    }
  } else {

    let obj = {
      interest: totalInterest,
      extraPaid: extraMoneyPay + monthlyPayment,
      extraPayment: countArray.length * extraMoneyPay,
      noOfTimesExtraPay: countArray.length,
      totalWeeks: m,
      lastRemainingMoney: remainingMoney
    }
    return obj;
  }
}

async function calculateYearlyExtraPayment(m, principal, iDash, monthlyPayment, i, remainingMoney, extraMoneyPay, countArray, totalInterest) {
  if (principal > 0) {
    let interest = principal * i;
    totalInterest = totalInterest + interest;
    let totalMoney = principal + interest;
    let extraMoney = extraMoneyPay + monthlyPayment;
    if (totalMoney >= extraMoney && (m % 12 == 0)) {
      countArray.push(m)
      let remainingPay = totalMoney - extraMoney;
      return calculateYearlyExtraPayment(m + 1, remainingPay, iDash, monthlyPayment, i, 0, extraMoneyPay, countArray, totalInterest)
    } else if (parseFloat(totalMoney.toFixed(4)) >= monthlyPayment) {
      let newPay = parseFloat(totalMoney.toFixed(4)) - monthlyPayment;
      return calculateYearlyExtraPayment(m + 1, newPay, iDash, monthlyPayment, i, 0, extraMoneyPay, countArray, totalInterest)
    } else {
      let lastValue = totalMoney;
      let result = lastValue - totalMoney;
      return calculateYearlyExtraPayment(m, result, iDash, monthlyPayment, i, lastValue, extraMoneyPay, countArray, totalInterest)
    }
  } else {
    let obj = {
      interest: totalInterest,
      extraPaid: extraMoneyPay + monthlyPayment,
      extraPayment: countArray.length * extraMoneyPay,
      noOfTimesExtraPay: countArray.length,
      totalMonths: m,
      lastRemainingMoney: remainingMoney
    }
    return obj;
  }
}


module.exports = router;
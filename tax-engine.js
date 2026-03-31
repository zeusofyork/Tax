/**
 * EasyTax - Federal Tax Calculation Engine (Tax Year 2025)
 * Implements IRS tax brackets, standard deductions, SE tax, and common credits.
 */

const TaxEngine = (() => {

    // ==================== 2025 TAX BRACKETS ====================
    const BRACKETS = {
        single: [
            { min: 0,       max: 11925,   rate: 0.10 },
            { min: 11925,   max: 48475,   rate: 0.12 },
            { min: 48475,   max: 103350,  rate: 0.22 },
            { min: 103350,  max: 197300,  rate: 0.24 },
            { min: 197300,  max: 250525,  rate: 0.32 },
            { min: 250525,  max: 626350,  rate: 0.35 },
            { min: 626350,  max: Infinity, rate: 0.37 },
        ],
        married_joint: [
            { min: 0,       max: 23850,   rate: 0.10 },
            { min: 23850,   max: 96950,   rate: 0.12 },
            { min: 96950,   max: 206700,  rate: 0.22 },
            { min: 206700,  max: 394600,  rate: 0.24 },
            { min: 394600,  max: 501050,  rate: 0.32 },
            { min: 501050,  max: 751600,  rate: 0.35 },
            { min: 751600,  max: Infinity, rate: 0.37 },
        ],
        married_separate: [
            { min: 0,       max: 11925,   rate: 0.10 },
            { min: 11925,   max: 48475,   rate: 0.12 },
            { min: 48475,   max: 103350,  rate: 0.22 },
            { min: 103350,  max: 197300,  rate: 0.24 },
            { min: 197300,  max: 250525,  rate: 0.32 },
            { min: 250525,  max: 375800,  rate: 0.35 },
            { min: 375800,  max: Infinity, rate: 0.37 },
        ],
        head_household: [
            { min: 0,       max: 17000,   rate: 0.10 },
            { min: 17000,   max: 64850,   rate: 0.12 },
            { min: 64850,   max: 103350,  rate: 0.22 },
            { min: 103350,  max: 197300,  rate: 0.24 },
            { min: 197300,  max: 250500,  rate: 0.32 },
            { min: 250500,  max: 626350,  rate: 0.35 },
            { min: 626350,  max: Infinity, rate: 0.37 },
        ],
        widow: null, // same as married_joint
    };
    BRACKETS.widow = BRACKETS.married_joint;

    // ==================== STANDARD DEDUCTIONS 2025 ====================
    const STANDARD_DEDUCTION = {
        single:           15000,
        married_joint:    30000,
        married_separate: 15000,
        head_household:   22500,
        widow:            30000,
    };

    // ==================== SE TAX CONSTANTS ====================
    const SE_TAX_RATE = 0.153;        // 15.3%  (12.4% SS + 2.9% Medicare)
    const SE_INCOME_FACTOR = 0.9235;  // 92.35% of net SE income
    const SS_WAGE_BASE = 176100;      // 2025 SS wage base

    // ==================== CHILD TAX CREDIT ====================
    const CHILD_CREDIT_AMOUNT = 2000;
    const CHILD_CREDIT_PHASEOUT = {
        single:           200000,
        married_joint:    400000,
        married_separate: 200000,
        head_household:   200000,
        widow:            400000,
    };

    // ==================== HELPER ====================
    function n(val) {
        const v = parseFloat(val);
        return isNaN(v) ? 0 : v;
    }

    function fmt(amount) {
        return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    function pct(rate) {
        return (rate * 100).toFixed(1) + '%';
    }

    // ==================== TAX CALCULATION ====================
    function calcBracketTax(taxableIncome, filingStatus) {
        const brackets = BRACKETS[filingStatus] || BRACKETS.single;
        let tax = 0;
        const breakdown = [];

        for (const bracket of brackets) {
            if (taxableIncome <= bracket.min) break;
            const taxable = Math.min(taxableIncome, bracket.max) - bracket.min;
            const bracketTax = taxable * bracket.rate;
            tax += bracketTax;
            breakdown.push({
                rate: bracket.rate,
                min: bracket.min,
                max: bracket.max === Infinity ? null : bracket.max,
                taxableInBracket: taxable,
                taxInBracket: bracketTax,
            });
        }
        return { tax, breakdown };
    }

    function calcSelfEmploymentTax(necIncome) {
        if (necIncome <= 0) return { seTax: 0, seDeduction: 0 };
        const seIncome = necIncome * SE_INCOME_FACTOR;
        const ssIncome = Math.min(seIncome, SS_WAGE_BASE);
        const ssTax = ssIncome * 0.124;
        const medicareTax = seIncome * 0.029;
        const additionalMedicare = seIncome > 200000 ? (seIncome - 200000) * 0.009 : 0;
        const seTax = ssTax + medicareTax + additionalMedicare;
        const seDeduction = seTax / 2;
        return { seTax: Math.round(seTax * 100) / 100, seDeduction: Math.round(seDeduction * 100) / 100 };
    }

    function calcChildTaxCredit(numDependents, agi, filingStatus) {
        if (numDependents <= 0) return 0;
        const phaseout = CHILD_CREDIT_PHASEOUT[filingStatus] || 200000;
        let credit = numDependents * CHILD_CREDIT_AMOUNT;
        if (agi > phaseout) {
            const reduction = Math.ceil((agi - phaseout) / 1000) * 50;
            credit = Math.max(0, credit - reduction);
        }
        return credit;
    }

    // ==================== FULL RETURN CALCULATION ====================
    function calculateReturn(data) {
        const filingStatus = data.filingStatus || 'single';

        // --- Income ---
        let totalW2Wages = 0;
        let totalFedWithheld = 0;
        let totalStateWithheld = 0;
        (data.w2s || []).forEach(w2 => {
            totalW2Wages += n(w2.wages);
            totalFedWithheld += n(w2.fedWithheld);
            totalStateWithheld += n(w2.stateWithheld);
        });

        const nec = n(data.income1099NEC);
        const interest = n(data.income1099INT);
        const dividends = n(data.income1099DIV);
        const qualifiedDiv = n(data.income1099DIVQ);
        const unemployment = n(data.income1099G);
        const retirement = n(data.income1099R);
        const misc = n(data.income1099MISC);
        const alimony = n(data.incomeAlimony);
        const capGains = n(data.incomeCapGains);
        const rental = n(data.incomeRental);
        const other = n(data.incomeOther);

        const grossIncome = totalW2Wages + nec + interest + dividends +
            unemployment + retirement + misc + alimony + capGains + rental + other;

        // --- Self-employment tax ---
        const se = calcSelfEmploymentTax(nec);

        // --- Adjustments ---
        const adjStudentLoan = Math.min(n(data.adjStudentLoan), 2500);
        const adjEducator = Math.min(n(data.adjEducator), 300);
        const adjHSA = n(data.adjHSA);
        const adjIRA = n(data.adjIRA);
        const totalAdjustments = adjStudentLoan + adjEducator + adjHSA + adjIRA + se.seDeduction;

        const agi = grossIncome - totalAdjustments;

        // --- Deductions ---
        const standardDed = STANDARD_DEDUCTION[filingStatus] || 15000;
        let deduction;
        if (data.deductionType === 'itemized') {
            const medical = Math.max(0, n(data.dedMedical) - agi * 0.075);
            const salt = Math.min(n(data.dedSALT), 10000);
            const mortgage = n(data.dedMortgage);
            const charity = n(data.dedCharity);
            const casualty = n(data.dedCasualty);
            const otherDed = n(data.dedOther);
            const itemizedTotal = medical + salt + mortgage + charity + casualty + otherDed;
            deduction = {
                type: 'itemized',
                amount: itemizedTotal,
                details: { medical, salt, mortgage, charity, casualty, other: otherDed }
            };
        } else {
            deduction = { type: 'standard', amount: standardDed, details: {} };
        }

        const taxableIncome = Math.max(0, agi - deduction.amount);

        // --- Tax computation ---
        const { tax: incomeTax, breakdown: bracketBreakdown } = calcBracketTax(taxableIncome, filingStatus);

        // --- Credits ---
        const numDependents = n(data.dependents);
        const childCredit = calcChildTaxCredit(numDependents, agi, filingStatus);
        const eic = n(data.creditEIC);
        const education = n(data.creditEducation);
        const childCare = n(data.creditChildCare);
        const saverCredit = n(data.creditSaverCredit);
        const energy = n(data.creditEnergy);
        const otherCredits = n(data.creditOther);
        const totalCredits = childCredit + eic + education + childCare + saverCredit + energy + otherCredits;

        // --- Tax after credits (cannot go below 0 for non-refundable) ---
        const taxAfterCredits = Math.max(0, incomeTax - totalCredits);

        // --- Total tax = income tax after credits + SE tax ---
        const totalTax = taxAfterCredits + se.seTax;

        // --- Payments ---
        const estimatedPaid = n(data.estimatedTaxPaid);
        const totalPayments = totalFedWithheld + estimatedPaid;

        // --- Refund or balance due ---
        const balanceDue = totalTax - totalPayments;
        const refund = balanceDue < 0 ? Math.abs(balanceDue) : 0;
        const owed = balanceDue > 0 ? balanceDue : 0;

        // --- Effective rate ---
        const effectiveRate = grossIncome > 0 ? (totalTax / grossIncome) : 0;
        const marginalRate = bracketBreakdown.length > 0 ? bracketBreakdown[bracketBreakdown.length - 1].rate : 0;

        return {
            filingStatus,
            grossIncome,
            totalW2Wages,
            totalFedWithheld,
            totalStateWithheld,
            nec, interest, dividends, qualifiedDiv, unemployment, retirement, misc,
            alimony, capGains, rental, otherIncome: other,
            seTax: se.seTax,
            seDeduction: se.seDeduction,
            adjustments: {
                studentLoan: adjStudentLoan,
                educator: adjEducator,
                hsa: adjHSA,
                ira: adjIRA,
                seDeduction: se.seDeduction,
                total: totalAdjustments,
            },
            agi,
            deduction,
            standardDeduction: standardDed,
            taxableIncome,
            incomeTax,
            bracketBreakdown,
            credits: {
                child: childCredit,
                eic, education, childCare, saverCredit, energy,
                other: otherCredits,
                total: totalCredits,
            },
            taxAfterCredits,
            totalTax,
            estimatedPaid,
            totalPayments,
            refund,
            owed,
            effectiveRate,
            marginalRate,
            fmt,
            pct,
        };
    }

    // Public API
    return {
        calculateReturn,
        calcSelfEmploymentTax,
        calcChildTaxCredit,
        STANDARD_DEDUCTION,
        BRACKETS,
        fmt,
        pct,
        n,
    };
})();

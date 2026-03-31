/**
 * EasyTax - Application Controller
 * Handles form navigation, validation, save/load, and summary rendering.
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'easytax_returns';
    let currentStep = 1;

    // ==================== INIT ====================
    document.addEventListener('DOMContentLoaded', () => {
        populateStates();
        setupListeners();
        loadSavedReturnsList();
        updateStandardDeductionDisplay();
        updateDependentSection();
    });

    // ==================== US STATES ====================
    function populateStates() {
        const states = [
            'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
            'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
            'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
            'VA','WA','WV','WI','WY','DC','PR','GU','VI','AS','MP'
        ];
        const sel = document.getElementById('state');
        states.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            sel.appendChild(opt);
        });
    }

    // ==================== EVENT LISTENERS ====================
    function setupListeners() {
        // SSN formatting
        document.getElementById('ssn').addEventListener('input', function () {
            let v = this.value.replace(/\D/g, '').slice(0, 9);
            if (v.length > 5) v = v.slice(0, 3) + '-' + v.slice(3, 5) + '-' + v.slice(5);
            else if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
            this.value = v;
        });

        // Phone formatting
        document.getElementById('phone').addEventListener('input', function () {
            let v = this.value.replace(/\D/g, '').slice(0, 10);
            if (v.length > 6) v = '(' + v.slice(0, 3) + ') ' + v.slice(3, 6) + '-' + v.slice(6);
            else if (v.length > 3) v = '(' + v.slice(0, 3) + ') ' + v.slice(3);
            this.value = v;
        });

        // Filing status change
        document.getElementById('filingStatus').addEventListener('change', () => {
            updateStandardDeductionDisplay();
        });

        // Dependents
        document.getElementById('dependents').addEventListener('input', updateDependentSection);
        document.getElementById('btnAddDependent').addEventListener('click', addDependentRow);

        // Add W-2
        document.getElementById('btnAddW2').addEventListener('click', addW2Entry);

        // Income live preview
        document.getElementById('step2').addEventListener('input', updateGrossIncomePreview);

        // Deduction type toggle
        document.querySelectorAll('input[name="deductionType"]').forEach(r => {
            r.addEventListener('change', () => {
                document.getElementById('itemizedSection').classList.toggle('hidden', r.value !== 'itemized' || !r.checked);
            });
        });

        // Itemized total preview
        document.getElementById('itemizedSection').addEventListener('input', updateItemizedTotal);

        // 1099-NEC SE auto-calc
        document.getElementById('income1099NEC').addEventListener('input', updateSETax);

        // Progress bar clicks
        document.querySelectorAll('.progress-bar .step').forEach(el => {
            el.addEventListener('click', () => {
                goToStep(parseInt(el.dataset.step));
            });
        });

        // Saved returns
        document.getElementById('btnSaveReturn').addEventListener('click', saveReturn);
        document.getElementById('btnNewReturn').addEventListener('click', newReturn);
        document.getElementById('savedReturnsList').addEventListener('change', loadReturn);
        document.getElementById('btnDeleteReturn').addEventListener('click', deleteReturn);
    }

    // ==================== NAVIGATION ====================
    window.goToStep = function (step) {
        if (step < 1 || step > 5) return;

        // Validate current step before advancing
        if (step > currentStep && !validateStep(currentStep)) return;

        // If going to step 5, calculate
        if (step === 5) renderSummary();

        // Update UI
        document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
        document.getElementById('step' + step).classList.add('active');

        document.querySelectorAll('.progress-bar .step').forEach(s => {
            const sNum = parseInt(s.dataset.step);
            s.classList.remove('active', 'completed');
            if (sNum === step) s.classList.add('active');
            else if (sNum < step) s.classList.add('completed');
        });

        currentStep = step;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ==================== VALIDATION ====================
    function validateStep(step) {
        if (step === 1) {
            const required = ['firstName', 'lastName', 'ssn', 'dob', 'address', 'city', 'state', 'zip', 'filingStatus'];
            let valid = true;
            required.forEach(id => {
                const el = document.getElementById(id);
                if (!el.value.trim()) {
                    el.classList.add('error');
                    valid = false;
                } else {
                    el.classList.remove('error');
                }
            });
            if (!valid) alert('Please fill in all required fields marked with *');
            return valid;
        }
        return true;
    }

    // ==================== DEPENDENT SECTION ====================
    function updateDependentSection() {
        const count = parseInt(document.getElementById('dependents').value) || 0;
        const section = document.getElementById('dependentDetails');
        const list = document.getElementById('dependentList');
        if (count > 0) {
            section.classList.remove('hidden');
            // Auto-populate child credit
        } else {
            section.classList.add('hidden');
            list.innerHTML = '';
        }
        updateChildCredit();
    }

    function addDependentRow() {
        const list = document.getElementById('dependentList');
        const idx = list.children.length;
        const div = document.createElement('div');
        div.className = 'dependent-entry';
        div.innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Dependent Name</label>
                    <input type="text" class="dep-name">
                </div>
                <div class="form-group">
                    <label>SSN</label>
                    <input type="text" class="dep-ssn" maxlength="11">
                </div>
                <div class="form-group">
                    <label>Relationship</label>
                    <select class="dep-rel">
                        <option value="child">Son/Daughter</option>
                        <option value="stepchild">Stepchild</option>
                        <option value="foster">Foster Child</option>
                        <option value="sibling">Sibling</option>
                        <option value="parent">Parent</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Date of Birth</label>
                    <input type="date" class="dep-dob">
                </div>
            </div>
            <button type="button" class="w2-remove" onclick="this.parentElement.remove()">Remove</button>
        `;
        list.appendChild(div);
    }

    function updateChildCredit() {
        const deps = parseInt(document.getElementById('dependents').value) || 0;
        document.getElementById('creditChild').value = (deps * 2000).toFixed(2);
    }

    // ==================== W-2 MANAGEMENT ====================
    function addW2Entry() {
        const list = document.getElementById('w2List');
        const idx = list.children.length;
        const div = document.createElement('div');
        div.className = 'w2-entry';
        div.dataset.index = idx;
        div.innerHTML = `
            <button type="button" class="w2-remove" onclick="this.parentElement.remove(); updateGrossIncomePreview();">Remove W-2</button>
            <div class="form-grid">
                <div class="form-group">
                    <label>Employer Name</label>
                    <input type="text" class="w2-employer">
                </div>
                <div class="form-group">
                    <label>Employer EIN</label>
                    <input type="text" class="w2-ein" placeholder="XX-XXXXXXX">
                </div>
                <div class="form-group">
                    <label>Wages (Box 1)</label>
                    <input type="number" class="w2-wages" step="0.01" min="0" value="0">
                </div>
                <div class="form-group">
                    <label>Federal Tax Withheld (Box 2)</label>
                    <input type="number" class="w2-fed-withheld" step="0.01" min="0" value="0">
                </div>
                <div class="form-group">
                    <label>State Tax Withheld (Box 17)</label>
                    <input type="number" class="w2-state-withheld" step="0.01" min="0" value="0">
                </div>
                <div class="form-group">
                    <label>Social Security Wages (Box 3)</label>
                    <input type="number" class="w2-ss-wages" step="0.01" min="0" value="0">
                </div>
                <div class="form-group">
                    <label>SS Tax Withheld (Box 4)</label>
                    <input type="number" class="w2-ss-withheld" step="0.01" min="0" value="0">
                </div>
                <div class="form-group">
                    <label>Medicare Wages (Box 5)</label>
                    <input type="number" class="w2-med-wages" step="0.01" min="0" value="0">
                </div>
                <div class="form-group">
                    <label>Medicare Tax Withheld (Box 6)</label>
                    <input type="number" class="w2-med-withheld" step="0.01" min="0" value="0">
                </div>
            </div>
        `;
        list.appendChild(div);
    }

    // ==================== LIVE PREVIEWS ====================
    window.updateGrossIncomePreview = function () {
        const wages = sumClass('w2-wages');
        const nec = val('income1099NEC');
        const int = val('income1099INT');
        const div = val('income1099DIV');
        const unemp = val('income1099G');
        const ret = val('income1099R');
        const misc = val('income1099MISC');
        const alimony = val('incomeAlimony');
        const cap = val('incomeCapGains');
        const rental = val('incomeRental');
        const other = val('incomeOther');
        const total = wages + nec + int + div + unemp + ret + misc + alimony + cap + rental + other;
        document.getElementById('grossIncomePreview').textContent = TaxEngine.fmt(total);
    };

    function updateItemizedTotal() {
        const total = val('dedMedical') + val('dedSALT') + val('dedMortgage') +
            val('dedCharity') + val('dedCasualty') + val('dedOther');
        document.getElementById('itemizedTotal').textContent = TaxEngine.fmt(total);
    }

    function updateStandardDeductionDisplay() {
        const status = document.getElementById('filingStatus').value || 'single';
        const amount = TaxEngine.STANDARD_DEDUCTION[status] || 15000;
        document.getElementById('standardDeductionAmount').textContent = TaxEngine.fmt(amount);
    }

    function updateSETax() {
        const nec = val('income1099NEC');
        const se = TaxEngine.calcSelfEmploymentTax(nec);
        document.getElementById('adjSE').value = se.seDeduction.toFixed(2);
    }

    // ==================== COLLECT FORM DATA ====================
    function collectData() {
        const w2s = [];
        document.querySelectorAll('.w2-entry').forEach(entry => {
            w2s.push({
                employer: entry.querySelector('.w2-employer').value,
                ein: entry.querySelector('.w2-ein').value,
                wages: entry.querySelector('.w2-wages').value,
                fedWithheld: entry.querySelector('.w2-fed-withheld').value,
                stateWithheld: entry.querySelector('.w2-state-withheld').value,
                ssWages: entry.querySelector('.w2-ss-wages').value,
                ssWithheld: entry.querySelector('.w2-ss-withheld').value,
                medWages: entry.querySelector('.w2-med-wages').value,
                medWithheld: entry.querySelector('.w2-med-withheld').value,
            });
        });

        return {
            // Personal
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            ssn: document.getElementById('ssn').value,
            dob: document.getElementById('dob').value,
            address: document.getElementById('address').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            zip: document.getElementById('zip').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            filingStatus: document.getElementById('filingStatus').value,
            dependents: document.getElementById('dependents').value,

            // W-2s
            w2s,

            // 1099s
            income1099NEC: document.getElementById('income1099NEC').value,
            income1099INT: document.getElementById('income1099INT').value,
            income1099DIV: document.getElementById('income1099DIV').value,
            income1099DIVQ: document.getElementById('income1099DIVQ').value,
            income1099G: document.getElementById('income1099G').value,
            income1099R: document.getElementById('income1099R').value,
            income1099MISC: document.getElementById('income1099MISC').value,

            // Other income
            incomeAlimony: document.getElementById('incomeAlimony').value,
            incomeCapGains: document.getElementById('incomeCapGains').value,
            incomeRental: document.getElementById('incomeRental').value,
            incomeOther: document.getElementById('incomeOther').value,
            estimatedTaxPaid: document.getElementById('estimatedTaxPaid').value,

            // Deductions
            deductionType: document.querySelector('input[name="deductionType"]:checked').value,
            dedMedical: document.getElementById('dedMedical').value,
            dedSALT: document.getElementById('dedSALT').value,
            dedMortgage: document.getElementById('dedMortgage').value,
            dedCharity: document.getElementById('dedCharity').value,
            dedCasualty: document.getElementById('dedCasualty').value,
            dedOther: document.getElementById('dedOther').value,

            // Adjustments
            adjStudentLoan: document.getElementById('adjStudentLoan').value,
            adjEducator: document.getElementById('adjEducator').value,
            adjHSA: document.getElementById('adjHSA').value,
            adjIRA: document.getElementById('adjIRA').value,

            // Credits
            creditChild: document.getElementById('creditChild').value,
            creditEIC: document.getElementById('creditEIC').value,
            creditEducation: document.getElementById('creditEducation').value,
            creditChildCare: document.getElementById('creditChildCare').value,
            creditSaverCredit: document.getElementById('creditSaverCredit').value,
            creditEnergy: document.getElementById('creditEnergy').value,
            creditOther: document.getElementById('creditOther').value,
        };
    }

    // ==================== RESTORE FORM DATA ====================
    function restoreData(data) {
        // Simple fields
        const simpleFields = [
            'firstName', 'lastName', 'ssn', 'dob', 'address', 'city', 'state', 'zip',
            'phone', 'email', 'filingStatus', 'dependents',
            'income1099NEC', 'income1099INT', 'income1099DIV', 'income1099DIVQ',
            'income1099G', 'income1099R', 'income1099MISC',
            'incomeAlimony', 'incomeCapGains', 'incomeRental', 'incomeOther', 'estimatedTaxPaid',
            'dedMedical', 'dedSALT', 'dedMortgage', 'dedCharity', 'dedCasualty', 'dedOther',
            'adjStudentLoan', 'adjEducator', 'adjHSA', 'adjIRA',
            'creditChild', 'creditEIC', 'creditEducation', 'creditChildCare',
            'creditSaverCredit', 'creditEnergy', 'creditOther',
        ];
        simpleFields.forEach(id => {
            const el = document.getElementById(id);
            if (el && data[id] !== undefined) el.value = data[id];
        });

        // Deduction type
        if (data.deductionType) {
            document.querySelector(`input[name="deductionType"][value="${data.deductionType}"]`).checked = true;
            document.getElementById('itemizedSection').classList.toggle('hidden', data.deductionType !== 'itemized');
        }

        // W-2s
        const w2List = document.getElementById('w2List');
        w2List.innerHTML = '';
        (data.w2s || []).forEach((w2, i) => {
            if (i > 0) addW2Entry();
            else {
                // Recreate first entry
                const div = document.createElement('div');
                div.className = 'w2-entry';
                div.dataset.index = '0';
                div.innerHTML = `
                    <div class="form-grid">
                        <div class="form-group"><label>Employer Name</label><input type="text" class="w2-employer"></div>
                        <div class="form-group"><label>Employer EIN</label><input type="text" class="w2-ein" placeholder="XX-XXXXXXX"></div>
                        <div class="form-group"><label>Wages (Box 1)</label><input type="number" class="w2-wages" step="0.01" min="0" value="0"></div>
                        <div class="form-group"><label>Federal Tax Withheld (Box 2)</label><input type="number" class="w2-fed-withheld" step="0.01" min="0" value="0"></div>
                        <div class="form-group"><label>State Tax Withheld (Box 17)</label><input type="number" class="w2-state-withheld" step="0.01" min="0" value="0"></div>
                        <div class="form-group"><label>Social Security Wages (Box 3)</label><input type="number" class="w2-ss-wages" step="0.01" min="0" value="0"></div>
                        <div class="form-group"><label>SS Tax Withheld (Box 4)</label><input type="number" class="w2-ss-withheld" step="0.01" min="0" value="0"></div>
                        <div class="form-group"><label>Medicare Wages (Box 5)</label><input type="number" class="w2-med-wages" step="0.01" min="0" value="0"></div>
                        <div class="form-group"><label>Medicare Tax Withheld (Box 6)</label><input type="number" class="w2-med-withheld" step="0.01" min="0" value="0"></div>
                    </div>
                `;
                w2List.appendChild(div);
            }
            const entry = w2List.children[i];
            entry.querySelector('.w2-employer').value = w2.employer || '';
            entry.querySelector('.w2-ein').value = w2.ein || '';
            entry.querySelector('.w2-wages').value = w2.wages || 0;
            entry.querySelector('.w2-fed-withheld').value = w2.fedWithheld || 0;
            entry.querySelector('.w2-state-withheld').value = w2.stateWithheld || 0;
            entry.querySelector('.w2-ss-wages').value = w2.ssWages || 0;
            entry.querySelector('.w2-ss-withheld').value = w2.ssWithheld || 0;
            entry.querySelector('.w2-med-wages').value = w2.medWages || 0;
            entry.querySelector('.w2-med-withheld').value = w2.medWithheld || 0;
        });

        updateStandardDeductionDisplay();
        updateDependentSection();
        updateSETax();
        updateGrossIncomePreview();
    }

    // ==================== SUMMARY RENDERING ====================
    function renderSummary() {
        const data = collectData();
        const r = TaxEngine.calculateReturn(data);
        const fmt = TaxEngine.fmt;

        // Taxpayer
        const statusLabels = {
            single: 'Single', married_joint: 'Married Filing Jointly',
            married_separate: 'Married Filing Separately',
            head_household: 'Head of Household', widow: 'Qualifying Surviving Spouse'
        };
        document.getElementById('summaryTaxpayer').innerHTML = `
            <p><strong>${data.firstName} ${data.lastName}</strong></p>
            <p>SSN: ${data.ssn}</p>
            <p>${data.address}, ${data.city}, ${data.state} ${data.zip}</p>
            <p>Filing: ${statusLabels[data.filingStatus] || data.filingStatus}</p>
            <p>Dependents: ${data.dependents || 0}</p>
        `;

        // Income
        document.getElementById('summaryIncome').innerHTML = tableRows([
            ['W-2 Wages', fmt(r.totalW2Wages)],
            r.nec ? ['1099-NEC (Self-Employment)', fmt(r.nec)] : null,
            r.interest ? ['1099-INT (Interest)', fmt(r.interest)] : null,
            r.dividends ? ['1099-DIV (Dividends)', fmt(r.dividends)] : null,
            r.unemployment ? ['1099-G (Unemployment)', fmt(r.unemployment)] : null,
            r.retirement ? ['1099-R (Retirement)', fmt(r.retirement)] : null,
            r.misc ? ['1099-MISC', fmt(r.misc)] : null,
            r.alimony ? ['Alimony', fmt(r.alimony)] : null,
            r.capGains ? ['Capital Gains/(Losses)', fmt(r.capGains)] : null,
            r.rental ? ['Rental Income', fmt(r.rental)] : null,
            r.otherIncome ? ['Other Income', fmt(r.otherIncome)] : null,
            ['total', 'Gross Income', fmt(r.grossIncome)],
        ]);

        // Adjustments
        document.getElementById('summaryAdjustments').innerHTML = tableRows([
            r.adjustments.studentLoan ? ['Student Loan Interest', fmt(r.adjustments.studentLoan)] : null,
            r.adjustments.educator ? ['Educator Expenses', fmt(r.adjustments.educator)] : null,
            r.adjustments.hsa ? ['HSA Deduction', fmt(r.adjustments.hsa)] : null,
            r.adjustments.ira ? ['IRA Deduction', fmt(r.adjustments.ira)] : null,
            r.adjustments.seDeduction ? ['SE Tax Deduction (50%)', fmt(r.adjustments.seDeduction)] : null,
            ['total', 'Total Adjustments', fmt(r.adjustments.total)],
            ['total', 'Adjusted Gross Income (AGI)', fmt(r.agi)],
        ]);

        // Deductions
        let dedRows = [];
        if (r.deduction.type === 'itemized') {
            const d = r.deduction.details;
            dedRows = [
                ['Deduction Method', 'Itemized'],
                d.medical ? ['Medical & Dental (excess)', fmt(d.medical)] : null,
                d.salt ? ['State & Local Tax (SALT)', fmt(d.salt)] : null,
                d.mortgage ? ['Mortgage Interest', fmt(d.mortgage)] : null,
                d.charity ? ['Charitable Contributions', fmt(d.charity)] : null,
                d.casualty ? ['Casualty & Theft Losses', fmt(d.casualty)] : null,
                d.other ? ['Other Deductions', fmt(d.other)] : null,
            ];
        } else {
            dedRows = [['Deduction Method', 'Standard']];
        }
        dedRows.push(['total', 'Total Deduction', fmt(r.deduction.amount)]);
        dedRows.push(['total', 'Taxable Income', fmt(r.taxableIncome)]);
        document.getElementById('summaryDeductions').innerHTML = tableRows(dedRows);

        // Tax computation
        document.getElementById('summaryTax').innerHTML = tableRows([
            ['Income Tax (from brackets)', fmt(r.incomeTax)],
            r.seTax ? ['Self-Employment Tax', fmt(r.seTax)] : null,
            ['total', 'Total Tax Before Credits', fmt(r.incomeTax + r.seTax)],
        ]);

        // Credits & Payments
        document.getElementById('summaryCredits').innerHTML = tableRows([
            r.credits.child ? ['Child Tax Credit', fmt(r.credits.child)] : null,
            r.credits.eic ? ['Earned Income Credit', fmt(r.credits.eic)] : null,
            r.credits.education ? ['Education Credits', fmt(r.credits.education)] : null,
            r.credits.childCare ? ['Child & Dependent Care', fmt(r.credits.childCare)] : null,
            r.credits.saverCredit ? ['Saver\'s Credit', fmt(r.credits.saverCredit)] : null,
            r.credits.energy ? ['Energy Credit', fmt(r.credits.energy)] : null,
            r.credits.other ? ['Other Credits', fmt(r.credits.other)] : null,
            ['total', 'Total Credits', fmt(r.credits.total)],
            ['', ''],
            ['Federal Tax Withheld', fmt(r.totalFedWithheld)],
            r.estimatedPaid ? ['Estimated Tax Payments', fmt(r.estimatedPaid)] : null,
            ['total', 'Total Payments', fmt(r.totalPayments)],
        ]);

        // Result
        const resultDiv = document.getElementById('summaryResult');
        const resultCard = document.getElementById('resultCard');
        if (r.refund > 0) {
            resultCard.style.background = '#ecfdf5';
            resultCard.style.borderColor = '#059669';
            resultDiv.innerHTML = `
                <div class="result-label">Your Estimated Federal Refund</div>
                <div class="result-refund">${fmt(r.refund)}</div>
            `;
        } else if (r.owed > 0) {
            resultCard.style.background = '#fef2f2';
            resultCard.style.borderColor = '#dc2626';
            resultDiv.innerHTML = `
                <div class="result-label">Estimated Amount You Owe</div>
                <div class="result-owed">${fmt(r.owed)}</div>
            `;
        } else {
            resultCard.style.background = '#f0fdf4';
            resultCard.style.borderColor = '#059669';
            resultDiv.innerHTML = `
                <div class="result-label">You're All Square!</div>
                <div class="result-refund">$0.00</div>
            `;
        }

        // Bracket breakdown
        let bracketHTML = '';
        r.bracketBreakdown.forEach(b => {
            bracketHTML += `<tr>
                <td>${TaxEngine.pct(b.rate)} bracket</td>
                <td>${fmt(b.taxableInBracket)} taxed = ${fmt(b.taxInBracket)}</td>
            </tr>`;
        });
        document.getElementById('summaryBrackets').innerHTML = bracketHTML;
        document.getElementById('effectiveRate').innerHTML =
            `<strong>Effective Tax Rate:</strong> ${TaxEngine.pct(r.effectiveRate)} &nbsp;|&nbsp; <strong>Marginal Rate:</strong> ${TaxEngine.pct(r.marginalRate)}`;
    }

    function tableRows(rows) {
        return rows.filter(Boolean).map(r => {
            if (r[0] === 'total') return `<tr class="total-row"><td>${r[1]}</td><td>${r[2]}</td></tr>`;
            return `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`;
        }).join('');
    }

    // ==================== SAVE / LOAD / DELETE ====================
    function getSavedReturns() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
        catch { return {}; }
    }

    function loadSavedReturnsList() {
        const sel = document.getElementById('savedReturnsList');
        sel.innerHTML = '<option value="">-- Load Saved Return --</option>';
        const returns = getSavedReturns();
        Object.keys(returns).sort().forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = key;
            sel.appendChild(opt);
        });
    }

    function saveReturn() {
        const data = collectData();
        const name = `${data.lastName || 'Unknown'}, ${data.firstName || 'Unknown'} - ${data.filingStatus || 'draft'}`;
        const returns = getSavedReturns();
        returns[name] = { ...data, savedAt: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(returns));
        loadSavedReturnsList();
        document.getElementById('savedReturnsList').value = name;
        alert('Return saved: ' + name);
    }

    function loadReturn() {
        const sel = document.getElementById('savedReturnsList');
        if (!sel.value) return;
        const returns = getSavedReturns();
        const data = returns[sel.value];
        if (data) {
            restoreData(data);
            goToStep(1);
        }
    }

    function deleteReturn() {
        const sel = document.getElementById('savedReturnsList');
        if (!sel.value) return;
        if (!confirm('Delete saved return "' + sel.value + '"?')) return;
        const returns = getSavedReturns();
        delete returns[sel.value];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(returns));
        loadSavedReturnsList();
    }

    function newReturn() {
        if (!confirm('Start a new blank return? Unsaved changes will be lost.')) return;
        document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="date"]').forEach(el => el.value = '');
        document.querySelectorAll('input[type="number"]').forEach(el => el.value = '0');
        document.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
        document.querySelector('input[name="deductionType"][value="standard"]').checked = true;
        document.getElementById('itemizedSection').classList.add('hidden');
        document.getElementById('dependentDetails').classList.add('hidden');
        document.getElementById('dependentList').innerHTML = '';
        const w2List = document.getElementById('w2List');
        w2List.innerHTML = '';
        // Recreate first W-2 entry
        const div = document.createElement('div');
        div.className = 'w2-entry';
        div.dataset.index = '0';
        div.innerHTML = `
            <div class="form-grid">
                <div class="form-group"><label>Employer Name</label><input type="text" class="w2-employer"></div>
                <div class="form-group"><label>Employer EIN</label><input type="text" class="w2-ein" placeholder="XX-XXXXXXX"></div>
                <div class="form-group"><label>Wages (Box 1)</label><input type="number" class="w2-wages" step="0.01" min="0" value="0"></div>
                <div class="form-group"><label>Federal Tax Withheld (Box 2)</label><input type="number" class="w2-fed-withheld" step="0.01" min="0" value="0"></div>
                <div class="form-group"><label>State Tax Withheld (Box 17)</label><input type="number" class="w2-state-withheld" step="0.01" min="0" value="0"></div>
                <div class="form-group"><label>Social Security Wages (Box 3)</label><input type="number" class="w2-ss-wages" step="0.01" min="0" value="0"></div>
                <div class="form-group"><label>SS Tax Withheld (Box 4)</label><input type="number" class="w2-ss-withheld" step="0.01" min="0" value="0"></div>
                <div class="form-group"><label>Medicare Wages (Box 5)</label><input type="number" class="w2-med-wages" step="0.01" min="0" value="0"></div>
                <div class="form-group"><label>Medicare Tax Withheld (Box 6)</label><input type="number" class="w2-med-withheld" step="0.01" min="0" value="0"></div>
            </div>
        `;
        w2List.appendChild(div);
        updateStandardDeductionDisplay();
        updateGrossIncomePreview();
        goToStep(1);
    }

    // ==================== PRINT / EXPORT ====================
    window.printReturn = function () {
        window.print();
    };

    window.exportJSON = function () {
        const data = collectData();
        const result = TaxEngine.calculateReturn(data);
        const exportData = {
            taxpayer: {
                name: `${data.firstName} ${data.lastName}`,
                ssn: data.ssn,
                filingStatus: data.filingStatus,
            },
            summary: {
                grossIncome: result.grossIncome,
                agi: result.agi,
                taxableIncome: result.taxableIncome,
                totalTax: result.totalTax,
                totalPayments: result.totalPayments,
                refund: result.refund,
                owed: result.owed,
                effectiveRate: result.effectiveRate,
            },
            fullData: data,
            exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tax-return-${data.lastName || 'export'}-2025.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ==================== HELPERS ====================
    function val(id) {
        return TaxEngine.n(document.getElementById(id).value);
    }

    function sumClass(cls) {
        let total = 0;
        document.querySelectorAll('.' + cls).forEach(el => total += TaxEngine.n(el.value));
        return total;
    }

})();

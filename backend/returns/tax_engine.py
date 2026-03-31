"""
Federal Tax Calculation Engine — Tax Year 2025
Implements IRS brackets, SE tax, standard deductions, credits, and full computation.
All monetary values are floats rounded to 2 decimal places.
"""
from decimal import Decimal, ROUND_HALF_UP
import json

# ==================== 2025 TAX BRACKETS ====================
BRACKETS = {
    "SINGLE": [
        (11925, 0.10), (48475, 0.12), (103350, 0.22),
        (197300, 0.24), (250525, 0.32), (626350, 0.35), (float("inf"), 0.37),
    ],
    "MFJ": [
        (23850, 0.10), (96950, 0.12), (206700, 0.22),
        (394600, 0.24), (501050, 0.32), (751600, 0.35), (float("inf"), 0.37),
    ],
    "MFS": [
        (11925, 0.10), (48475, 0.12), (103350, 0.22),
        (197300, 0.24), (250525, 0.32), (375800, 0.35), (float("inf"), 0.37),
    ],
    "HOH": [
        (17000, 0.10), (64850, 0.12), (103350, 0.22),
        (197300, 0.24), (250500, 0.32), (626350, 0.35), (float("inf"), 0.37),
    ],
}
BRACKETS["QW"] = BRACKETS["MFJ"]

STANDARD_DEDUCTION = {
    "SINGLE": 15000, "MFJ": 30000, "MFS": 15000, "HOH": 22500, "QW": 30000,
}

SS_WAGE_BASE_2025 = 176100
SE_INCOME_FACTOR = 0.9235
CHILD_CREDIT_PER_CHILD = 2000
CHILD_CREDIT_PHASEOUT = {
    "SINGLE": 200000, "MFJ": 400000, "MFS": 200000, "HOH": 200000, "QW": 400000,
}


def _r(val):
    """Round to 2 decimal places."""
    return float(Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def calc_bracket_tax(taxable_income, filing_status):
    brackets = BRACKETS.get(filing_status, BRACKETS["SINGLE"])
    tax = 0.0
    prev_limit = 0
    breakdown = []
    for limit, rate in brackets:
        if taxable_income <= prev_limit:
            break
        taxable_in_bracket = min(taxable_income, limit) - prev_limit
        bracket_tax = taxable_in_bracket * rate
        tax += bracket_tax
        breakdown.append({
            "rate": rate,
            "range_low": prev_limit,
            "range_high": limit if limit != float("inf") else None,
            "taxable_in_bracket": _r(taxable_in_bracket),
            "tax_in_bracket": _r(bracket_tax),
        })
        prev_limit = limit
    return _r(tax), breakdown


def calc_se_tax(nec_income):
    if nec_income <= 0:
        return 0.0, 0.0
    se_income = nec_income * SE_INCOME_FACTOR
    ss_income = min(se_income, SS_WAGE_BASE_2025)
    ss_tax = ss_income * 0.124
    medicare_tax = se_income * 0.029
    additional_medicare = max(0, (se_income - 200000) * 0.009)
    total_se = ss_tax + medicare_tax + additional_medicare
    return _r(total_se), _r(total_se / 2)


def calc_child_credit(num_dependents, agi, filing_status):
    if num_dependents <= 0:
        return 0.0
    phaseout = CHILD_CREDIT_PHASEOUT.get(filing_status, 200000)
    credit = num_dependents * CHILD_CREDIT_PER_CHILD
    if agi > phaseout:
        import math
        reduction = math.ceil((agi - phaseout) / 1000) * 50
        credit = max(0, credit - reduction)
    return _r(credit)


def calculate_return(form_data):
    """
    Main calculation entry point.
    form_data: dict with all income, deduction, credit, and personal fields.
    Returns a dict with the full computation result.
    """
    filing_status = form_data.get("filing_status", "SINGLE")

    # ---------- INCOME ----------
    w2s = form_data.get("w2s", [])
    total_w2_wages = sum(float(w.get("wages", 0)) for w in w2s)
    total_fed_withheld = sum(float(w.get("federal_withheld", 0)) for w in w2s)
    total_state_withheld = sum(float(w.get("state_withheld", 0)) for w in w2s)

    nec = float(form_data.get("income_1099_nec", 0))
    interest = float(form_data.get("income_1099_int", 0))
    dividends = float(form_data.get("income_1099_div", 0))
    qualified_div = float(form_data.get("income_1099_div_qualified", 0))
    unemployment = float(form_data.get("income_1099_g", 0))
    retirement = float(form_data.get("income_1099_r", 0))
    misc = float(form_data.get("income_1099_misc", 0))
    alimony = float(form_data.get("income_alimony", 0))
    cap_gains = float(form_data.get("income_cap_gains", 0))
    rental = float(form_data.get("income_rental", 0))
    other = float(form_data.get("income_other", 0))

    gross_income = _r(total_w2_wages + nec + interest + dividends +
                      unemployment + retirement + misc + alimony +
                      cap_gains + rental + other)

    # ---------- SE TAX ----------
    se_tax, se_deduction = calc_se_tax(nec)

    # ---------- ADJUSTMENTS ----------
    adj_student_loan = min(float(form_data.get("adj_student_loan", 0)), 2500)
    adj_educator = min(float(form_data.get("adj_educator", 0)), 300)
    adj_hsa = float(form_data.get("adj_hsa", 0))
    adj_ira = float(form_data.get("adj_ira", 0))
    total_adjustments = _r(adj_student_loan + adj_educator + adj_hsa + adj_ira + se_deduction)

    agi = _r(gross_income - total_adjustments)

    # ---------- DEDUCTIONS ----------
    std_ded = STANDARD_DEDUCTION.get(filing_status, 15000)
    deduction_type = form_data.get("deduction_type", "standard")

    if deduction_type == "itemized":
        medical_raw = float(form_data.get("ded_medical", 0))
        medical = max(0, medical_raw - agi * 0.075)
        salt = min(float(form_data.get("ded_salt", 0)), 10000)
        mortgage = float(form_data.get("ded_mortgage", 0))
        charity = float(form_data.get("ded_charity", 0))
        casualty = float(form_data.get("ded_casualty", 0))
        other_ded = float(form_data.get("ded_other", 0))
        itemized_total = _r(medical + salt + mortgage + charity + casualty + other_ded)
        deduction_amount = itemized_total
        deduction_details = {
            "type": "itemized",
            "medical": _r(medical), "salt": _r(salt), "mortgage": _r(mortgage),
            "charity": _r(charity), "casualty": _r(casualty), "other": _r(other_ded),
        }
    else:
        deduction_amount = std_ded
        deduction_details = {"type": "standard"}

    taxable_income = _r(max(0, agi - deduction_amount))

    # ---------- TAX ----------
    income_tax, bracket_breakdown = calc_bracket_tax(taxable_income, filing_status)

    # ---------- CREDITS ----------
    num_dependents = int(form_data.get("num_dependents", 0))
    child_credit = calc_child_credit(num_dependents, agi, filing_status)
    eic = float(form_data.get("credit_eic", 0))
    education = float(form_data.get("credit_education", 0))
    child_care = float(form_data.get("credit_child_care", 0))
    saver = float(form_data.get("credit_saver", 0))
    energy = float(form_data.get("credit_energy", 0))
    other_credits = float(form_data.get("credit_other", 0))
    total_credits = _r(child_credit + eic + education + child_care + saver + energy + other_credits)

    tax_after_credits = _r(max(0, income_tax - total_credits))
    total_tax = _r(tax_after_credits + se_tax)

    # ---------- PAYMENTS ----------
    estimated_paid = float(form_data.get("estimated_tax_paid", 0))
    total_payments = _r(total_fed_withheld + estimated_paid)

    balance = _r(total_tax - total_payments)
    refund = _r(abs(balance)) if balance < 0 else 0.0
    owed = _r(balance) if balance > 0 else 0.0

    effective_rate = _r(total_tax / gross_income) if gross_income > 0 else 0.0
    marginal_rate = bracket_breakdown[-1]["rate"] if bracket_breakdown else 0.0

    return {
        "filing_status": filing_status,
        "gross_income": gross_income,
        "total_w2_wages": _r(total_w2_wages),
        "total_fed_withheld": _r(total_fed_withheld),
        "total_state_withheld": _r(total_state_withheld),
        "income_breakdown": {
            "nec": _r(nec), "interest": _r(interest), "dividends": _r(dividends),
            "qualified_dividends": _r(qualified_div), "unemployment": _r(unemployment),
            "retirement": _r(retirement), "misc": _r(misc), "alimony": _r(alimony),
            "cap_gains": _r(cap_gains), "rental": _r(rental), "other": _r(other),
        },
        "se_tax": se_tax,
        "se_deduction": se_deduction,
        "adjustments": {
            "student_loan": _r(adj_student_loan), "educator": _r(adj_educator),
            "hsa": _r(adj_hsa), "ira": _r(adj_ira), "se_deduction": se_deduction,
            "total": total_adjustments,
        },
        "agi": agi,
        "deduction": {**deduction_details, "amount": _r(deduction_amount)},
        "standard_deduction": std_ded,
        "taxable_income": taxable_income,
        "income_tax": income_tax,
        "bracket_breakdown": bracket_breakdown,
        "credits": {
            "child": child_credit, "eic": _r(eic), "education": _r(education),
            "child_care": _r(child_care), "saver": _r(saver), "energy": _r(energy),
            "other": _r(other_credits), "total": total_credits,
        },
        "tax_after_credits": tax_after_credits,
        "total_tax": total_tax,
        "estimated_paid": _r(estimated_paid),
        "total_payments": total_payments,
        "refund": refund,
        "owed": owed,
        "effective_rate": effective_rate,
        "marginal_rate": marginal_rate,
    }

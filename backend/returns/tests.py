"""Tests for the tax calculation engine."""
import pytest
from returns.tax_engine import calculate_return, calc_bracket_tax, calc_se_tax, calc_child_credit


class TestBracketTax:
    def test_single_10_percent_only(self):
        tax, breakdown = calc_bracket_tax(10000, "SINGLE")
        assert tax == 1000.00
        assert len(breakdown) == 1

    def test_single_crosses_brackets(self):
        tax, breakdown = calc_bracket_tax(50000, "SINGLE")
        expected = 11925 * 0.10 + (48475 - 11925) * 0.12 + (50000 - 48475) * 0.22
        assert tax == round(expected, 2)

    def test_mfj_first_bracket(self):
        tax, _ = calc_bracket_tax(20000, "MFJ")
        assert tax == 2000.00

    def test_zero_income(self):
        tax, breakdown = calc_bracket_tax(0, "SINGLE")
        assert tax == 0.0
        assert breakdown == []

    def test_hoh_brackets(self):
        tax, _ = calc_bracket_tax(17000, "HOH")
        assert tax == 1700.00


class TestSETax:
    def test_basic_se(self):
        se_tax, se_ded = calc_se_tax(100000)
        assert se_tax > 0
        assert se_ded == round(se_tax / 2, 2)

    def test_zero_nec(self):
        se_tax, se_ded = calc_se_tax(0)
        assert se_tax == 0.0
        assert se_ded == 0.0

    def test_negative_nec(self):
        se_tax, se_ded = calc_se_tax(-5000)
        assert se_tax == 0.0


class TestChildCredit:
    def test_basic_credit(self):
        credit = calc_child_credit(2, 80000, "SINGLE")
        assert credit == 4000.00

    def test_phaseout(self):
        credit = calc_child_credit(1, 210000, "SINGLE")
        assert credit < 2000.00

    def test_no_dependents(self):
        credit = calc_child_credit(0, 80000, "SINGLE")
        assert credit == 0.0


class TestFullReturn:
    def test_simple_w2_return(self):
        data = {
            "filing_status": "SINGLE",
            "w2s": [{"wages": 75000, "federal_withheld": 12000}],
            "num_dependents": 0,
        }
        result = calculate_return(data)
        assert result["gross_income"] == 75000.00
        assert result["agi"] == 75000.00
        assert result["taxable_income"] == 60000.00  # 75000 - 15000 standard
        assert result["total_tax"] > 0
        assert result["total_payments"] == 12000.00

    def test_self_employment(self):
        data = {
            "filing_status": "SINGLE",
            "income_1099_nec": 50000,
        }
        result = calculate_return(data)
        assert result["se_tax"] > 0
        assert result["adjustments"]["se_deduction"] > 0
        assert result["agi"] < 50000  # Reduced by SE deduction

    def test_mfj_with_children(self):
        data = {
            "filing_status": "MFJ",
            "w2s": [{"wages": 100000, "federal_withheld": 15000}],
            "num_dependents": 2,
        }
        result = calculate_return(data)
        assert result["credits"]["child"] == 4000.00
        assert result["deduction"]["amount"] == 30000.00

    def test_itemized_deductions(self):
        data = {
            "filing_status": "SINGLE",
            "w2s": [{"wages": 200000, "federal_withheld": 40000}],
            "deduction_type": "itemized",
            "ded_mortgage": 15000,
            "ded_salt": 10000,
            "ded_charity": 5000,
        }
        result = calculate_return(data)
        assert result["deduction"]["type"] == "itemized"
        assert result["deduction"]["amount"] == 30000.00  # 15k + 10k + 5k

    def test_refund_scenario(self):
        data = {
            "filing_status": "SINGLE",
            "w2s": [{"wages": 40000, "federal_withheld": 8000}],
        }
        result = calculate_return(data)
        assert result["refund"] > 0
        assert result["owed"] == 0.0

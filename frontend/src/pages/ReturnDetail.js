import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import toast from "react-hot-toast";

const STATUS_STEPS = [
  "INTAKE", "DOCUMENTS_REQUESTED", "DOCUMENTS_RECEIVED",
  "UNDER_REVIEW", "CLIENT_REVIEW", "APPROVED", "FILED", "COMPLETE",
];

export default function ReturnDetail() {
  const { id } = useParams();
  const [ret, setRet] = useState(null);
  const [result, setResult] = useState(null);
  const [formData, setFormData] = useState({});
  const [w2s, setW2s] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadReturn(); }, [id]);

  const loadReturn = async () => {
    const { data } = await api.get(`/returns/${id}/`);
    setRet(data);
    setFormData(typeof data.form_data === "string" ? JSON.parse(data.form_data || "{}") : (data.form_data || {}));
    setW2s(data.w2s || []);
    setResult(data.computed_result || null);
    setLoading(false);
  };

  const updateField = (key) => (e) => setFormData({ ...formData, [key]: e.target.value });

  const saveReturn = async () => {
    setSaving(true);
    try {
      await api.put(`/returns/${id}/`, {
        form_data: formData,
        filing_status: ret.filing_status,
        w2s: w2s,
      });
      toast.success("Return saved.");
    } catch {
      toast.error("Save failed.");
    }
    setSaving(false);
  };

  const calculateReturn = async () => {
    try {
      await saveReturn();
      const { data } = await api.post(`/returns/${id}/calculate/`);
      setResult(data);
      toast.success("Calculation complete.");
    } catch {
      toast.error("Calculation failed.");
    }
  };

  const submitReturn = async () => {
    if (!window.confirm("Submit this return for review?")) return;
    try {
      await api.post(`/returns/${id}/submit/`);
      toast.success("Return submitted!");
      loadReturn();
    } catch (err) {
      toast.error(err.response?.data?.error || "Submit failed.");
    }
  };

  const addW2 = () => {
    setW2s([...w2s, {
      employer_name: "", employer_ein: "", wages: 0, federal_withheld: 0,
      state_withheld: 0, ss_wages: 0, ss_withheld: 0, medicare_wages: 0, medicare_withheld: 0,
    }]);
  };

  const updateW2 = (index, field) => (e) => {
    const updated = [...w2s];
    updated[index] = { ...updated[index], [field]: e.target.value };
    setW2s(updated);
  };

  const fmt = (v) => parseFloat(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

  if (loading) return <div className="text-center py-12 text-gray-500">Loading return...</div>;
  if (!ret) return <div className="text-center py-12 text-red-500">Return not found.</div>;

  const currentIdx = STATUS_STEPS.indexOf(ret.status);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy">
            Tax Year {ret.tax_year}
          </h1>
          <p className="text-gray-500 text-sm">Filing: {ret.filing_status || "Not set"}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={saveReturn} disabled={saving}
            className="bg-white border text-navy px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button onClick={calculateReturn}
            className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-light">
            Calculate
          </button>
          {["INTAKE", "DOCUMENTS_RECEIVED", "CLIENT_REVIEW"].includes(ret.status) && (
            <button onClick={submitReturn}
              className="bg-gold text-navy px-4 py-2 rounded-lg text-sm font-bold hover:bg-gold-dark">
              Submit
            </button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-2">
        {STATUS_STEPS.map((s, i) => (
          <div key={s} className={`flex-1 min-w-[80px] text-center py-2 rounded text-xs font-medium ${
            i <= currentIdx ? "bg-navy text-white" : "bg-gray-100 text-gray-400"
          }`}>
            {s.replace(/_/g, " ")}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Income Form */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="font-heading text-xl font-bold text-navy mb-4">Income</h2>

          {/* W-2s */}
          <h3 className="text-sm font-semibold text-gray-600 mb-2">W-2 Wages</h3>
          {w2s.map((w2, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2 text-sm space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Employer" value={w2.employer_name || ""} onChange={updateW2(i, "employer_name")}
                  className="px-2 py-1.5 border rounded text-sm" />
                <input type="number" placeholder="Wages" value={w2.wages || ""} onChange={updateW2(i, "wages")}
                  className="px-2 py-1.5 border rounded text-sm" />
                <input type="number" placeholder="Fed withheld" value={w2.federal_withheld || ""} onChange={updateW2(i, "federal_withheld")}
                  className="px-2 py-1.5 border rounded text-sm" />
                <input type="number" placeholder="State withheld" value={w2.state_withheld || ""} onChange={updateW2(i, "state_withheld")}
                  className="px-2 py-1.5 border rounded text-sm" />
              </div>
            </div>
          ))}
          <button onClick={addW2} className="text-gold text-sm hover:underline mb-4">+ Add W-2</button>

          {/* 1099 & Other */}
          <h3 className="text-sm font-semibold text-gray-600 mb-2 mt-4">1099 & Other Income</h3>
          <div className="space-y-2 text-sm">
            {[
              ["income_1099_nec", "1099-NEC (Self-Employment)"],
              ["income_1099_int", "1099-INT (Interest)"],
              ["income_1099_div", "1099-DIV (Dividends)"],
              ["income_1099_g", "1099-G (Unemployment)"],
              ["income_1099_r", "1099-R (Retirement)"],
              ["income_cap_gains", "Capital Gains/Losses"],
              ["income_rental", "Rental Income"],
              ["income_other", "Other Income"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <label className="w-48 text-gray-600 text-xs">{label}</label>
                <input type="number" step="0.01" value={formData[key] || ""}
                  onChange={updateField(key)} className="flex-1 px-2 py-1.5 border rounded text-sm" />
              </div>
            ))}
          </div>

          {/* Deductions */}
          <h3 className="text-sm font-semibold text-gray-600 mb-2 mt-6">Deductions & Adjustments</h3>
          <div className="space-y-2 text-sm">
            {[
              ["adj_student_loan", "Student Loan Interest"],
              ["adj_hsa", "HSA Deduction"],
              ["adj_ira", "IRA Deduction"],
              ["ded_mortgage", "Mortgage Interest"],
              ["ded_charity", "Charitable Contributions"],
              ["ded_salt", "SALT (capped $10K)"],
              ["estimated_tax_paid", "Estimated Tax Paid"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <label className="w-48 text-gray-600 text-xs">{label}</label>
                <input type="number" step="0.01" value={formData[key] || ""}
                  onChange={updateField(key)} className="flex-1 px-2 py-1.5 border rounded text-sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Results Panel */}
        <div>
          {result ? (
            <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
              <h2 className="font-heading text-xl font-bold text-navy">Tax Summary</h2>

              <div className="space-y-1 text-sm">
                <Row label="Gross Income" value={fmt(result.gross_income)} />
                <Row label="Adjustments" value={`-${fmt(result.adjustments?.total)}`} />
                <Row label="AGI" value={fmt(result.agi)} bold />
                <Row label={`Deduction (${result.deduction?.type})`} value={`-${fmt(result.deduction?.amount)}`} />
                <Row label="Taxable Income" value={fmt(result.taxable_income)} bold />
              </div>

              <hr />
              <div className="space-y-1 text-sm">
                <Row label="Income Tax" value={fmt(result.income_tax)} />
                {result.se_tax > 0 && <Row label="SE Tax" value={fmt(result.se_tax)} />}
                <Row label="Total Credits" value={`-${fmt(result.credits?.total)}`} />
                <Row label="Total Tax" value={fmt(result.total_tax)} bold />
              </div>

              <hr />
              <div className="space-y-1 text-sm">
                <Row label="Total Payments" value={fmt(result.total_payments)} />
              </div>

              <div className={`text-center p-4 rounded-xl mt-4 ${
                result.refund > 0 ? "bg-green-50 border border-green-200" : result.owed > 0 ? "bg-red-50 border border-red-200" : "bg-gray-50"
              }`}>
                {result.refund > 0 ? (
                  <>
                    <p className="text-sm text-gray-500">Estimated Refund</p>
                    <p className="text-3xl font-bold text-green-600">{fmt(result.refund)}</p>
                  </>
                ) : result.owed > 0 ? (
                  <>
                    <p className="text-sm text-gray-500">Amount Owed</p>
                    <p className="text-3xl font-bold text-red-600">{fmt(result.owed)}</p>
                  </>
                ) : (
                  <p className="text-xl font-bold text-gray-500">$0.00 — Even</p>
                )}
              </div>

              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>Effective Rate: {((result.effective_rate || 0) * 100).toFixed(1)}%</span>
                <span>Marginal Rate: {((result.marginal_rate || 0) * 100).toFixed(1)}%</span>
              </div>

              {/* Bracket Breakdown */}
              {result.bracket_breakdown?.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Bracket Breakdown</h3>
                  <div className="space-y-1">
                    {result.bracket_breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-500">
                        <span>{(b.rate * 100).toFixed(0)}% bracket</span>
                        <span>{fmt(b.taxable_in_bracket)} = {fmt(b.tax_in_bracket)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-12 text-center text-gray-400 border border-dashed">
              <p className="text-lg mb-2">No calculation yet</p>
              <p className="text-sm">Enter your income data and click "Calculate" to see your tax summary.</p>
            </div>
          )}

          {/* Status History */}
          {ret.status_history?.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border mt-6">
              <h3 className="font-heading text-lg font-bold text-navy mb-3">Status History</h3>
              <div className="space-y-2 text-sm">
                {ret.status_history.map((h) => (
                  <div key={h.id} className="flex justify-between text-gray-600">
                    <span>{h.new_status.replace(/_/g, " ")}</span>
                    <span className="text-gray-400">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-navy" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

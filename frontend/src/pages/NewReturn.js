import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import toast from "react-hot-toast";

export default function NewReturn() {
  const navigate = useNavigate();
  const [taxYear, setTaxYear] = useState(2025);
  const [filingStatus, setFilingStatus] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [priorYears, setPriorYears] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/returns/").then((r) => {
      const data = r.data.results || r.data;
      setPriorYears(data.map((d) => d.tax_year));
    });
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/returns/", {
        tax_year: taxYear,
        filing_status: filingStatus,
        copy_from_year: copyFrom ? parseInt(copyFrom) : null,
      });
      toast.success(`Return for ${taxYear} created.`);
      navigate(`/returns/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create return.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="font-heading text-3xl font-bold text-navy mb-6">Start New Tax Return</h1>
      <form onSubmit={handleCreate} className="bg-white rounded-xl p-6 shadow-sm border space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Tax Year</label>
          <input type="number" min={2000} max={2099} value={taxYear}
            onChange={(e) => setTaxYear(parseInt(e.target.value))}
            className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Filing Status</label>
          <select value={filingStatus} onChange={(e) => setFilingStatus(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg">
            <option value="">Select...</option>
            <option value="SINGLE">Single</option>
            <option value="MFJ">Married Filing Jointly</option>
            <option value="MFS">Married Filing Separately</option>
            <option value="HOH">Head of Household</option>
            <option value="QW">Qualifying Surviving Spouse</option>
          </select>
        </div>
        {priorYears.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Copy from Prior Year (optional)</label>
            <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg">
              <option value="">Don't copy</option>
              {priorYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Pre-fill income sources and deductions from a prior return.</p>
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full bg-gold hover:bg-gold-dark text-navy font-bold py-2.5 rounded-lg transition disabled:opacity-50">
          {loading ? "Creating..." : "Create Return"}
        </button>
      </form>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";

const STATUS_COLORS = {
  INTAKE: "bg-gray-200 text-gray-700",
  DOCUMENTS_REQUESTED: "bg-yellow-100 text-yellow-800",
  DOCUMENTS_RECEIVED: "bg-blue-100 text-blue-800",
  UNDER_REVIEW: "bg-indigo-100 text-indigo-800",
  CLIENT_REVIEW: "bg-purple-100 text-purple-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  FILED: "bg-green-100 text-green-800",
  COMPLETE: "bg-green-200 text-green-900",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [returns, setReturns] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/returns/").then((r) => setReturns(r.data.results || r.data)),
      api.get("/invoices/").then((r) => setInvoices(r.data.results || r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  const unpaid = invoices.filter((i) => !["PAID", "VOID"].includes(i.status));

  if (loading) return <div className="text-center py-12 text-gray-500">Loading dashboard...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy">
            Welcome back, {user?.first_name}
          </h1>
          <p className="text-gray-500 mt-1">Manage your tax returns, documents, and invoices.</p>
        </div>
        <Link to="/returns/new"
          className="mt-4 sm:mt-0 bg-gold hover:bg-gold-dark text-navy font-bold px-6 py-2.5 rounded-lg transition inline-block text-center">
          + New Return
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-sm text-gray-500">Tax Returns</p>
          <p className="text-3xl font-bold text-navy">{returns.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-sm text-gray-500">Unpaid Invoices</p>
          <p className="text-3xl font-bold text-red-600">{unpaid.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-sm text-gray-500">Account Status</p>
          <p className="text-3xl font-bold text-emerald-600">
            {user?.mfa_enabled ? "Secured" : "Setup MFA"}
          </p>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-8">
        <div className="px-5 py-4 border-b">
          <h2 className="font-heading text-xl font-bold text-navy">Your Tax Returns</h2>
        </div>
        {returns.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No returns yet. <Link to="/returns/new" className="text-gold hover:underline">Start your first return.</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3">Tax Year</th>
                <th className="px-5 py-3">Filing Status</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last Updated</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-5 py-3 font-semibold">{r.tax_year}</td>
                  <td className="px-5 py-3">{r.filing_status || "-"}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || "bg-gray-100"}`}>
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{new Date(r.updated_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <Link to={`/returns/${r.id}`} className="text-gold hover:underline text-sm font-medium">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invoices Preview */}
      {unpaid.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h3 className="font-heading text-lg text-red-700 font-bold mb-3">Outstanding Invoices</h3>
          {unpaid.map((inv) => (
            <div key={inv.id} className="flex justify-between items-center py-2 border-b border-red-100 last:border-0">
              <span className="text-sm text-gray-700">{inv.invoice_number} &mdash; Due {new Date(inv.due_date).toLocaleDateString()}</span>
              <div className="flex items-center gap-3">
                <span className="font-bold text-red-700">${parseFloat(inv.total).toFixed(2)}</span>
                {inv.stripe_hosted_url && (
                  <a href={inv.stripe_hosted_url} target="_blank" rel="noopener noreferrer"
                    className="bg-red-600 text-white text-xs px-3 py-1 rounded-lg hover:bg-red-700">
                    Pay Now
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

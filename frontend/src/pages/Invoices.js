import React, { useEffect, useState } from "react";
import api from "../api";

const STATUS_STYLES = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-indigo-100 text-indigo-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  VOID: "bg-gray-200 text-gray-500",
};

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/invoices/").then((r) => {
      setInvoices(r.data.results || r.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading invoices...</div>;

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-navy mb-6">Invoices</h1>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {invoices.length === 0 ? (
          <p className="p-8 text-center text-gray-400">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Due Date</th>
                <th className="px-5 py-3">Paid</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{inv.invoice_number}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-semibold">${parseFloat(inv.total).toFixed(2)}</td>
                  <td className="px-5 py-3 text-gray-500">{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-5 py-3">
                    {inv.stripe_hosted_url && inv.status !== "PAID" && inv.status !== "VOID" && (
                      <a href={inv.stripe_hosted_url} target="_blank" rel="noopener noreferrer"
                        className="bg-gold hover:bg-gold-dark text-navy text-xs font-bold px-3 py-1.5 rounded-lg transition">
                        Pay Now
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import toast from "react-hot-toast";

export default function AdminPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState("returns");
  const [returns, setReturns] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [clients, setClients] = useState([]);

  // Invoice form
  const [invForm, setInvForm] = useState({
    client_user_id: "", due_date: "", tax_amount: "0", notes: "",
    line_items: [{ description: "Federal Return Preparation", quantity: 1, unit_price: "150" }],
  });

  useEffect(() => {
    api.get("/returns/").then((r) => setReturns(r.data.results || r.data));
    api.get("/invoices/").then((r) => setInvoices(r.data.results || r.data));
    if (user?.role === "ADMIN") {
      api.get("/audit/logs/").then((r) => setAuditLogs(r.data.results || r.data)).catch(() => {});
    }
    api.get("/clients/preparer/clients/").then((r) => setClients(r.data.results || r.data)).catch(() => {});
  }, [user]);

  const sendInvoice = async (invoiceId) => {
    try {
      await api.post(`/invoices/${invoiceId}/send_invoice/`);
      toast.success("Invoice sent via Stripe!");
      api.get("/invoices/").then((r) => setInvoices(r.data.results || r.data));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to send.");
    }
  };

  const createInvoice = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...invForm,
        line_items: invForm.line_items.map((li) => ({
          ...li, unit_price: parseFloat(li.unit_price), quantity: parseInt(li.quantity),
        })),
        tax_amount: parseFloat(invForm.tax_amount),
      };
      await api.post("/invoices/", payload);
      toast.success("Invoice created!");
      api.get("/invoices/").then((r) => setInvoices(r.data.results || r.data));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create invoice.");
    }
  };

  const updateStatus = async (returnId, newStatus) => {
    try {
      await api.post(`/returns/${returnId}/update_status/`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      api.get("/returns/").then((r) => setReturns(r.data.results || r.data));
    } catch (err) {
      toast.error("Failed.");
    }
  };

  const tabs = [
    { id: "returns", label: "Returns" },
    { id: "invoices", label: "Invoices" },
    { id: "create-invoice", label: "Create Invoice" },
    ...(user?.role === "ADMIN" ? [{ id: "audit", label: "Audit Log" }] : []),
  ];

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-navy mb-6">Admin Panel</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id ? "bg-navy text-white" : "bg-white border hover:bg-gray-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Returns Management */}
      {tab === "returns" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">{r.tax_year}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{r.id.slice(0, 8)}...</td>
                  <td className="px-4 py-2">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{r.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    <select onChange={(e) => e.target.value && updateStatus(r.id, e.target.value)}
                      defaultValue="" className="text-xs border rounded px-2 py-1">
                      <option value="">Update status...</option>
                      {["DOCUMENTS_REQUESTED", "DOCUMENTS_RECEIVED", "UNDER_REVIEW",
                        "CLIENT_REVIEW", "APPROVED", "FILED", "COMPLETE"].map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoices List */}
      {tab === "invoices" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{inv.invoice_number}</td>
                  <td className="px-4 py-2 text-xs">{inv.client_email}</td>
                  <td className="px-4 py-2 font-semibold">${parseFloat(inv.total).toFixed(2)}</td>
                  <td className="px-4 py-2"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{inv.status}</span></td>
                  <td className="px-4 py-2">
                    {inv.status === "DRAFT" && (
                      <button onClick={() => sendInvoice(inv.id)}
                        className="bg-navy text-white text-xs px-3 py-1 rounded">Send</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Invoice */}
      {tab === "create-invoice" && (
        <form onSubmit={createInvoice} className="bg-white rounded-xl p-6 shadow-sm border max-w-lg space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Client User ID</label>
            <input type="text" required value={invForm.client_user_id}
              onChange={(e) => setInvForm({ ...invForm, client_user_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="UUID of client" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Due Date</label>
            <input type="date" required value={invForm.due_date}
              onChange={(e) => setInvForm({ ...invForm, due_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Line Items</label>
            {invForm.line_items.map((li, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input placeholder="Description" value={li.description}
                  onChange={(e) => {
                    const items = [...invForm.line_items];
                    items[i] = { ...items[i], description: e.target.value };
                    setInvForm({ ...invForm, line_items: items });
                  }} className="flex-1 px-2 py-1.5 border rounded text-sm" />
                <input type="number" placeholder="Price" value={li.unit_price}
                  onChange={(e) => {
                    const items = [...invForm.line_items];
                    items[i] = { ...items[i], unit_price: e.target.value };
                    setInvForm({ ...invForm, line_items: items });
                  }} className="w-24 px-2 py-1.5 border rounded text-sm" />
              </div>
            ))}
            <button type="button" onClick={() => setInvForm({
              ...invForm, line_items: [...invForm.line_items, { description: "", quantity: 1, unit_price: "0" }]
            })} className="text-gold text-sm hover:underline">+ Add Line</button>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Notes</label>
            <textarea value={invForm.notes} onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          </div>
          <button type="submit" className="bg-gold text-navy font-bold px-6 py-2 rounded-lg">Create Invoice</button>
        </form>
      )}

      {/* Audit Log */}
      {tab === "audit" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Resource</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="px-3 py-1.5">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-3 py-1.5">{log.user_email}</td>
                  <td className="px-3 py-1.5"><span className="bg-gray-100 px-1.5 py-0.5 rounded">{log.action}</span></td>
                  <td className="px-3 py-1.5">{log.resource} {log.resource_id?.slice(0, 8)}</td>
                  <td className="px-3 py-1.5 font-mono">{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

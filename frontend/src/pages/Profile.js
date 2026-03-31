import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import toast from "react-hot-toast";

export default function Profile() {
  const { user, loadUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [taxProfile, setTaxProfile] = useState(null);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [loginHist, setLoginHist] = useState([]);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", new_password_confirm: "" });
  const [tab, setTab] = useState("info");

  useEffect(() => {
    api.get("/auth/profile/").then((r) => setProfile(r.data));
    api.get("/clients/profile/").then((r) => setTaxProfile(r.data));
    api.get("/auth/profile/login-history/").then((r) => setLoginHist(r.data));
  }, []);

  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      await api.put("/auth/profile/", {
        first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone,
      });
      toast.success("Profile updated.");
      loadUser();
    } catch (err) {
      toast.error("Update failed.");
    }
  };

  const updateTaxProfile = async (e) => {
    e.preventDefault();
    try {
      await api.put("/clients/profile/", taxProfile);
      toast.success("Tax profile updated.");
    } catch (err) {
      toast.error("Update failed.");
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/password/change/", pwForm);
      toast.success("Password changed. Please sign in again.");
      logout();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to change password.");
    }
  };

  const setupMfa = async () => {
    try {
      const { data } = await api.post("/auth/mfa/setup/");
      setMfaSetup(data);
    } catch {
      toast.error("Failed to start MFA setup.");
    }
  };

  const confirmMfa = async () => {
    try {
      await api.post("/auth/mfa/confirm/", { code: mfaCode });
      toast.success("MFA enabled!");
      setMfaSetup(null);
      loadUser();
    } catch {
      toast.error("Invalid code.");
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm("Are you sure? Your account will be scheduled for deletion in 30 days.")) return;
    try {
      await api.delete("/auth/profile/delete/");
      toast.success("Account scheduled for deletion.");
      logout();
    } catch {
      toast.error("Failed.");
    }
  };

  const tabs = [
    { id: "info", label: "Personal Info" },
    { id: "tax", label: "Tax Profile" },
    { id: "security", label: "Security" },
    { id: "history", label: "Login History" },
  ];

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-navy mb-6">Account Settings</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id ? "bg-navy text-white" : "bg-white border text-gray-600 hover:bg-gray-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Personal Info */}
      {tab === "info" && profile && (
        <form onSubmit={updateProfile} className="bg-white rounded-xl p-6 shadow-sm border max-w-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">First Name</label>
              <input type="text" value={profile.first_name}
                onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Last Name</label>
              <input type="text" value={profile.last_name}
                onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
            <input type="email" value={profile.email} disabled className="w-full px-3 py-2 border rounded-lg bg-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Phone</label>
            <input type="tel" value={profile.phone || ""}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <button type="submit" className="bg-gold text-navy font-bold px-6 py-2 rounded-lg">Save Changes</button>
        </form>
      )}

      {/* Tax Profile */}
      {tab === "tax" && taxProfile && (
        <form onSubmit={updateTaxProfile} className="bg-white rounded-xl p-6 shadow-sm border max-w-lg space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">SSN (last 4)</label>
            <input type="text" maxLength={4} value={taxProfile.ssn_last4 || ""}
              onChange={(e) => setTaxProfile({ ...taxProfile, ssn_last4: e.target.value.replace(/\D/g, "") })}
              className="w-full px-3 py-2 border rounded-lg" placeholder="1234" />
            {taxProfile.ssn_masked && <p className="text-xs text-gray-400 mt-1">Stored as: {taxProfile.ssn_masked}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Filing Status</label>
            <select value={taxProfile.filing_status || ""}
              onChange={(e) => setTaxProfile({ ...taxProfile, filing_status: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select...</option>
              <option value="SINGLE">Single</option>
              <option value="MFJ">Married Filing Jointly</option>
              <option value="MFS">Married Filing Separately</option>
              <option value="HOH">Head of Household</option>
              <option value="QW">Qualifying Surviving Spouse</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Address</label>
            <input type="text" value={taxProfile.address_street || ""}
              onChange={(e) => setTaxProfile({ ...taxProfile, address_street: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input type="text" placeholder="City" value={taxProfile.city || ""}
              onChange={(e) => setTaxProfile({ ...taxProfile, city: e.target.value })}
              className="px-3 py-2 border rounded-lg" />
            <input type="text" placeholder="State" maxLength={2} value={taxProfile.state || ""}
              onChange={(e) => setTaxProfile({ ...taxProfile, state: e.target.value.toUpperCase() })}
              className="px-3 py-2 border rounded-lg" />
            <input type="text" placeholder="ZIP" value={taxProfile.zip_code || ""}
              onChange={(e) => setTaxProfile({ ...taxProfile, zip_code: e.target.value })}
              className="px-3 py-2 border rounded-lg" />
          </div>
          <button type="submit" className="bg-gold text-navy font-bold px-6 py-2 rounded-lg">Save Tax Profile</button>
        </form>
      )}

      {/* Security */}
      {tab === "security" && (
        <div className="space-y-6 max-w-lg">
          {/* MFA */}
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <h3 className="font-heading text-lg font-bold text-navy mb-3">Two-Factor Authentication</h3>
            {user?.mfa_enabled ? (
              <p className="text-emerald-600 font-semibold">MFA is enabled.</p>
            ) : !mfaSetup ? (
              <button onClick={setupMfa} className="bg-navy text-white px-4 py-2 rounded-lg text-sm">
                Enable MFA
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Scan this QR code with Google Authenticator or Authy:</p>
                <img src={mfaSetup.qr_code} alt="QR" className="w-48 h-48 mx-auto border rounded" />
                <div>
                  <p className="text-xs text-gray-400 mb-1">Backup codes (save these!):</p>
                  <div className="grid grid-cols-2 gap-1 text-xs font-mono bg-gray-50 p-2 rounded">
                    {mfaSetup.backup_codes.map((c, i) => <span key={i}>{c}</span>)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input type="text" maxLength={6} value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="6-digit code" className="px-3 py-2 border rounded-lg flex-1" />
                  <button onClick={confirmMfa} className="bg-gold text-navy font-bold px-4 py-2 rounded-lg">Verify</button>
                </div>
              </div>
            )}
          </div>

          {/* Change Password */}
          <form onSubmit={changePassword} className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
            <h3 className="font-heading text-lg font-bold text-navy">Change Password</h3>
            <input type="password" required placeholder="Current password"
              value={pwForm.current_password}
              onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" />
            <input type="password" required placeholder="New password (min 12 chars)" minLength={12}
              value={pwForm.new_password}
              onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" />
            <input type="password" required placeholder="Confirm new password"
              value={pwForm.new_password_confirm}
              onChange={(e) => setPwForm({ ...pwForm, new_password_confirm: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg" />
            <button type="submit" className="bg-navy text-white px-4 py-2 rounded-lg text-sm">Change Password</button>
          </form>

          {/* Delete Account */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h3 className="font-heading text-lg font-bold text-red-700 mb-2">Delete Account</h3>
            <p className="text-sm text-gray-600 mb-3">This will schedule your account for permanent deletion in 30 days. Financial records are retained per IRS requirements.</p>
            <button onClick={deleteAccount} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm">Delete My Account</button>
          </div>
        </div>
      )}

      {/* Login History */}
      {tab === "history" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden max-w-2xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loginHist.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="px-4 py-2">{new Date(h.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono text-xs">{h.ip_address}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${h.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {h.success ? "Success" : h.failure_reason || "Failed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

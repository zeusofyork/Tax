import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api";
import toast from "react-hot-toast";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) { toast.error("Passwords don't match."); return; }
    try {
      await api.post("/auth/password/reset/confirm/", {
        token: params.get("token"), new_password: pw, new_password_confirm: pw2,
      });
      toast.success("Password reset! You can now sign in.");
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.error || "Reset failed.");
    }
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <h1 className="font-heading text-2xl text-navy font-bold text-center mb-4">Set New Password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" required minLength={12} placeholder="New password (min 12 chars)"
            value={pw} onChange={(e) => setPw(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gold outline-none" />
          <input type="password" required placeholder="Confirm password"
            value={pw2} onChange={(e) => setPw2(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gold outline-none" />
          <button type="submit" className="w-full bg-gold text-navy font-bold py-2.5 rounded-lg">
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
}

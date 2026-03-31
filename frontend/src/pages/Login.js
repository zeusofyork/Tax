import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Login() {
  const { login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.mfaRequired) {
        setMfaToken(result.mfaToken);
        toast.success("Enter your authenticator code.");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed.");
    }
    setLoading(false);
  };

  const handleMfa = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyMfa(mfaToken, mfaCode);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || "Invalid MFA code.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <h1 className="font-heading text-3xl font-bold text-navy text-center mb-2">
          Easy<span className="text-gold">Tax</span>
        </h1>
        <p className="text-center text-gray-500 mb-8">Sign in to your account</p>

        {!mfaToken ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:border-gold outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold focus:border-gold outline-none" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-navy hover:bg-navy-light text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfa} className="space-y-5">
            <p className="text-center text-sm text-gray-600">
              Enter the 6-digit code from your authenticator app.
            </p>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">MFA Code</label>
              <input type="text" required maxLength={6} value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-gold outline-none"
                autoFocus />
            </div>
            <button type="submit" disabled={loading || mfaCode.length !== 6}
              className="w-full bg-gold hover:bg-gold-dark text-navy font-semibold py-2.5 rounded-lg transition disabled:opacity-50">
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-gray-500 space-y-2">
          <p><Link to="/forgot-password" className="text-gold hover:underline">Forgot password?</Link></p>
          <p>Don't have an account? <Link to="/register" className="text-gold hover:underline font-semibold">Sign up</Link></p>
        </div>
      </div>
    </div>
  );
}

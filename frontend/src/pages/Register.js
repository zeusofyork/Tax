import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    password: "", password_confirm: "", recaptcha_token: "dev-token",
  });
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.password_confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (form.password.length < 12) {
      toast.error("Password must be at least 12 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(form);
      toast.success("Account created! Check your email to verify.");
      navigate("/login");
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.error
        ? Object.values(data.error).flat().join(" ")
        : "Registration failed.";
      toast.error(msg);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
        <h1 className="font-heading text-3xl font-bold text-navy text-center mb-2">
          Create Your Account
        </h1>
        <p className="text-center text-gray-500 mb-8">Start preparing your tax return today</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">First Name</label>
              <input type="text" required value={form.first_name} onChange={set("first_name")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Last Name</label>
              <input type="text" required value={form.last_name} onChange={set("last_name")}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
            <input type="email" required value={form.email} onChange={set("email")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Phone (optional)</label>
            <input type="tel" value={form.phone} onChange={set("phone")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Password (min 12 chars)</label>
            <input type="password" required minLength={12} value={form.password} onChange={set("password")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none" />
            <p className="text-xs text-gray-400 mt-1">1 uppercase, 1 number, 1 symbol required</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Confirm Password</label>
            <input type="password" required value={form.password_confirm} onChange={set("password_confirm")}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gold outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-gold hover:bg-gold-dark text-navy font-bold py-2.5 rounded-lg transition disabled:opacity-50">
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account? <Link to="/login" className="text-gold hover:underline font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

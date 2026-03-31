import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import toast from "react-hot-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/password/reset/", { email });
      setSent(true);
    } catch {
      toast.error("Something went wrong.");
    }
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <h1 className="font-heading text-2xl text-navy font-bold text-center mb-4">Reset Password</h1>
        {sent ? (
          <p className="text-center text-gray-600">If an account exists for that email, a reset link has been sent. Check your inbox.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" required placeholder="Enter your email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gold outline-none" />
            <button type="submit" className="w-full bg-gold text-navy font-bold py-2.5 rounded-lg">
              Send Reset Link
            </button>
          </form>
        )}
        <p className="text-center text-sm text-gray-500 mt-4">
          <Link to="/login" className="text-gold hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

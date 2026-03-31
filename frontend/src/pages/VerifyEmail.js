import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("verifying");

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setStatus("error"); return; }
    api.post("/auth/verify-email/", { token })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [params]);

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        {status === "verifying" && <p className="text-gray-500">Verifying your email...</p>}
        {status === "success" && (
          <>
            <h2 className="font-heading text-2xl text-navy font-bold mb-2">Email Verified!</h2>
            <p className="text-gray-500 mb-6">Your account is ready. You can now sign in.</p>
            <Link to="/login" className="bg-gold text-navy font-bold px-6 py-2 rounded-lg">Sign In</Link>
          </>
        )}
        {status === "error" && (
          <>
            <h2 className="font-heading text-2xl text-red-600 font-bold mb-2">Verification Failed</h2>
            <p className="text-gray-500">The link is invalid or has expired.</p>
          </>
        )}
      </div>
    </div>
  );
}

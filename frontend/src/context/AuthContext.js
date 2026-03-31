import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) {
        throw new Error("Token expired");
      }
      const { data } = await api.get("/auth/profile/");
      setUser(data);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password, deviceFingerprint = "") => {
    const { data } = await api.post("/auth/login/", {
      email, password, device_fingerprint: deviceFingerprint,
    });
    if (data.mfa_required) {
      return { mfaRequired: true, mfaToken: data.mfa_token };
    }
    localStorage.setItem("access_token", data.access);
    localStorage.setItem("refresh_token", data.refresh);
    setUser(data.user);
    return { mfaRequired: false };
  };

  const verifyMfa = async (mfaToken, code) => {
    const { data } = await api.post("/auth/mfa/verify/", {
      mfa_token: mfaToken, code,
    });
    localStorage.setItem("access_token", data.access);
    localStorage.setItem("refresh_token", data.refresh);
    setUser(data.user);
  };

  const register = async (formData) => {
    await api.post("/auth/register/", formData);
  };

  const logout = async () => {
    const refresh = localStorage.getItem("refresh_token");
    try { await api.post("/auth/logout/", { refresh }); } catch {}
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyMfa, register, logout, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

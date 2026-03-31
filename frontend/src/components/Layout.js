import React from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-navy text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="text-gold text-2xl font-heading font-bold">EasyTax</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-body">
            <Link to="/dashboard" className="hover:text-gold transition">Dashboard</Link>
            <Link to="/documents" className="hover:text-gold transition">Documents</Link>
            <Link to="/invoices" className="hover:text-gold transition">Invoices</Link>
            <Link to="/profile" className="hover:text-gold transition">Profile</Link>
            {(user?.role === "ADMIN" || user?.role === "TAX_PREPARER") && (
              <Link to="/admin" className="hover:text-gold transition">Admin</Link>
            )}
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300 hidden sm:block">{user?.email}</span>
            <button onClick={handleLogout}
              className="text-sm bg-gold/20 hover:bg-gold/40 text-gold px-3 py-1.5 rounded transition">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-navy-dark text-gray-500 text-center py-4 text-xs font-body">
        EasyTax &copy; {new Date().getFullYear()} &mdash; For informational purposes only.
        Not a substitute for professional tax advice.
        <span className="mx-2">|</span>
        <Link to="/privacy" className="hover:text-gold">Privacy Policy</Link>
        <span className="mx-2">|</span>
        <Link to="/terms" className="hover:text-gold">Terms of Service</Link>
      </footer>
    </div>
  );
}

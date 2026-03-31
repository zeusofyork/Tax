import React from "react";
import { Link } from "react-router-dom";

const features = [
  { title: "Secure Filing", desc: "AES-256 encryption, MFA, and full PII protection for every return." },
  { title: "Document Vault", desc: "Upload W-2s, 1099s, and ID documents with virus scanning and 7-year retention." },
  { title: "Real-Time Calculations", desc: "2025 federal tax brackets computed instantly as you enter data." },
  { title: "Invoice & Pay Online", desc: "Receive invoices and pay securely via Stripe — no checks, no hassle." },
  { title: "Repeat Customer Pre-fill", desc: "Returning clients get pre-filled forms from last year's data." },
  { title: "Status Tracking", desc: "Follow your return from intake through filing — every step visible." },
];

const pricing = [
  { name: "Simple Return", price: "$99", desc: "W-2 income, standard deduction, no dependents." },
  { name: "Standard Return", price: "$199", desc: "Multiple W-2s, dependents, itemized deductions." },
  { name: "Complex Return", price: "$349+", desc: "Self-employment, rental, capital gains, Schedule C/E." },
];

export default function Landing() {
  return (
    <div className="font-body">
      {/* Hero */}
      <section className="bg-navy text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1Ii8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')]" />
        <div className="max-w-6xl mx-auto px-6 py-24 relative z-10 text-center">
          <h1 className="font-heading text-5xl md:text-6xl font-bold mb-4">
            Easy<span className="text-gold">Tax</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
            Professional individual tax return preparation with bank-level security,
            transparent pricing, and a seamless online experience.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/register" className="bg-gold hover:bg-gold-dark text-navy font-bold px-8 py-3 rounded-lg text-lg transition">
              Get Started Free
            </Link>
            <Link to="/login" className="border border-gold/50 text-gold hover:bg-gold/10 px-8 py-3 rounded-lg text-lg transition">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-heading text-3xl text-center font-bold text-navy mb-12">
            Why Choose EasyTax
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition">
                <h3 className="font-heading text-lg font-semibold text-navy mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="font-heading text-3xl text-center font-bold text-navy mb-12">
            Transparent Pricing
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {pricing.map((p, i) => (
              <div key={i} className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center hover:border-gold transition">
                <h3 className="font-heading text-xl font-bold text-navy">{p.name}</h3>
                <p className="text-4xl font-bold text-gold mt-4 mb-2">{p.price}</p>
                <p className="text-gray-500 text-sm mb-6">{p.desc}</p>
                <Link to="/register" className="inline-block bg-navy hover:bg-navy-light text-white px-6 py-2 rounded-lg text-sm transition">
                  Start Now
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-dark text-gray-500 text-center py-6 text-xs">
        EasyTax &copy; {new Date().getFullYear()} &mdash; Not a substitute for professional tax advice.
      </footer>
    </div>
  );
}

import React, { useEffect, useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import api from "../api";
import toast from "react-hot-toast";

const DOC_TYPES = [
  { value: "W2", label: "W-2" },
  { value: "1099_NEC", label: "1099-NEC" },
  { value: "1099_INT", label: "1099-INT" },
  { value: "1099_DIV", label: "1099-DIV" },
  { value: "1099_G", label: "1099-G" },
  { value: "1099_R", label: "1099-R" },
  { value: "1099_MISC", label: "1099-MISC" },
  { value: "1098", label: "1098" },
  { value: "K1", label: "Schedule K-1" },
  { value: "ID_FRONT", label: "ID (Front)" },
  { value: "ID_BACK", label: "ID (Back)" },
  { value: "OTHER", label: "Other" },
];

const SCAN_COLORS = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CLEAN: "bg-green-100 text-green-700",
  INFECTED: "bg-red-100 text-red-700",
  ERROR: "bg-gray-100 text-gray-700",
};

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [docType, setDocType] = useState("W2");
  const [taxYear, setTaxYear] = useState(2025);
  const [uploading, setUploading] = useState(false);

  const loadDocs = () => api.get("/documents/").then((r) => setDocs(r.data.results || r.data));
  useEffect(() => { loadDocs(); }, []);

  const onDrop = useCallback(async (files) => {
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("doc_type", docType);
      formData.append("tax_year", taxYear);
      setUploading(true);
      try {
        await api.post("/documents/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(`Uploaded: ${file.name}`);
      } catch (err) {
        toast.error(err.response?.data?.file?.[0] || `Failed: ${file.name}`);
      }
    }
    setUploading(false);
    loadDocs();
  }, [docType, taxYear]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    maxSize: 10 * 1024 * 1024,
  });

  const deleteDoc = async (id) => {
    if (!window.confirm("Delete this document?")) return;
    await api.delete(`/documents/${id}/`);
    toast.success("Deleted.");
    loadDocs();
  };

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-navy mb-6">Document Vault</h1>

      {/* Upload Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
        <div className="flex gap-4 mb-4 flex-wrap">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Document Type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm">
              {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Tax Year</label>
            <input type="number" value={taxYear} onChange={(e) => setTaxYear(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm w-24" />
          </div>
        </div>
        <div {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
            isDragActive ? "border-gold bg-gold/5" : "border-gray-300 hover:border-gold/50"}`}>
          <input {...getInputProps()} />
          {uploading ? (
            <p className="text-gray-500">Uploading...</p>
          ) : isDragActive ? (
            <p className="text-gold font-semibold">Drop files here</p>
          ) : (
            <div>
              <p className="text-gray-500 mb-1">Drag & drop files here, or click to select</p>
              <p className="text-xs text-gray-400">PDF, JPG, PNG only. Max 10MB per file.</p>
            </div>
          )}
        </div>
      </div>

      {/* Document List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-heading text-xl font-bold text-navy">Uploaded Documents</h2>
        </div>
        {docs.length === 0 ? (
          <p className="p-8 text-center text-gray-400">No documents uploaded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3">File</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Year</th>
                <th className="px-5 py-3">Scan</th>
                <th className="px-5 py-3">Uploaded</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{d.original_filename}</td>
                  <td className="px-5 py-3">{d.doc_type}</td>
                  <td className="px-5 py-3">{d.tax_year}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SCAN_COLORS[d.scan_status]}`}>
                      {d.scan_status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{new Date(d.uploaded_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 flex gap-2">
                    {d.download_url && (
                      <a href={d.download_url} target="_blank" rel="noopener noreferrer"
                        className="text-gold hover:underline text-xs">Download</a>
                    )}
                    <button onClick={() => deleteDoc(d.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

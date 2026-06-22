"use client";

import { useState } from "react";
import { Download, Calendar } from "lucide-react";

interface ExportCsvPanelProps {
  type?: "cuti";
}

export function ExportCsvPanel({ type = "cuti" }: ExportCsvPanelProps) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const query = new URLSearchParams();
    if (start) query.set("start", start);
    if (end) query.set("end", end);

    window.location.href = `/api/reports/cuti?${query.toString()}`;

    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  return (
    <div
      className="card-outer mb-6"
      style={{
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-card)",
      }}
    >
      <div className="card-inner" style={{ padding: "var(--space-4)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Download
            size={16}
            style={{ color: "var(--color-primary)" }}
          />
          <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 700, margin: 0 }}>
            Ekspor Laporan CSV (Cuti & Izin Karyawan)
          </h4>
        </div>

        <form onSubmit={handleExport} className="flex flex-wrap items-end gap-4">
          <div className="form-group" style={{ marginBottom: 0, flex: "1 1 200px" }}>
            <label
              htmlFor="export-start"
              className="form-label"
              style={{ fontSize: "var(--text-xs)", marginBottom: 4 }}
            >
              Mulai Tanggal
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Calendar
                size={14}
                className="text-light"
                style={{ position: "absolute", left: 12, pointerEvents: "none" }}
              />
              <input
                id="export-start"
                type="date"
                className="form-input w-full"
                style={{
                  minHeight: 38,
                  padding: "8px 12px 8px 36px",
                  fontSize: "var(--text-sm)",
                }}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0, flex: "1 1 200px" }}>
            <label
              htmlFor="export-end"
              className="form-label"
              style={{ fontSize: "var(--text-xs)", marginBottom: 4 }}
            >
              Sampai Tanggal
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Calendar
                size={14}
                className="text-light"
                style={{ position: "absolute", left: 12, pointerEvents: "none" }}
              />
              <input
                id="export-end"
                type="date"
                className="form-input w-full"
                style={{
                  minHeight: 38,
                  padding: "8px 12px 8px 36px",
                  fontSize: "var(--text-sm)",
                }}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              minHeight: 38,
              padding: "0 20px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "var(--text-sm)",
            }}
          >
            <Download size={14} />
            {loading ? "Mengekspor..." : "Ekspor CSV"}
          </button>
        </form>
      </div>
    </div>
  );
}

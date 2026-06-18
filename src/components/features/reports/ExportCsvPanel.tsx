"use client";

import { useState } from "react";
import { Download, Calendar } from "lucide-react";

interface ExportCsvPanelProps {
  type: "cuti" | "izin";
}

export function ExportCsvPanel({ type }: ExportCsvPanelProps) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const query = new URLSearchParams();
    if (start) query.set("start", start);
    if (end) query.set("end", end);

    // Trigger the file download by setting window.location.href
    // Since the endpoint responds with attachment disposition, it will trigger native download
    window.location.href = `/api/reports/${type}?${query.toString()}`;

    // Reset loading state after a brief moment since browser handles download in the background
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const isIzin = type === "izin";

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
            style={{ color: isIzin ? "var(--color-accent)" : "var(--color-primary)" }}
          />
          <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 700, margin: 0 }}>
            Ekspor Laporan CSV {isIzin ? "(Izin & Keterangan)" : "(Cuti Khusus & Sakit)"}
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
            className={`btn ${isIzin ? "btn-accent" : "btn-primary"}`}
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

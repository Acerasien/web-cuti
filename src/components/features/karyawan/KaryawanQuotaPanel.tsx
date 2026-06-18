"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertAnnualLeaveQuota } from "@/lib/actions/karyawan";
import { Plus, Loader2 } from "lucide-react";

interface KaryawanQuotaPanelProps {
  userId: string;
  defaultCycleStart: string;
}

export function KaryawanQuotaPanel({ userId, defaultCycleStart }: KaryawanQuotaPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [cycleStart, setCycleStart] = useState(defaultCycleStart.substring(0, 10));
  const [totalDays, setTotalDays] = useState(12);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!cycleStart) {
      setError("Tanggal mulai siklus wajib diisi.");
      return;
    }
    if (totalDays <= 0) {
      setError("Jumlah hari harus lebih besar dari 0.");
      return;
    }

    startTransition(async () => {
      const res = await upsertAnnualLeaveQuota(userId, cycleStart, totalDays);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        router.refresh();
      }
    });
  };

  return (
    <div className="card-outer mt-6" style={{ border: "1px solid rgba(124, 58, 237, 0.15)", background: "rgba(124, 58, 237, 0.01)" }}>
      <div className="card-inner">
        <h3 className="card-title mb-4">Tambah / Perbarui Siklus Kuota</h3>

        {error && (
          <div className="form-error" style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-danger-light)", color: "var(--color-danger)", borderRadius: "var(--radius-md)", border: "1px solid rgba(220,38,38,0.2)", marginBottom: "var(--space-4)", fontSize: "var(--text-xs)" }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: "var(--space-2) var(--space-3)", background: "var(--color-success-light)", color: "var(--color-success)", borderRadius: "var(--radius-md)", border: "1px solid rgba(22,163,74,0.2)", marginBottom: "var(--space-4)", fontSize: "var(--text-xs)", fontWeight: 500 }}>
            Kuota berhasil disimpan!
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="cycleStart" className="form-label required" style={{ fontSize: "var(--text-xs)" }}>
              Tanggal Mulai Siklus
            </label>
            <input
              id="cycleStart"
              type="date"
              className="form-input"
              style={{ minHeight: 38, padding: "8px 12px", fontSize: "var(--text-sm)" }}
              value={cycleStart}
              onChange={(e) => setCycleStart(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="totalDays" className="form-label required" style={{ fontSize: "var(--text-xs)" }}>
              Jumlah Kuota (Hari)
            </label>
            <input
              id="totalDays"
              type="number"
              className="form-input"
              style={{ minHeight: 38, padding: "8px 12px", fontSize: "var(--text-sm)" }}
              value={totalDays}
              onChange={(e) => setTotalDays(parseInt(e.target.value) || 0)}
              disabled={isPending}
              min="1"
              max="90"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-sm w-full mt-2"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            ) : (
              <Plus size={14} />
            )}
            Simpan Kuota
          </button>
        </form>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

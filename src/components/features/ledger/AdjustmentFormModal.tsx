"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createAdjustment, updateAdjustment } from "@/lib/actions/adjustments";

interface AdjustmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotaId: string;
  userId: string;
  initialData?: {
    id: string;
    days: number;
    reason: string;
    effectiveOn: string; // ISO Date String YYYY-MM-DD
  } | null;
}

export function AdjustmentFormModal({
  isOpen,
  onClose,
  quotaId,
  userId,
  initialData = null,
}: AdjustmentFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form values
  const [type, setType] = useState<"ADD" | "SUBTRACT">("ADD");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveOn, setEffectiveOn] = useState("");

  // Populate data when editing
  useEffect(() => {
    if (initialData) {
      const days = initialData.days;
      setType(days >= 0 ? "ADD" : "SUBTRACT");
      setAmount(Math.abs(days).toString());
      setReason(initialData.reason);
      setEffectiveOn(initialData.effectiveOn);
    } else {
      setType("ADD");
      setAmount("");
      setReason("");
      // Default to today in local timezone YYYY-MM-DD
      const todayStr = new Date().toISOString().split("T")[0];
      setEffectiveOn(todayStr);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setError("Jumlah hari harus berupa angka positif lebih dari nol.");
        setIsLoading(false);
        return;
      }

      if (!reason.trim()) {
        setError("Alasan penyesuaian wajib diisi.");
        setIsLoading(false);
        return;
      }

      if (!effectiveOn) {
        setError("Tanggal efektif wajib dipilih.");
        setIsLoading(false);
        return;
      }

      const finalDays = type === "SUBTRACT" ? -parsedAmount : parsedAmount;

      const submissionData = new FormData();
      if (initialData) {
        submissionData.append("id", initialData.id);
      } else {
        submissionData.append("quotaId", quotaId);
        submissionData.append("userId", userId);
      }
      submissionData.append("days", finalDays.toString());
      submissionData.append("reason", reason);
      submissionData.append("effectiveOn", effectiveOn);

      const res = initialData
        ? await updateAdjustment(null, submissionData)
        : await createAdjustment(null, submissionData);

      if (res?.error) {
        setError(res.error);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
        backgroundColor: "rgba(15, 23, 42, 0.4)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transition: "all 0.3s ease",
        zIndex: 9999,
      }}
    >
      <div
        style={{ position: "absolute", inset: 0 }}
        onClick={() => !isLoading && onClose()}
      />

      <div
        className="card-outer animate-modal-scale"
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 460,
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="card-inner" style={{ padding: "var(--space-6)" }}>
          {/* Header */}
          <div
            className="flex justify-between items-start mb-6"
            style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 16 }}
          >
            <div>
              <h3 className="card-title" style={{ margin: 0, fontSize: "var(--text-lg)" }}>
                {initialData ? "Ubah Penyesuaian Saldo" : "Tambah Penyesuaian Saldo"}
              </h3>
              <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                Siklus Cuti Tahunan Karyawan
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn btn-ghost btn-sm"
              style={{
                minHeight: 32,
                width: 32,
                padding: 0,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-danger)",
                  backgroundColor: "var(--color-danger-light)",
                  padding: "10px var(--space-4)",
                  borderRadius: "var(--radius-sm)",
                  fontWeight: 500,
                  border: "1px solid rgba(220, 38, 26, 0.1)",
                }}
              >
                {error}
              </div>
            )}

            {/* Type Selector */}
            <div className="flex flex-col gap-2">
              <label className="form-label required" style={{ fontSize: "var(--text-xs)" }}>
                Jenis Penyesuaian
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setType("ADD")}
                  className={`btn ${type === "ADD" ? "btn-primary" : "btn-outline"}`}
                  style={{
                    fontSize: "var(--text-xs)",
                    height: 38,
                    borderRadius: "var(--radius-md)",
                    justifyContent: "center",
                  }}
                >
                  Penambahan (+)
                </button>
                <button
                  type="button"
                  onClick={() => setType("SUBTRACT")}
                  className={`btn ${type === "SUBTRACT" ? "btn-danger" : "btn-outline"}`}
                  style={{
                    fontSize: "var(--text-xs)",
                    height: 38,
                    borderRadius: "var(--radius-md)",
                    justifyContent: "center",
                  }}
                >
                  Pengurangan (-)
                </button>
              </div>
            </div>

            {/* Amount (Days) */}
            <div className="flex flex-col gap-2">
              <label htmlFor="amount" className="form-label required" style={{ fontSize: "var(--text-xs)" }}>
                Jumlah Hari
              </label>
              <input
                id="amount"
                type="number"
                step="0.5"
                min="0.5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Contoh: 2 atau 1.5"
                className="form-input"
                required
                disabled={isLoading}
                style={{ height: 40 }}
              />
            </div>

            {/* Effective On (Date) */}
            <div className="flex flex-col gap-2">
              <label htmlFor="effectiveOn" className="form-label required" style={{ fontSize: "var(--text-xs)" }}>
                Tanggal Efektif
              </label>
              <input
                id="effectiveOn"
                type="date"
                value={effectiveOn}
                onChange={(e) => setEffectiveOn(e.target.value)}
                className="form-input"
                required
                disabled={isLoading}
                style={{ height: 40 }}
              />
            </div>

            {/* Reason (Textarea) */}
            <div className="flex flex-col gap-2">
              <label htmlFor="reason" className="form-label required" style={{ fontSize: "var(--text-xs)" }}>
                Alasan Penyesuaian
              </label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Kompensasi lembur akhir pekan / Koreksi admin"
                className="form-textarea"
                required
                disabled={isLoading}
                style={{
                  resize: "none",
                  padding: "10px 12px",
                  fontSize: "var(--text-sm)",
                  minHeight: 80,
                }}
              />
            </div>

            {/* Form Footer Buttons */}
            <div
              className="flex justify-end gap-3 mt-4"
              style={{ borderTop: "1px solid var(--color-border)", paddingTop: 16 }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="btn btn-outline"
                style={{ height: 38, fontSize: "var(--text-xs)" }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`btn ${type === "SUBTRACT" ? "btn-danger" : "btn-primary"}`}
                style={{ height: 38, fontSize: "var(--text-xs)" }}
              >
                {isLoading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewLeaveRequest } from "@/lib/actions/leave";
import { Check, X, Loader2 } from "lucide-react";

interface LeaveReviewPanelProps {
  requestId: string;
}

export function LeaveReviewPanel({ requestId }: LeaveReviewPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectionNote, setRejectionNote] = useState("");
  const [error, setError] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleProcess = (status: "APPROVED" | "REJECTED") => {
    setError("");

    if (status === "REJECTED" && !rejectionNote.trim()) {
      setError("Catatan penolakan wajib diisi jika pengajuan ditolak.");
      return;
    }

    startTransition(async () => {
      const res = await reviewLeaveRequest(requestId, status, rejectionNote);
      if (res?.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="card-outer mt-6" style={{ border: "1px solid rgba(124, 58, 237, 0.12)", background: "rgba(124, 58, 237, 0.01)" }}>
      <div className="card-inner">
        <h3 className="card-title mb-4">Panel Tindakan (Admin HR)</h3>

        {error && (
          <div className="form-error" style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-danger-light)", borderRadius: "var(--radius-md)", border: "1px solid rgba(220,38,38,0.2)", marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
            {error}
          </div>
        )}

        {!showRejectForm ? (
          <div className="flex gap-4">
            <button
              onClick={() => handleProcess("APPROVED")}
              disabled={isPending}
              className="btn btn-primary flex-1"
            >
              {isPending ? (
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Check size={18} />
              )}
              Setujui Cuti
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              disabled={isPending}
              className="btn btn-danger flex-1"
            >
              <X size={18} />
              Tolak Cuti
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="form-group">
              <label htmlFor="rejectionNote" className="form-label required">
                Alasan Penolakan
              </label>
              <textarea
                id="rejectionNote"
                className="form-textarea"
                placeholder="Tuliskan catatan alasan penolakan pengajuan..."
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => handleProcess("REJECTED")}
                disabled={isPending}
                className="btn btn-danger flex-1"
              >
                {isPending ? (
                  <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <Check size={18} />
                )}
                Konfirmasi Tolak
              </button>
              <button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionNote("");
                  setError("");
                }}
                disabled={isPending}
                className="btn btn-ghost flex-1"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

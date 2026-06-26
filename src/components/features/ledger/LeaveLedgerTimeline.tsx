"use client";

import { useState } from "react";
import {
  Play,
  Plus,
  Minus,
  Calendar,
  Sliders,
  Edit2,
  Trash2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { LedgerEntry } from "@/lib/ledger";
import { deleteAdjustment } from "@/lib/actions/adjustments";
import { AdjustmentFormModal } from "./AdjustmentFormModal";

interface LeaveLedgerTimelineProps {
  userId: string;
  quotaId: string;
  entries: LedgerEntry[];
  quota: {
    cycleStart: Date;
    cycleEnd: Date;
    totalDays: number;
  };
  isAdmin: boolean;
}

export function LeaveLedgerTimeline({
  userId,
  quotaId,
  entries,
  quota,
  isAdmin,
}: LeaveLedgerTimelineProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdj, setEditingAdj] = useState<{
    id: string;
    days: number;
    reason: string;
    effectiveOn: string;
  } | null>(null);
  
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Format date to local ID format (e.g., 26 Jun 2026)
  const formatDateString = (date: Date) => {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Get current balance (the latest computed running balance, which is the first item in the list)
  const currentBalance = entries.length > 0 ? entries[0].balance : 0;
  
  // Calculate maximum accrued possible so far (all accruals in this cycle)
  const accrualCount = entries.filter((e) => e.type === "ACCRUAL").length;

  const handleEditClick = (entry: LedgerEntry) => {
    // Format effectiveOn date to YYYY-MM-DD for standard HTML date input
    const dateObj = new Date(entry.date);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;

    // Strip out the admin name if it exists in the meta string to get the raw reason
    let rawReason = entry.meta || "";
    if (rawReason.includes(" (oleh ")) {
      rawReason = rawReason.split(" (oleh ")[0];
    }

    setEditingAdj({
      id: entry.adjustmentId || "",
      days: entry.days,
      reason: rawReason,
      effectiveOn: formattedDate,
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string, days: number) => {
    // Warning if deleting adjustment causes balance to go negative
    const nextBalance = currentBalance - days;
    const warningMsg = nextBalance < 0 
      ? "\n\n⚠️ Peringatan: Menghapus penyesuaian ini akan menyebabkan sisa saldo cuti menjadi negatif!"
      : "";

    if (!confirm(`Apakah Anda yakin ingin menghapus penyesuaian saldo ini?${warningMsg}`)) {
      return;
    }

    setIsDeletingId(id);
    setActionError(null);

    try {
      const res = await deleteAdjustment(id);
      if (res?.error) {
        setActionError(res.error);
      }
    } catch (err: any) {
      setActionError(err.message || "Gagal menghapus penyesuaian.");
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAdj(null);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "CYCLE_START":
        return <Play size={12} style={{ color: "var(--color-success)" }} />;
      case "ACCRUAL":
        return <Plus size={12} style={{ color: "var(--color-success)" }} />;
      case "LEAVE":
        return <Minus size={12} style={{ color: "var(--color-danger)" }} />;
      case "CUTI_BERSAMA":
        return <Calendar size={12} style={{ color: "var(--color-accent)" }} />;
      case "ADJUSTMENT":
        return <Sliders size={12} style={{ color: "var(--color-info)" }} />;
      default:
        return null;
    }
  };

  const getEventClass = (type: string) => {
    switch (type) {
      case "CYCLE_START":
      case "ACCRUAL":
        return "event-success";
      case "LEAVE":
        return "event-danger";
      case "CUTI_BERSAMA":
        return "event-accent";
      case "ADJUSTMENT":
        return "event-info";
      default:
        return "";
    }
  };

  return (
    <div className="ledger-timeline-container">
      {/* Top Metrics Panel */}
      <div className="card-outer mb-6">
        <div className="card-inner" style={{ padding: "var(--space-5)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <span className="text-muted text-xs font-semibold uppercase tracking-wider">
                Status Saldo Saat Ini
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    fontSize: "var(--text-3xl)",
                    fontWeight: 800,
                    color: currentBalance < 0 ? "var(--color-danger)" : "var(--color-primary)",
                  }}
                >
                  {currentBalance.toFixed(1)}
                </span>
                <span className="text-sm text-muted font-medium">Hari Kerja</span>
              </div>
              <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                Terhitung dari {formatDateString(quota.cycleStart)} s/d hari ini
              </p>
            </div>

            {/* Progress Bar Visualizer */}
            <div style={{ flex: 1, minWidth: "220px", maxWidth: "340px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  marginBottom: 6,
                }}
              >
                <span className="font-semibold text-muted">Akurasi Penggunaan</span>
                <span className="font-bold">
                  Sisa {currentBalance.toFixed(1)} / {quota.totalDays} H
                </span>
              </div>
              <div className="quota-bar-track" style={{ height: 8, borderRadius: 4 }}>
                <div
                  className="quota-bar-fill"
                  style={{
                    height: "100%",
                    borderRadius: 4,
                    width: `${Math.min(100, Math.max(0, (currentBalance / quota.totalDays) * 100))}%`,
                    background:
                      currentBalance < 0
                        ? "var(--color-danger)"
                        : currentBalance <= 2
                        ? "var(--color-warning)"
                        : "var(--color-primary)",
                  }}
                />
              </div>
            </div>

            {/* Admin trigger button */}
            {isAdmin && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn btn-primary btn-sm"
                style={{ alignSelf: "center", height: 38, gap: 6 }}
              >
                <Plus size={16} /> Penyesuaian Saldo
              </button>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div
          className="mb-4"
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-danger)",
            backgroundColor: "var(--color-danger-light)",
            padding: "10px var(--space-4)",
            borderRadius: "var(--radius-sm)",
            fontWeight: 500,
            border: "1px solid rgba(220, 38, 26, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={14} />
          {actionError}
        </div>
      )}

      {/* Timeline Rows */}
      <div className="card-outer">
        <div className="card-inner" style={{ padding: "var(--space-6) var(--space-6) var(--space-8) var(--space-6)" }}>
          <h3 className="card-title mb-6" style={{ fontSize: "var(--text-base)" }}>
            Linimasa Transaksi Saldo Cuti
          </h3>

          {entries.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">
              Belum ada aktivitas saldo tercatat untuk siklus ini.
            </p>
          ) : (
            <div className="timeline-wrapper">
              {entries.map((entry, index) => {
                const daysFormatted = entry.days > 0 
                  ? `+${entry.days.toFixed(1)}` 
                  : entry.days < 0 
                  ? `${entry.days.toFixed(1)}` 
                  : "0.0";

                const isAdjustment = entry.type === "ADJUSTMENT";
                const isDeleting = isDeletingId === entry.adjustmentId;

                return (
                  <div key={entry.id} className="timeline-item">
                    {/* Date Block */}
                    <div className="timeline-date-col">
                      <span className="timeline-date-text">
                        {formatDateString(entry.date)}
                      </span>
                    </div>

                    {/* Badge & Line Connector */}
                    <div className="timeline-node-col">
                      <div className={`timeline-node ${getEventClass(entry.type)}`}>
                        {getEventIcon(entry.type)}
                      </div>
                      {index < entries.length - 1 && (
                        <div className="timeline-connector" />
                      )}
                    </div>

                    {/* Content Block */}
                    <div className="timeline-content-card">
                      <div className="timeline-content-header">
                        <div>
                          <span className="timeline-item-label">{entry.label}</span>
                          {entry.meta && (
                            <span className="timeline-item-meta">{entry.meta}</span>
                          )}
                        </div>

                        {/* Transaction delta display */}
                        <div style={{ textAlign: "right" }}>
                          <span
                            className={`timeline-delta-badge ${
                              entry.days > 0
                                ? "delta-positive"
                                : entry.days < 0
                                ? "delta-negative"
                                : "delta-neutral"
                            }`}
                          >
                            {daysFormatted} Hari
                          </span>
                          <div className="timeline-running-balance">
                            Saldo: {entry.balance.toFixed(1)} H
                          </div>
                        </div>
                      </div>

                      {/* Admin actions for manual adjustments */}
                      {isAdmin && isAdjustment && entry.adjustmentId && (
                        <div className="timeline-actions">
                          <button
                            disabled={isDeleting}
                            onClick={() => handleEditClick(entry)}
                            className="timeline-action-btn edit-btn"
                          >
                            <Edit2 size={12} />
                            Ubah
                          </button>
                          <button
                            disabled={isDeleting}
                            onClick={() => handleDeleteClick(entry.adjustmentId!, entry.days)}
                            className="timeline-action-btn delete-btn"
                          >
                            {isDeleting ? (
                              <>
                                <Clock size={12} className="animate-spin" />
                                Menghapus...
                              </>
                            ) : (
                              <>
                                <Trash2 size={12} />
                                Hapus
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal adjustment */}
      {isAdmin && (
        <AdjustmentFormModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          quotaId={quotaId}
          userId={userId}
          initialData={editingAdj}
        />
      )}

      {/* Local custom Vanilla CSS styles using variables */}
      <style jsx global>{`
        .ledger-timeline-container {
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        .timeline-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          padding-left: 2px;
        }

        .timeline-item {
          display: grid;
          grid-template-columns: 120px 32px 1fr;
          align-items: start;
          transition: transform var(--transition-spring-fast);
        }

        .timeline-item:hover {
          transform: translateY(-2px);
        }

        .timeline-date-col {
          display: flex;
          align-items: center;
          height: 32px;
          padding-right: var(--space-3);
        }

        .timeline-date-text {
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--color-text-muted);
          text-align: right;
          width: 100%;
        }

        .timeline-node-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          position: relative;
        }

        .timeline-node {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-bg-card);
          border: 2px solid var(--color-border);
          box-shadow: var(--shadow-sm);
          z-index: 2;
          transition: transform var(--transition-fast);
        }

        .timeline-item:hover .timeline-node {
          transform: scale(1.1);
        }

        .event-success {
          border-color: var(--color-success);
          background-color: var(--color-success-light);
        }

        .event-danger {
          border-color: var(--color-danger);
          background-color: var(--color-danger-light);
        }

        .event-accent {
          border-color: var(--color-accent);
          background-color: var(--color-accent-light);
        }

        .event-info {
          border-color: var(--color-info);
          background-color: var(--color-info-light);
        }

        .timeline-connector {
          position: absolute;
          top: 32px;
          bottom: -16px; /* overlapping length to connect to next row */
          width: 2px;
          background: var(--color-border);
          z-index: 1;
        }

        .timeline-content-card {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          box-shadow: var(--shadow-sm);
        }

        .timeline-content-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .timeline-item-label {
          font-size: var(--text-sm);
          font-weight: 700;
          color: var(--color-text);
          display: block;
        }

        .timeline-item-meta {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-top: 2px;
          display: block;
          line-height: 1.4;
        }

        .timeline-delta-badge {
          font-size: var(--text-xs);
          font-weight: 700;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          display: inline-block;
        }

        .delta-positive {
          color: var(--color-success);
          background: var(--color-success-light);
        }

        .delta-negative {
          color: var(--color-danger);
          background: var(--color-danger-light);
        }

        .delta-neutral {
          color: var(--color-text-muted);
          background: var(--color-border);
        }

        .timeline-running-balance {
          font-size: 10px;
          font-weight: 600;
          color: var(--color-text-light);
          margin-top: 4px;
        }

        .timeline-actions {
          display: flex;
          gap: 12px;
          border-top: 1px dashed var(--color-border);
          padding-top: var(--space-2);
          margin-top: 2px;
        }

        .timeline-action-btn {
          background: none;
          border: none;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .edit-btn {
          color: var(--color-info);
        }

        .edit-btn:hover {
          color: var(--color-primary);
          background: var(--color-info-light);
        }

        .delete-btn {
          color: var(--color-danger);
        }

        .delete-btn:hover {
          color: #b91c1c;
          background: var(--color-danger-light);
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @media (max-width: 640px) {
          .timeline-item {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .timeline-date-col {
            height: auto;
            padding-right: 0;
          }

          .timeline-date-text {
            text-align: left;
          }

          .timeline-node-col {
            display: none; /* Hide node dots on small layouts if it gets messy */
          }

          .timeline-item {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

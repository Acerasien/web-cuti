"use client";

import { useState, useEffect } from "react";
import { FileDown, X, Loader2, AlertCircle } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { LeavePdfTemplate } from "@/lib/leavePdfTemplate";

interface SignatoryUser {
  id: string;
  name: string;
  level: string | null;
  position: string | null;
  department: string | null;
}

interface LeaveSegment {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
}

interface LeaveData {
  id: string;
  reason: string;
  createdAt: string;
  status: string;
  user: {
    name: string;
    nik: string | null;
    position: string | null;
    department: string | null;
    level: string | null;
    lokasiKerja: string | null;
    namaAtasan: string | null;
    subCompany: {
      name: string;
      code: string | null;
    } | null;
  };
  segments: LeaveSegment[];
}

interface ExportPdfButtonProps {
  leave: LeaveData;
  userId: string;
}

export function ExportPdfButton({ leave, userId }: ExportPdfButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingSignatories, setLoadingSignatories] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [disetujuiList, setDisetujuiList] = useState<SignatoryUser[]>([]);
  const [diterimaList, setDiterimaList] = useState<SignatoryUser[]>([]);

  const [selectedDisetujuiId, setSelectedDisetujuiId] = useState("");
  const [selectedDiterimaId, setSelectedDiterimaId] = useState("");

  const [generating, setGenerating] = useState(false);

  // Preview States
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [renderingPreview, setRenderingPreview] = useState(false);

  const handleOpenModal = async () => {
    setIsOpen(true);
    setLoadingSignatories(true);
    setError(null);
    setPdfUrl(null);
    try {
      const res = await fetch(`/api/employees/signatories?userId=${userId}`);
      if (!res.ok) throw new Error("Gagal mengambil data penandatangan");
      const data = await res.json();
      setDisetujuiList(data.disetujuiOleh || []);
      setDiterimaList(data.diterimaOleh || []);

      // Auto-select first item if available
      if (data.disetujuiOleh?.length > 0) {
        setSelectedDisetujuiId(data.disetujuiOleh[0].id);
      }
      if (data.diterimaOleh?.length > 0) {
        setSelectedDiterimaId(data.diterimaOleh[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan koneksi server");
    } finally {
      setLoadingSignatories(false);
    }
  };

  const handleCloseModal = () => {
    if (!generating) {
      setIsOpen(false);
      setError(null);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    }
  };

  // Generate preview when options change
  useEffect(() => {
    if (!isOpen || !selectedDisetujuiId || !selectedDiterimaId || loadingSignatories) return;

    let active = true;
    const generatePreview = async () => {
      setRenderingPreview(true);
      try {
        const selectedDisetujui = disetujuiList.find((u) => u.id === selectedDisetujuiId);
        const selectedDiterima = diterimaList.find((u) => u.id === selectedDiterimaId);

        const disetujuiName = selectedDisetujui?.name || "—";
        const diterimaName = selectedDiterima?.name || "—";

        const formattedToday = new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        const doc = (
          <LeavePdfTemplate
            leave={leave}
            disetujuiName={disetujuiName}
            diterimaName={diterimaName}
            exportDate={formattedToday}
          />
        );

        const blob = await pdf(doc).toBlob();
        if (active) {
          const url = URL.createObjectURL(blob);
          setPdfUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        }
      } catch (err) {
        console.error("Gagal membuat pratinjau PDF:", err);
      } finally {
        if (active) setRenderingPreview(false);
      }
    };

    const timer = setTimeout(() => {
      generatePreview();
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, selectedDisetujuiId, selectedDiterimaId, loadingSignatories, disetujuiList, diterimaList, leave]);

  const handleGeneratePdf = async () => {
    if (!selectedDisetujuiId || !selectedDiterimaId) {
      setError("Silakan pilih penandatangan yang valid");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const selectedDisetujui = disetujuiList.find((u) => u.id === selectedDisetujuiId);
      const selectedDiterima = diterimaList.find((u) => u.id === selectedDiterimaId);

      const disetujuiName = selectedDisetujui?.name || "—";
      const diterimaName = selectedDiterima?.name || "—";

      const formattedToday = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const doc = (
        <LeavePdfTemplate
          leave={leave}
          disetujuiName={disetujuiName}
          diterimaName={diterimaName}
          exportDate={formattedToday}
        />
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Formulir_Cuti_${leave.user.name.replace(/\s+/g, "_")}_${formattedToday.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsOpen(false);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    } catch (err: any) {
      console.error(err);
      setError("Gagal membuat dokumen PDF");
    } finally {
      setGenerating(false);
    }
  };

  // Clean up URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="btn btn-outline"
        style={{ display: "inline-flex", gap: 8 }}
        title="Ekspor Formulir PDF"
      >
        <FileDown size={16} /> Ekspor PDF
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-4)",
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            transition: "all 0.3s ease",
          }}
        >
          {/* Backdrop Closer */}
          <div
            style={{ position: "absolute", inset: 0 }}
            onClick={handleCloseModal}
          />

          <div
            className="card-outer animate-modal-scale"
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: 950,
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="card-inner modal-container"
              style={{
                padding: 0,
                display: "flex",
                flexDirection: "row",
                height: "600px",
                overflow: "hidden",
              }}
            >
              {/* Left Column: Form Controls */}
              <div
                style={{
                  width: "360px",
                  display: "flex",
                  flexDirection: "column",
                  padding: "var(--space-6)",
                  borderRight: "1.5px solid var(--color-border)",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <div>
                  {/* Header */}
                  <div
                    className="flex justify-between items-start mb-6"
                    style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 16 }}
                  >
                    <div>
                      <h3 className="card-title" style={{ margin: 0, fontSize: "var(--text-lg)" }}>
                        Ekspor Formulir PDF
                      </h3>
                      <p className="text-xs text-muted mt-1">
                        Silakan tentukan nama penandatangan untuk formulir cuti/izin.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      disabled={generating}
                      className="btn btn-ghost btn-sm btn-close-mobile"
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

                  {/* Error Message */}
                  {error && (
                    <div
                      className="flex items-center gap-2 mb-4 p-3 alert-danger"
                      style={{
                        borderRadius: "var(--rounded-md)",
                        fontSize: "var(--text-xs)",
                        border: "1px solid var(--color-danger)",
                      }}
                    >
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Loader */}
                  {loadingSignatories ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="animate-spin" size={24} style={{ color: "var(--color-primary)" }} />
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                        Mengambil data penandatangan...
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Select Disetujui Oleh */}
                      <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
                        <label
                          htmlFor="disetujuiSelect"
                          className="form-label required"
                          style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}
                        >
                          Disetujui Oleh (Atasan / Di Atasnya)
                        </label>
                        {disetujuiList.length === 0 ? (
                          <div className="text-xs text-muted p-2 bg-slate-50 border rounded">
                            Tidak ada kandidat penandatangan di tingkat ini.
                          </div>
                        ) : (
                          <select
                            id="disetujuiSelect"
                            className="form-select w-full"
                            value={selectedDisetujuiId}
                            onChange={(e) => setSelectedDisetujuiId(e.target.value)}
                            disabled={generating}
                            style={{ fontSize: "var(--text-sm)" }}
                          >
                            {disetujuiList.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.level || "Staff"})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Select Diterima Oleh */}
                      <div className="form-group" style={{ marginBottom: "var(--space-3)" }}>
                        <label
                          htmlFor="diterimaSelect"
                          className="form-label required"
                          style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}
                        >
                          Diterima Oleh (HRGA Department)
                        </label>
                        {diterimaList.length === 0 ? (
                          <div className="text-xs text-muted p-2 bg-slate-50 border rounded">
                            Tidak ada karyawan dengan departemen HRGA aktif.
                          </div>
                        ) : (
                          <select
                            id="diterimaSelect"
                            className="form-select w-full"
                            value={selectedDiterimaId}
                            onChange={(e) => setSelectedDiterimaId(e.target.value)}
                            disabled={generating}
                            style={{ fontSize: "var(--text-sm)" }}
                          >
                            {diterimaList.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.position || "Staff HRGA"})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div
                  className="flex justify-end gap-3 pt-4"
                  style={{ borderTop: "1.5px solid var(--color-border)" }}
                >
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleCloseModal}
                    disabled={generating}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleGeneratePdf}
                    disabled={
                      generating ||
                      !selectedDisetujuiId ||
                      !selectedDiterimaId ||
                      loadingSignatories
                    }
                    style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Membuat PDF...
                      </>
                    ) : (
                      <>
                        <FileDown size={16} />
                        Unduh PDF
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Live PDF Preview */}
              <div
                className="preview-panel"
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "var(--color-bg)",
                  padding: "var(--space-6)",
                  justifyContent: "stretch",
                  height: "100%",
                }}
              >
                <div className="flex justify-between items-center mb-3">
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--color-text-muted)" }}>
                    Pratinjau Dokumen
                  </span>
                  {renderingPreview && (
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Loader2 className="animate-spin" size={12} style={{ color: "var(--color-primary)" }} />
                      <span>Memperbarui...</span>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    flex: 1,
                    backgroundColor: "#ffffff",
                    borderRadius: "var(--radius-md)",
                    border: "1.5px solid var(--color-border)",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  {loadingSignatories ? (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-light)" }}>
                      Menunggu data penandatangan...
                    </span>
                  ) : renderingPreview && !pdfUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="animate-spin" size={20} style={{ color: "var(--color-primary)" }} />
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                        Menyiapkan pratinjau...
                      </span>
                    </div>
                  ) : pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                      }}
                      title="Pratinjau PDF"
                    />
                  ) : (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-light)" }}>
                      Pilih penandatangan untuk memuat dokumen.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animation & Responsive Styles */}
      <style jsx global>{`
        @keyframes modalScale {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-modal-scale {
          animation: modalScale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @media (max-width: 768px) {
          .modal-container {
            flex-direction: column !important;
            height: auto !important;
            max-height: 90vh !important;
          }
          .modal-container > div:first-child {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1.5px solid var(--color-border) !important;
          }
          .preview-panel {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}

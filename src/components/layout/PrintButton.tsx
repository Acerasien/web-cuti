"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn btn-outline no-print"
      style={{ display: "inline-flex", gap: 8 }}
      title="Cetak Dokumen"
    >
      <Printer size={16} /> Cetak Dokumen
    </button>
  );
}

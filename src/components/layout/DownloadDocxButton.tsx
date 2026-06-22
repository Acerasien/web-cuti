"use client";

import { FileDown } from "lucide-react";
import { useState } from "react";
import { exportLeaveToDocx } from "@/lib/docxExport";

interface DownloadDocxButtonProps {
  data: any;
  reviewerName: string;
}

export function DownloadDocxButton({ data, reviewerName }: DownloadDocxButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await exportLeaveToDocx(data, reviewerName);
    } catch (error) {
      console.error("Failed to generate docx:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className="btn btn-outline"
      style={{ display: "inline-flex", gap: 8 }}
      title="Unduh Word (DOCX)"
    >
      <FileDown size={16} /> {isDownloading ? "Mengunduh..." : "Unduh DOCX"}
    </button>
  );
}

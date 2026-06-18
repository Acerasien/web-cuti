"use client";

import { FileDown } from "lucide-react";
import { useState } from "react";
import { exportExcuseToDocx, exportLeaveToDocx } from "@/lib/docxExport";

interface DownloadDocxButtonProps {
  type: "leave" | "excuse";
  data: any;
  reviewerName: string;
}

export function DownloadDocxButton({ type, data, reviewerName }: DownloadDocxButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      if (type === "leave") {
        await exportLeaveToDocx(data, reviewerName);
      } else {
        await exportExcuseToDocx(data, reviewerName);
      }
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

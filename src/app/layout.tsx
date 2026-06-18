import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";

export const metadata: Metadata = {
  title: {
    default: "Web Cuti — Manajemen Cuti Karyawan",
    template: "%s | Web Cuti",
  },
  description:
    "Sistem manajemen cuti dan izin karyawan perusahaan. Kelola cuti tahunan, cuti khusus, dan izin dengan mudah.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

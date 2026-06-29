import type { Metadata } from "next";
import { PageWrapper } from "@/components/layout/PageWrapper";

export const metadata: Metadata = {
  title: "Audit Logs & Compliance",
};

export default function AuditLogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageWrapper title="Audit Logs">{children}</PageWrapper>;
}

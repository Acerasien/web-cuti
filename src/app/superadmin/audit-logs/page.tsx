import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AuditActionType } from "@prisma/client";
import { AuditLogsClient } from "./AuditLogsClient";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const PAGE_SIZE = 25;

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // Guard: Only SUPERADMIN is allowed to view audit logs
  if (session.user.role !== "SUPERADMIN") {
    redirect("/dashboard");
  }

  const resolvedParams = await searchParams;

  const q = resolvedParams.q as string | undefined;
  const actionTypeParam = resolvedParams.actionType as string | undefined;
  const startParam = resolvedParams.start as string | undefined;
  const endParam = resolvedParams.end as string | undefined;
  const pageParam = resolvedParams.page as string | undefined;

  const currentPage = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;

  // Build Prisma filter clause
  const whereClause: any = {};

  if (q && q.trim() !== "") {
    const searchTerms = q.trim();
    whereClause.OR = [
      { actorName: { contains: searchTerms, mode: "insensitive" } },
      { targetName: { contains: searchTerms, mode: "insensitive" } },
      { description: { contains: searchTerms, mode: "insensitive" } },
    ];
  }

  if (actionTypeParam && actionTypeParam !== "ALL") {
    whereClause.actionType = actionTypeParam as AuditActionType;
  }

  const dateFilter: any = {};
  if (startParam) {
    dateFilter.gte = new Date(startParam);
  }
  if (endParam) {
    dateFilter.lte = new Date(`${endParam}T23:59:59.999Z`);
  }
  if (startParam || endParam) {
    whereClause.createdAt = dateFilter;
  }

  // Count total matching logs
  const totalCount = await prisma.auditLog.count({ where: whereClause });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  // Fetch logs
  const logs = await prisma.auditLog.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // Get list of action types for filter dropdown
  const actionTypes = Object.values(AuditActionType) as string[];

  // Serialize logs for Client Component (ensuring dates/JSON fields are converted to plain types)
  const serializedLogs = logs.map((log: any) => ({
    id: log.id,
    actionType: log.actionType,
    description: log.description,
    actorId: log.actorId,
    actorName: log.actorName,
    targetId: log.targetId,
    targetName: log.targetName,
    beforeState: log.beforeState || null,
    afterState: log.afterState || null,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  }));

  return (
    <AuditLogsClient
      initialLogs={serializedLogs}
      actionTypes={actionTypes}
      totalCount={totalCount}
      totalPages={totalPages}
      currentPage={safePage}
      filters={{
        q: q || "",
        actionType: actionTypeParam || "ALL",
        start: startParam || "",
        end: endParam || "",
      }}
    />
  );
}

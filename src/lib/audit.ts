import { prisma } from "@/lib/prisma";
import { AuditActionType } from "@prisma/client";
import { headers } from "next/headers";

interface AuditLogOptions {
  actionType: AuditActionType;
  description: string;
  actorId?: string | null;
  actorName?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  req?: Request;
}

export async function logAuditEvent(options: AuditLogOptions) {
  try {
    let ipAddress = "unknown";
    let userAgent = "unknown";

    if (options.req) {
      ipAddress = options.req.headers.get("x-forwarded-for") || "unknown";
      userAgent = options.req.headers.get("user-agent") || "unknown";
    } else {
      try {
        const headersList = await headers();
        ipAddress = headersList.get("x-forwarded-for") || "unknown";
        userAgent = headersList.get("user-agent") || "unknown";
      } catch {
        // Safe fallback if headers() is called in a context where it's not available
        // (e.g. background tasks or build-time pre-rendering)
      }
    }

    // Split multiple IPs if present in x-forwarded-for
    if (ipAddress && ipAddress.includes(",")) {
      ipAddress = ipAddress.split(",")[0].trim();
    }

    await prisma.auditLog.create({
      data: {
        actionType: options.actionType,
        description: options.description,
        actorId: options.actorId || null,
        actorName: options.actorName || null,
        targetId: options.targetId || null,
        targetName: options.targetName || null,
        beforeState: options.beforeState !== undefined ? (options.beforeState as any) : null,
        afterState: options.afterState !== undefined ? (options.afterState as any) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Fail-safe wrapper to ensure primary actions aren't interrupted by logging failures
    console.error("Fail-safe: Failed to log audit event:", error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const secret = process.env.CRON_SECRET;

    if (!secret) {
      console.error("CRON_SECRET is not defined in environment variables.");
      return NextResponse.json({ error: "Configuration error." }, { status: 500 });
    }

    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: oneYearAgo,
        },
      },
    });

    if (result.count > 0) {
      await logAuditEvent({
        actionType: "SETTING_UPDATE",
        description: `System cron: Pruned ${result.count} expired audit logs older than 1 year (older than ${oneYearAgo.toLocaleDateString("id-ID")})`,
        actorId: "system-cron",
        actorName: "System Cron Service",
      });
    }

    return NextResponse.json({ success: true, deletedCount: result.count });
  } catch (error: any) {
    console.error("Cron audit-cleanup error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

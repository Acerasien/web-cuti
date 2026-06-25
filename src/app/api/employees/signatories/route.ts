import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HIERARCHY_RANKS } from "@/lib/hierarchy";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const employee = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        atasanId: true,
        atasan: {
          select: {
            id: true,
            level: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const atasanLevel = employee.atasan?.level;
    const atasanRank = atasanLevel ? (HIERARCHY_RANKS[atasanLevel] || 0) : 0;

    // Fetch active users
    const activeUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        id: {
          notIn: [userId, employee.atasanId].filter((id): id is string => !!id),
        },
      },
      select: {
        id: true,
        name: true,
        level: true,
        department: true,
        position: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    // Disetujui Oleh: ADMIN/SUPERADMIN, or any user whose level rank >= direct supervisor's level rank
    const disetujuiOleh = activeUsers.filter((u) => {
      if (u.role === "ADMIN" || u.role === "SUPERADMIN") return true;
      const userRank = u.level ? (HIERARCHY_RANKS[u.level] || 0) : 0;
      const targetRank = atasanRank > 0 ? atasanRank : 2; // Default to Staff - Foreman (rank 2) if no supervisor
      return userRank >= targetRank;
    });

    // Diterima Oleh: users in HRGA department (case-insensitive check)
    const diterimaOleh = activeUsers.filter((u) => {
      const dept = u.department?.toLowerCase() || "";
      return (
        dept.includes("hrga") ||
        dept.includes("hr-ga") ||
        dept.includes("hr/ga") ||
        dept === "hr" ||
        dept === "ga"
      );
    });

    return NextResponse.json({
      disetujuiOleh,
      diterimaOleh,
    });
  } catch (error: any) {
    console.error("Error in signatories endpoint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HIERARCHY_RANKS } from "@/lib/hierarchy";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Diketahui Oleh: active users whose level is exactly the same as the employee's direct supervisor's level
    let diketahuiOleh: typeof activeUsers = [];
    if (employee.atasanId) {
      const supervisor = await prisma.user.findUnique({
        where: { id: employee.atasanId },
        select: { id: true, name: true, level: true, position: true, department: true, role: true },
      });
      if (supervisor) {
        if (supervisor.level) {
          diketahuiOleh = await prisma.user.findMany({
            where: {
              isActive: true,
              level: supervisor.level,
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
        } else {
          diketahuiOleh = [supervisor];
        }
      }
    } else {
      // Fallback: active users with rank >= 2 (Foreman and above)
      diketahuiOleh = await prisma.user.findMany({
        where: {
          isActive: true,
          level: {
            in: Object.keys(HIERARCHY_RANKS).filter((lvl) => HIERARCHY_RANKS[lvl] >= 2),
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
    }

    return NextResponse.json({
      diketahuiOleh,
      disetujuiOleh,
      diterimaOleh,
    });
  } catch (error: any) {
    console.error("Error in signatories endpoint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

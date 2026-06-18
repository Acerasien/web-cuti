"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RequestStatus } from "@prisma/client";

export async function getCalendarEvents(startDateInput?: string, endDateInput?: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Session expired. Please log in again." };
    }

    const currentRole = session.user.role;
    const isKaryawan = currentRole === "KARYAWAN";

    let start = startDateInput ? new Date(startDateInput) : new Date();
    let end = endDateInput ? new Date(endDateInput) : new Date();

    if (!startDateInput || !endDateInput) {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    // Query APPROVED leave requests that overlap with the range
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        status: RequestStatus.APPROVED,
        AND: [
          { startDate: { lte: end } },
          { endDate: { gte: start } },
        ],
      },
      include: {
        user: {
          select: {
            name: true,
            role: true,
            department: true,
            subCompanyId: true,
            subCompany: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Query APPROVED excuse requests that overlap with the range
    const excuseRequests = await prisma.excuseRequest.findMany({
      where: {
        status: RequestStatus.APPROVED,
        AND: [
          { dateFrom: { lte: end } },
          { dateTo: { gte: start } },
        ],
      },
      include: {
        user: {
          select: {
            name: true,
            role: true,
            department: true,
            subCompanyId: true,
            subCompany: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Map leave requests to unified event schema
    const mappedLeaves = leaveRequests.map((req) => ({
      id: req.id,
      userId: req.userId,
      userName: req.user.name,
      department: req.user.department || "Tidak Ada Departemen",
      subCompanyId: req.user.subCompanyId || "no-subcompany",
      subCompanyName: req.user.subCompany?.name || "Tidak Ada Unit Bisnis",
      category: "LEAVE",
      type: req.leaveType,
      startDate: req.startDate.toISOString().substring(0, 10),
      endDate: req.endDate.toISOString().substring(0, 10),
      totalDays: req.totalDays,
      reason: isKaryawan ? null : req.reason,
      attachmentUrl: isKaryawan ? null : req.attachmentUrl,
    }));

    // Map excuse requests to unified event schema
    const mappedExcuses = excuseRequests.map((req) => ({
      id: req.id,
      userId: req.userId,
      userName: req.user.name,
      department: req.user.department || "Tidak Ada Departemen",
      subCompanyId: req.user.subCompanyId || "no-subcompany",
      subCompanyName: req.user.subCompany?.name || "Tidak Ada Unit Bisnis",
      category: "EXCUSE",
      type: req.excuseType,
      startDate: req.dateFrom.toISOString().substring(0, 10),
      endDate: req.dateTo.toISOString().substring(0, 10),
      totalDays: Number(req.totalDays || 0),
      reason: isKaryawan ? null : req.reason,
      attachmentUrl: isKaryawan ? null : req.attachmentUrl,
    }));

    const events = [...mappedLeaves, ...mappedExcuses];

    return { events };
  } catch (error: any) {
    console.error("Error fetching calendar events:", error);
    return { error: "Internal server error fetching calendar data." };
  }
}

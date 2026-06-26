import { prisma } from "@/lib/prisma";

export type LedgerEntryType =
  | "CYCLE_START"
  | "ACCRUAL"
  | "LEAVE"
  | "CUTI_BERSAMA"
  | "ADJUSTMENT";

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  date: Date;
  days: number;
  label: string;
  meta?: string;
  adjustmentId?: string;
  balance: number;
}

export async function buildLedgerTimeline(
  userId: string,
  quotaId: string
): Promise<{
  quota: {
    cycleStart: Date;
    cycleEnd: Date;
    totalDays: number;
  };
  entries: LedgerEntry[];
}> {
  const quota = await prisma.annualLeaveQuota.findUnique({
    where: { id: quotaId },
  });

  if (!quota) {
    throw new Error("Kuota tahunan tidak ditemukan.");
  }

  const cycleStart = new Date(quota.cycleStart);
  const cycleEnd = new Date(quota.cycleEnd);
  const now = new Date();
  const limitDate = now < cycleEnd ? now : cycleEnd;

  const entries: Omit<LedgerEntry, "balance">[] = [];

  // 1. CYCLE_START
  entries.push({
    id: `cycle-start-${quota.id}`,
    type: "CYCLE_START",
    date: cycleStart,
    days: 0,
    label: "Awal Siklus Kuota Cuti",
    meta: `Alokasi maksimal: ${quota.totalDays} Hari`,
  });

  // 2. ACCRUALS (Monthly Completed Month Accrual)
  const maxAccrualLimit = quota.totalDays;
  for (let i = 1; i <= maxAccrualLimit; i++) {
    const anniversary = new Date(
      cycleStart.getFullYear(),
      cycleStart.getMonth() + i,
      cycleStart.getDate()
    );
    if (anniversary <= limitDate) {
      entries.push({
        id: `accrual-${quota.id}-${i}`,
        type: "ACCRUAL",
        date: anniversary,
        days: 1,
        label: `Akrual Bulanan (Bulan ke-${i})`,
      });
    }
  }

  // 3. LEAVE SEGMENTS (Approved Cuti Tahunan only)
  const leaveSegments = await prisma.leaveSegment.findMany({
    where: {
      annualQuotaId: quotaId,
      leaveType: "CUTI_TAHUNAN",
      leaveRequest: {
        userId,
        status: "APPROVED",
      },
    },
    include: {
      leaveRequest: true,
    },
  });

  leaveSegments.forEach((segment) => {
    entries.push({
      id: `leave-${segment.id}`,
      type: "LEAVE",
      date: new Date(segment.startDate),
      days: -Number(segment.totalDays),
      label: "Pengambilan Cuti Tahunan",
      meta: segment.leaveRequest.reason || "Tanpa keterangan",
    });
  });

  // 4. CUTI BERSAMA (Occurred during cycle)
  const cutiBersamaHolidays = await prisma.holiday.findMany({
    where: {
      isCutiBersama: true,
      date: {
        gte: cycleStart,
        lte: limitDate,
      },
    },
  });

  cutiBersamaHolidays.forEach((holiday) => {
    entries.push({
      id: `cuti-bersama-${holiday.id}`,
      type: "CUTI_BERSAMA",
      date: new Date(holiday.date),
      days: -1,
      label: "Potongan Cuti Bersama",
      meta: holiday.description,
    });
  });

  // 5. MANUAL ADJUSTMENTS
  const adjustments = await prisma.leaveAdjustment.findMany({
    where: {
      quotaId,
      userId,
    },
    include: {
      createdBy: {
        select: { name: true },
      },
    },
  });

  adjustments.forEach((adj) => {
    entries.push({
      id: `adj-${adj.id}`,
      type: "ADJUSTMENT",
      date: new Date(adj.effectiveOn),
      days: Number(adj.days),
      label: "Penyesuaian HR",
      meta: `${adj.reason} (oleh ${adj.createdBy.name})`,
      adjustmentId: adj.id,
    });
  });

  // Sort entries chronologically for computing running balance
  const sorted = entries.sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime();
    if (diff !== 0) return diff;
    const priority: Record<LedgerEntryType, number> = {
      CYCLE_START: 0,
      ACCRUAL: 1,
      ADJUSTMENT: 2,
      CUTI_BERSAMA: 3,
      LEAVE: 4,
    };
    return priority[a.type] - priority[b.type];
  });

  // Compute running balance
  let runningBalance = 0;
  const finalEntries: LedgerEntry[] = sorted.map((entry) => {
    runningBalance += entry.days;
    return {
      ...entry,
      balance: runningBalance,
    };
  });

  // Return reverse chronological order (latest first) for display
  return {
    quota: {
      cycleStart,
      cycleEnd,
      totalDays: quota.totalDays,
    },
    entries: [...finalEntries].reverse(),
  };
}

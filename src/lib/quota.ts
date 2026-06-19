import { prisma } from "@/lib/prisma";

/**
 * Checks all active Karyawan (employees) and rolls over their annual leave quota cycles
 * to the current year if their cycle has expired. Supports multiple catch-up loops
 * for older join dates.
 * 
 * @param createdByIdInput Optional ID of the Admin/Superadmin who triggered this sync.
 * @returns The total number of new quota cycles created.
 */
export async function syncAllEmployeeQuotas(createdByIdInput?: string): Promise<number> {
  let defaultDays = 12;
  try {
    const settings = await prisma.companySetting.findFirst();
    if (settings && settings.defaultAnnualDays) {
      defaultDays = settings.defaultAnnualDays;
    }
  } catch (error) {
    console.error("Error reading company settings, using fallback default 12 days:", error);
  }

  // Determine audit createdById fallback (e.g. for Cron context)
  let auditCreatedById = createdByIdInput || null;
  if (!auditCreatedById) {
    try {
      const fallbackAdmin = await prisma.user.findFirst({
        where: {
          role: { in: ["SUPERADMIN", "ADMIN"] },
          isActive: true,
        },
        select: { id: true },
      });
      if (fallbackAdmin) {
        auditCreatedById = fallbackAdmin.id;
      }
    } catch (error) {
      console.error("Error finding fallback admin user for quota audit:", error);
    }
  }

  if (!auditCreatedById) {
    throw new Error("Cannot run rollover: No active Admin/Superadmin found in the database for auditing.");
  }

  // Fetch all active KARYAWAN
  const activeKaryawan = await prisma.user.findMany({
    where: {
      role: "KARYAWAN",
      isActive: true,
    },
    select: {
      id: true,
      joinDate: true,
      name: true,
    },
  });

  let totalCyclesCreated = 0;
  const today = new Date();
  // Strip hours for UTC date comparison consistency
  const now = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

  for (const employee of activeKaryawan) {
    try {
      if (!employee.joinDate) {
        console.warn(`Skipping rollover for employee ${employee.name} (ID: ${employee.id}): joinDate is missing.`);
        continue;
      }

      // Find the latest quota cycle
      const latestQuota = await prisma.annualLeaveQuota.findFirst({
        where: { userId: employee.id },
        orderBy: { cycleEnd: "desc" },
      });

      let nextCycleStart: Date;

      if (!latestQuota) {
        // Start first cycle exactly on joinDate
        nextCycleStart = new Date(employee.joinDate);
      } else {
        // Start next cycle on the day after previous cycle ends (strictly using UTC methods to avoid timezone shift)
        const prevEnd = new Date(latestQuota.cycleEnd);
        nextCycleStart = new Date(Date.UTC(prevEnd.getUTCFullYear(), prevEnd.getUTCMonth(), prevEnd.getUTCDate() + 1));
      }

      let currentCycleStart = nextCycleStart;

      while (true) {
        // cycleEnd = currentCycleStart + 1 year - 1 day (strictly using UTC methods)
        const currentCycleEnd = new Date(currentCycleStart);
        currentCycleEnd.setUTCFullYear(currentCycleEnd.getUTCFullYear() + 1);
        currentCycleEnd.setUTCDate(currentCycleEnd.getUTCDate() - 1);

        // Keep generating cycles until the candidate cycle starts in the future (starts after today)
        if (currentCycleStart > now) {
          break;
        }

        // Create the cycle record
        await prisma.annualLeaveQuota.create({
          data: {
            userId: employee.id,
            cycleStart: currentCycleStart,
            cycleEnd: currentCycleEnd,
            totalDays: defaultDays,
            createdById: auditCreatedById,
          },
        });

        totalCyclesCreated++;

        // Advance start date of the next cycle (strictly using UTC methods)
        currentCycleStart = new Date(Date.UTC(currentCycleEnd.getUTCFullYear(), currentCycleEnd.getUTCMonth(), currentCycleEnd.getUTCDate() + 1));
      }
    } catch (error) {
      console.error(`Failed to rollover quota for employee ${employee.name} (ID: ${employee.id}):`, error);
    }
  }

  return totalCyclesCreated;
}

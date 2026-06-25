import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting to wipe all KARYAWAN records...");

  // Find all user IDs with role KARYAWAN
  const karyawanUsers = await prisma.user.findMany({
    where: { role: "KARYAWAN" },
    select: { id: true, name: true, nik: true },
  });

  const ids = karyawanUsers.map((u) => u.id);
  console.log(`Found ${ids.length} KARYAWAN users to delete:`);
  karyawanUsers.forEach(u => {
    console.log(` - ${u.name} (NIK: ${u.nik ?? "—"})`);
  });

  if (ids.length === 0) {
    console.log("No KARYAWAN users found. Nothing to delete.");
    return;
  }

  // Deleting related data in order to satisfy database relationships
  await prisma.$transaction(async (tx) => {
    // 1. Delete leave segments belonging to these users' requests
    console.log("Deleting related leave segments...");
    await tx.leaveSegment.deleteMany({
      where: {
        leaveRequest: {
          userId: { in: ids },
        },
      },
    });

    // 2. Delete leave requests
    console.log("Deleting related leave requests...");
    await tx.leaveRequest.deleteMany({
      where: {
        userId: { in: ids },
      },
    });

    // 3. Delete annual quotas
    console.log("Deleting related annual leave quotas...");
    await tx.annualLeaveQuota.deleteMany({
      where: {
        userId: { in: ids },
      },
    });

    // 4. Nullify supervisor references (atasanId) pointing to deleted users
    console.log("Nullifying supervisor references...");
    await tx.user.updateMany({
      where: {
        atasanId: { in: ids },
      },
      data: {
        atasanId: null,
        namaAtasan: null,
      },
    });

    // 5. Delete the users themselves
    console.log("Deleting users...");
    const deleteResult = await tx.user.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    console.log(`Successfully deleted ${deleteResult.count} users.`);
  });
}

main()
  .catch((e) => {
    console.error("Error running wipe script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

// Prisma Client imports for seed script
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create company settings
  const existingSettings = await prisma.companySetting.findFirst();
  if (!existingSettings) {
    await prisma.companySetting.create({
      data: {
        defaultAnnualDays: 12,
        companyName: "Perusahaan Anda",
      },
    });
    console.log("✅ Company settings created");
  }

  // Create Superadmin
  const superadminEmail = "superadmin@webcuti.com";
  const existingSuperadmin = await prisma.user.findUnique({
    where: { email: superadminEmail },
  });

  if (!existingSuperadmin) {
    const passwordHash = await bcrypt.hash("superadmin123", 12);
    await prisma.user.create({
      data: {
        name: "Super Administrator",
        email: superadminEmail,
        passwordHash,
        role: Role.SUPERADMIN,
        joinDate: new Date("2020-01-01"),
        department: "Management",
        position: "System Administrator",
      },
    });
    console.log(`✅ Superadmin created: ${superadminEmail} / superadmin123`);
  } else {
    console.log("ℹ️  Superadmin already exists, skipping");
  }

  // Create sample Admin
  const adminEmail = "admin@webcuti.com";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  let adminId = existingAdmin?.id;

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 12);
    const admin = await prisma.user.create({
      data: {
        name: "Admin HR",
        email: adminEmail,
        passwordHash,
        role: Role.ADMIN,
        joinDate: new Date("2022-03-15"),
        department: "Human Resources",
        position: "HR Manager",
      },
    });
    adminId = admin.id;
    console.log(`✅ Admin created: ${adminEmail} / admin123`);
  }

  // Create sample Karyawan
  const karyawanEmail = "karyawan@webcuti.com";
  const existingKaryawan = await prisma.user.findUnique({
    where: { email: karyawanEmail },
  });

  if (!existingKaryawan && adminId) {
    const passwordHash = await bcrypt.hash("karyawan123", 12);
    const karyawan = await prisma.user.create({
      data: {
        name: "Budi Santoso",
        email: karyawanEmail,
        passwordHash,
        role: Role.KARYAWAN,
        joinDate: new Date("2023-06-01"),
        department: "Engineering",
        position: "Software Engineer",
      },
    });
    console.log(`✅ Karyawan created: ${karyawanEmail} / karyawan123`);

    // Create annual quota for sample karyawan
    await prisma.annualLeaveQuota.create({
      data: {
        userId: karyawan.id,
        cycleStart: new Date("2023-06-01"),
        cycleEnd: new Date("2024-05-31"),
        totalDays: 12,
        createdById: adminId,
      },
    });
    console.log("✅ Annual leave quota created for Budi Santoso");
  }

  console.log("\n🎉 Seeding complete!\n");
  console.log("📋 Test accounts:");
  console.log("   Superadmin: superadmin@webcuti.com / superadmin123");
  console.log("   Admin:      admin@webcuti.com / admin123");
  console.log("   Karyawan:   karyawan@webcuti.com / karyawan123");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

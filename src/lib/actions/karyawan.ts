"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { getAccruedQuotaDays } from "@/lib/accrual";
import { isEligibleSupervisor } from "@/lib/hierarchy";

export async function createKaryawanUser(prevState: any, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir. Silakan login kembali." };
    }

    const currentUserRole = session.user.role;
    if (currentUserRole !== "SUPERADMIN" && currentUserRole !== "ADMIN") {
      return { error: "Anda tidak memiliki akses untuk menambah karyawan baru." };
    }

    // Extract form data
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const roleInput = "KARYAWAN"; // New employees are strictly KARYAWAN
    const nik = formData.get("nik") as string;
    const level = formData.get("level") as string;
    const department = formData.get("department") as string;
    const position = formData.get("position") as string;
    const lokasiKerja = formData.get("lokasiKerja") as string;
    const atasanId = formData.get("atasanId") as string || null;
    const subCompanyId = formData.get("subCompanyId") as string;
    const joinDateInput = formData.get("joinDate") as string;

    if (!name || !password || !roleInput || !joinDateInput) {
      return { error: "Kolom Nama, Password, Role, dan Tanggal Bergabung wajib diisi." };
    }

    const emailTrim = email?.trim() || null;
    const usernameTrim = username?.trim() || null;

    if (!emailTrim && !usernameTrim) {
      return { error: "Salah satu dari Email atau Username wajib diisi agar karyawan dapat login." };
    }

    // Check if email already exists
    if (emailTrim) {
      const existingUser = await prisma.user.findUnique({
        where: { email: emailTrim },
      });

      if (existingUser) {
        return { error: "Email sudah digunakan oleh akun lain." };
      }
    }

    // Check if username already exists
    if (usernameTrim) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: usernameTrim },
      });

      if (existingUsername) {
        return { error: "Username sudah digunakan oleh akun lain." };
      }
    }

    // Check unique NIK if provided
    if (nik && nik.trim() !== "") {
      const existingNik = await prisma.user.findFirst({
        where: { nik: nik.trim() },
      });
      if (existingNik) {
        return { error: "NIK sudah digunakan oleh karyawan lain." };
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const joinDate = new Date(joinDateInput);

    if (isNaN(joinDate.getTime())) {
      return { error: "Format tanggal bergabung tidak valid." };
    }

    // Find supervisor's name if atasanId is provided
    let namaAtasan: string | null = null;
    if (atasanId) {
      const supervisor = await prisma.user.findUnique({
        where: { id: atasanId },
        select: { name: true },
      });
      namaAtasan = supervisor?.name ?? null;
    }

    // Create User
    const user = await prisma.user.create({
      data: {
        name,
        email: emailTrim,
        username: usernameTrim,
        passwordHash,
        role: roleInput as Role,
        nik: nik?.trim() || null,
        level: level?.trim() || null,
        department: department?.trim() || null,
        position: position?.trim() || null,
        lokasiKerja: lokasiKerja?.trim() || null,
        namaAtasan,
        atasanId,
        subCompanyId: subCompanyId || null,
        joinDate,
        isActive: true,
      },
    });

    // Auto-create initial Annual Leave Quota for Karyawan role
    if (roleInput === "KARYAWAN" || roleInput === "ADMIN") {
      const cycleStart = new Date(joinDate);
      const cycleEnd = new Date(cycleStart);
      cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
      cycleEnd.setDate(cycleEnd.getDate() - 1);

      // Fetch default leave quota from settings
      const companySettings = await prisma.companySetting.findFirst();
      const defaultDays = companySettings?.defaultAnnualDays ?? 12;

      await prisma.annualLeaveQuota.create({
        data: {
          userId: user.id,
          cycleStart,
          cycleEnd,
          totalDays: defaultDays,
          createdById: session.user.id,
        },
      });
    }

    revalidatePath("/karyawan");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating employee user:", error);
    return { error: "Terjadi kesalahan server saat menyimpan data karyawan." };
  }
}

export async function updateKaryawanUser(userId: string, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir." };
    }

    const currentUserRole = session.user.role;
    if (currentUserRole !== "SUPERADMIN" && currentUserRole !== "ADMIN") {
      return { error: "Anda tidak memiliki akses untuk menyunting data karyawan." };
    }

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const roleInput = "KARYAWAN";
    const nik = formData.get("nik") as string;
    const level = formData.get("level") as string;
    const department = formData.get("department") as string;
    const position = formData.get("position") as string;
    const lokasiKerja = formData.get("lokasiKerja") as string;
    const atasanId = formData.get("atasanId") as string || null;
    const subCompanyId = formData.get("subCompanyId") as string;
    const joinDateInput = formData.get("joinDate") as string;
    const isActiveInput = formData.get("isActive") as string;

    if (!name || !roleInput || !joinDateInput) {
      return { error: "Kolom Nama, Role, dan Tanggal Bergabung wajib diisi." };
    }

    const emailTrim = email?.trim() || null;
    const usernameTrim = username?.trim() || null;

    if (!emailTrim && !usernameTrim) {
      return { error: "Salah satu dari Email atau Username wajib diisi agar karyawan dapat login." };
    }

    const joinDate = new Date(joinDateInput);
    if (isNaN(joinDate.getTime())) {
      return { error: "Format tanggal bergabung tidak valid." };
    }

    // Check email uniqueness if modified
    if (emailTrim) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: emailTrim,
          id: { not: userId },
        },
      });

      if (existingUser) {
        return { error: "Email sudah digunakan oleh akun lain." };
      }
    }

    // Check username uniqueness if modified
    if (usernameTrim) {
      const existingUsername = await prisma.user.findFirst({
        where: {
          username: usernameTrim,
          id: { not: userId },
        },
      });

      if (existingUsername) {
        return { error: "Username sudah digunakan oleh akun lain." };
      }
    }

    // Check unique NIK if provided
    if (nik && nik.trim() !== "") {
      const existingNik = await prisma.user.findFirst({
        where: {
          nik: nik.trim(),
          id: { not: userId },
        },
      });
      if (existingNik) {
        return { error: "NIK sudah digunakan oleh karyawan lain." };
      }
    }

    // Find supervisor's name if atasanId is provided
    let namaAtasan: string | null = null;
    if (atasanId) {
      const supervisor = await prisma.user.findUnique({
        where: { id: atasanId },
        select: { name: true },
      });
      namaAtasan = supervisor?.name ?? null;
    }

    const updateData: any = {
      name,
      email: emailTrim,
      username: usernameTrim,
      role: roleInput as Role,
      nik: nik?.trim() || null,
      level: level?.trim() || null,
      department: department?.trim() || null,
      position: position?.trim() || null,
      lokasiKerja: lokasiKerja?.trim() || null,
      namaAtasan,
      atasanId,
      subCompanyId: subCompanyId || null,
      joinDate,
      isActive: isActiveInput === "true",
    };

    if (password && password.trim() !== "") {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    revalidatePath("/karyawan");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating employee user:", error);
    return { error: "Terjadi kesalahan server saat menyimpan perubahan." };
  }
}

export async function upsertAnnualLeaveQuota(
  userId: string,
  cycleStartInput: string,
  totalDays: number
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir." };
    }

    const currentUserRole = session.user.role;
    if (currentUserRole !== "SUPERADMIN" && currentUserRole !== "ADMIN") {
      return { error: "Anda tidak memiliki akses untuk mengelola kuota cuti." };
    }

    const cycleStart = new Date(cycleStartInput);
    if (isNaN(cycleStart.getTime())) {
      return { error: "Format tanggal mulai siklus tidak valid." };
    }

    // Calculate end of cycle (1 year anniversary - 1 day)
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
    cycleEnd.setDate(cycleEnd.getDate() - 1);

    // Look for existing quota in the exact cycle start
    const existingQuota = await prisma.annualLeaveQuota.findFirst({
      where: {
        userId,
        cycleStart,
      },
    });

    if (existingQuota) {
      await prisma.annualLeaveQuota.update({
        where: { id: existingQuota.id },
        data: {
          totalDays,
          cycleEnd,
          createdById: session.user.id,
        },
      });
    } else {
      await prisma.annualLeaveQuota.create({
        data: {
          userId,
          cycleStart,
          cycleEnd,
          totalDays,
          createdById: session.user.id,
        },
      });
    }

    revalidatePath("/karyawan");
    revalidatePath("/kuota-tahunan");
    return { success: true };
  } catch (error: any) {
    console.error("Error managing annual leave quota:", error);
    return { error: "Terjadi kesalahan server saat menyimpan kuota cuti." };
  }
}

export async function getKaryawanRemainingQuota(userId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir." };
    }

    const now = new Date();
    // Find active quota cycle for user
    let activeQuota = await prisma.annualLeaveQuota.findFirst({
      where: {
        userId,
        cycleStart: { lte: now },
        cycleEnd: { gte: now },
      },
    });

    // Fallback to latest cycle
    if (!activeQuota) {
      activeQuota = await prisma.annualLeaveQuota.findFirst({
        where: { userId },
        orderBy: { cycleStart: "desc" },
      });
    }

    if (!activeQuota) {
      return { quota: null };
    }

    // Sum approved cuti tahunan segments
    const approvedSegments = await prisma.leaveSegment.aggregate({
      _sum: { totalDays: true },
      where: {
        leaveRequest: {
          userId,
          status: "APPROVED",
        },
        leaveType: "CUTI_TAHUNAN",
        annualQuotaId: activeQuota.id,
      },
    });

    const usedDays = Number(approvedSegments._sum.totalDays || 0);
    const accruedDays = getAccruedQuotaDays(activeQuota.cycleStart, activeQuota.totalDays, now);
    
    // Count Cuti Bersama days that have occurred during the active cycle
    const cutiBersamaCount = await prisma.holiday.count({
      where: {
        isCutiBersama: true,
        date: {
          gte: activeQuota.cycleStart,
          lte: now,
        },
      },
    });

    const remainingDays = accruedDays - usedDays - cutiBersamaCount;

    return {
      quota: {
        id: activeQuota.id,
        total: activeQuota.totalDays,
        accrued: accruedDays,
        used: usedDays,
        cutiBersama: cutiBersamaCount,
        remaining: remainingDays,
        cycleStart: activeQuota.cycleStart.toISOString(),
        cycleEnd: activeQuota.cycleEnd.toISOString(),
        expired: activeQuota.cycleEnd < now,
      },
    };
  } catch (error: any) {
    console.error("Error fetching employee remaining quota:", error);
    return { error: "Gagal mengambil data sisa cuti." };
  }
}

export async function deleteKaryawanUser(userId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir. Silakan login kembali." };
    }

    const currentUserRole = session.user.role;
    if (currentUserRole !== "SUPERADMIN" && currentUserRole !== "ADMIN") {
      return { error: "Anda tidak memiliki akses untuk menghapus karyawan." };
    }

    // Verify target user has role KARYAWAN
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, name: true },
    });

    if (!userToDelete) {
      return { error: "Karyawan tidak ditemukan." };
    }

    if (userToDelete.role !== "KARYAWAN") {
      return { error: "Hanya akun dengan peran Karyawan yang dapat dihapus melalui menu ini." };
    }

    // Run cascade delete transaction
    await prisma.$transaction([
      prisma.leaveRequest.deleteMany({ where: { userId } }),
      prisma.annualLeaveQuota.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    revalidatePath("/karyawan");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting employee user:", error);
    return { error: "Terjadi kesalahan server saat menghapus data karyawan." };
  }
}

function parseDDMMYYYY(dateStr: string): Date | null {
  const regex = /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/;
  const match = dateStr.trim().match(regex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed month
    const year = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
      return date;
    }
  }
  return null;
}

function normalizeDepartment(dept: string | null): string | null {
  if (!dept) return null;
  const deptLower = dept.trim().toLowerCase();
  
  const mapping: Record<string, string> = {
    hrga: "HRGA",
    production: "Production",
    engineering: "Engineering",
    hse: "HSE",
    legal: "Legal",
    fat: "FAT",
    csr: "CSR",
    plant: "Plant",
    scm: "SCM",
    management: "Management"
  };
  
  return mapping[deptLower] ?? dept.trim();
}

function normalizeLevel(lvl: string | null): string | null {
  if (!lvl) return null;
  const lvlLower = lvl.trim().toLowerCase();
  
  const mapping: Record<string, string> = {
    "non staff - clerk": "Non Staff - Skill",
    "non staff - skill": "Non Staff - Skill",
    "non staff - operator": "Non Staff - Operator",
    "non staff - mekanik": "Non Staff - Mekanik",
    "non staff - non skill": "Non Staff - Non Skill",
    "staff - superintendent": "Staff - Superintendent",
    "staff - supervisor": "Staff - Supervisor",
    "staff - foreman": "Staff - Foreman",
    "staff - manager": "Staff - Manager",
    "staff - general manager": "Staff - General Manager",
    "clerk": "Non Staff - Skill",
    "skill": "Non Staff - Skill",
    "operator": "Non Staff - Operator",
    "mekanik": "Non Staff - Mekanik",
    "non skill": "Non Staff - Non Skill",
    "superintendent": "Staff - Superintendent",
    "supervisor": "Staff - Supervisor",
    "foreman": "Staff - Foreman",
    "manager": "Staff - Manager",
    "general manager": "Staff - General Manager"
  };
  
  return mapping[lvlLower] ?? lvl.trim();
}

export async function importKaryawanAction(records: any[]) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir. Silakan login kembali." };
    }

    const currentUserRole = session.user.role;
    if (currentUserRole !== "SUPERADMIN" && currentUserRole !== "ADMIN") {
      return { error: "Anda tidak memiliki akses untuk mengimpor karyawan baru." };
    }

    if (!Array.isArray(records) || records.length === 0) {
      return { error: "Data karyawan kosong atau tidak valid." };
    }

    // Prefetch database lookups to optimize performance
    const subCompanies = await prisma.subCompany.findMany();
    const subCompanyMap = new Map<string, string>();
    for (const sc of subCompanies) {
      subCompanyMap.set(sc.name.trim().toLowerCase(), sc.id);
      if (sc.code) {
        subCompanyMap.set(sc.code.trim().toLowerCase(), sc.id);
      }
    }

    const existingUsers = await prisma.user.findMany({
      select: {
        nik: true,
        email: true,
        username: true
      }
    });

    const dbNiks = new Set(existingUsers.map(u => u.nik?.trim().toLowerCase()).filter(Boolean));
    const dbEmails = new Set(existingUsers.map(u => u.email?.trim().toLowerCase()).filter(Boolean));
    const dbUsernames = new Set(existingUsers.map(u => u.username?.trim().toLowerCase()).filter(Boolean));

    const companySettings = await prisma.companySetting.findFirst();
    const defaultDays = companySettings?.defaultAnnualDays ?? 12;

    const results = {
      successCount: 0,
      failedCount: 0,
      errors: [] as { row: number; name: string; error: string }[]
    };

    // Tracking for internal batch duplicates
    const batchNiks = new Set<string>();
    const batchEmails = new Set<string>();
    const batchUsernames = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      const rowNum = i + 2; // Excel rows are 1-indexed, headers are row 1, data starts at row 2
      const record = records[i];

      // Normalize record keys (trim and case-insensitive matching)
      const normalizedRecord: Record<string, any> = {};
      for (const key of Object.keys(record)) {
        normalizedRecord[key.trim().toLowerCase()] = record[key];
      }

      // Helper to get value case-insensitively
      const getVal = (possibleKeys: string[]): string | null => {
        for (const k of possibleKeys) {
          const val = normalizedRecord[k.toLowerCase()];
          if (val !== undefined && val !== null) {
            return String(val).trim();
          }
        }
        return null;
      };

      const name = getVal(["Nama Lengkap", "Nama", "name", "full name"]);
      const nik = getVal(["NIK", "nik", "nomor induk karyawan"]);
      const email = getVal(["Email", "email", "surel"]);
      const username = getVal(["Username", "username"]);
      const rawJoinDate = getVal(["Tanggal Bergabung (DD/MM/YYYY)", "Tanggal Bergabung (YYYY-MM-DD)", "Tanggal Bergabung", "join date", "joinDate"]);
      const subCompanyName = getVal(["Unit Bisnis", "Sub Company", "subCompany", "unit_bisnis"]);
      const rawDepartment = getVal(["Departemen", "Department", "department"]);
      const position = getVal(["Jabatan", "Position", "position", "jabatan"]);
      const rawLevel = getVal(["Level", "level"]);
      
      const department = normalizeDepartment(rawDepartment);
      const level = normalizeLevel(rawLevel);
      const lokasiKerja = getVal(["Lokasi Kerja", "Work Location", "lokasi_kerja", "lokasikerja"]);
      const password = getVal(["Password", "password", "kata sandi"]);

      const displayName = name || nik || email || username || `Baris ${rowNum}`;

      // 1. Validate required name
      if (!name) {
        results.failedCount++;
        results.errors.push({ row: rowNum, name: displayName, error: "Nama Lengkap wajib diisi." });
        continue;
      }

      // 2. Validate at least Email or Username is present
      const emailTrim = email || null;
      const usernameTrim = username || null;
      if (!emailTrim && !usernameTrim) {
        results.failedCount++;
        results.errors.push({ row: rowNum, name: displayName, error: "Salah satu dari Email or Username wajib diisi agar karyawan dapat login." });
        continue;
      }

      // 3. Validate Date
      if (!rawJoinDate) {
        results.failedCount++;
        results.errors.push({ row: rowNum, name: displayName, error: "Tanggal Bergabung wajib diisi." });
        continue;
      }

      let joinDate: Date | null = null;
      // Handle Excel serial date or standard date parsing
      if (!isNaN(Number(rawJoinDate))) {
        // Excel serial date number
        const serial = Number(rawJoinDate);
        // Excel date starts from 1900-01-01
        joinDate = new Date(Math.round((serial - 25569) * 86400 * 1000));
      } else {
        // Try parsing DD/MM/YYYY first
        joinDate = parseDDMMYYYY(rawJoinDate);
        if (!joinDate) {
          // Fallback to standard JS date parsing
          const parsed = new Date(rawJoinDate);
          if (!isNaN(parsed.getTime())) {
            joinDate = parsed;
          }
        }
      }

      if (!joinDate || isNaN(joinDate.getTime())) {
        results.failedCount++;
        results.errors.push({ row: rowNum, name: displayName, error: `Format Tanggal Bergabung tidak valid: '${rawJoinDate}'. Harap gunakan format DD/MM/YYYY.` });
        continue;
      }

      // 4. Validate unique NIK
      if (nik) {
        const nikLower = nik.toLowerCase();
        if (batchNiks.has(nikLower)) {
          results.failedCount++;
          results.errors.push({ row: rowNum, name: displayName, error: `NIK ganda '${nik}' terdeteksi di dalam file Excel.` });
          continue;
        }
        if (dbNiks.has(nikLower)) {
          results.failedCount++;
          results.errors.push({ row: rowNum, name: displayName, error: `NIK '${nik}' sudah digunakan oleh karyawan lain.` });
          continue;
        }
        batchNiks.add(nikLower);
      }

      // 5. Validate unique Email
      if (emailTrim) {
        const emailLower = emailTrim.toLowerCase();
        if (batchEmails.has(emailLower)) {
          results.failedCount++;
          results.errors.push({ row: rowNum, name: displayName, error: `Email ganda '${emailTrim}' terdeteksi di dalam file Excel.` });
          continue;
        }
        if (dbEmails.has(emailLower)) {
          results.failedCount++;
          results.errors.push({ row: rowNum, name: displayName, error: `Email '${emailTrim}' sudah digunakan oleh akun lain.` });
          continue;
        }
        batchEmails.add(emailLower);
      }

      // 6. Validate unique Username
      if (usernameTrim) {
        const usernameLower = usernameTrim.toLowerCase();
        if (batchUsernames.has(usernameLower)) {
          results.failedCount++;
          results.errors.push({ row: rowNum, name: displayName, error: `Username ganda '${usernameTrim}' terdeteksi di dalam file Excel.` });
          continue;
        }
        if (dbUsernames.has(usernameLower)) {
          results.failedCount++;
          results.errors.push({ row: rowNum, name: displayName, error: `Username '${usernameTrim}' sudah digunakan oleh akun lain.` });
          continue;
        }
        batchUsernames.add(usernameLower);
      }

      // 7. Resolve Unit Bisnis
      let subCompanyId: string | null = null;
      if (subCompanyName) {
        const matchingId = subCompanyMap.get(subCompanyName.toLowerCase());
        if (!matchingId) {
          results.failedCount++;
          results.errors.push({ row: rowNum, name: displayName, error: `Unit Bisnis '${subCompanyName}' tidak ditemukan di database.` });
          continue;
        }
        subCompanyId = matchingId;
      }

      // 8. Hash Password
      // Fallback password is NIK or Username (in that order of priority)
      const fallbackPassword = password || nik || usernameTrim;
      if (!fallbackPassword) {
        results.failedCount++;
        results.errors.push({ row: rowNum, name: displayName, error: "Password kosong dan tidak ada NIK/Username untuk password default." });
        continue;
      }
      const passwordHash = await bcrypt.hash(fallbackPassword, 12);

      // Create Employee inside a try-catch for safety
      try {
        const user = await prisma.user.create({
          data: {
            name,
            email: emailTrim,
            username: usernameTrim,
            passwordHash,
            role: "KARYAWAN",
            nik: nik || null,
            level: level || null,
            department: department || null,
            position: position || null,
            lokasiKerja: lokasiKerja || null,
            subCompanyId,
            joinDate,
            isActive: true,
          },
        });

        // Create Quota
        const cycleStart = new Date(joinDate);
        const cycleEnd = new Date(cycleStart);
        cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
        cycleEnd.setDate(cycleEnd.getDate() - 1);

        await prisma.annualLeaveQuota.create({
          data: {
            userId: user.id,
            cycleStart,
            cycleEnd,
            totalDays: defaultDays,
            createdById: session.user.id,
          },
        });

        results.successCount++;

        // Add dynamically created values to prefetch caches to support back-to-back duplicate detections (though we already checked batch sets)
        if (nik) dbNiks.add(nik.toLowerCase());
        if (emailTrim) dbEmails.add(emailTrim.toLowerCase());
        if (usernameTrim) dbUsernames.add(usernameTrim.toLowerCase());

      } catch (rowError: any) {
        console.error(`Error importing row ${rowNum}:`, rowError);
        results.failedCount++;
        results.errors.push({ row: rowNum, name: displayName, error: `Kesalahan database: ${rowError.message || "Gagal menyimpan data."}` });
      }
    }

    revalidatePath("/karyawan");
    return { success: true, results };
  } catch (error: any) {
    console.error("Error running importKaryawanAction:", error);
    return { error: "Terjadi kesalahan server saat mengimpor data karyawan." };
  }
}

export async function assignSupervisorAction(employeeIds: string[], supervisorId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir. Silakan login kembali." };
    }

    const currentUserRole = session.user.role;
    if (currentUserRole !== "SUPERADMIN" && currentUserRole !== "ADMIN") {
      return { error: "Anda tidak memiliki akses untuk mengatur hierarki karyawan." };
    }

    const supervisor = await prisma.user.findUnique({
      where: { id: supervisorId },
      select: { id: true, name: true, level: true },
    });

    if (!supervisor) {
      return { error: "Supervisor tidak ditemukan." };
    }

    const employees = await prisma.user.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, level: true },
    });

    const successIds: string[] = [];
    const failedIds: string[] = [];
    const errors: { id: string; reason: string }[] = [];

    for (const emp of employees) {
      if (!isEligibleSupervisor(emp.level, supervisor.level)) {
        failedIds.push(emp.id);
        errors.push({
          id: emp.id,
          reason: `Level supervisor (${supervisor.level || "Kosong"}) tidak lebih tinggi dari level karyawan ${emp.name} (${emp.level || "Kosong"}).`,
        });
        continue;
      }

      await prisma.user.update({
        where: { id: emp.id },
        data: {
          atasanId: supervisor.id,
          namaAtasan: supervisor.name,
        },
      });
      successIds.push(emp.id);
    }

    revalidatePath("/pengaturan");
    return { success: true, successIds, failedIds, errors };
  } catch (error: any) {
    console.error("Error in assignSupervisorAction:", error);
    return { error: "Terjadi kesalahan server saat memperbarui hierarki." };
  }
}

export async function unassignSupervisorAction(employeeId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return { error: "Sesi Anda telah berakhir. Silakan login kembali." };
    }

    const currentUserRole = session.user.role;
    if (currentUserRole !== "SUPERADMIN" && currentUserRole !== "ADMIN") {
      return { error: "Anda tidak memiliki akses untuk mengatur hierarki karyawan." };
    }

    await prisma.user.update({
      where: { id: employeeId },
      data: {
        atasanId: null,
        namaAtasan: null,
      },
    });

    revalidatePath("/pengaturan");
    return { success: true };
  } catch (error: any) {
    console.error("Error in unassignSupervisorAction:", error);
    return { error: "Terjadi kesalahan server saat menghapus supervisor." };
  }
}




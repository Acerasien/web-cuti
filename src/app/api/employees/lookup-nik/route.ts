import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nik = req.nextUrl.searchParams.get("nik");

  if (!nik || nik.trim() === "") {
    return NextResponse.json({ error: "Parameter NIK diperlukan." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { nik: nik.trim() },
    select: { id: true, name: true, nik: true },
  });

  if (!user) {
    return NextResponse.json({ error: `NIK "${nik}" tidak ditemukan dalam sistem.` }, { status: 404 });
  }

  return NextResponse.json(user);
}

import { NextRequest, NextResponse } from "next/server";
import { syncAllEmployeeQuotas } from "@/lib/quota";

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

    const cyclesCreated = await syncAllEmployeeQuotas();

    return NextResponse.json({ success: true, cyclesCreated });
  } catch (error: any) {
    console.error("Cron quota-rollover error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

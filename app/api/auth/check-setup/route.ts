import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// API route to check if setup is needed (bypasses RLS)
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: adminCount, error } = await supabase.rpc("admin_count")

    if (error) {
      console.error("[v0] Check setup error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      needsSetup: Number(adminCount ?? 0) === 0,
    })
  } catch (error: any) {
    console.error("[v0] Check setup error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

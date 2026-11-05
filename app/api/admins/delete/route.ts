import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminId } = body

    if (!adminId) {
      return NextResponse.json({ error: "Missing admin ID" }, { status: 400 })
    }

    const adminClient = getSupabaseAdminClient()

    // Delete from admins table first
    const { error: deleteError } = await adminClient
      .from("admins")
      .delete()
      .eq("id", adminId)

    if (deleteError) {
      console.error("Delete admin record error:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    // Delete from auth
    const { error: authError } = await adminClient.auth.admin.deleteUser(adminId)

    if (authError) {
      console.error("Delete auth user error:", authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting admin:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

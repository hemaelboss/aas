import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, full_name, role } = body

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const adminClient = getSupabaseAdminClient()

    // Create user in auth
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: role || "admin",
      },
    })

    if (authError) {
      console.error("Auth error:", authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Insert into admins table
    const { error: insertError } = await adminClient.from("admins").insert({
      id: authData.user.id,
      email,
      full_name,
      role: role || "admin",
    })

    if (insertError) {
      console.error("Insert error:", insertError)
      // Rollback: delete the auth user if insert fails
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, user: authData.user })
  } catch (error: any) {
    console.error("Error creating admin:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

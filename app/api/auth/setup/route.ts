import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check if any admin already exists
    const { data: existingAdmins, error: checkError } = await supabase.from("admins").select("id").limit(1)

    if (checkError) {
      console.error("[v0] Check error:", checkError)
      return NextResponse.json({ error: "فشل في التحقق من المدراء الموجودين" }, { status: 500 })
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return NextResponse.json({ error: "يوجد مدير مسجل بالفعل" }, { status: 400 })
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for first admin
    })

    if (authError) {
      console.error("[v0] Auth error:", authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: "فشل في إنشاء المستخدم" }, { status: 400 })
    }

    // Create admin record
    const { error: adminError } = await supabase.from("admins").insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      role: "super_admin",
    })

    if (adminError) {
      console.error("[v0] Admin insert error:", adminError)
      // Try to delete the auth user if admin creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: "فشل في إنشاء سجل المدير" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: "تم إنشاء حساب المدير بنجاح",
    })
  } catch (error: any) {
    console.error("[v0] Setup error:", error)
    return NextResponse.json({ error: error.message || "حدث خطأ غير متوقع" }, { status: 500 })
  }
}

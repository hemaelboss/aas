import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { SetupForm } from "@/components/setup-form"

export const metadata: Metadata = {
  title: "إعداد المدير الأول",
  description: "إنشاء حساب المدير الرئيسي",
}

export default async function SetupPage() {
  const supabase = await createServerClient()

  // Check if any auth users exist
  const { data: authData } = await supabase.auth.getSession()

  // If already logged in, redirect to dashboard
  if (authData.session) {
    redirect("/dashboard")
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/check-setup`,
      {
        cache: "no-store",
      },
    )

    if (response.ok) {
      const { needsSetup } = await response.json()

      // If admins exist but user is not logged in, redirect to login
      if (!needsSetup) {
        redirect("/auth/login")
      }
    }
  } catch (error) {
    console.error("[v0] Setup check error:", error)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">مرحباً بك!</h1>
          <p className="text-slate-600 dark:text-slate-400">إنشاء حساب المدير الرئيسي الأول</p>
        </div>
        <SetupForm />
      </div>
    </div>
  )
}

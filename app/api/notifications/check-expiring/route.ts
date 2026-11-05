import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient()

    // Get customers expiring in the next 3 days
    const today = new Date()
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(today.getDate() + 3)

    const { data: expiringCustomers, error } = await supabase
      .from("customers")
      .select("*")
      .eq("status", "active")
      .eq("auto_notifications", true)
      .gte("end_date", today.toISOString().split("T")[0])
      .lte("end_date", threeDaysFromNow.toISOString().split("T")[0])

    if (error) throw error

    // Send expiry notifications
    const results = []
    for (const customer of expiringCustomers || []) {
      if (customer.email) {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/notifications/send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_id: customer.id,
              type: "subscription_expiry",
            }),
          },
        )

        results.push({
          customer_id: customer.id,
          success: response.ok,
        })
      }
    }

    return NextResponse.json({
      message: "Expiry notifications processed",
      results,
    })
  } catch (error: any) {
    console.error("Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

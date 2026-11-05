import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import {
  sendEmail,
  getSubscriptionStartEmailTemplate,
  getSubscriptionExpiryEmailTemplate,
  getSubscriptionRenewalEmailTemplate,
} from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const { customer_id, type } = await request.json()

    const supabase = await getSupabaseServerClient()

    // Get customer and account data
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*, accounts(*)")
      .eq("id", customer_id)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Check if auto_notifications is enabled
    if (!customer.auto_notifications) {
      return NextResponse.json({ message: "Auto notifications disabled for this customer" }, { status: 200 })
    }

    // Check if customer has email
    if (!customer.email) {
      return NextResponse.json({ error: "Customer email not found" }, { status: 400 })
    }

    let subject = ""
    let html = ""

    // Generate email based on type
    if (type === "subscription_start") {
      subject = "تم تفعيل اشتراكك بنجاح"
      html = getSubscriptionStartEmailTemplate(customer.name, customer.accounts.name, customer.end_date)
    } else if (type === "subscription_expiry") {
      subject = "تنبيه: اشتراكك على وشك الانتهاء"
      html = getSubscriptionExpiryEmailTemplate(customer.name, customer.accounts.name, customer.end_date)
    } else if (type === "subscription_renewal") {
      subject = "تم تجديد اشتراكك بنجاح"
      html = getSubscriptionRenewalEmailTemplate(customer.name, customer.accounts.name, customer.end_date)
    }

    // Send email
    try {
      await sendEmail({
        to: customer.email,
        subject,
        html,
      })

      // Log notification
      await supabase.from("notification_logs").insert({
        customer_id,
        notification_type: type,
        email_sent: true,
        sent_at: new Date().toISOString(),
      })

      return NextResponse.json({ message: "Email sent successfully" }, { status: 200 })
    } catch (emailError: any) {
      // Log error
      await supabase.from("notification_logs").insert({
        customer_id,
        notification_type: type,
        email_sent: false,
        error_message: emailError.message,
      })

      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

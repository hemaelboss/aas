import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

// Helper function to fetch all records with pagination
async function fetchAllRecords(supabase: any, tableName: string) {
  const allRecords: any[] = []
  let page = 0
  const pageSize = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("created_at", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) throw error
    if (data && data.length > 0) {
      allRecords.push(...data)
      page++
      hasMore = data.length === pageSize
    } else {
      hasMore = false
    }
  }
  return allRecords
}

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()

    // Get all customers with pagination
    const customers = await fetchAllRecords(supabase, "customers")

    // Get all renewals with pagination
    let renewals: any[] = []
    try {
      renewals = await fetchAllRecords(supabase, "renewals")
    } catch (renewalsError) {
      console.error("[v0] Error fetching renewals:", renewalsError)
    }

    // Process data to get monthly statistics for the last 12 months
    const monthlyStats: Record<string, any> = {}
    // Use UTC date to ensure consistency across timezones
    const now = new Date()
    const currentYear = now.getUTCFullYear()
    const currentMonth = now.getUTCMonth()
    
    // Initialize last 12 months including current month
    for (let i = 11; i >= 0; i--) {
      const date = new Date(Date.UTC(currentYear, currentMonth - i, 1))
      const monthKey = date.toISOString().slice(0, 7) // YYYY-MM format
      monthlyStats[monthKey] = {
        month: monthKey,
        monthName: date.toLocaleDateString("ar-SA", { month: "long", year: "numeric" }),
        newSubscriptions: 0,
        renewals: 0,
        expired: 0,
        newRevenue: 0,
        renewalRevenue: 0,
        activeCount: 0,
      }
    }

    // Process customers for new subscriptions and calculate monthly revenue
    customers?.forEach((customer) => {
      const customerStartDate = new Date(customer.start_date)
      const customerEndDate = new Date(customer.end_date)
      const customerPrice = customer.price || 0

      // Count only first-time customer records. Renewals update start_date,
      // so start_date must never be used to classify a subscription as new.
      const createdMonth = customer.created_at?.slice(0, 7)
      if (createdMonth && monthlyStats[createdMonth]) {
        monthlyStats[createdMonth].newSubscriptions++
        monthlyStats[createdMonth].newRevenue += customerPrice
      }

      // Count expired subscriptions based on end_date (only if already expired)
      const today = new Date()
      if (customerEndDate < today) {
        const expiredMonth = customer.end_date.slice(0, 7)
        if (monthlyStats[expiredMonth]) {
          monthlyStats[expiredMonth].expired++
        }
      }

      // Calculate revenue and active count for each month the subscription was active
      Object.keys(monthlyStats).forEach((monthKey) => {
        const [year, month] = monthKey.split("-").map(Number)
        const monthStart = new Date(Date.UTC(year, month - 1, 1))
        const monthEnd = new Date(Date.UTC(year, month, 0))

        // Check if subscription was active during this month
        if (customerStartDate <= monthEnd && customerEndDate >= monthStart) {
          monthlyStats[monthKey].activeCount++
        }
      })
    })

    // Process renewals with their revenue (remove duplicates per customer per month)
    const processedRenewals = new Map<string, any>() // key: "customer_id-month"
    
    renewals?.forEach((renewal) => {
      const renewalMonth = renewal.created_at.slice(0, 7)
      const key = `${renewal.customer_id}-${renewalMonth}`
      
      // Keep only the latest renewal per customer per month
      if (!processedRenewals.has(key) || 
          new Date(renewal.created_at) > new Date(processedRenewals.get(key).created_at)) {
        processedRenewals.set(key, renewal)
      }
    })
    
    // Now count unique renewals
    processedRenewals.forEach((renewal) => {
      const renewalMonth = renewal.created_at.slice(0, 7)
      if (monthlyStats[renewalMonth]) {
        monthlyStats[renewalMonth].renewals++
        monthlyStats[renewalMonth].renewalRevenue += renewal.price || 0
      }
    })

    const statsArray = Object.values(monthlyStats)

    return NextResponse.json({ data: statsArray })
  } catch (error: any) {
    console.error("Error fetching monthly stats:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const PAGE_SIZE = 1000
const MAX_PARALLEL_PAGES = 4

async function fetchAllPages<T>(queryForRange: (from: number, to: number, includeCount: boolean) => any): Promise<T[]> {
  const firstPage = await queryForRange(0, PAGE_SIZE - 1, true)
  if (firstPage.error) throw firstPage.error

  const rows = [...(firstPage.data ?? [])] as T[]
  const pageCount = Math.ceil((firstPage.count ?? rows.length) / PAGE_SIZE)

  for (let firstPageIndex = 1; firstPageIndex < pageCount; firstPageIndex += MAX_PARALLEL_PAGES) {
    const pageIndexes = Array.from(
      { length: Math.min(MAX_PARALLEL_PAGES, pageCount - firstPageIndex) },
      (_, index) => firstPageIndex + index,
    )
    const pages = await Promise.all(
      pageIndexes.map(async (pageIndex) => {
        const { data, error } = await queryForRange(
          pageIndex * PAGE_SIZE,
          (pageIndex + 1) * PAGE_SIZE - 1,
          false,
        )
        if (error) throw error
        return (data ?? []) as T[]
      }),
    )
    rows.push(...pages.flat())
  }

  return rows
}

export async function GET() {
  try {
    const authClient = await createServerClient()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const { data: adminData, error: adminError } = await authClient
      .from("admins")
      .select("id")
      .eq("id", user.id)
      .single()

    if (adminError || !adminData) {
      return NextResponse.json({ error: "ليس لديك صلاحيات للوصول" }, { status: 403 })
    }

    const supabase = getSupabaseAdminClient()

    const now = new Date()
    const currentYear = now.getUTCFullYear()
    const currentMonth = now.getUTCMonth()
    const chartStart = new Date(Date.UTC(currentYear, currentMonth - 11, 1))
    const nextMonthStart = new Date(Date.UTC(currentYear, currentMonth + 1, 1))
    const chartStartDate = chartStart.toISOString().slice(0, 10)
    const chartStartTimestamp = chartStart.toISOString()
    const chartEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).toISOString().slice(0, 10)
    const chartEndExclusive = nextMonthStart.toISOString()

    const customerQuery = (from: number, to: number, includeCount: boolean) =>
      supabase
        .from("customers")
        .select("id,created_at,start_date,end_date,price", includeCount ? { count: "exact" } : undefined)
        .gte("created_at", chartStartTimestamp)
        .lt("created_at", chartEndExclusive)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    const overlappingCustomerQuery = (from: number, to: number, includeCount: boolean) =>
      supabase
        .from("customers")
        .select("id,created_at,start_date,end_date,price", includeCount ? { count: "exact" } : undefined)
        .lte("start_date", chartEndDate)
        .gte("end_date", chartStartDate)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    const renewalQuery = (from: number, to: number, includeCount: boolean) =>
      supabase
        .from("renewals")
        .select("id,customer_id,created_at,price", includeCount ? { count: "exact" } : undefined)
        .gte("created_at", chartStartTimestamp)
        .lt("created_at", chartEndExclusive)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)

    const [newCustomers, overlappingCustomers, renewals] = await Promise.all([
      fetchAllPages<any>(customerQuery),
      fetchAllPages<any>(overlappingCustomerQuery),
      fetchAllPages<any>(renewalQuery),
    ])
    const customersById = new Map<string, any>()
    for (const customer of [...newCustomers, ...overlappingCustomers]) {
      customersById.set(customer.id, customer)
    }
    const customers = Array.from(customersById.values())

    // Process data to get monthly statistics for the last 12 months
    const monthlyStats: Record<string, any> = {}
    
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
      if (customerEndDate < now) {
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

import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await req.json()

    const {
      dataTypes = { customers: true, accounts: true, renewals: true },
      customerFilters = { status: "all", expiringOnly: false, accountId: "", platform: "" },
      accountFilters = { status: "all", platform: "" },
      dateRange = { start: "", end: "" },
    } = body

    let allData: any[] = []

    // 1. Get platform-specific accounts if platform is selected
    let platformAccounts: any[] = []
    if (accountFilters.platform) {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, platform, name, email, max_slots, subscription_period, expiry_date, price, created_at")
        .eq("platform", accountFilters.platform)

      if (error) throw error
      platformAccounts = data || []

      // Apply account status filter
      if (accountFilters.status === "expired") {
        const now = new Date()
        platformAccounts = platformAccounts.filter(
          a => a.expiry_date && new Date(a.expiry_date) < now
        )
      } else if (accountFilters.status === "active") {
        const now = new Date()
        platformAccounts = platformAccounts.filter(
          a => !a.expiry_date || new Date(a.expiry_date) >= now
        )
      }
    }

    // 2. Export Accounts
    if (dataTypes.accounts) {
      let query = supabase
        .from("accounts")
        .select("id, platform, name, email, max_slots, subscription_period, expiry_date, price, created_at")

      if (accountFilters.platform) {
        query = query.eq("platform", accountFilters.platform)
      }

      if (accountFilters.status === "expired") {
        // Get all accounts and filter client-side to handle timezone correctly
        const { data: allAccounts, error } = await query
        if (error) throw error

        const now = new Date()
        const filtered = allAccounts?.filter(a => a.expiry_date && new Date(a.expiry_date) < now) || []

        // Apply date range filter
        let finalAccounts = filtered
        if (dateRange.start) {
          const startDate = new Date(dateRange.start)
          startDate.setHours(0, 0, 0, 0)
          finalAccounts = finalAccounts.filter(a => new Date(a.created_at) >= startDate)
        }
        if (dateRange.end) {
          const endDate = new Date(dateRange.end)
          endDate.setHours(23, 59, 59, 999)
          finalAccounts = finalAccounts.filter(a => new Date(a.created_at) <= endDate)
        }

        allData.push(...finalAccounts.map(a => ({ ...a, type: "حساب", status: "منتهي" })))
      } else if (accountFilters.status === "active") {
        const { data: allAccounts, error } = await query
        if (error) throw error

        const now = new Date()
        const filtered = allAccounts?.filter(a => !a.expiry_date || new Date(a.expiry_date) >= now) || []

        // Apply date range filter
        let finalAccounts = filtered
        if (dateRange.start) {
          const startDate = new Date(dateRange.start)
          startDate.setHours(0, 0, 0, 0)
          finalAccounts = finalAccounts.filter(a => new Date(a.created_at) >= startDate)
        }
        if (dateRange.end) {
          const endDate = new Date(dateRange.end)
          endDate.setHours(23, 59, 59, 999)
          finalAccounts = finalAccounts.filter(a => new Date(a.created_at) <= endDate)
        }

        allData.push(...finalAccounts.map(a => ({ ...a, type: "حساب", status: "نشط" })))
      } else {
        const { data: accounts, error } = await query
        if (error) throw error

        let finalAccounts = accounts || []

        // Apply date range filter
        if (dateRange.start || dateRange.end) {
          const startDate = dateRange.start ? new Date(dateRange.start) : null
          const endDate = dateRange.end ? new Date(dateRange.end) : null

          if (startDate) startDate.setHours(0, 0, 0, 0)
          if (endDate) endDate.setHours(23, 59, 59, 999)

          finalAccounts = finalAccounts.filter(a => {
            const accountDate = new Date(a.created_at)
            if (startDate && accountDate < startDate) return false
            if (endDate && accountDate > endDate) return false
            return true
          })
        }

        allData.push(...finalAccounts.map(a => ({ ...a, type: "حساب" })))
      }
    }

    // 3. Export Customers
    if (dataTypes.customers) {
      // Get account IDs if platform is selected
      let accountIds: string[] = []
      if (accountFilters.platform || customerFilters.platform) {
        const platformToUse = accountFilters.platform || customerFilters.platform
        const { data: accounts, error } = await supabase
          .from("accounts")
          .select("id")
          .eq("platform", platformToUse)

        if (error) throw error
        accountIds = accounts?.map(a => a.id) || []
      }

      let query = supabase
        .from("customers")
        .select("id, name, email, phone, start_date, end_date, price, status, created_at, account_id, accounts(id, platform, name)")

      // Apply account filter
      if (customerFilters.accountId) {
        query = query.eq("account_id", customerFilters.accountId)
      } else if (accountIds.length > 0) {
        query = query.in("account_id", accountIds)
      }

      const { data: customers, error } = await query
      if (error) throw error

      let finalCustomers = customers || []

      // Apply status filter
      if (customerFilters.status !== "all") {
        finalCustomers = finalCustomers.filter(c => c.status === customerFilters.status)
      }

      // Apply expiring only filter (7 days or less)
      if (customerFilters.expiringOnly) {
        const now = new Date()
        finalCustomers = finalCustomers.filter(c => {
          const endDate = new Date(c.end_date)
          const daysRemaining = Math.ceil(
            (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          )
          return daysRemaining >= 0 && daysRemaining <= 7
        })
      }

      // Apply date range filter (by creation date)
      if (dateRange.start || dateRange.end) {
        const startDate = dateRange.start ? new Date(dateRange.start) : null
        const endDate = dateRange.end ? new Date(dateRange.end) : null

        if (startDate) startDate.setHours(0, 0, 0, 0)
        if (endDate) endDate.setHours(23, 59, 59, 999)

        finalCustomers = finalCustomers.filter(c => {
          const customerDate = new Date(c.created_at)
          if (startDate && customerDate < startDate) return false
          if (endDate && customerDate > endDate) return false
          return true
        })
      }

      allData.push(
        ...finalCustomers.map(c => ({
          ...c,
          type: "عميل",
          account_name: c.accounts?.name || "",
          platform: c.accounts?.platform || "",
        }))
      )
    }

    // 4. Export Renewals
    if (dataTypes.renewals) {
      // Get account IDs if platform is selected
      let accountIds: string[] = []
      if (accountFilters.platform) {
        const { data: accounts, error } = await supabase
          .from("accounts")
          .select("id")
          .eq("platform", accountFilters.platform)

        if (error) throw error
        accountIds = accounts?.map(a => a.id) || []
      }

      let query = supabase
        .from("renewals")
        .select("id, customer_id, account_id, old_end_date, new_end_date, price, created_at, customers(name), accounts(name, platform)")

      if (accountIds.length > 0) {
        query = query.in("account_id", accountIds)
      }

      const { data: renewals, error } = await query
      if (error) throw error

      let finalRenewals = renewals || []

      // Apply date range filter (by renewal creation date)
      if (dateRange.start || dateRange.end) {
        const startDate = dateRange.start ? new Date(dateRange.start) : null
        const endDate = dateRange.end ? new Date(dateRange.end) : null

        if (startDate) startDate.setHours(0, 0, 0, 0)
        if (endDate) endDate.setHours(23, 59, 59, 999)

        finalRenewals = finalRenewals.filter(r => {
          const renewalDate = new Date(r.created_at)
          if (startDate && renewalDate < startDate) return false
          if (endDate && renewalDate > endDate) return false
          return true
        })
      }

      // Remove duplicates (keep only latest renewal per customer)
      const uniqueRenewals = finalRenewals.reduce((acc: any[], renewal: any) => {
        const existingIndex = acc.findIndex(r => r.customer_id === renewal.customer_id)
        if (existingIndex === -1) {
          acc.push(renewal)
        } else {
          if (new Date(renewal.created_at) > new Date(acc[existingIndex].created_at)) {
            acc[existingIndex] = renewal
          }
        }
        return acc
      }, [])

      allData.push(
        ...uniqueRenewals.map(r => ({
          ...r,
          type: "تجديد",
          customer_name: r.customers?.name || "",
          account_name: r.accounts?.name || "",
          platform: r.accounts?.platform || "",
        }))
      )
    }

    return NextResponse.json({
      success: true,
      data: allData,
      count: allData.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[v0] Export error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

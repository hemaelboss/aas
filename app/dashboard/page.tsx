"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Users,
  CreditCard,
  UserPlus,
  Plus,
  Pencil,
  Trash2,
  Search,
  LogOut,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  AlertCircle,
  MessageCircle,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  FileDown,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"

type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  account_id: string | null
  start_date: string
  end_date: string
  price: number
  status: "active" | "expired" | "cancelled"
  auto_notifications: boolean
  created_at: string
}

type Account = {
  id: string
  name: string
  platform: string
  email: string | null
  password: string | null
  max_slots: number
  subscription_period: "monthly" | "quarterly" | "yearly" | null
  expiry_date: string | null
  price: number | null
  created_at: string
  updated_at: string
}

type Admin = {
  id: string
  email: string
  full_name: string
  role: "super_admin" | "admin"
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [supabase, setSupabase] = useState<any>(null)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [globalSearchTerm, setGlobalSearchTerm] = useState("")
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>("all")
  const [startDateFilter, setStartDateFilter] = useState<string>("")
  const [endDateFilter, setEndDateFilter] = useState<string>("")
  const [accountSearchTerm, setAccountSearchTerm] = useState<string>("")
  const [showExpiringOnly, setShowExpiringOnly] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<
    "addCustomer" | "editCustomer" | "renewCustomer" | "addAccount" | "editAccount" | "addAdmin"
  >("addCustomer")
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  const [monthlyStats, setMonthlyStats] = useState<any[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showExportModal, setShowExportModal] = useState(false)
  const [accountSearchInput, setAccountSearchInput] = useState("")
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    dataTypes: { customers: true, accounts: true, renewals: true },
    customerFilters: { status: "all", expiringOnly: false, accountId: "", platform: "" },
    accountFilters: { status: "all", platform: "" },
    dateRange: { start: "", end: "" },
  })

  const [subscriberPage, setSubscriberPage] = useState(1)
  const [expiredPage, setExpiredPage] = useState(1)
  const [accountPage, setAccountPage] = useState(1)
  const pageSize = 10

  const [expiringCustomers, setExpiringCustomers] = useState<Customer[]>([])
  const [monthlyRenewals, setMonthlyRenewals] = useState<any[]>([])
  
  // Time filters for each tab
  const [tabTimeFilters, setTabTimeFilters] = useState({
    customers: { startDate: "", endDate: "" },
    renewals: { startDate: "", endDate: "" },
    expired: { startDate: "", endDate: "" },
    accounts: { startDate: "", endDate: "" },
    expiredAccounts: { startDate: "", endDate: "" },
  })

  useEffect(() => {
    // Initialize Supabase client after component mounts
    const client = createBrowserClient()
    if (client) {
      setSupabase(client)
    } else {
      console.error("[v0] Failed to initialize Supabase client")
    }
  }, [])

  useEffect(() => {
    if (supabase) {
      loadData()
      checkAuth()
    }
  }, [supabase])

  useEffect(() => {
    if (customers.length > 0) {
      autoExpireSubscriptions()
    }
  }, [customers])

  const checkAuth = async () => {
    if (!supabase) return
    
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/auth/login")
      return
    }

    const { data: admin } = await supabase.from("admins").select("*").eq("id", user.id).single()

    if (admin) {
      setCurrentAdmin(admin)
    }
  }

  const autoExpireSubscriptions = async () => {
    const today = new Date().toISOString().split("T")[0]
    const expiredCustomers = customers.filter((c) => c.status === "active" && c.end_date < today)

    for (const customer of expiredCustomers) {
      await supabase.from("customers").update({ status: "expired" }).eq("id", customer.id)
    }

    if (expiredCustomers.length > 0) {
      loadData()
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)

      // Fetch all customers with pagination to bypass 1000 row limit
      const fetchAllCustomers = async () => {
        const allCustomers: Customer[] = []
        let page = 0
        const pageSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data, error } = await supabase
            .from("customers")
            .select("*")
            .order("created_at", { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1)

          if (error) throw error
          if (data && data.length > 0) {
            allCustomers.push(...data)
            page++
            hasMore = data.length === pageSize
          } else {
            hasMore = false
          }
        }
        return allCustomers
      }

      const [customersData, accountsRes, adminsRes] = await Promise.all([
        fetchAllCustomers(),
        supabase.from("accounts").select("*").order("created_at", { ascending: false }),
        supabase.from("admins").select("*").order("created_at", { ascending: false }),
      ])

      console.log("[v0] Data loaded - Customers:", customersData?.length || 0, "Accounts:", accountsRes.data?.length || 0, "Admins:", adminsRes.data?.length || 0)

      if (customersData) {
        setCustomers(customersData)
        const today = new Date()
        const sevenDaysLater = new Date()
        sevenDaysLater.setDate(today.getDate() + 7)

        const expiring = customersData.filter((c) => {
          if (c.status !== "active") return false
          const endDate = new Date(c.end_date)
          return endDate >= today && endDate <= sevenDaysLater
        })
        setExpiringCustomers(expiring)
      }
      if (accountsRes.data) setAccounts(accountsRes.data)
      if (adminsRes.data) setAdmins(adminsRes.data)

      const statsResponse = await fetch("/api/stats/monthly")
      const statsData = await statsResponse.json()
      if (statsData.data) {
        setMonthlyStats(statsData.data)
        const currentMonth = new Date().toISOString().slice(0, 7)
        const currentMonthStats = statsData.data.find((stat: any) => stat.month === currentMonth)
        setMonthlyRevenue(currentMonthStats?.revenue || 0)
      }

      // Fetch current month renewals with customer details
      const currentMonth = new Date().toISOString().slice(0, 7)
      const { data: renewalsData } = await supabase
        .from("renewals")
        .select("*, customers(*), accounts(*)")
        .gte("created_at", currentMonth + "-01")
        .order("created_at", { ascending: false })
      
      if (renewalsData) {
        // Remove duplicates - keep only the latest renewal per customer
        const uniqueRenewals = renewalsData.reduce((acc: any[], renewal: any) => {
          const existingIndex = acc.findIndex(r => r.customer_id === renewal.customer_id)
          if (existingIndex === -1) {
            // No existing renewal for this customer, add it
            acc.push(renewal)
          } else {
            // Replace if this renewal is newer
            if (new Date(renewal.created_at) > new Date(acc[existingIndex].created_at)) {
              acc[existingIndex] = renewal
            }
          }
          return acc
        }, [])
        setMonthlyRenewals(uniqueRenewals)
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const openModal = (type: typeof modalType, item: any = null) => {
    setModalType(type)
    setEditingItem(item)
  if (item) {
  const initialAccount = accounts.find((account) => account.id === item.account_id)
  setAccountSearchInput(initialAccount ? `${initialAccount.platform} - ${initialAccount.name}` : "")
  setFormData(type === "renewCustomer" ? {
    renewal_email: item.email || "",
    renewal_account_id: item.account_id || "",
    renewal_start_date: item.end_date,
    renewal_days: "30",
    renewal_price: item.price ?? "",
  } : { ...item })
  // If editing a customer, set the account name in search field
      if ((type === "editCustomer" || type === "addCustomer") && item.account_id) {
        const selectedAccount = accounts.find(a => a.id === item.account_id)
        if (selectedAccount) {
          setAccountSearchInput(`${selectedAccount.platform} - ${selectedAccount.name}`)
        }
      }
    } else {
      setFormData({})
      setAccountSearchInput("")
    }
    setShowAccountDropdown(false)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingItem(null)
    setFormData({})
    setAccountSearchInput("")
    setShowAccountDropdown(false)
  }

  const handleOpenExportModal = () => {
    setExportOptions({
      dataTypes: { customers: true, accounts: true, renewals: true },
      customerFilters: { status: "all", expiringOnly: false, accountId: "", platform: "" },
      accountFilters: { status: "all", platform: "" },
      dateRange: { start: "", end: "" },
    })
    setShowExportModal(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (modalType === "addCustomer") {
        const endDate = formData.end_date

        const { data: newCustomer, error } = await supabase
          .from("customers")
          .insert({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            account_id: formData.account_id,
            start_date: formData.start_date,
            end_date: endDate,
            price: Number(formData.price),
            status: "active",
            auto_notifications: formData.auto_notifications ?? true,
          })
          .select()
          .single()

        if (error) throw error

        if (formData.auto_notifications && formData.email) {
          await fetch("/api/notifications/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_id: newCustomer.id,
              type: "subscription_start",
            }),
          })
        }
      } else if (modalType === "renewCustomer") {
        const customer = editingItem
        const renewalStart = formData.renewal_start_date || customer.end_date
        const renewalDays = Number(formData.renewal_days)
        if (!Number.isInteger(renewalDays) || renewalDays <= 0) throw new Error("مدة التجديد غير صحيحة")
        const newEnd = new Date(`${renewalStart}T00:00:00`)
        newEnd.setDate(newEnd.getDate() + renewalDays)
        const newEndDate = newEnd.toISOString().split("T")[0]
        const renewalPrice = Number(formData.renewal_price)
        if (!Number.isFinite(renewalPrice) || renewalPrice < 0) throw new Error("قيمة التجديد غير صحيحة")
        const renewalEmail = String(formData.renewal_email || "").trim()
        if (renewalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(renewalEmail)) {
          throw new Error("البريد الإلكتروني غير صحيح")
        }
        const renewalAccountId = String(formData.renewal_account_id || customer.account_id || "")
        if (!renewalAccountId) throw new Error("يجب اختيار الحساب")

        const { error } = await supabase.from("customers").update({
          email: renewalEmail || null,
          account_id: renewalAccountId,
          end_date: newEndDate,
          price: renewalPrice,
          status: "active",
        }).eq("id", customer.id)
        if (error) throw error

        const { error: renewalError } = await supabase.from("renewals").insert({
          customer_id: customer.id,
          account_id: renewalAccountId,
          old_end_date: customer.end_date,
          new_end_date: newEndDate,
          price: renewalPrice,
        })
        if (renewalError) throw renewalError
      } else if (modalType === "editCustomer") {
        // Check if end_date changed (renewal via edit)
        const oldEndDate = editingItem.end_date
        const newEndDate = formData.end_date

        const { error } = await supabase
          .from("customers")
          .update({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            account_id: formData.account_id,
            start_date: formData.start_date,
            end_date: formData.end_date,
            price: Number(formData.price),
            status: formData.status,
            auto_notifications: formData.auto_notifications,
          })
          .eq("id", editingItem.id)

        if (error) throw error

        // If end_date was extended, record it as a renewal (but check for duplicates first)
        if (newEndDate && oldEndDate && new Date(newEndDate) > new Date(oldEndDate)) {
          // Check if a renewal with same customer_id and new_end_date already exists today
          const today = new Date().toISOString().split("T")[0]
          const { data: existingRenewal } = await supabase
            .from("renewals")
            .select("id")
            .eq("customer_id", editingItem.id)
            .eq("new_end_date", newEndDate)
            .gte("created_at", today)
            .limit(1)
          
          // Only insert if no duplicate exists
          if (!existingRenewal || existingRenewal.length === 0) {
            const { error: renewalError } = await supabase.from("renewals").insert({
              customer_id: editingItem.id,
              account_id: formData.account_id || editingItem.account_id,
              old_end_date: oldEndDate,
              new_end_date: newEndDate,
              price: Number(formData.price) || editingItem.price,
            })
            if (renewalError) console.error("Renewal tracking error:", renewalError)
          }
        }
      } else if (modalType === "addAccount" || modalType === "editAccount") {
        const accountData = {
          name: formData.name,
          platform: formData.platform,
          email: formData.email,
          password: formData.password,
          max_slots: Number(formData.max_slots) || 5,
          subscription_period: formData.subscription_period || "monthly",
          expiry_date: formData.expiry_date || null,
          price: formData.price ? Number(formData.price) : 0,
        }

        if (modalType === "addAccount") {
          const { error } = await supabase.from("accounts").insert(accountData)
          if (error) throw error
        } else {
          const { error } = await supabase.from("accounts").update(accountData).eq("id", editingItem.id)
          if (error) throw error
        }
      } else if (modalType === "addAdmin") {
        // Create admin via API
        const response = await fetch("/api/admins/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            role: formData.role || "admin",
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to create admin")
        }
      }

      await loadData()
      closeModal()
    } catch (error) {
      console.error("Error saving:", error)
      alert("حدث خطأ أثناء الحفظ")
    }
  }

  const handleRenew = async (customerId: string) => {
    try {
      const customer = customers.find((c) => c.id === customerId)
      if (!customer) return

      const currentEnd = new Date(customer.end_date)
      const newEnd = new Date(currentEnd)
      newEnd.setDate(currentEnd.getDate() + 30)

      // Update customer end_date and set status to active
      const { error: updateError } = await supabase
        .from("customers")
        .update({
          end_date: newEnd.toISOString().split("T")[0],
          status: "active",
        })
        .eq("id", customerId)

      if (updateError) throw updateError

      // Create renewal record
      const { error: renewalError } = await supabase.from("renewals").insert({
        customer_id: customerId,
        account_id: customer.account_id,
        old_end_date: currentEnd.toISOString().split("T")[0],
        new_end_date: newEnd.toISOString().split("T")[0],
        price: customer.price,
      })

      if (renewalError) console.error("Renewal tracking error:", renewalError)

      // Send renewal email if auto_notifications is enabled
      if (customer.auto_notifications && customer.email) {
        await fetch("/api/notifications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: customerId,
            type: "subscription_renewal",
          }),
        })
      }

      await loadData()
      alert("تم التجديد بنجاح")
    } catch (error) {
      console.error("Error renewing:", error)
      alert("حدث خطأ أثناء التجديد")
    }
  }

  const handleDelete = async (type: "customer" | "account" | "admin", id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return

    try {
      if (type === "admin") {
        // Use API route with service_role_key for admin deletion
        const res = await fetch("/api/admins/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminId: id }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "فشل حذف المدير")
      } else {
        const table = type === "customer" ? "customers" : "accounts"
        const { error } = await supabase.from(table).delete().eq("id", id)
        if (error) throw error
      }

      await loadData()
    } catch (error) {
      console.error("Error deleting:", error)
      alert("حدث خطأ أثناء الحذف")
    }
  }

  const filteredAccountsForSelect = accounts.filter(a => 
    a.name.toLowerCase().includes(accountSearchInput.toLowerCase()) ||
    a.platform.toLowerCase().includes(accountSearchInput.toLowerCase())
  )

  // Get unique platforms
  const uniquePlatforms = [...new Set(accounts.map(a => a.platform))]

  const handleAdvancedExport = async () => {
    if (!exportOptions.dataTypes.customers && !exportOptions.dataTypes.accounts && !exportOptions.dataTypes.renewals) {
      alert("اختر نوع بيانات واحد على الأقل")
      return
    }

    try {
      const response = await fetch("/api/export/advanced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportOptions),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "فشل التصدير")
      }

      const result = await response.json()
      
      if (!result.success || result.data.length === 0) {
        alert("لا توجد بيانات مطابقة للفلاتر المحددة")
        return
      }

      exportToCSV(result.data, "filtered_export")
      setShowExportModal(false)
    } catch (error: any) {
      console.error("[v0] Export error:", error)
      alert(`خطأ في التصدير: ${error.message}`)
    }
  }

  const getFilteredTabData = (tabName: string) => {
    const filters = tabTimeFilters[tabName as keyof typeof tabTimeFilters]
    const startDate = filters?.startDate ? new Date(filters.startDate) : null
    const endDate = filters?.endDate ? new Date(filters.endDate) : null
    if (endDate) endDate.setHours(23, 59, 59, 999)

    let data: any[] = []

    if (tabName === "customers") {
      data = customers.filter(c => {
        if (startDate) {
          const cDate = new Date(c.created_at)
          if (cDate < startDate) return false
        }
        if (endDate) {
          const cDate = new Date(c.created_at)
          if (cDate > endDate) return false
        }
        return true
      })
    } else if (tabName === "renewals") {
      data = monthlyRenewals.filter(r => {
        if (startDate) {
          const rDate = new Date(r.created_at)
          if (rDate < startDate) return false
        }
        if (endDate) {
          const rDate = new Date(r.created_at)
          if (rDate > endDate) return false
        }
        return true
      })
  } else if (tabName === "expired") {
    data = customers.filter(c => {
      if (c.status !== "expired") return false
      if (startDate) {
        const cDate = new Date(c.end_date)
        if (cDate < startDate) return false
      }
      if (endDate) {
        const cDate = new Date(c.end_date)
        if (cDate > endDate) return false
      }
      return true
    })
    } else if (tabName === "accounts") {
      data = accounts.filter(a => {
        if (startDate) {
          const aDate = new Date(a.created_at)
          if (aDate < startDate) return false
        }
        if (endDate) {
          const aDate = new Date(a.created_at)
          if (aDate > endDate) return false
        }
        return true
      })
    } else if (tabName === "expiredAccounts") {
      const now = new Date()
      data = accounts.filter(a => {
        if (!a.expiry_date || new Date(a.expiry_date) >= now) return false
        if (startDate) {
          const aDate = new Date(a.created_at)
          if (aDate < startDate) return false
        }
        if (endDate) {
          const aDate = new Date(a.created_at)
          if (aDate > endDate) return false
        }
        return true
      })
    }

    return data
  }

  const handleCustomersTabExport = () => {
    // Get filtered customers based on existing filters
    let filtered = customers

    // Apply account filter
    if (selectedAccountFilter !== "all") {
      filtered = filtered.filter(c => c.account_id === selectedAccountFilter)
    }

    // Apply search term
    if (globalSearchTerm) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
        accounts.find(a => a.id === c.account_id)?.name.toLowerCase().includes(globalSearchTerm.toLowerCase())
      )
    }

    // Apply date range filter
    if (startDateFilter || endDateFilter) {
      const start = startDateFilter ? new Date(startDateFilter) : null
      const end = endDateFilter ? new Date(endDateFilter) : null
      if (end) end.setHours(23, 59, 59, 999)

      filtered = filtered.filter(c => {
        const cStart = new Date(c.start_date)
        const cEnd = new Date(c.end_date)

        if (start && cStart < start) return false
        if (end && cEnd > end) return false
        return true
      })
    }

    // Apply expiring only filter
    if (showExpiringOnly) {
      const today = new Date()
      const sevenDaysLater = new Date()
      sevenDaysLater.setDate(today.getDate() + 7)

      filtered = filtered.filter(c => {
        if (c.status !== "active") return false
        const endDate = new Date(c.end_date)
        return endDate >= today && endDate <= sevenDaysLater
      })
    }

    if (filtered.length === 0) {
      alert("لا توجد بيانات للتصدير")
      return
    }

    exportToCSV(filtered, "customers_filtered_export")
  }

  const handleTabExport = (tabName: string) => {
    const data = getFilteredTabData(tabName)
    
    if (data.length === 0) {
      alert("لا توجد بيانات للتصدير")
      return
    }

    exportToCSV(data, `${tabName}_export`)
  }

  const TimeFilterComponent = ({ tabName, count }: { tabName: string; count: number }) => (
    <div className="flex gap-3 items-end flex-wrap mb-4">
      <div>
        <Label htmlFor={`${tabName}-start`} className="text-sm font-medium">من التاريخ</Label>
        <Input
          id={`${tabName}-start`}
          type="date"
          value={tabTimeFilters[tabName as keyof typeof tabTimeFilters]?.startDate || ""}
          onChange={(e) =>
            setTabTimeFilters({
              ...tabTimeFilters,
              [tabName]: {
                ...tabTimeFilters[tabName as keyof typeof tabTimeFilters],
                startDate: e.target.value,
              },
            })
          }
          className="w-40"
        />
      </div>
      <div>
        <Label htmlFor={`${tabName}-end`} className="text-sm font-medium">إلى التاريخ</Label>
        <Input
          id={`${tabName}-end`}
          type="date"
          value={tabTimeFilters[tabName as keyof typeof tabTimeFilters]?.endDate || ""}
          onChange={(e) =>
            setTabTimeFilters({
              ...tabTimeFilters,
              [tabName]: {
                ...tabTimeFilters[tabName as keyof typeof tabTimeFilters],
                endDate: e.target.value,
              },
            })
          }
          className="w-40"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
          onClick={() => handleTabExport(tabName)}
        >
          <FileDown className="h-4 w-4" />
          تنزيل ({count})
        </Button>
        {(tabTimeFilters[tabName as keyof typeof tabTimeFilters]?.startDate ||
          tabTimeFilters[tabName as keyof typeof tabTimeFilters]?.endDate) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setTabTimeFilters({
                ...tabTimeFilters,
                [tabName]: { startDate: "", endDate: "" },
              })
            }
          >
            إعادة تعيين
          </Button>
        )}
      </div>
    </div>
  )

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      alert("لا توجد بيانات للتصدير")
      return
    }

    // Define headers based on data type
    let headers: string[] = []
    let rows: string[][] = []

    // For mixed data (filtered_export), group by type
    if (filename.includes("filtered")) {
      const groupedByType = data.reduce((acc, item) => {
        const type = item.type || "عميل"
        if (!acc[type]) acc[type] = []
        acc[type].push(item)
        return acc
      }, {} as Record<string, any[]>)

      // Build rows dynamically based on what we have
      rows = data.map((item: any) => {
        if (item.type === "حساب") {
          // Account row
          return [
            item.type,
            item.platform || "",
            item.name || "",
            item.email || "",
            item.max_slots?.toString() || "",
            item.subscription_period === "monthly" ? "شهري" : item.subscription_period === "quarterly" ? "3 شهور" : "سنوي",
            item.expiry_date || "",
            item.price?.toString() || "0",
            new Date(item.created_at).toLocaleDateString("ar-EG"),
          ]
        } else if (item.type === "تجديد") {
          // Renewal row
          return [
            item.type,
            item.customers?.name || item.customer_id || "",
            item.accounts?.name || item.account_id || "",
            item.old_end_date || "",
            item.new_end_date || "",
            item.price?.toString() || "0",
            new Date(item.created_at).toLocaleDateString("ar-EG"),
          ]
        } else {
          // Customer row
          return [
            item.type || "عميل",
            item.name || "",
            item.email || "",
            item.phone || "",
            item.start_date || "",
            item.end_date || "",
            item.price?.toString() || "0",
            item.status === "active" ? "نشط" : item.status === "expired" ? "منتهي" : "ملغي",
            new Date(item.created_at).toLocaleDateString("ar-EG"),
          ]
        }
      })

      headers = ["النوع", "الاسم/المنصة", "البيان الثاني", "البيان الثالث", "البيان الرابع", "البيان الخامس", "البيان السادس", "البيان السابع", "التاريخ"]
    } else if (filename.includes("expired")) {
      // Handle expired customers export
      headers = [
        "الاسم",
        "البريد الإلكتروني",
        "الهاتف",
        "تاريخ البداية",
        "تاريخ الانتهاء",
        "السعر",
        "تاريخ الإنشاء",
      ]
      rows = data.map((item: Customer) => [
        item.name,
        item.email || "",
        item.phone || "",
        item.start_date,
        item.end_date,
        item.price.toString(),
        new Date(item.created_at).toLocaleDateString("ar-EG"),
      ])
    } else if (filename.includes("renewals")) {
      // Handle renewals export
      headers = [
        "اسم المشترك",
        "المنصة",
        "تاريخ الانتهاء القديم",
        "تاريخ الانتهاء الجدي����",
        "السعر",
        "تاريخ التجديد",
      ]
      rows = data.map((item: any) => [
        item.customers?.name || "",
        item.accounts?.name || "",
        item.old_end_date || "",
        item.new_end_date || "",
        item.price?.toString() || "0",
        new Date(item.created_at).toLocaleDateString("ar-EG"),
      ])
    } else if (filename.includes("accounts")) {
      // Handle accounts export
      headers = [
        "المنصة",
        "الاسم",
        "البريد الإلكتروني",
        "عدد المواقع",
        "نوع الاشتراك",
        "تاريخ الانتهاء",
        "السعر",
        "تاريخ الإنشاء",
      ]
      rows = data.map((item: any) => [
        item.platform || "",
        item.name || "",
        item.email || "",
        item.max_slots?.toString() || "0",
        item.subscription_period === "monthly" ? "شهري" : item.subscription_period === "quarterly" ? "3 شهور" : "سنوي",
        item.expiry_date || "",
        item.price?.toString() || "0",
        new Date(item.created_at).toLocaleDateString("ar-EG"),
      ])
    } else if (filename.includes("subscribers")) {
      headers = [
        "الاسم",
        "البريد الإلكتروني",
        "الهاتف",
        "تاريخ البداية",
        "تاريخ الانتهاء",
        "السعر",
        "الحالة",
        "تاريخ الإنشاء",
      ]
      rows = data.map((item: Customer) => [
        item.name,
        item.email || "",
        item.phone || "",
        item.start_date,
        item.end_date,
        item.price.toString(),
        item.status === "active" ? "نشط" : item.status === "expired" ? "منتهي" : "ملغي",
        new Date(item.created_at).toLocaleDateString("ar-EG"),
      ])
    }

    // Create CSV content with BOM for proper Arabic encoding
    const BOM = "\uFEFF"
    const csvContent = BOM + [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const totalSubscribers = customers.length
  const activeSubscriptions = customers.filter((c) => c.status === "active").length
  const totalAccounts = accounts.length

  const currentMonth = new Date().toISOString().slice(0, 7)
  const today = new Date()
  const currentMonthData = monthlyStats.find((stat: any) => stat.month === currentMonth)
  
  // Use the API metric shared with the Performance tab.
  // It is based on created_at, so renewals are not counted as new subscriptions.
  const monthlyNewSubscriptions = currentMonthData?.newSubscriptions || 0
  
  const monthlyExpired = customers.filter((c) => {
    return c.status === "expired"
  }).length
  
  // Get renewals from API data (since renewals table is separate)
  const monthlyRenewalsCount = currentMonthData?.renewals || 0
  
  // Calculate actual monthly income (new subscriptions + renewals this month).
  // A renewal updates start_date, so new subscriptions must use created_at.
  const newSubscriptionsRevenue = customers
  .filter((c) => c.created_at && c.created_at.startsWith(currentMonth))
  .reduce((sum, c) => sum + (c.price || 0), 0)
  
  // Renewals revenue (from monthlyRenewals state which has actual renewal records)
  const renewalsRevenue = monthlyRenewals.reduce((sum, r) => sum + (r.price || 0), 0)
  
  // Total actual monthly income
  const calculatedMonthlyIncome = newSubscriptionsRevenue + renewalsRevenue

  const chartConfig = {
    newSubscriptions: { label: "اشتراكات جديدة", color: "var(--chart-1)" },
    renewals: { label: "تجديدات", color: "var(--chart-2)" },
    revenue: { label: "الإيرادات", color: "var(--chart-3)" },
  } satisfies ChartConfig

  const chartData = monthlyStats.slice(-6).map((stat: any) => ({
    month: new Date(`${stat.month}-01`).toLocaleDateString("ar-EG-u-ca-gregory", { month: "short" }),
    newSubscriptions: stat.newSubscriptions || 0,
    renewals: stat.renewals || 0,
    revenue: (stat.newRevenue || 0) + (stat.renewalRevenue || 0),
  }))

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm)

    let matchesAccount = true
    if (selectedAccountFilter !== "all") {
      matchesAccount = customer.account_id === selectedAccountFilter
    }

    let matchesDateRange = true
    if (startDateFilter || endDateFilter) {
      const customerStartDate = new Date(customer.start_date)
      const customerEndDate = new Date(customer.end_date)

      if (startDateFilter) {
        const filterStart = new Date(startDateFilter)
        matchesDateRange = customerStartDate >= filterStart && matchesDateRange
      }

      if (endDateFilter) {
        const filterEnd = new Date(endDateFilter)
        matchesDateRange = customerEndDate <= filterEnd && matchesDateRange
      }
    }

    // Filter for expiring soon (within 7 days)
    let matchesExpiring = true
    if (showExpiringOnly) {
      const daysRemaining = Math.ceil(
        (new Date(customer.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
      matchesExpiring = daysRemaining >= 0 && daysRemaining <= 7
    }

    return matchesSearch && matchesAccount && matchesDateRange && matchesExpiring
  })

  const activeCustomers = filteredCustomers.filter((c) => c.status !== "expired")
  const totalSubscriberPages = Math.ceil(activeCustomers.length / pageSize)
  const paginatedCustomers = activeCustomers.slice((subscriberPage - 1) * pageSize, subscriberPage * pageSize)

  // Reset pagination when search term changes
  useEffect(() => {
    setSubscriberPage(1)
  }, [searchTerm, selectedAccountFilter, startDateFilter, endDateFilter])

  const totalAccountPages = Math.ceil(
    accounts
      .filter((a) =>
        accountSearchTerm
          ? a.name.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
            a.platform.toLowerCase().includes(accountSearchTerm.toLowerCase())
          : true
      )
      .filter((a) => activeTab === "accounts" || (a.expiry_date && new Date(a.expiry_date) < new Date())).length / pageSize
  )
  
  const filteredAccountsList = accounts
    .filter((a) =>
      accountSearchTerm
        ? a.name.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
          a.platform.toLowerCase().includes(accountSearchTerm.toLowerCase())
        : true
    )
    .filter((a) => activeTab === "accounts" || (a.expiry_date && new Date(a.expiry_date) < new Date()))
  
  const paginatedAccounts = filteredAccountsList.slice((accountPage - 1) * pageSize, accountPage * pageSize)

  // Reset pagination for accounts when search term changes
  useEffect(() => {
    setAccountPage(1)
  }, [accountSearchTerm])

  // Expired customers pagination
  const filteredExpiredCustomers = getFilteredTabData("expired")
    .filter((c) =>
      searchTerm
        ?           c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone?.toLowerCase().includes(searchTerm.toLowerCase())
        : true
    )
  
  const totalExpiredPages = Math.ceil(filteredExpiredCustomers.length / pageSize)
  const paginatedExpiredCustomers = filteredExpiredCustomers.slice((expiredPage - 1) * pageSize, expiredPage * pageSize)

  // Reset pagination for expired when filters change
  useEffect(() => {
    setExpiredPage(1)
  }, [searchTerm, tabTimeFilters])

  const getDaysRemaining = (endDate: string) => {
    const today = new Date()
    const end = new Date(endDate)
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getStatusColor = (endDate: string, status: string) => {
    if (status === "expired") return "bg-red-100 text-red-700 border-red-300"
    const days = getDaysRemaining(endDate)
    if (days <= 3) return "bg-orange-100 text-orange-700 border-orange-300"
    if (days <= 7) return "bg-yellow-100 text-yellow-700 border-yellow-300"
    return "bg-green-100 text-green-700 border-green-300"
  }

  const accountsExpiringSoon = accounts.filter((account) => {
    if (!account.expiry_date) return false
    const days = getDaysRemaining(account.expiry_date)
    return days >= 0 && days <= 7
  })

  const customersExpiringSoon = customers
    .filter((customer) => {
      if (customer.status !== "active") return false
      const days = getDaysRemaining(customer.end_date)
      return days >= 0 && days <= 7
    })
    .sort((a, b) => {
      // Sort by days remaining (ascending)
      return getDaysRemaining(a.end_date) - getDaysRemaining(b.end_date)
    })

  const expiredCustomers = customers.filter((c) => c.status === "expired")

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  const formatDateArabic = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("ar-EG-u-ca-gregory", {
      year: "numeric",
      month: "long",
      day: "numeric",
      calendar: "gregory",
    })
  }

  const getSubscriptionDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const durationInDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return durationInDays > 0 ? durationInDays : 0
  }

  const getAccountCustomers = (accountId: string) => {
    return customers.filter((c) => c.account_id === accountId && c.status === "active")
  }

  // Global search results
  const globalSearchResults = globalSearchTerm
    ? [
        // Active Customers
        ...customers
          .filter(
            (c) =>
              (c.status !== "expired" && (!c.end_date || new Date(c.end_date) >= new Date())) &&
              (c.name.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                c.email?.toLowerCase().includes(globalSearchTerm.toLowerCase()))
          )
          .map((c) => ({ ...c, _type: "customer" })),
        // Expired Customers
        ...customers
          .filter(
            (c) =>
              (c.status === "expired" || (c.end_date && new Date(c.end_date) < new Date())) &&
              (c.name.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                c.email?.toLowerCase().includes(globalSearchTerm.toLowerCase()))
          )
          .map((c) => ({ ...c, _type: "expiredCustomer" })),
        // Active Accounts
        ...accounts
          .filter(
            (a) =>
              (!a.expiry_date || new Date(a.expiry_date) >= new Date()) &&
              (a.name.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                a.platform.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                a.email?.toLowerCase().includes(globalSearchTerm.toLowerCase()))
          )
          .map((a) => ({ ...a, _type: "account" })),
        // Expired Accounts
        ...accounts
          .filter(
            (a) =>
              a.expiry_date && new Date(a.expiry_date) < new Date() &&
              (a.name.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                a.platform.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                a.email?.toLowerCase().includes(globalSearchTerm.toLowerCase()))
          )
          .map((a) => ({ ...a, _type: "expiredAccount" })),
      ]
    : []

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-3 rounded-xl shadow-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  لوحة التحكم
                </h1>
                <p className="text-sm text-gray-600">مرحباً، {currentAdmin?.full_name}</p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300 w-full sm:w-auto bg-transparent"
            >
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        {customersExpiringSoon.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <Card className="bg-gradient-to-r from-red-50 via-orange-50 to-yellow-50 border-red-300 shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-red-700 text-lg sm:text-xl">
                  <AlertCircle className="h-6 w-6 animate-pulse" />
                  مشتركون موشكون على الانتهاء ({customersExpiringSoon.length})
                </CardTitle>
                <p className="text-sm text-red-600 mt-1">المشتركون التالية اشتراكاتهم باقي عليها أقل من 7 أيام</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {customersExpiringSoon.slice(0, 10).map((customer) => {
                    const days = getDaysRemaining(customer.end_date)
                    const account = accounts.find((a) => a.id === customer.account_id)
                    return (
                      <div
                        key={customer.id}
                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-lg border-2 border-red-200 hover:border-red-300 transition-all"
                      >
                        <div className="flex-1 w-full sm:w-auto">
                          <div className="flex items-start gap-2 mb-1">
                            <p className="font-bold text-gray-800 text-base">{customer.name}</p>
                            {days <= 3 && (
                              <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
                                عاجل
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{customer.email || customer.phone}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {account && (
                              <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs">
                                {account.platform}
                              </span>
                            )}
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                days <= 3
                                  ? "bg-red-100 text-red-700"
                                  : days <= 7
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {days === 0 ? "ينتهي اليوم" : days === 1 ? "ينتهي غداً" : `متبقي ${days} أيام`}
                            </span>
                            <span className="text-xs text-gray-500">ينتهي: {formatDateArabic(customer.end_date)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                            onClick={() => openModal("renewCustomer", customer)}
                          >
                            <CheckCircle className="h-4 w-4 ml-1" />
                            تجديد
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 sm:flex-none bg-transparent"
                            onClick={() => openModal("editCustomer", customer)}
                          >
                            <Pencil className="h-4 w-4 ml-1" />
                            تعديل
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  {customersExpiringSoon.length > 10 && (
                    <p className="text-center text-sm text-gray-600 py-2 bg-gray-50 rounded-lg">
                      و {customersExpiringSoon.length - 10} مشتركين آخرين موشكون على الانتهاء
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Monthly Income Widget - Super Admin Only */}
          {currentAdmin?.role === "super_admin" && (
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base font-medium flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  إجمالي الدخل الشهري
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl sm:text-3xl font-bold">{calculatedMonthlyIncome.toLocaleString()} ج.م</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-medium flex items-center gap-2">
                <Users className="h-5 w-5" />
                إجمالي المشتركين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold">{totalSubscribers}</p>
              <p className="text-xs sm:text-sm text-blue-100 mt-1">نشط: {activeSubscriptions}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-medium flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                إجمالي الحسابات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold">{totalAccounts}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-medium flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                ح��ابات موشكة على الانتهاء
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl sm:text-3xl font-bold">{accountsExpiringSoon.length}</p>
              <p className="text-xs sm:text-sm text-orange-100 mt-1">خلال 7 أيام</p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Summary */}
        <Card className="mb-6 sm:mb-8 shadow-lg border-indigo-100">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
              ملخص إحصائيات الشهر الحالي
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-xl p-4 sm:p-6 border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="text-sm sm:text-base text-gray-700 font-medium">اشتراكات جديدة</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">{monthlyNewSubscriptions}</p>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <p className="text-sm sm:text-base text-gray-700 font-medium">تجديدات</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">{monthlyRenewalsCount}</p>
              </div>

              <div className="bg-red-50 rounded-xl p-4 sm:p-6 border border-red-200">
                <div className="flex items-center gap-3 mb-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <p className="text-sm sm:text-base text-gray-700 font-medium">اشتراكات منتهية</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-red-600">{monthlyExpired}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global Search */}
        <Card className="mb-6 sm:mb-8 shadow-lg border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Search className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
              بحث عام
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Input
                placeholder="ابحث بالاسم أو البريد الإلكتروني أو اسم الحساب..."
                value={globalSearchTerm}
                onChange={(e) => setGlobalSearchTerm(e.target.value)}
                className="border-indigo-300 focus:border-indigo-600 focus:ring-indigo-500"
              />
              
              {/* Search Results */}
              {globalSearchTerm && globalSearchResults.length > 0 && (
                <div className="border-t pt-4">
                  <div className="text-sm text-gray-600 mb-3">
                    النتائج: <span className="font-bold text-indigo-600">{globalSearchResults.length}</span> نتيجة
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {globalSearchResults.map((result, idx) => {
                      const type = result._type
                      const isCustomer = type === "customer" || type === "expiredCustomer"
                      const isAccount = type === "account" || type === "expiredAccount"
                      const isExpired = type === "expiredCustomer" || type === "expiredAccount"
                      
                      let bgColor = ""
                      let borderColor = ""
                      let icon = null
                      let typeLabel = ""
                      
                      if (type === "customer") {
                        bgColor = "bg-blue-50"
                        borderColor = "border-blue-400"
                        icon = <UserPlus className="h-4 w-4 text-blue-600" />
                        typeLabel = "مشترك نشط"
                      } else if (type === "expiredCustomer") {
                        bgColor = "bg-red-50"
                        borderColor = "border-red-400"
                        icon = <UserPlus className="h-4 w-4 text-red-600" />
                        typeLabel = "مشترك منتهي"
                      } else if (type === "account") {
                        bgColor = "bg-green-50"
                        borderColor = "border-green-400"
                        icon = <CreditCard className="h-4 w-4 text-green-600" />
                        typeLabel = "حساب نشط"
                      } else if (type === "expiredAccount") {
                        bgColor = "bg-orange-50"
                        borderColor = "border-orange-400"
                        icon = <CreditCard className="h-4 w-4 text-orange-600" />
                        typeLabel = "حساب منتهي"
                      }
                      
                      return (
                        <div
                          key={`${type}-${idx}`}
                          className={`p-3 rounded-lg border-l-4 ${bgColor} ${borderColor}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {icon}
                                <p className="font-semibold text-sm">
                                  {result.name}
                                </p>
                                <span className={`text-xs px-2 py-1 rounded bg-white ${
                                  isExpired ? "text-red-600 font-semibold" : "text-gray-600"
                                }`}>
                                  {typeLabel}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600">
                                {isCustomer ? result.email : `${result.platform}`}
                              </p>
                              {isAccount && (
                                <p className="text-xs text-gray-500 mt-1">
                                  السعر: <span className="font-semibold text-indigo-600">{result.price || "غير محدد"} ج.م</span>
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (type === "customer") {
                                  setActiveTab("customers")
                                  setSearchTerm(result.name)
                                  setSubscriberPage(1)
                                } else if (type === "expiredCustomer") {
                                  setActiveTab("expired")
                                  setSearchTerm(result.name)
                                  setSubscriberPage(1)
                                } else if (type === "account") {
                                  setActiveTab("accounts")
                                  setAccountSearchTerm(result.name)
                                  setAccountPage(1)
                                } else if (type === "expiredAccount") {
                                  setActiveTab("expiredAccounts")
                                  setAccountSearchTerm(result.name)
                                  setAccountPage(1)
                                }
                                setSelectedAccountFilter("all")
                                setStartDateFilter("")
                                setEndDateFilter("")
                                setGlobalSearchTerm("")
                              }}
                              className="text-indigo-600 hover:bg-indigo-100"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {globalSearchTerm && globalSearchResults.length === 0 && (
                <div className="text-center py-6">
                  <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">لم يتم العثور على نتائج</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-6">
          <div className="border-b border-gray-200 overflow-x-auto flex justify-between items-center pr-4">
            <nav className="flex gap-2 sm:gap-4 p-2 sm:p-4 min-w-max sm:min-w-0">
              {/* Modified tabs to include a subscribers tab and integrated existing tabs */}
              {[
                { id: "overview", label: "نظرة عامة", icon: Users },
                { id: "customers", label: "المشتركين", icon: UserPlus },
                { id: "renewals", label: "تجديدات الشهر", icon: RefreshCw },
                { id: "expired", label: "الاشتراكات المنتهية", icon: XCircle },
                { id: "accounts", label: "الحسابات", icon: CreditCard },
                { id: "expiredAccounts", label: "الحسابات المنتهية", icon: XCircle },
                ...(currentAdmin?.role === "super_admin"
                  ? [
                      { id: "performance", label: "إحصائيات الأداء", icon: TrendingUp },
                      { id: "admins", label: "المدراء", icon: ShieldCheck },
                    ]
                  : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id ? "bg-indigo-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>

            {currentAdmin?.role === "super_admin" && (
              <div className="flex gap-2 p-2">
                {/* Advanced Export Button - Super Admin Only */}
                {currentAdmin?.role === "super_admin" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="hidden sm:flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50 bg-transparent"
                    onClick={handleOpenExportModal}
                  >
                    <FileDown className="h-4 w-4" />
                    تنزيل بيانات متقدمة
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">نظرة عامة</h2>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                    <Button
                      onClick={() => openModal("addCustomer")}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 w-full sm:w-auto"
                    >
                      <UserPlus className="h-4 w-4 ml-2" />
                      إضافة مشترك
                    </Button>
                    <Button
                      onClick={() => openModal("addAccount")}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة حساب
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <Card className="overflow-hidden border-slate-200/80 shadow-sm">
                    <CardHeader className="border-b bg-slate-50/70 pb-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-base sm:text-lg">نشاط الاشتراكات</CardTitle>
                          <p className="mt-1 text-xs text-muted-foreground">آخر ستة أشهر</p>
                        </div>
                        <TrendingUp className="h-5 w-5 text-indigo-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-5">
                      {chartData.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                          <BarChart accessibilityLayer data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="4 4" />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                            <Bar dataKey="newSubscriptions" fill="var(--color-newSubscriptions)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="renewals" fill="var(--color-renewals)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">لا توجد بيانات كافية بعد</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden border-slate-200/80 shadow-sm">
                    <CardHeader className="border-b bg-slate-50/70 pb-4">
                      <CardTitle className="text-base sm:text-lg">الإيرادات الشهرية</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">مقارنة سريعة للإيرادات</p>
                    </CardHeader>
                    <CardContent className="pt-5">
                      {chartData.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[250px] w-full">
                          <BarChart accessibilityLayer data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="4 4" />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(value) => `${value}`} />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">لا توجد بيانات كافية بعد</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {accountsExpiringSoon.length > 0 && (
                  <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-orange-700">
                        <AlertCircle className="h-5 w-5" />
                        حسابات موشكة على الانتهاء
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {accountsExpiringSoon.map((account) => {
                          const days = getDaysRemaining(account.expiry_date!)
                          const accountCustomers = getAccountCustomers(account.id)
                          return (
                            <div
                              key={account.id}
                              className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-lg border-2 border-orange-300"
                            >
                              <div className="flex-1 w-full sm:w-auto">
                                <p className="font-bold text-gray-800 text-base sm:text-lg">{account.platform}</p>
                                <p className="text-sm text-gray-600">{account.name}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-medium">
                                    متبقي {days} يوم
                                  </span>
                                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                                    {accountCustomers.length} / {account.max_slots} مشترك
                                  </span>
                                </div>
                              </div>
                              <div className="text-left w-full sm:w-auto">
                                <p className="text-xs text-gray-500">تاريخ الانتهاء</p>
                                <p className="font-semibold text-orange-700 text-sm">
                                  {formatDate(account.expiry_date!)}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Customers */}
                <Card>
                  <CardHeader>
                    <CardTitle>آخر المشتركين</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <div className="space-y-3 min-w-max sm:min-w-0">
                        {customers.slice(0, 5).map((customer) => {
                          const account = accounts.find((a) => a.id === customer.account_id)
                          const days = getDaysRemaining(customer.end_date)
                          return (
                            <div
                              key={customer.id}
                              className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 rounded-lg border-2 ${getStatusColor(
                                customer.end_date,
                                customer.status,
                              )}`}
                            >
                              <div className="flex-1">
                                <p className="font-bold text-base sm:text-lg">{customer.name}</p>
                                <p className="text-sm text-gray-600">{account?.platform}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <span className="text-xs bg-white/50 px-2 py-1 rounded">
                                    {customer.status === "expired" ? "منتهي" : `متبقي ${days} يوم`}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                {customer.phone && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      window.open(`https://wa.me/${customer.phone.replace(/\D/g, "")}`, "_blank")
                                    }
                                    className="bg-green-500 hover:bg-green-600 text-white flex-1 sm:flex-none"
                                  >
                                    <MessageCircle className="h-4 w-4 ml-1" />
                                    واتساب
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Customers Tab */}
            {activeTab === "customers" && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">إدارة المشتركين</h2>
                  <Button onClick={() => openModal("addCustomer")} className="w-full sm:w-auto">
                    <UserPlus className="h-4 w-4 ml-2" />
                    إضافة مشترك جديد
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Account Filter with Search */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">تصفية حسب الحساب</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="ابحث عن حساب..."
                        value={accountSearchTerm}
                        onChange={(e) => setAccountSearchTerm(e.target.value.toLowerCase())}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div className="absolute right-2 top-2.5 text-gray-400">
                        <Search className="h-4 w-4" />
                      </div>
                    </div>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={selectedAccountFilter}
                      onChange={(e) => {
                        setSelectedAccountFilter(e.target.value)
                        setSubscriberPage(1)
                      }}
                    >
                      <option value="all">كل الحسابات</option>
                      {accounts
                        .filter(
                          (account) =>
                            account.name.toLowerCase().includes(accountSearchTerm) ||
                            account.platform.toLowerCase().includes(accountSearchTerm),
                        )
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} - {account.platform}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Start Date Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">من تاريخ الاشتراك</label>
                    <input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => {
                        setStartDateFilter(e.target.value)
                        setSubscriberPage(1)
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  {/* End Date Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">إلى تاريخ الاشتراك</label>
                    <input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => {
                        setEndDateFilter(e.target.value)
                        setSubscriberPage(1)
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  {/* Expiring Soon Filter */}
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 h-10 px-3 py-2 rounded-md border border-orange-300 bg-orange-50 cursor-pointer hover:bg-orange-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={showExpiringOnly}
                        onChange={(e) => {
                          setShowExpiringOnly(e.target.checked)
                          setSubscriberPage(1)
                        }}
                        className="w-4 h-4 accent-orange-500"
                      />
                      <span className="text-sm font-medium text-orange-700">موشك على الانتهاء</span>
                    </label>
                  </div>
                </div>

                {/* Filters Actions */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  {(startDateFilter || endDateFilter || selectedAccountFilter !== "all" || showExpiringOnly) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDateFilter("")
                        setEndDateFilter("")
                        setSelectedAccountFilter("all")
                        setAccountSearchTerm("")
                        setShowExpiringOnly(false)
                        setSubscriberPage(1)
                      }}
                      className="w-full sm:w-auto"
                    >
                      مسح الفلاتر
                    </Button>
                  )}
                  <Button
                    onClick={handleCustomersTabExport}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                  >
                    <FileDown className="h-4 w-4" />
                    تنزيل النتائج
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="بحث عن مشترك..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 text-base"
                  />
                </div>

                <div className="overflow-x-auto">
                  <div className="space-y-3 min-w-max sm:min-w-0">
                    {paginatedCustomers.map((customer) => {
                      const account = accounts.find((a) => a.id === customer.account_id)
                      const days = getDaysRemaining(customer.end_date)
                      const subscriptionDuration = getSubscriptionDuration(customer.start_date, customer.end_date)
                      return (
                        <div
                          key={customer.id}
                          className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 rounded-lg border-2 ${getStatusColor(
                            customer.end_date,
                            customer.status,
                          )}`}
                        >
                          <div className="flex-1">
                            <p className="font-bold text-base sm:text-lg">{customer.name}</p>
                            <p className="text-sm text-gray-600">
                              البريد: {customer.email} | الهاتف: {customer.phone}
                            </p>
                            <p className="text-sm text-gray-600">
                              اشتراك المشترك: من {formatDateArabic(customer.start_date)} إلى {formatDateArabic(customer.end_date)}
                            </p>
                            <p className="text-sm text-gray-600">الحساب: {account?.name} — {account?.platform}</p>
                            {account && (
                              <p className="text-sm text-gray-600">
                                مدة الحساب: من {formatDateArabic(account.created_at)} إلى {account.expiry_date ? formatDateArabic(account.expiry_date) : "غير محدد"}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="text-xs bg-white/70 px-2 py-1 rounded flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                متبقي {days} يوم
                              </span>
                              <span className="text-xs bg-white/70 px-2 py-1 rounded flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                مدة الاشتراك: {subscriptionDuration} يوم
                              </span>
                              <span className="text-xs bg-white/70 px-2 py-1 rounded">{customer.price} ج.م</span>
                              <span className="text-xs bg-white/70 px-2 py-1 rounded flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(customer.end_date)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            {customer.status === "active" && days >= 0 && days <= 7 && (
                              <Button
                                size="sm"
                                onClick={() => openModal("renewCustomer", customer)}
                                className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                              >
                                <TrendingUp className="h-4 w-4 ml-1" />
                                تجديد الاشتراك
                              </Button>
                            )}
                            {customer.phone && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  window.open(`https://wa.me/${customer.phone.replace(/\D/g, "")}`, "_blank")
                                }
                                className="bg-green-500 hover:bg-green-600 text-white flex-1 sm:flex-none"
                              >
                                <MessageCircle className="h-4 w-4 ml-1" />
                                واتساب
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openModal("editCustomer", customer)}
                              className="flex-1 sm:flex-none"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete("customer", customer.id)}
                              className="hover:bg-red-50 hover:text-red-600 hover:border-red-300 flex-1 sm:flex-none"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {totalSubscriberPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSubscriberPage(1)}
                      disabled={subscriberPage === 1}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSubscriberPage((p) => Math.max(1, p - 1))}
                      disabled={subscriberPage === 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium mx-2">
                      صفحة {subscriberPage} من {totalSubscriberPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSubscriberPage((p) => Math.min(totalSubscriberPages, p + 1))}
                      disabled={subscriberPage === totalSubscriberPages}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSubscriberPage(totalSubscriberPages)}
                      disabled={subscriberPage === totalSubscriberPages}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                  </div>
                )}
            </div>
            )}

            {/* Monthly Renewals Tab */}
            {activeTab === "renewals" && (
              <div className="space-y-4 sm:space-y-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                  تجديدات الشهر الحالي ({monthlyRenewals.length})
                </h2>
                
                {/* Time Filter for Renewals */}
                <TimeFilterComponent tabName="renewals" count={getFilteredTabData("renewals").length} />

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  {/* Export Renewals Button - Super Admin Only */}
                  {currentAdmin?.role === "super_admin" && monthlyRenewals.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 bg-transparent"
                      onClick={() => exportToCSV(monthlyRenewals, "renewals_export")}
                    >
                      <FileDown className="h-4 w-4" />
                      تنزيل البيانات
                    </Button>
                  )}
                </div>

                {/* Summary Card - Super Admin Only */}
                {currentAdmin?.role === "super_admin" && (
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white">
                    <div className="flex items-center gap-4">
                      <RefreshCw className="h-12 w-12" />
                      <div>
                        <p className="text-blue-100">إجمالي إيرادات التجديدات هذا الشهر</p>
                        <p className="text-3xl font-bold">
                          {monthlyRenewals.reduce((sum, r) => sum + (r.price || 0), 0).toLocaleString()} ج.م
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {monthlyRenewals.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-3 text-right font-semibold">اسم المشترك</th>
                            <th className="p-3 text-right font-semibold">الحساب</th>
                            <th className="p-3 text-right font-semibold">تاريخ الانتهاء القديم</th>
                            <th className="p-3 text-right font-semibold">تاريخ الانتهاء الجديد</th>
                            <th className="p-3 text-right font-semibold">السعر</th>
                            <th className="p-3 text-right font-semibold">تاريخ التجديد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {monthlyRenewals.map((renewal) => (
                            <tr key={renewal.id} className="hover:bg-gray-50">
                              <td className="p-3 font-medium">
                                {renewal.customers?.name || "غير معروف"}
                              </td>
                              <td className="p-3">
                                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs">
                                  {renewal.accounts?.name || "غير معروف"}
                                </span>
                              </td>
                              <td className="p-3 text-red-600">
                                {renewal.old_end_date ? new Date(renewal.old_end_date).toLocaleDateString("ar-EG") : "-"}
                              </td>
                              <td className="p-3 text-green-600 font-semibold">
                                {renewal.new_end_date ? new Date(renewal.new_end_date).toLocaleDateString("ar-EG") : "-"}
                              </td>
                              <td className="p-3 text-indigo-600 font-bold">
                                {(renewal.price || 0).toLocaleString()} ج.م
                              </td>
                              <td className="p-3 text-gray-500">
                                {new Date(renewal.created_at).toLocaleDateString("ar-EG")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-xl shadow-md">
                    <RefreshCw className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">لا توجد تجديدات هذا الشهر</p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === "expired" && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">الاشتراكات المنتهية</h2>
                  <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-medium">
                  {filteredExpiredCustomers.length} اشتراك منتهي
                  </div>
                </div>

                {/* Time Filter for Expired */}
                <TimeFilterComponent tabName="expired" count={getFilteredTabData("expired").length} />
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="بحث عن مشترك منتهي..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 text-base"
                  />
                </div>

                {searchTerm && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                    النتائج: <span className="font-bold text-blue-600">{filteredExpiredCustomers.length}</span> نتيجة
                  </div>
                )}

                <div className="overflow-x-auto">
                  <div className="space-y-3 min-w-max sm:min-w-0">
                    {paginatedExpiredCustomers.map((customer) => {
                        const account = accounts.find((a) => a.id === customer.account_id)
                        const daysExpired = Math.abs(getDaysRemaining(customer.end_date))
                        return (
                          <div
                            key={customer.id}
                            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 rounded-lg border-2 bg-red-50 border-red-300"
                          >
                            <div className="flex-1">
                              <p className="font-bold text-base sm:text-lg text-gray-800">{customer.name}</p>
                              <p className="text-sm text-gray-600">{customer.email || customer.phone}</p>
                              <p className="text-sm text-gray-600">{account?.platform}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="text-xs bg-red-200 text-red-700 px-2 py-1 rounded flex items-center gap-1">
                                  <XCircle className="h-3 w-3" />
                                  منتهي منذ {daysExpired} يوم
                                </span>
                                <span className="text-xs bg-white px-2 py-1 rounded">{customer.price} ج.م</span>
                                <span className="text-xs bg-white px-2 py-1 rounded flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(customer.end_date)}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openModal("editCustomer", customer)}
                                className="flex-1 sm:flex-none border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                              >
                                <Pencil className="h-4 w-4 ml-1" />
                                تعديل
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => openModal("renewCustomer", customer)}
                                className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                              >
                                <TrendingUp className="h-4 w-4 ml-1" />
                                تجديد
                              </Button>
                              {customer.phone && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    window.open(`https://wa.me/${customer.phone.replace(/\D/g, "")}`, "_blank")
                                  }
                                  className="bg-green-500 hover:bg-green-600 text-white flex-1 sm:flex-none"
                                >
                                  <MessageCircle className="h-4 w-4 ml-1" />
                                  و��تساب
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete("customer", customer.id)}
                                className="hover:bg-red-100 hover:text-red-600 hover:border-red-300 flex-1 sm:flex-none"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}

                    {filteredExpiredCustomers.length === 0 && (
                      <div className="text-center py-12">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <p className="text-gray-600 text-lg">لا توجد اشتراكات منتهية</p>
                      </div>
                    )}
                  </div>
                </div>

                {totalExpiredPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setExpiredPage(1)}
                      disabled={expiredPage === 1}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setExpiredPage((p) => Math.max(1, p - 1))}
                      disabled={expiredPage === 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium mx-2">
                      صفحة {expiredPage} من {totalExpiredPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setExpiredPage((p) => Math.min(totalExpiredPages, p + 1))}
                      disabled={expiredPage === totalExpiredPages}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setExpiredPage(totalExpiredPages)}
                      disabled={expiredPage === totalExpiredPages}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Accounts Tab */}
            {activeTab === "accounts" && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">إدارة الحسابات</h2>
                  <Button
                  onClick={() => openModal("addAccount")}
                  className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto"
                  >
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة حساب جديد
                  </Button>
                </div>

                {/* Time Filter for Accounts */}
                <TimeFilterComponent tabName="accounts" count={getFilteredTabData("accounts").length} />

                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="بحث عن حساب..."
                    value={accountSearchTerm}
                    onChange={(e) => setAccountSearchTerm(e.target.value)}
                    className="pr-10 text-base"
                  />
                </div>

                {accountSearchTerm && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                    النتائج: <span className="font-bold text-blue-600">{paginatedAccounts.filter(a => a.name.toLowerCase().includes(accountSearchTerm.toLowerCase()) || a.platform.toLowerCase().includes(accountSearchTerm.toLowerCase())).length}</span> نتيجة
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {paginatedAccounts
                    .filter((a) =>
                      accountSearchTerm
                        ? a.name.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
                          a.platform.toLowerCase().includes(accountSearchTerm.toLowerCase())
                        : true
                    )
                    .map((account) => {
                    const accountCustomers = getAccountCustomers(account.id)
                    const availableSlots = account.max_slots - accountCustomers.length
                    const daysRemaining = account.expiry_date ? getDaysRemaining(account.expiry_date) : null
                    const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7

                    return (
                      <Card
                        key={account.id}
                        className={`hover:shadow-xl transition-shadow cursor-pointer ${
                          isExpiringSoon ? "border-2 border-orange-400 bg-orange-50" : ""
                        }`}
                        onClick={() => {
                          if (availableSlots > 0) {
                            openModal("addCustomer", { account_id: account.id })
                          }
                        }}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-base sm:text-lg mb-1">{account.platform}</CardTitle>
                              <p className="text-xs sm:text-sm text-gray-600">{account.name}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openModal("editAccount", account)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete("account", account.id)
                                }}
                                className="hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Slots */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">الأماكن المتاحة:</span>
                            <span className={`font-bold ${availableSlots === 0 ? "text-red-600" : "text-green-600"}`}>
                              {availableSlots} / {account.max_slots}
                            </span>
                          </div>

                          {/* Subscribers List */}
                          {accountCustomers.length > 0 && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-700 mb-2">المشتركون:</p>
                              <div className="space-y-1">
                                {accountCustomers.map((customer) => {
                                  const days = getDaysRemaining(customer.end_date)
                                  return (
                                    <div
                                      key={customer.id}
                                      className="flex justify-between items-center text-xs bg-white p-2 rounded"
                                    >
                                      <span className="font-medium">{customer.name}</span>
                                      <span
                                        className={`px-2 py-0.5 rounded ${
                                          days <= 3
                                            ? "bg-red-100 text-red-700"
                                            : days <= 7
                                              ? "bg-yellow-100 text-yellow-700"
                                              : "bg-green-100 text-green-700"
                                        }`}
                                      >
                                        {days} يوم
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Expiry Date */}
                          {account.expiry_date && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">تاريخ الانتهاء:</span>
                              <div className="text-left">
                                <p className={`font-semibold text-xs ${isExpiringSoon ? "text-orange-700" : ""}`}>
                                  {formatDate(account.expiry_date)}
                                </p>
                                {daysRemaining !== null && (
                                  <p className={`text-xs ${isExpiringSoon ? "text-orange-600" : "text-gray-500"}`}>
                                    متبقي {daysRemaining} يوم
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Price */}
                          {account.price !== null && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">السعر:</span>
                              <span className="font-bold text-indigo-600">{account.price} ج.م</span>
                            </div>
                          )}

                          {/* Add Subscriber Button */}
                          {availableSlots > 0 && (
                            <Button
                              size="sm"
                              className="w-full bg-indigo-600 hover:bg-indigo-700"
                              onClick={(e) => {
                                e.stopPropagation()
                                openModal("addCustomer", { account_id: account.id })
                              }}
                            >
                              <UserPlus className="h-4 w-4 ml-2" />
                              إضافة مشترك ({availableSlots} متاح)
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>

                {totalAccountPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setAccountPage(1)}
                      disabled={accountPage === 1}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setAccountPage((p) => Math.max(1, p - 1))}
                      disabled={accountPage === 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium mx-2">
                      صفحة {accountPage} من {totalAccountPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setAccountPage((p) => Math.min(totalAccountPages, p + 1))}
                      disabled={accountPage === totalAccountPages}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setAccountPage(totalAccountPages)}
                      disabled={accountPage === totalAccountPages}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Expired Accounts Tab */}
            {activeTab === "expiredAccounts" && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">الحسابات المنتهية</h2>
                </div>

                {/* Time Filter for Expired Accounts */}
                <TimeFilterComponent tabName="expiredAccounts" count={getFilteredTabData("expiredAccounts").length} />
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="بحث عن حساب منتهي..."
                    value={accountSearchTerm}
                    onChange={(e) => setAccountSearchTerm(e.target.value)}
                    className="pr-10 text-base"
                  />
                </div>

                {accountSearchTerm && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                    النتائج: <span className="font-bold text-blue-600">{accounts.filter((a) => a.expiry_date && new Date(a.expiry_date) < new Date()).filter(a => a.name.toLowerCase().includes(accountSearchTerm.toLowerCase()) || a.platform.toLowerCase().includes(accountSearchTerm.toLowerCase())).length}</span> نتيجة
                  </div>
                )}

                {accounts.filter((a) => a.expiry_date && new Date(a.expiry_date) < new Date()).filter(a =>
                  accountSearchTerm
                    ? a.name.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
                      a.platform.toLowerCase().includes(accountSearchTerm.toLowerCase())
                    : true
                ).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {accounts
                      .filter((a) => a.expiry_date && new Date(a.expiry_date) < new Date())
                      .filter(a =>
                        accountSearchTerm
                          ? a.name.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
                            a.platform.toLowerCase().includes(accountSearchTerm.toLowerCase())
                          : true
                      )
                      .map((account) => {
                        const accountCustomers = getAccountCustomers(account.id)
                        return (
                          <Card
                            key={account.id}
                            className="border-2 border-red-400 bg-red-50 hover:shadow-xl transition-shadow"
                          >
                            <CardHeader className="pb-3">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <CardTitle className="text-base sm:text-lg mb-1 text-red-700">{account.platform}</CardTitle>
                                  <p className="text-xs sm:text-sm text-gray-600">{account.name}</p>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openModal("editAccount", account)}
                                    className="hover:bg-red-100"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDelete("account", account.id)}
                                    className="hover:bg-red-100 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {/* Platform */}
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">المنصة:</span>
                                <span className="font-semibold">{account.platform}</span>
                              </div>

                              {/* Subscribers Count */}
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">المشتركين:</span>
                                <span className={`font-bold ${accountCustomers.length > 0 ? "text-orange-600" : "text-gray-500"}`}>
                                  {accountCustomers.length} / {account.max_slots}
                                </span>
                              </div>

                              {/* Subscription Period */}
                              {account.subscription_period && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">فترة الاشتراك:</span>
                                  <span className="font-semibold">
                                    {account.subscription_period === "monthly"
                                      ? "شهري"
                                      : account.subscription_period === "quarterly"
                                        ? "ثلاثة أشهر"
                                        : "سنوي"}
                                  </span>
                                </div>
                              )}

                              {/* Expiry Date */}
                              {account.expiry_date && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">تاريخ الانتهاء:</span>
                                  <div className="text-left">
                                    <p className="font-semibold text-xs text-red-700">{formatDate(account.expiry_date)}</p>
                                    <p className="text-xs text-red-600">منتهي</p>
                                  </div>
                                </div>
                              )}

                              {/* Price */}
                              {account.price !== null && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">السعر:</span>
                                  <span className="font-bold text-indigo-600">{account.price} ج.م</span>
                                </div>
                              )}

                              {/* Renew Button */}
                              <Button
                                size="sm"
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => openModal("editAccount", account)}
                              >
                                <TrendingUp className="h-4 w-4 ml-2" />
                                تجديد / تعديل
                              </Button>
                            </CardContent>
                          </Card>
                        )
                      })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">لا توجد حسابات منتهية - جميع حساباتك نشطة</p>
                  </div>
                )}
              </div>
            )}

            {/* Performance Tab - Super Admin Only */}
            {activeTab === "performance" && currentAdmin?.role === "super_admin" && (() => {
              const totalNew = monthlyStats.reduce((sum, m) => sum + m.newSubscriptions, 0)
              const totalRenewals = monthlyStats.reduce((sum, m) => sum + m.renewals, 0)
              const totalExpired = monthlyStats.reduce((sum, m) => sum + m.expired, 0)
              const totalNewRevenue = monthlyStats.reduce((sum, m) => sum + (m.newRevenue || 0), 0)
              const totalRenewalRevenue = monthlyStats.reduce((sum, m) => sum + (m.renewalRevenue || 0), 0)
              const totalRevenue = totalNewRevenue + totalRenewalRevenue

              return (
              <div className="space-y-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">إحصائيات الأداء</h2>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100">
                    <p className="text-sm text-gray-600 font-medium">إجمالي الإيرادات</p>
                    <p className="text-xl sm:text-2xl font-bold text-indigo-600 mt-2">
                      {totalRevenue.toLocaleString()} ج.م
                    </p>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100">
                    <p className="text-sm text-gray-600 font-medium">اشتراكات جديدة ({totalNew})</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600 mt-2">
                      {totalNewRevenue.toLocaleString()} ج.م
                    </p>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100">
                    <p className="text-sm text-gray-600 font-medium">تجديدات ({totalRenewals})</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-2">
                      {totalRenewalRevenue.toLocaleString()} ج.م
                    </p>
                  </div>
                </div>
                
                {/* Additional Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100">
                    <p className="text-sm text-gray-600 font-medium">عدد الاشتراكات الجديدة</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600 mt-2">{totalNew}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100">
                    <p className="text-sm text-gray-600 font-medium">عدد التجديدات</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-2">{totalRenewals}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-100">
                    <p className="text-sm text-gray-600 font-medium">اشتراكات منتهية</p>
                    <p className="text-xl sm:text-2xl font-bold text-red-600 mt-2">{totalExpired}</p>
                  </div>
                </div>

                {/* Monthly Performance Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>الأداء الشهري</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-3 text-right font-semibold">الشهر</th>
                            <th className="p-3 text-right font-semibold">اشتراكات جديدة</th>
                            <th className="p-3 text-right font-semibold">إيرادات الجديدة</th>
                            <th className="p-3 text-right font-semibold">تجديدات</th>
                            <th className="p-3 text-right font-semibold">إيرادات التجديد</th>
                            <th className="p-3 text-right font-semibold">إجمالي الإيرادات</th>
                            <th className="p-3 text-right font-semibold">منته��ة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {monthlyStats.map((stat) => {
                            const totalRevenue = (stat.newRevenue || 0) + (stat.renewalRevenue || 0)
                            return (
                            <tr key={stat.month} className="hover:bg-gray-50">
                              <td className="p-3 text-sm">
                                {new Date(stat.month + "-01").toLocaleDateString("ar-EG-u-ca-gregory", {
                                  year: "numeric",
                                  month: "long",
                                  calendar: "gregory",
                                })}
                              </td>
                              <td className="p-3 text-green-600 font-semibold">{stat.newSubscriptions}</td>
                              <td className="p-3 text-green-600 font-bold">{(stat.newRevenue || 0).toLocaleString()} ج.م</td>
                              <td className="p-3 text-blue-600 font-semibold">{stat.renewals}</td>
                              <td className="p-3 text-blue-600 font-bold">{(stat.renewalRevenue || 0).toLocaleString()} ج.م</td>
                              <td className="p-3 text-indigo-600 font-bold">{totalRevenue.toLocaleString()} ج.م</td>
                              <td className="p-3 text-red-600 font-semibold">{stat.expired}</td>
                            </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
              )
            })()}

            {/* Admins Tab */}
            {activeTab === "admins" && currentAdmin?.role === "super_admin" && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">إدارة المدراء</h2>
                  <Button
                    onClick={() => openModal("addAdmin")}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 w-full sm:w-auto"
                  >
                    <ShieldCheck className="h-4 w-4 ml-2" />
                    إضافة مدير جديد
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {admins.map((admin) => (
                    <Card key={admin.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base sm:text-lg">{admin.full_name}</CardTitle>
                            <p className="text-xs sm:text-sm text-gray-600 mt-1">{admin.email}</p>
                          </div>
                          {admin.id !== currentAdmin.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete("admin", admin.id)}
                              className="hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            admin.role === "super_admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {admin.role === "super_admin" ? "مدير رئيسي" : "مدير"}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalType === "addCustomer" && "إضافة مشترك جديد"}
              {modalType === "editCustomer" && "تعديل بيانات المشترك"}
              {modalType === "renewCustomer" && "تجديد اشت��اك المشترك"}
              {modalType === "addAccount" && "إضافة حساب جديد"}
              {modalType === "editAccount" && "تعديل بيانات الحساب"}
              {modalType === "addAdmin" && "إضافة مدير جديد"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {modalType === "renewCustomer" && (
              <>
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium">{editingItem?.name}</p>
                  <p className="text-muted-foreground">تاريخ الانتهاء الحالي: {editingItem?.end_date}</p>
                </div>
                <div>
                  <Label htmlFor="renewal_email">البريد الإلكتروني</Label>
                  <Input
                    id="renewal_email"
                    name="renewal_email"
                    type="email"
                    value={formData.renewal_email || ""}
                    onChange={handleInputChange}
                    placeholder="أدخل البريد الإلكتروني للمشترك"
                  />
                </div>
                <div>
                  <Label htmlFor="renewal_account_search">الحساب الجديد *</Label>
                  <div className="relative">
                    <Input
                      id="renewal_account_search"
                      type="text"
                      placeholder="اكتب اسم الحساب أو المنصة للبحث..."
                      value={accountSearchInput}
                      onChange={(event) => {
                        setAccountSearchInput(event.target.value)
                        setShowAccountDropdown(true)
                      }}
                      onFocus={() => setShowAccountDropdown(true)}
                      required={!formData.renewal_account_id}
                    />
                    {showAccountDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-background shadow-lg">
                        {filteredAccountsForSelect.length > 0 ? (
                          filteredAccountsForSelect.map((account) => (
                            <button
                              key={account.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, renewal_account_id: account.id })
                                setAccountSearchInput(`${account.platform} - ${account.name}`)
                                setShowAccountDropdown(false)
                              }}
                              className="block w-full border-b p-3 text-right transition-colors hover:bg-muted"
                            >
                              <span className="block text-sm font-medium">{account.platform}</span>
                              <span className="block text-xs text-muted-foreground">{account.name}</span>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-sm text-muted-foreground">لا توجد حسابات مطابقة</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="renewal_start_date">بداية التجديد *</Label>
                  <Input id="renewal_start_date" name="renewal_start_date" type="date" value={formData.renewal_start_date || ""} onChange={handleInputChange} required />
                </div>
                <div>
                  <Label htmlFor="renewal_days">فترة التجديد بالأيام *</Label>
                  <Input id="renewal_days" name="renewal_days" type="number" min="1" value={formData.renewal_days || "30"} onChange={handleInputChange} required />
                </div>
                <div>
                  <Label htmlFor="renewal_price">قيمة التجديد (ج.م) *</Label>
                  <Input id="renewal_price" name="renewal_price" type="number" min="0" step="0.01" value={formData.renewal_price ?? ""} onChange={handleInputChange} required />
                </div>
              </>
            )}

            {/* Customer Form */}
            {(modalType === "addCustomer" || modalType === "editCustomer") && (
              <>
                <div>
                  <Label htmlFor="name">الاسم *</Label>
                  <Input id="name" name="name" value={formData.name || ""} onChange={handleInputChange} required />
                </div>
                <div>
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">رقم ال��اتف</Label>
                  <Input id="phone" name="phone" value={formData.phone || ""} onChange={handleInputChange} />
                </div>
                <div>
                  <Label htmlFor="account_search">الحساب *</Label>
                  <div className="relative">
                    <Input
                      id="account_search"
                      type="text"
                      placeholder="ابحث عن الحساب بالاسم أو المنصة..."
                      value={accountSearchInput}
                      onChange={(e) => {
                        setAccountSearchInput(e.target.value)
                        setShowAccountDropdown(true)
                      }}
                      onFocus={() => setShowAccountDropdown(true)}
                      className="w-full"
                    />
                    {showAccountDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-white shadow-lg z-50 max-h-64 overflow-y-auto">
                        {filteredAccountsForSelect.length > 0 ? (
                          filteredAccountsForSelect.map((account) => (
                            <div
                              key={account.id}
                              onClick={() => {
                                setFormData({ ...formData, account_id: account.id })
                                setAccountSearchInput(`${account.platform} - ${account.name}`)
                                setShowAccountDropdown(false)
                              }}
                              className="p-3 border-b hover:bg-indigo-50 cursor-pointer transition-colors"
                            >
                              <div className="font-medium text-sm">{account.platform}</div>
                              <div className="text-xs text-gray-600">{account.name}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {account.max_slots} مقعد • {account.price} ج.م
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            لا توجد حسابات مطابقة
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {formData.account_id && (
                    <p className="text-xs text-green-600 mt-1">✓ تم اختيار الحساب</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="start_date">تاريخ البدء *</Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={formData.start_date || ""}
                    onChange={handleInputChange}
                    required
                  />
                </div>
        <div>
          <Label htmlFor="end_date">تاريخ الانتهاء *</Label>
                    <Input
                      id="end_date"
                      name="end_date"
                      type="date"
                      value={formData.end_date || ""}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                <div>
                  <Label htmlFor="price">السعر (ج.م) *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    value={formData.price || ""}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                {modalType === "editCustomer" && (
                  <div>
                    <Label htmlFor="status">الحالة</Label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status || "active"}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="active">نشط</option>
                      <option value="expired">منتهي</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    id="auto_notifications"
                    name="auto_notifications"
                    type="checkbox"
                    checked={formData.auto_notifications ?? true}
                    onChange={handleInputChange}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="auto_notifications">إرسال إشعارات تلقائية</Label>
                </div>
              </>
            )}

            {/* Account Form */}
            {(modalType === "addAccount" || modalType === "editAccount") && (
              <>
                <div>
                  <Label htmlFor="platform">المنصة *</Label>
                  <Input
                    id="platform"
                    name="platform"
                    value={formData.platform || ""}
                    onChange={handleInputChange}
                    placeholder="مثال: Netflix, ChatGPT, Spotify"
                    list="platforms"
                    required
                  />
                  <datalist id="platforms">
                    <option value="Netflix"></option>
                    <option value="ChatGPT"></option>
                    <option value="Spotify"></option>
                    <option value="YouTube Premium"></option>
                    <option value="Disney+"></option>
                    <option value="Shahid"></option>
                    <option value="Adobe Creative Cloud"></option>
                  </datalist>
                </div>
                <div>
                  <Label htmlFor="name">اسم الحساب *</Label>
                  <Input id="name" name="name" value={formData.name || ""} onChange={handleInputChange} required />
                </div>
                <div>
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="password">كلمة المرور</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password || ""}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="max_slots">عدد الأماكن *</Label>
                  <Input
                    id="max_slots"
                    name="max_slots"
                    type="number"
                    value={formData.max_slots || 5}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="subscription_period">مدة الاشتراك</Label>
                  <select
                    id="subscription_period"
                    name="subscription_period"
                    value={formData.subscription_period || "monthly"}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="monthly">شهري</option>
                    <option value="quarterly">3 شهور</option>
                    <option value="yearly">سنوي</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="expiry_date">تاريخ الانتهاء</Label>
                  <Input
                    id="expiry_date"
                    name="expiry_date"
                    type="date"
                    value={formData.expiry_date || ""}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="price">السعر (ج.م)</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    value={formData.price || ""}
                    onChange={handleInputChange}
                  />
                </div>
              </>
            )}

            {/* Admin Form */}
            {modalType === "addAdmin" && (
              <>
                <div>
                  <Label htmlFor="full_name">الاسم الكامل *</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    value={formData.full_name || ""}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">البريد الإلكتروني *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">كلمة المرور *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password || ""}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role">الصلاحية</Label>
                  <select
                    id="role"
                    name="role"
                    value={formData.role || "admin"}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="admin">مدير</option>
                    <option value="super_admin">مدير رئيسي</option>
                  </select>
                </div>
              </>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                className="flex-1 sm:flex-none bg-transparent"
              >
                إلغاء
              </Button>
              <Button type="submit" className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700">
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Advanced Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تنزيل البيانات بفلاتر متقدمة</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Platform Filter */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="font-semibold text-gray-800">المنصة (اختياري):</h3>
              <select
                value={exportOptions.accountFilters.platform}
                onChange={(e) => {
                  const newPlatform = e.target.value
                  setExportOptions({
                    ...exportOptions,
                    accountFilters: { ...exportOptions.accountFilters, platform: newPlatform },
                    customerFilters: { ...exportOptions.customerFilters, platform: newPlatform, accountId: "" },
                  })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">جميع المنصات</option>
                {uniquePlatforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
              {exportOptions.accountFilters.platform && (
                <p className="text-xs text-blue-600">
                  المنصة المختارة: <strong>{exportOptions.accountFilters.platform}</strong>
                  ({accounts.filter(a => a.platform === exportOptions.accountFilters.platform).length} حساب، {customers.filter(c => accounts.filter(a => a.platform === exportOptions.accountFilters.platform).map(a => a.id).includes(c.account_id)).length} مشترك)
                </p>
              )}
            </div>

            {/* Data Types Selection */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="font-semibold text-gray-800">اختر نوع البيانات:</h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.dataTypes.customers}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        dataTypes: { ...exportOptions.dataTypes, customers: e.target.checked },
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span>العملاء/المشتركين</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.dataTypes.accounts}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        dataTypes: { ...exportOptions.dataTypes, accounts: e.target.checked },
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span>الحسابات</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.dataTypes.renewals}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        dataTypes: { ...exportOptions.dataTypes, renewals: e.target.checked },
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span>التجديدات</span>
                </label>
              </div>
            </div>

            {/* Customer Filters */}
            {exportOptions.dataTypes.customers && (
              <div className="space-y-3 border-b pb-4">
                <h3 className="font-semibold text-gray-800">فلاتر العملاء:</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">الحساب (اختياري):</label>
                    <select
                      value={exportOptions.customerFilters.accountId}
                      onChange={(e) =>
                        setExportOptions({
                          ...exportOptions,
                          customerFilters: { ...exportOptions.customerFilters, accountId: e.target.value },
                        })
                      }
                      disabled={!exportOptions.customerFilters.platform}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {exportOptions.customerFilters.platform ? "جميع الحسابات" : "اختر منصة أولاً"}
                      </option>
                      {exportOptions.customerFilters.platform
                        ? accounts
                            .filter(a => a.platform === exportOptions.customerFilters.platform)
                            .map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))
                        : accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.platform} - {account.name}
                            </option>
                          ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">حالة ال��شتراك:</label>
                    <select
                      value={exportOptions.customerFilters.status}
                      onChange={(e) =>
                        setExportOptions({
                          ...exportOptions,
                          customerFilters: { ...exportOptions.customerFilters, status: e.target.value },
                        })
                      }
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="all">الكل</option>
                      <option value="active">نشط</option>
                      <option value="expired">منتهي</option>
                      <option value="cancelled">ملغى</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={exportOptions.customerFilters.expiringOnly}
                      onChange={(e) =>
                        setExportOptions({
                          ...exportOptions,
                          customerFilters: { ...exportOptions.customerFilters, expiringOnly: e.target.checked },
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span>موشك على الانتهاء (7 أيام)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Account Filters */}
            {exportOptions.dataTypes.accounts && (
              <div className="space-y-3 border-b pb-4">
                <h3 className="font-semibold text-gray-800">فلاتر الحسابات:</h3>
                <div>
                  <label className="text-sm font-medium">حالة الحساب:</label>
                  <select
                    value={exportOptions.accountFilters.status}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        accountFilters: { ...exportOptions.accountFilters, status: e.target.value },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">الكل</option>
                    <option value="active">نشط</option>
                    <option value="expired">منتهي</option>
                  </select>
                </div>
              </div>
            )}

            {/* Date Range Filter */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="font-semibold text-gray-800">نطاق التاريخ:</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">من:</label>
                  <input
                    type="date"
                    value={exportOptions.dateRange.start}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        dateRange: { ...exportOptions.dateRange, start: e.target.value },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">إلى:</label>
                  <input
                    type="date"
                    value={exportOptions.dateRange.end}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        dateRange: { ...exportOptions.dateRange, end: e.target.value },
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowExportModal(false)}>
              إلغاء
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleAdvancedExport}
            >
              <FileDown className="h-4 w-4 mr-2" />
              تنزيل البيانات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export interface Admin {
  id: string
  email: string
  full_name: string
  role: "super_admin" | "admin"
  created_at: string
  created_by?: string
}

export interface Account {
  id: string
  name: string
  platform: string
  email?: string
  password?: string
  max_slots: number
  // <CHANGE> Added subscription tracking fields
  subscription_period: "monthly" | "quarterly" | "yearly"
  expiry_date?: string
  price: number
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  account_id: string
  start_date: string
  end_date: string
  price: number
  status: "active" | "expired" | "cancelled"
  auto_notifications: boolean
  created_at: string
  updated_at: string
}

export interface NotificationLog {
  id: string
  customer_id: string
  notification_type: "subscription_start" | "subscription_expiry" | "subscription_renewal"
  email_sent: boolean
  sent_at?: string
  error_message?: string
  created_at: string
}

// <CHANGE> Added Renewal interface to track subscription renewals
export interface Renewal {
  id: string
  customer_id: string
  account_id: string
  old_end_date: string
  new_end_date: string
  price?: number
  renewed_by?: string
  created_at: string
}

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admins table (for admin users)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES admins(id)
);

-- Accounts table (subscription platforms like ChatGPT, Netflix)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  email TEXT,
  password TEXT,
  max_slots INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers/Subscribers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price DECIMAL(10,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  auto_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications log table
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('subscription_start', 'subscription_expiry', 'subscription_renewal')),
  email_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Policies
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read all admins
CREATE POLICY "Admins can view all admins"
  ON admins FOR SELECT
  USING (auth.uid() IN (SELECT id FROM admins));

-- Policy: Super admins can insert/update/delete admins
CREATE POLICY "Super admins can manage admins"
  ON admins FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM admins WHERE role = 'super_admin')
  );

-- Policy: Admins can read all accounts
CREATE POLICY "Admins can view accounts"
  ON accounts FOR SELECT
  USING (auth.uid() IN (SELECT id FROM admins));

-- Policy: Admins can manage accounts
CREATE POLICY "Admins can manage accounts"
  ON accounts FOR ALL
  USING (auth.uid() IN (SELECT id FROM admins));

-- Policy: Admins can read all customers
CREATE POLICY "Admins can view customers"
  ON customers FOR SELECT
  USING (auth.uid() IN (SELECT id FROM admins));

-- Policy: Admins can manage customers
CREATE POLICY "Admins can manage customers"
  ON customers FOR ALL
  USING (auth.uid() IN (SELECT id FROM admins));

-- Policy: Admins can read notification logs
CREATE POLICY "Admins can view notification logs"
  ON notification_logs FOR SELECT
  USING (auth.uid() IN (SELECT id FROM admins));

-- Policy: Admins can insert notification logs
CREATE POLICY "Admins can create notification logs"
  ON notification_logs FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM admins));

-- Create indexes for better performance
CREATE INDEX idx_customers_account_id ON customers(account_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_end_date ON customers(end_date);
CREATE INDEX idx_notification_logs_customer_id ON notification_logs(customer_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

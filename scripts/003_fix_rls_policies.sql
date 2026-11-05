-- Drop existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view all admins" ON admins;
DROP POLICY IF EXISTS "Super admins can manage admins" ON admins;
DROP POLICY IF EXISTS "Admins can view accounts" ON accounts;
DROP POLICY IF EXISTS "Admins can manage accounts" ON accounts;
DROP POLICY IF EXISTS "Admins can view customers" ON customers;
DROP POLICY IF EXISTS "Admins can manage customers" ON customers;
DROP POLICY IF EXISTS "Admins can view notification logs" ON notification_logs;
DROP POLICY IF EXISTS "Admins can create notification logs" ON notification_logs;

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New policies for admins table
-- Allow anyone to check if admins exist (for setup page)
CREATE POLICY "Anyone can count admins"
  ON admins FOR SELECT
  USING (true);

-- Allow super admins to insert new admins
CREATE POLICY "Super admins can insert admins"
  ON admins FOR INSERT
  WITH CHECK (is_super_admin());

-- Allow super admins to update admins
CREATE POLICY "Super admins can update admins"
  ON admins FOR UPDATE
  USING (is_super_admin());

-- Allow super admins to delete admins
CREATE POLICY "Super admins can delete admins"
  ON admins FOR DELETE
  USING (is_super_admin());

-- New policies for accounts table
CREATE POLICY "Admins can view accounts"
  ON accounts FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert accounts"
  ON accounts FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update accounts"
  ON accounts FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete accounts"
  ON accounts FOR DELETE
  USING (is_admin());

-- New policies for customers table
CREATE POLICY "Admins can view customers"
  ON customers FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert customers"
  ON customers FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update customers"
  ON customers FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete customers"
  ON customers FOR DELETE
  USING (is_admin());

-- New policies for notification_logs table
CREATE POLICY "Admins can view notification logs"
  ON notification_logs FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert notification logs"
  ON notification_logs FOR INSERT
  WITH CHECK (is_admin());

-- Create renewals history table to track all renewals
CREATE TABLE IF NOT EXISTS renewals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  old_end_date DATE NOT NULL,
  new_end_date DATE NOT NULL,
  price DECIMAL(10,2),
  renewed_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE renewals ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view renewals
CREATE POLICY "Admins can view renewals"
  ON renewals FOR SELECT
  USING (auth.uid() IN (SELECT id FROM admins));

-- Policy: Admins can insert renewals
CREATE POLICY "Admins can create renewals"
  ON renewals FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM admins));

-- Create index for better performance
CREATE INDEX idx_renewals_customer_id ON renewals(customer_id);
CREATE INDEX idx_renewals_created_at ON renewals(created_at);

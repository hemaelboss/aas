-- Add subscription period and expiry date to accounts
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS subscription_period TEXT DEFAULT 'monthly' CHECK (subscription_period IN ('monthly', 'quarterly', 'yearly')),
ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;

-- Add comment to explain the fields
COMMENT ON COLUMN accounts.subscription_period IS 'Period of subscription: monthly, quarterly (3 months), or yearly';
COMMENT ON COLUMN accounts.expiry_date IS 'Date when the account subscription expires';
COMMENT ON COLUMN accounts.price IS 'Monthly price of the account subscription';

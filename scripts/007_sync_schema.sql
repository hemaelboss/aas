-- This script synchronizes the existing database with the provided schema structure.
-- It ensures all columns, constraints, and tables match the reference.

-- 1. Update accounts table
ALTER TABLE public.accounts 
  ALTER COLUMN id SET DEFAULT uuid_generate_v4(),
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN platform SET NOT NULL,
  ALTER COLUMN max_slots SET DEFAULT 5,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN subscription_period SET DEFAULT 'monthly',
  ALTER COLUMN price SET DEFAULT 0;

-- Add check constraint if not exists (handling potential naming conflicts)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_subscription_period_check') THEN
        ALTER TABLE public.accounts ADD CONSTRAINT accounts_subscription_period_check 
        CHECK (subscription_period = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text]));
    END IF;
END $$;

-- 2. Update admins table
ALTER TABLE public.admins
  ALTER COLUMN id SET DEFAULT uuid_generate_v4(),
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN full_name SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'admin',
  ALTER COLUMN created_at SET DEFAULT now();

-- Add check constraint for admin role
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admins_role_check') THEN
        ALTER TABLE public.admins ADD CONSTRAINT admins_role_check 
        CHECK (role = ANY (ARRAY['super_admin'::text, 'admin'::text]));
    END IF;
END $$;

-- 3. Update customers table
ALTER TABLE public.customers
  ALTER COLUMN id SET DEFAULT uuid_generate_v4(),
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN auto_notifications SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- Add check constraint for customer status
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_status_check') THEN
        ALTER TABLE public.customers ADD CONSTRAINT customers_status_check 
        CHECK (status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text]));
    END IF;
END $$;

-- 4. Update notification_logs table
ALTER TABLE public.notification_logs
  ALTER COLUMN id SET DEFAULT uuid_generate_v4(),
  ALTER COLUMN notification_type SET NOT NULL,
  ALTER COLUMN email_sent SET DEFAULT false,
  ALTER COLUMN created_at SET DEFAULT now();

-- Add check constraint for notification type
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_logs_notification_type_check') THEN
        ALTER TABLE public.notification_logs ADD CONSTRAINT notification_logs_notification_type_check 
        CHECK (notification_type = ANY (ARRAY['subscription_start'::text, 'subscription_expiry'::text, 'subscription_renewal'::text]));
    END IF;
END $$;

-- 5. Update renewals table
ALTER TABLE public.renewals
  ALTER COLUMN id SET DEFAULT uuid_generate_v4(),
  ALTER COLUMN old_end_date SET NOT NULL,
  ALTER COLUMN new_end_date SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now();

-- Ensure all foreign key constraints are properly named and present
-- Note: These tables already exist with FKs, so we primarily focus on column defaults and constraints.

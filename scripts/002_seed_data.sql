-- Insert a super admin (you'll need to create this user in Supabase Auth first)
-- Replace 'your-admin-email@example.com' with your actual email
-- After running this script, sign up with this email in the app

-- Note: The actual UUID will be generated when you sign up
-- This is just a placeholder to show the structure

-- Insert sample accounts
INSERT INTO accounts (name, platform, email, password, max_slots) VALUES
  ('ChatGPT Group 1', 'ChatGPT', 'chat1@example.com', 'password123', 5),
  ('Netflix Premium', 'Netflix', 'netflix@example.com', 'netflix123', 4),
  ('Shahid VIP', 'Shahid', 'shahid@example.com', 'shahid123', 3);

-- Sample customers (update account_id with actual UUIDs after accounts are created)
-- INSERT INTO customers (name, email, phone, account_id, start_date, end_date, price, status, auto_notifications) VALUES
--   ('أحمد محمد', 'ahmed@example.com', '01012345678', 'ACCOUNT_UUID_HERE', '2024-01-01', '2024-01-31', 100.00, 'active', true),
--   ('سارة علي', 'sara@example.com', '01198765432', 'ACCOUNT_UUID_HERE', '2024-01-01', '2024-01-31', 100.00, 'active', true);

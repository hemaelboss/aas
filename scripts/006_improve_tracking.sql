-- Add triggers to automatically track new subscriptions and expirations

-- Function to track new subscription
CREATE OR REPLACE FUNCTION track_new_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Log as new subscription on insert
  INSERT INTO notification_logs (customer_id, notification_type, email_sent, sent_at)
  VALUES (NEW.id, 'subscription_start', false, NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to track expiration
CREATE OR REPLACE FUNCTION track_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to expired, log it
  IF OLD.status != 'expired' AND NEW.status = 'expired' THEN
    INSERT INTO notification_logs (customer_id, notification_type, email_sent, sent_at)
    VALUES (NEW.id, 'subscription_expiry', false, NOW());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_new_subscription ON customers;
CREATE TRIGGER trigger_new_subscription
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION track_new_subscription();

DROP TRIGGER IF EXISTS trigger_track_expiration ON customers;
CREATE TRIGGER trigger_track_expiration
  AFTER UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION track_expiration();

-- Function to automatically expire subscriptions
CREATE OR REPLACE FUNCTION auto_expire_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE customers
  SET status = 'expired'
  WHERE end_date < CURRENT_DATE
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;

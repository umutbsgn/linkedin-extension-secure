-- SQL script to create the system_config table in Supabase

-- Create the system_config table
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the default API limit configuration
INSERT INTO system_config (key, value, description)
VALUES (
  'api_usage_limits',
  '{"monthly_limit": 50}',
  'Configuration for API usage limits'
)
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Create RLS policies for the system_config table
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Policy to allow only authenticated users with admin role to modify the system_config table
CREATE POLICY "Only admins can modify system config"
  ON system_config
  USING (auth.jwt() ? 'is_admin' AND auth.jwt()->>'is_admin' = 'true');

-- Policy to allow all authenticated users to read the system_config table
CREATE POLICY "All authenticated users can read system config"
  ON system_config
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create a function to get the API usage limit
CREATE OR REPLACE FUNCTION get_api_usage_limit()
RETURNS INTEGER AS $$
DECLARE
  config_value JSONB;
  monthly_limit INTEGER;
BEGIN
  SELECT value INTO config_value FROM system_config WHERE key = 'api_usage_limits';
  
  IF config_value IS NULL THEN
    RETURN 50; -- Default value if config doesn't exist
  END IF;
  
  monthly_limit := (config_value->>'monthly_limit')::INTEGER;
  
  IF monthly_limit IS NULL OR monthly_limit < 1 THEN
    RETURN 50; -- Default value if monthly_limit is invalid
  END IF;
  
  RETURN monthly_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

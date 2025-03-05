-- SQL script to create the api_usage table in Supabase

-- Create the api_usage table
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  calls_count INTEGER DEFAULT 0,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS api_usage_user_month_idx ON api_usage(user_id, month);

-- Create RLS policies for the api_usage table
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read only their own usage data
CREATE POLICY "Users can read their own usage data"
  ON api_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy to allow users to insert their own usage data
CREATE POLICY "Users can insert their own usage data"
  ON api_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own usage data
CREATE POLICY "Users can update their own usage data"
  ON api_usage
  FOR UPDATE
  USING (auth.uid() = user_id);

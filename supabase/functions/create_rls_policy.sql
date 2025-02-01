CREATE OR REPLACE FUNCTION public.create_rls_policy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the policy already exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_settings'
      AND policyname = 'Users can only access their own settings'
  ) THEN
    -- Create the policy if it doesn't exist
    CREATE POLICY "Users can only access their own settings"
      ON public.user_settings
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Enable RLS on the user_settings table
  ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
END;
$$;

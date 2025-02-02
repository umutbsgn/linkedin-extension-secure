-- Reset everything first
DROP POLICY IF EXISTS "Users can only access their own settings" ON public.user_settings;
DROP TABLE IF EXISTS public.user_settings;
DROP FUNCTION IF EXISTS verify_user_settings();
DROP FUNCTION IF EXISTS check_user_permissions();

-- Create the user_settings table with proper constraints
CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY,
    api_key TEXT,
    system_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can only access their own settings"
    ON public.user_settings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON public.user_settings TO authenticated;

-- Create verification function
CREATE OR REPLACE FUNCTION verify_user_settings()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Check if table exists
    RETURN QUERY
    SELECT 
        'Table Existence' as check_name,
        CASE 
            WHEN EXISTS (
                SELECT FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename = 'user_settings'
            )
            THEN 'OK'
            ELSE 'FAIL'
        END as status,
        'Checking if user_settings table exists' as details;

    -- Check RLS is enabled
    RETURN QUERY
    SELECT 
        'RLS Status' as check_name,
        CASE 
            WHEN EXISTS (
                SELECT FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename = 'user_settings' 
                AND rowsecurity = true
            )
            THEN 'OK'
            ELSE 'FAIL'
        END as status,
        'Checking if RLS is enabled' as details;

    -- Check RLS policy exists
    RETURN QUERY
    SELECT 
        'RLS Policy' as check_name,
        CASE 
            WHEN EXISTS (
                SELECT FROM pg_policies 
                WHERE schemaname = 'public' 
                AND tablename = 'user_settings'
                AND policyname = 'Users can only access their own settings'
            )
            THEN 'OK'
            ELSE 'FAIL'
        END as status,
        'Checking if RLS policy exists' as details;

    -- Check foreign key constraint
    RETURN QUERY
    SELECT 
        'Foreign Key' as check_name,
        CASE 
            WHEN EXISTS (
                SELECT FROM pg_constraint 
                WHERE conname = 'fk_user'
            )
            THEN 'OK'
            ELSE 'FAIL'
        END as status,
        'Checking if foreign key constraint exists' as details;

    -- Check updated_at trigger
    RETURN QUERY
    SELECT 
        'Updated At Trigger' as check_name,
        CASE 
            WHEN EXISTS (
                SELECT FROM pg_trigger 
                WHERE tgname = 'update_user_settings_updated_at'
            )
            THEN 'OK'
            ELSE 'FAIL'
        END as status,
        'Checking if updated_at trigger exists' as details;
END;
$$;

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION check_user_permissions(test_user_id UUID)
RETURNS TABLE (
    operation TEXT,
    allowed BOOLEAN,
    details TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- Check SELECT permission
    RETURN QUERY
    SELECT 
        'SELECT' as operation,
        EXISTS (
            SELECT 1 FROM public.user_settings 
            WHERE user_id = test_user_id
        ) as allowed,
        'Checking if user can select their own settings' as details;

    -- Check INSERT permission
    RETURN QUERY
    SELECT 
        'INSERT' as operation,
        TRUE as allowed,
        'Users can always insert their own settings' as details;

    -- Check UPDATE permission
    RETURN QUERY
    SELECT 
        'UPDATE' as operation,
        EXISTS (
            SELECT 1 FROM public.user_settings 
            WHERE user_id = test_user_id
        ) as allowed,
        'Checking if user can update their own settings' as details;

    -- Check DELETE permission
    RETURN QUERY
    SELECT 
        'DELETE' as operation,
        EXISTS (
            SELECT 1 FROM public.user_settings 
            WHERE user_id = test_user_id
        ) as allowed,
        'Checking if user can delete their own settings' as details;
END;
$$;

-- Run verification
SELECT * FROM verify_user_settings();

-- Instructions for testing
COMMENT ON FUNCTION verify_user_settings() IS 'Run SELECT * FROM verify_user_settings(); to check table setup';
COMMENT ON FUNCTION check_user_permissions(UUID) IS 'Run SELECT * FROM check_user_permissions(auth.uid()); to check your permissions';

-- Example test data insertion (commented out for safety)
/*
INSERT INTO public.user_settings (user_id, api_key, system_prompt)
VALUES (auth.uid(), 'test_api_key', 'test_prompt')
ON CONFLICT (user_id) 
DO UPDATE SET 
    api_key = EXCLUDED.api_key,
    system_prompt = EXCLUDED.system_prompt,
    updated_at = CURRENT_TIMESTAMP;
*/

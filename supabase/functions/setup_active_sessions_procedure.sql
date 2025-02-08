-- Create the setup_active_sessions stored procedure
CREATE OR REPLACE FUNCTION public.setup_active_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Create active_sessions table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.active_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        session_id TEXT NOT NULL,
        last_active TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, session_id),
        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
    );

    -- Create index on user_id for faster lookups
    CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON public.active_sessions(user_id);

    -- Enable Row Level Security
    ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

    -- Create policies
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'active_sessions' AND policyname = 'Users can insert their own sessions'
        ) THEN
            CREATE POLICY "Users can insert their own sessions"
            ON public.active_sessions FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'active_sessions' AND policyname = 'Users can update their own sessions'
        ) THEN
            CREATE POLICY "Users can update their own sessions"
            ON public.active_sessions FOR UPDATE
            USING (auth.uid() = user_id);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'active_sessions' AND policyname = 'Users can delete their own sessions'
        ) THEN
            CREATE POLICY "Users can delete their own sessions"
            ON public.active_sessions FOR DELETE
            USING (auth.uid() = user_id);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'active_sessions' AND policyname = 'Users can select their own sessions'
        ) THEN
            CREATE POLICY "Users can select their own sessions"
            ON public.active_sessions FOR SELECT
            USING (auth.uid() = user_id);
        END IF;
    END
    $$;

    -- Create a function to enforce one session per user
    CREATE OR REPLACE FUNCTION public.enforce_one_session_per_user()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Delete any existing sessions for the user
        DELETE FROM public.active_sessions
        WHERE user_id = NEW.user_id AND session_id != NEW.session_id;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create a trigger to call the function on insert or update
    DROP TRIGGER IF EXISTS enforce_one_session_trigger ON public.active_sessions;
    CREATE TRIGGER enforce_one_session_trigger
    BEFORE INSERT OR UPDATE ON public.active_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_one_session_per_user();

END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.setup_active_sessions() TO authenticated;

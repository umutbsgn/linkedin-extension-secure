# LinkedIn Extension Backend

This is the backend for the LinkedIn AI Assistant browser extension. It provides secure API endpoints for the extension to interact with external services like Anthropic, Supabase, and PostHog.

## Features

- Secure API endpoints for Anthropic Claude AI
- Authentication via Supabase
- User settings management
- Beta access control
- Analytics tracking via PostHog

## Setup

### Prerequisites

- Node.js 18+ and npm
- A Supabase account with a project set up
- A Vercel account
- PostHog account (optional for analytics)

### Local Development

1. Clone this repository:
   ```bash
   git clone https://github.com/umutbsgn/linkedin-extension-backend.git
   cd linkedin-extension-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Fill in the environment variables in the `.env` file:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon key (from Project Settings > API)
   - `SUPABASE_SERVICE_KEY`: Your Supabase service role key (from Project Settings > API)
   - `POSTHOG_API_KEY`: Your PostHog API key
   - `POSTHOG_API_HOST`: Your PostHog API host (e.g., https://eu.i.posthog.com)

5. Run the development server:
   ```bash
   npm run dev
   ```

### Supabase Setup

1. Create the following tables in your Supabase project:

   - `user_settings` table:
     ```sql
     CREATE TABLE user_settings (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id UUID REFERENCES auth.users(id) NOT NULL,
       api_key TEXT,
       system_prompt TEXT,
       connect_system_prompt TEXT,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
     );
     ```

   - `beta_whitelist` table:
     ```sql
     CREATE TABLE beta_whitelist (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       email TEXT UNIQUE NOT NULL,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
     );
     ```

2. Set up Row Level Security (RLS) policies:
   ```sql
   -- For user_settings table
   ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can view their own settings"
     ON user_settings
     FOR SELECT
     USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can update their own settings"
     ON user_settings
     FOR UPDATE
     USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can insert their own settings"
     ON user_settings
     FOR INSERT
     WITH CHECK (auth.uid() = user_id);
   ```

## Deployment to Vercel

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. Connect your GitHub repository to Vercel:
   - Go to [Vercel](https://vercel.com) and sign in
   - Click "New Project"
   - Import your GitHub repository
   - Configure the project:
     - Framework Preset: Other
     - Root Directory: ./
     - Build Command: npm run build (or leave empty)
     - Output Directory: (leave empty)
     - Install Command: npm install

3. Add Environment Variables:
   - Add all the variables from your `.env` file to the Vercel project settings

4. Deploy:
   - Click "Deploy"
   - Wait for the deployment to complete
   - Your API will be available at the provided Vercel URL

5. Update the extension's config.js:
   - Set `VERCEL_BACKEND_URL` to your Vercel deployment URL

## API Endpoints

- `POST /api/anthropic/analyze`: Analyze text using Claude AI
- `POST /api/analytics/track`: Track events in PostHog
- `POST /api/supabase/auth/login`: Login with Supabase
- `POST /api/supabase/auth/signup`: Register with Supabase
- `GET/POST /api/supabase/user-settings`: Get or update user settings
- `GET /api/supabase/beta-access`: Check if an email has beta access

## Security

This backend is designed to keep API keys secure by:

1. Storing all API keys as environment variables on the server
2. Authenticating all requests using Supabase JWT tokens
3. Using server-side API calls to external services
4. Implementing proper CORS headers

## License

MIT

# LinkedIn AI Assistant API Proxy

This is a secure API proxy for the LinkedIn AI Assistant browser extension. It handles API calls to Anthropic, Supabase, and PostHog, keeping API keys secure on the server side.

## Features

- Secure API key storage using environment variables
- CORS handling for browser extension requests
- Proxy endpoints for:
  - Anthropic Claude API
  - Supabase authentication and data storage
  - PostHog analytics tracking

## API Endpoints

### Anthropic

- `POST /api/anthropic/analyze`: Analyze text using Claude AI

### Supabase Authentication

- `POST /api/supabase/auth/login`: Login with email and password
- `POST /api/supabase/auth/signup`: Register a new user

### Supabase Data

- `POST /api/supabase/user-settings`: Get, update, or insert user settings
- `POST /api/supabase/beta-access`: Check if an email is in the beta whitelist

### Analytics

- `POST /api/analytics/track`: Track events in PostHog

## Development

### Prerequisites

- Node.js 14+
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   POSTHOG_API_KEY=your_posthog_api_key
   POSTHOG_API_HOST=your_posthog_host
   ALLOWED_ORIGINS=chrome-extension://your-extension-id
   ```
4. Run the development server:
   ```
   npm run dev
   ```

## Deployment

### Vercel

1. Push the code to a GitHub repository
2. Connect the repository to Vercel
3. Configure the environment variables in the Vercel dashboard
4. Deploy

## Security Considerations

- API keys are stored securely as environment variables
- CORS is configured to only allow requests from the browser extension
- All API calls are made server-side, not from the browser

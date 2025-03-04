# Auto LinkedIn Comment AI - Chrome Extension

A Chrome extension for AI-powered LinkedIn interactions using Claude AI by Anthropic.

## Security Enhancements

This extension has been secured by moving all API keys to a Vercel backend. All API calls are now routed through the Vercel backend, ensuring that sensitive API keys are not exposed in the client-side code.

### Key Security Features

1. **API Key Protection**: 
   - Anthropic API key is retrieved from the user's Supabase settings
   - Supabase and PostHog API keys are stored securely as environment variables on the Vercel backend
2. **Comprehensive Tracking**: All API calls are tracked through PostHog for monitoring and analytics
3. **Beta Access Control**: Beta access is verified directly against the Supabase beta_whitelist table
4. **Reduced Permissions**: The extension's permissions have been minimized to only what's necessary

## Deployment Instructions

### 1. Deploy the Vercel Backend

1. Clone this repository
2. Create a new Vercel project
3. Deploy the project to Vercel
4. Set up the following environment variables in your Vercel project settings:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
POSTHOG_API_KEY=your_posthog_api_key
POSTHOG_API_HOST=your_posthog_host
```

### 2. Update the Extension Configuration

If you've deployed the Vercel backend to a different URL than the default, update the `VERCEL_BACKEND_URL` in `config.js` to point to your deployed Vercel app URL.

## Architecture

The extension now uses a secure architecture where all sensitive API calls are routed through a Vercel backend:

1. **Chrome Extension**: The client-side code that runs in the browser
2. **Vercel Backend**: A serverless backend that handles all API calls to external services
3. **External APIs**: Anthropic, Supabase, and PostHog

All API keys are stored securely as environment variables in the Vercel backend, not in the client-side code.

## API Endpoints

The Vercel backend provides the following API endpoints:

- `/api/anthropic/analyze`: Proxy for Anthropic API calls with tracking
- `/api/supabase/auth/login`: Handle Supabase login with tracking
- `/api/supabase/auth/signup`: Handle Supabase signup with tracking
- `/api/supabase/user-settings`: Handle user settings operations with tracking
- `/api/supabase/beta-access`: Handle beta access verification with tracking
- `/api/analytics/track`: Handle PostHog analytics tracking

### Tracking Implementation

All API endpoints include comprehensive tracking:

1. **Request Tracking**: Every API call is tracked with details like method, parameters, and user ID
2. **Success Tracking**: Successful API calls are tracked with response metrics
3. **Error Tracking**: Failed API calls are tracked with error details
4. **Performance Metrics**: Response times are tracked for all API calls

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file based on `.env.example`
4. Run the extension locally

## Building for Production

1. Build the extension: `npm run build`
2. The built extension will be in the `dist` directory
3. Load the unpacked extension in Chrome from the `dist` directory

## Publishing to Chrome Web Store

1. Create a ZIP file of the `dist` directory
2. Upload the ZIP file to the Chrome Web Store Developer Dashboard
3. Submit for review

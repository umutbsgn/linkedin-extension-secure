# SaasBrowserExtension

This project is a Chrome extension that integrates with the Anthropic API for AI-powered LinkedIn interactions, using Supabase for authentication and data storage.

## Features

- Analyze LinkedIn posts using AI
- User authentication with Supabase
- Save and manage Anthropic API key
- Customize system prompts for AI analysis

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing this project
5. The extension should now be installed and visible in your Chrome toolbar

## Supabase Setup

Before using the extension, you need to set up your Supabase project:

1. Create a new Supabase project if you haven't already
2. In your Supabase project, create a new table called `user_settings` with the following columns:
   - `id` (uuid, primary key)
   - `user_id` (uuid, foreign key to auth.users)
   - `api_key` (text)
   - `system_prompt` (text)
3. In the Supabase SQL editor, paste and execute the contents of the `supabase/functions/create_rls_policy.sql` file. This will create a function to set up the necessary Row Level Security policy.

## Usage

1. Click on the extension icon in the Chrome toolbar
2. Register or log in using your Supabase credentials
3. Enter your Anthropic API key
4. Customize the system prompt if desired
5. Navigate to LinkedIn and use the "Analyze with AI" button on posts

## Development

To make changes to the extension:

1. Modify the necessary files
2. If you've made changes to the manifest or background scripts, you may need to reload the extension in `chrome://extensions`
3. For changes to the popup or content scripts, you can usually just refresh the page

## Troubleshooting

If you encounter issues with saving user settings, ensure that:
1. You've executed the `create_rls_policy.sql` function in your Supabase project
2. The `user_settings` table has the correct structure
3. You're properly authenticated in the extension

## License

[MIT License](LICENSE)

import { createClient } from './popup/supabase-client.js';

const supabaseUrl = 'https://fslbhbywcxqmqhwdcgcl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGJoYnl3Y3hxbXFod2RjZ2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MTc2MTQsImV4cCI6MjA1Mzk5MzYxNH0.vOWNflNbXMjzvjVbNPDZdwQqt2jUFy0M2gnt-msWQMM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getApiKey() {
  const result = await chrome.storage.local.get('anthropicApiKey');
  return result.anthropicApiKey;
}

async function callAnthropicAPI(prompt, systemPrompt) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('API key not found. Please set your Anthropic API key in the extension options.');
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze") {
    callAnthropicAPI(request.text, request.systemPrompt)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates an asynchronous response
  } else if (request.action === "storeSupabaseToken") {
    chrome.storage.local.set({ supabaseAuthToken: request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === "getSupabaseToken") {
    chrome.storage.local.get('supabaseAuthToken', (result) => {
      sendResponse({ token: result.supabaseAuthToken });
    });
    return true;
  }
});

// Initialize Supabase session
chrome.runtime.onInstalled.addListener(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      chrome.storage.local.set({ supabaseAuthToken: session.access_token });
    }
  });
});

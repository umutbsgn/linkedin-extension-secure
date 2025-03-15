import React from 'react';

export default function Home() {
  return (
    <div style={{fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6}}>
      <h1>LinkedIn AI Assistant API Proxy</h1>
      <p>This is a secure API proxy for the LinkedIn AI Assistant browser extension.</p>
      <p>This server securely handles API calls to:</p>
      <ul>
        <li>Anthropic API</li>
        <li>Supabase API</li>
        <li>PostHog Analytics</li>
      </ul>
      <p>All API keys are securely stored as environment variables on the server.</p>
      <p><strong>Note:</strong> This page is informational only. The actual API endpoints are not accessible directly through a browser.</p>
    </div>
  );
}

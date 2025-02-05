import { createClient } from './supabase-client.js';

const supabaseUrl = 'https://fslbhbywcxqmqhwdcgcl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGJoYnl3Y3hxbXFod2RjZ2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MTc2MTQsImV4cCI6MjA1Mzk5MzYxNH0.vOWNflNbXMjzvjVbNPDZdwQqt2jUFy0M2gnt-msWQMM';
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyButton = document.getElementById('saveApiKey');
  const showApiKeyButton = document.getElementById('showApiKey');
  const apiKeyStatus = document.getElementById('apiKeyStatus');
  const promptInput = document.getElementById('prompt');
  const submitButton = document.getElementById('submit');
  const responseDiv = document.getElementById('response');
  const systemPromptInput = document.getElementById('systemPrompt');
  const savePromptButton = document.getElementById('savePrompt');
  const resetPromptButton = document.getElementById('resetPrompt');
  const authForm = document.getElementById('authForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginButton = document.getElementById('loginButton');
  const registerButton = document.getElementById('registerButton');
  const authStatus = document.getElementById('authStatus');
  const signOutButton = document.getElementById('signOutButton');

const DEFAULT_SYSTEM_PROMPT = `You are a flexible LinkedIn communication partner. Your task is to analyze the author's style, respond accordingly, and provide casual value. Your response should be concise, maximum 120 characters, and written directly in the author's style.`;
const ANTHROPIC_API_KEY = 'anthropicApiKey';

// Initialize extension
initializeExtension();

// Migrate old API key if exists
migrateOldApiKey();

async function migrateOldApiKey() {
  const result = await chrome.storage.local.get(['apiKey', ANTHROPIC_API_KEY]);
  if (result.apiKey && !result[ANTHROPIC_API_KEY]) {
    await chrome.storage.local.set({ [ANTHROPIC_API_KEY]: result.apiKey });
    await chrome.storage.local.remove('apiKey');
    console.log('Migrated old API key to new format');
  }
}

// Event listeners
saveApiKeyButton.addEventListener('click', saveUserSettings);
showApiKeyButton.addEventListener('click', toggleApiKeyVisibility);
submitButton.addEventListener('click', analyzeText);
resetPromptButton.addEventListener('click', resetSystemPrompt);
loginButton.addEventListener('click', () => authenticate('login'));
registerButton.addEventListener('click', () => authenticate('register'));
signOutButton.addEventListener('click', signOut);
savePromptButton.addEventListener('click', saveUserSettings);

// Functions
async function initializeExtension() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showAuthenticatedUI();
    await loadUserSettings();
  } else {
    showUnauthenticatedUI();
  }
}

async function loadUserSettings() {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .single();

    if (error) throw error;

    if (data) {
      apiKeyInput.value = data.api_key || '';
      systemPromptInput.value = data.system_prompt || DEFAULT_SYSTEM_PROMPT;
      await chrome.storage.local.set({ 
        [ANTHROPIC_API_KEY]: data.api_key,
        systemPrompt: data.system_prompt
      });
      showStatus('User settings loaded successfully', 'success');
    } else {
      await saveUserSettings();
    }
  } catch (error) {
    showStatus('Error loading user settings: ' + error.message, 'error');
  }
}

async function saveUserSettings(retryCount = 0) {
  const apiKey = apiKeyInput.value.trim();
  const systemPrompt = systemPromptInput.value.trim();

  try {
    console.log('Attempting to save user settings...');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error('Failed to get user session: ' + sessionError.message);
    }
    
    if (!session || !session.user) {
      throw new Error('User not authenticated');
    }

    const settingsData = { 
      api_key: apiKey, 
      system_prompt: systemPrompt,
      updated_at: new Date().toISOString()
    };

    // Versuche zuerst ein Update
    const { data: updateData, error: updateError } = await supabase
      .from('user_settings')
      .update(settingsData)
      .eq('user_id', session.user.id);

    console.log('Update result:', { updateData, updateError });

    // Wenn keine Zeilen aktualisiert wurden, versuche einen Insert
    if (!updateData || updateError?.message === 'No rows were updated') {
      console.log('No rows updated, attempting insert...');
      const { data: insertData, error: insertError } = await supabase
        .from('user_settings')
        .insert({
          ...settingsData,
          user_id: session.user.id
        });

      if (insertError) {
        throw new Error('Failed to save settings: ' + insertError.message);
      }
      console.log('Insert result:', insertData);
    }

    // Update local storage
    await chrome.storage.local.set({ 
      [ANTHROPIC_API_KEY]: apiKey, 
      systemPrompt 
    });

    showStatus('Settings saved successfully', 'success');

  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus(`Error: ${error.message}`, 'error');
  }
}

async function createRLSPolicy() {
  try {
    await supabase.rpc('create_rls_policy');
    console.log('RLS policy created successfully');
  } catch (error) {
    console.error('Error creating RLS policy:', error);
    throw error;
  }
}

  function toggleApiKeyVisibility() {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      showApiKeyButton.textContent = '🔒';
    } else {
      apiKeyInput.type = 'password';
      showApiKeyButton.textContent = '👁️';
    }
  }

  async function analyzeText() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      showStatus('Please enter text to analyze', 'error');
      return;
    }

    try {
      submitButton.disabled = true;
      responseDiv.textContent = 'Analyzing...';

      const { [ANTHROPIC_API_KEY]: anthropicApiKey, systemPrompt } = await chrome.storage.local.get([ANTHROPIC_API_KEY, 'systemPrompt']);

      const response = await chrome.runtime.sendMessage({
        action: 'analyze',
        text: prompt,
        apiKey: anthropicApiKey,
        systemPrompt: systemPrompt
      });

      if (response.success) {
        responseDiv.textContent = response.data.content[0].text;
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
      responseDiv.textContent = '';
    } finally {
      submitButton.disabled = false;
    }
  }

  function resetSystemPrompt() {
    systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
    saveUserSettings();
  }

  async function authenticate(action) {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showAuthStatus('Please enter both email and password', 'error');
      return;
    }

    try {
      let result;
      if (action === 'login') {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        result = await supabase.auth.signUp({ email, password });
      }

      if (result.error) throw result.error;

      if (action === 'login') {
        showAuthStatus('Login successful', 'success');
        showAuthenticatedUI();
        await loadUserSettings();
        await notifyAuthStatusChange('authenticated');
      } else {
        showAuthStatus('Registration successful. Please check your email to confirm your account.', 'success');
      }
    } catch (error) {
      showAuthStatus(`${action === 'login' ? 'Login' : 'Registration'} error: ${error.message}`, 'error');
    }
  }

async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    showAuthStatus('Logged out successfully', 'success');
    showUnauthenticatedUI();
    // Clear input fields
    apiKeyInput.value = '';
    systemPromptInput.value = '';
    emailInput.value = '';
    passwordInput.value = '';
    await chrome.storage.local.remove([ANTHROPIC_API_KEY, 'systemPrompt', 'supabaseAuthToken']);
    await notifyAuthStatusChange('unauthenticated');
  } catch (error) {
    showAuthStatus('Logout error: ' + error.message, 'error');
  }
}

// Function to check if user is authenticated
async function isUserAuthenticated() {
  try {
    const result = await chrome.storage.local.get([ANTHROPIC_API_KEY, 'supabaseAuthToken']);
    return !!(result[ANTHROPIC_API_KEY] && result.supabaseAuthToken);
  } catch (error) {
    console.error('Error checking authentication status:', error);
    return false;
  }
}

  // Function to notify all LinkedIn tabs about auth status changes
  async function notifyAuthStatusChange(status) {
    try {
      const tabs = await chrome.tabs.query({url: '*://*.linkedin.com/*'});
      for (const tab of tabs) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'auth_status_changed',
          status: status
        });
      }
    } catch (error) {
      console.error('Error notifying tabs:', error);
    }
  }

  function showAuthenticatedUI() {
    authForm.style.display = 'none';
    document.querySelectorAll('.authenticated').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.unauthenticated').forEach(el => el.style.display = 'none');
  }

  function showUnauthenticatedUI() {
    authForm.style.display = 'block';
    document.querySelectorAll('.authenticated').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.unauthenticated').forEach(el => el.style.display = 'block');
  }

  function showStatus(message, type) {
    apiKeyStatus.textContent = message;
    apiKeyStatus.className = `status-message ${type}`;
    setTimeout(() => {
      apiKeyStatus.textContent = '';
      apiKeyStatus.className = 'status-message';
    }, 3000);
  }

  function showAuthStatus(message, type) {
    authStatus.textContent = message;
    authStatus.className = `status-message ${type}`;
    setTimeout(() => {
      authStatus.className = 'status-message';
    }, 3000);
  }
});

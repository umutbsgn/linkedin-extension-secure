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

  // Initialize extension
  initializeExtension();

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
          anthropicApiKey: data.api_key,
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
      console.error('Session error:', sessionError);
      throw new Error('Failed to get user session');
    }
    
    if (!session || !session.user) {
      console.error('No active session found');
      throw new Error('User not authenticated');
    }

    console.log('User authenticated, saving settings...');
    
    const settingsData = { 
      api_key: apiKey, 
      system_prompt: systemPrompt,
      updated_at: new Date().toISOString()
    };

    // Try to update first
    const { data: updateData, error: updateError } = await supabase
      .from('user_settings')
      .update(settingsData)
      .eq('user_id', session.user.id);

    if (updateError) {
      console.error('Update error:', updateError);
      
      // If update fails because no row exists, then insert
      if (updateError.code === 'PGRST116') {
        console.log('No existing record found, attempting insert...');
        const { data: insertData, error: insertError } = await supabase
          .from('user_settings')
          .insert({...settingsData, user_id: session.user.id});

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        } else {
          console.log('Insert successful');
        }
      } else if (updateError.message && updateError.message.includes('violates row-level security policy')) {
        console.log('RLS policy violation detected, attempting to create policy...');
        await createRLSPolicy();
        console.log('RLS policy created, retrying update...');
        const { error: retryError } = await supabase
          .from('user_settings')
          .update(settingsData)
          .eq('user_id', session.user.id);
        if (retryError) {
          console.error('Retry update error:', retryError);
          throw retryError;
        }
        console.log('Retry update successful');
      } else {
        throw updateError;
      }
    } else {
      console.log('Update successful');
    }

    console.log('Settings saved to Supabase, updating local storage...');
    await chrome.storage.local.set({ anthropicApiKey: apiKey, systemPrompt });
    console.log('Local storage updated successfully');
    showStatus('User settings saved successfully', 'success');
  } catch (error) {
    console.error('Error saving user settings:', error);
    if ((error.message && (error.message.includes('Network error') || error.message.includes('Failed to fetch'))) && retryCount < 3) {
      showStatus(`Network error occurred. Retrying... (${retryCount + 1}/3)`, 'warning');
      setTimeout(() => saveUserSettings(retryCount + 1), 2000);
    } else {
      showStatus(`Error saving user settings: ${error.message || JSON.stringify(error)}. Please check your internet connection and try again.`, 'error');
    }
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

      const { anthropicApiKey, systemPrompt } = await chrome.storage.local.get(['anthropicApiKey', 'systemPrompt']);

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
      await chrome.storage.local.remove(['anthropicApiKey', 'systemPrompt']);
    } catch (error) {
      showAuthStatus('Logout error: ' + error.message, 'error');
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

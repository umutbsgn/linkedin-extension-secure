import { createClient } from './supabase-client.js';
import { checkBetaAccess } from './beta-validator.js';
import { API_ENDPOINTS } from '../config.js';
import {
    initAnalytics,
    trackEvent,
    trackLoginAttempt,
    trackLoginSuccess,
    trackLoginFailure,
    trackRegistrationAttempt,
    trackRegistrationSuccess,
    trackRegistrationFailure,
    trackSessionStart,
    identifyUserWithSupabase
} from './analytics.js';

// Initialize Supabase client with async function
let supabase = null;

async function initSupabase() {
    try {
        // Fetch Supabase URL and key from Vercel backend
        const urlResponse = await fetch(API_ENDPOINTS.SUPABASE_URL);
        const keyResponse = await fetch(API_ENDPOINTS.SUPABASE_KEY);

        if (!urlResponse.ok || !keyResponse.ok) {
            console.error('Failed to fetch Supabase configuration');
            // Return null instead of using hardcoded values
            return null;
        }

        const { url } = await urlResponse.json();
        const { key } = await keyResponse.json();

        return createClient(url, key);
    } catch (error) {
        console.error('Error initializing Supabase:', error);
        // Return null instead of using hardcoded values
        return null;
    }
}

// Initialize Supabase client
initSupabase().then(client => {
    supabase = client;
    console.log('Supabase client initialized');
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle tracking events from background script
    if (request.action === 'posthog_track_from_background') {
        try {
            console.log('Received tracking event from background:', request.eventName);

            // Handle specific event types directly
            if (request.eventName === 'post_comment' || request.eventName === 'connection_message') {
                // Use trackEvent from analytics.js to ensure consistent tracking
                trackEvent(request.eventName, request.properties);

                // Also try to use window.posthog directly as a backup
                if (window.posthog) {
                    window.posthog.capture(request.eventName, request.properties);
                    console.log(`${request.eventName} event tracked from background:`, request.properties);
                }
            }
            // Prioritize Autocapture
            else if (request.eventName === 'Autocapture') {
                // Use trackEvent from analytics.js to ensure consistent tracking
                trackEvent('Autocapture', request.properties);

                // Also try to use window.posthog directly as a backup
                if (window.posthog) {
                    window.posthog.capture('Autocapture', request.properties);
                    console.log(`Autocapture event tracked from background:`, request.properties);
                }
            }
            // For any other events, map to post_comment (preferred)
            else {
                const mappedProperties = {
                    ...request.properties,
                    original_event: request.eventName
                };

                trackEvent('post_comment', mappedProperties);

                if (window.posthog) {
                    window.posthog.capture('post_comment', mappedProperties);
                    console.log(`Event mapped to post_comment: ${request.eventName}`, mappedProperties);
                }
            }

            if (sendResponse) {
                sendResponse({ success: true });
            }
        } catch (error) {
            console.error('Error handling posthog_track_from_background:', error);
            if (sendResponse) {
                sendResponse({ success: false, error: error.message });
            }
        }
        return true;
    }
});

document.addEventListener('DOMContentLoaded', async() => {
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
    const connectSystemPromptInput = document.getElementById('connectSystemPrompt');
    const saveConnectPromptButton = document.getElementById('saveConnectPrompt');
    const resetConnectPromptButton = document.getElementById('resetConnectPrompt');
    const authForm = document.getElementById('authForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    const authStatus = document.getElementById('authStatus');
    const signOutButton = document.getElementById('signOutButton');
    const postsTab = document.getElementById('postsTab');
    const connectTab = document.getElementById('connectTab');
    const postsContent = document.getElementById('postsContent');
    const connectContent = document.getElementById('connectContent');

    const DEFAULT_SYSTEM_PROMPT = `You are a flexible LinkedIn communication partner. Your task is to analyze the author's style, respond accordingly, and provide casual value. Your response should be concise, maximum 120 characters, and written directly in the author's style.`;
    const DEFAULT_CONNECT_SYSTEM_PROMPT = `You are a LinkedIn connection request assistant. Your task is to analyze the recipient's profile and craft a personalized, concise connection message. Keep it friendly, professional, and highlight a shared interest or mutual benefit. Maximum 160 characters.`;
    const ANTHROPIC_API_KEY = 'anthropicApiKey';

    // Initialize extension
    initializeExtension();

    // Migrate old API key if exists
    migrateOldApiKey();

    async function migrateOldApiKey() {
        const result = await chrome.storage.local.get(['apiKey', ANTHROPIC_API_KEY]);
        if (result.apiKey && !result[ANTHROPIC_API_KEY]) {
            await chrome.storage.local.set({
                [ANTHROPIC_API_KEY]: result.apiKey
            });
            await chrome.storage.local.remove('apiKey');
            console.log('Migrated old API key to new format');
        }
    }

    // Event listeners
    saveApiKeyButton.addEventListener('click', saveUserSettings);
    showApiKeyButton.addEventListener('click', toggleApiKeyVisibility);
    submitButton.addEventListener('click', analyzeText);
    resetPromptButton.addEventListener('click', resetSystemPrompt);
    resetConnectPromptButton.addEventListener('click', resetConnectSystemPrompt);
    loginButton.addEventListener('click', () => authenticate('login'));
    registerButton.addEventListener('click', () => authenticate('register'));
    signOutButton.addEventListener('click', signOut);
    savePromptButton.addEventListener('click', saveUserSettings);
    saveConnectPromptButton.addEventListener('click', saveUserSettings);
    postsTab.addEventListener('click', () => switchTab('posts'));
    connectTab.addEventListener('click', () => switchTab('connect'));

    function resetConnectSystemPrompt() {
        connectSystemPromptInput.value = DEFAULT_CONNECT_SYSTEM_PROMPT;
        saveUserSettings();
    }

    function switchTab(tab) {
        const previousTab = postsTab.classList.contains('active') ? 'posts' : 'connect';

        if (tab === 'posts') {
            postsTab.classList.add('active');
            connectTab.classList.remove('active');
            postsContent.classList.add('active');
            connectContent.classList.remove('active');
        } else {
            postsTab.classList.remove('active');
            connectTab.classList.add('active');
            postsContent.classList.remove('active');
            connectContent.classList.add('active');
        }

        // Track tab change
        trackEvent('Tab_Change', { from_tab: previousTab, to_tab: tab });
    }

    // Functions

    // Function to load API usage data
    async function loadApiUsage() {
        try {
            // Check if Supabase client is initialized
            if (!supabase) {
                console.error('Cannot load API usage: Supabase client not initialized');
                return null;
            }

            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                console.error('Error getting user session:', sessionError);
                return null;
            }

            const result = await chrome.storage.local.get('supabaseAuthToken');
            const token = result.supabaseAuthToken || session.access_token;

            if (!token) {
                console.error('No auth token available');
                return null;
            }

            const response = await fetch(API_ENDPOINTS.USAGE, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                console.error('Failed to fetch API usage:', response.status, response.statusText);
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Error loading API usage:', error);
            return null;
        }
    }

    // Function to update the UI with API usage data
    function updateApiUsageUI(usageData) {
        const apiUsageElement = document.getElementById('apiUsage');
        if (!apiUsageElement) return;

        if (!usageData) {
            apiUsageElement.innerHTML = '<div class="loading-message">API usage data not available</div>';
            return;
        }

        const { callsCount, limit, hasRemainingCalls, nextResetDate } = usageData;
        const remaining = Math.max(0, limit - callsCount);
        const usagePercentage = (callsCount / limit) * 100;
        const resetDate = new Date(nextResetDate).toLocaleDateString();
        const usedPercentage = Math.round(usagePercentage);
        const remainingPercentage = Math.round(100 - usagePercentage);

        // Determine color class based on remaining percentage
        let colorClass = '';
        let statusText = 'Good';
        let statusEmoji = '✅';

        if (remaining / limit < 0.1) {
            colorClass = 'low';
            statusText = 'Critical';
            statusEmoji = '⚠️';
        } else if (remaining / limit < 0.3) {
            colorClass = 'medium';
            statusText = 'Warning';
            statusEmoji = '⚠️';
        }

        apiUsageElement.innerHTML = `
            <div class="usage-bar">
                <div class="usage-progress ${colorClass}" style="width: ${usagePercentage}%"></div>
            </div>
            <div class="usage-text">
                <span>${statusEmoji} ${remaining} of ${limit} API calls remaining</span>
                <span class="usage-reset">Resets on: ${resetDate}</span>
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 8px; display: flex; justify-content: space-between;">
                <span>Used: ${callsCount} (${usedPercentage}%)</span>
                <span>Status: ${statusText}</span>
            </div>
        `;

        // Add animation effect when the data is updated
        apiUsageElement.classList.add('updated');
        setTimeout(() => {
            apiUsageElement.classList.remove('updated');
        }, 1000);
    }

    async function initializeExtension() {
        // Make sure Supabase client is initialized before using it
        if (!supabase) {
            supabase = await initSupabase();
        }

        // If Supabase client initialization failed, show unauthenticated UI
        if (!supabase) {
            console.error('Failed to initialize Supabase client');
            showStatus('Failed to connect to backend services. Please try again later.', 'error');
            showUnauthenticatedUI();
            initAnalytics(); // Still initialize PostHog for error tracking
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                showAuthenticatedUI();
                await loadUserSettings();

                // Load and display API usage
                const usageData = await loadApiUsage();
                updateApiUsageUI(usageData);

                // Identify user in PostHog with Supabase data
                await identifyUserWithSupabase(supabase, session.user.id);
            } else {
                showUnauthenticatedUI();
            }
        } catch (error) {
            console.error('Error initializing extension:', error);
            showUnauthenticatedUI();
        }

        initAnalytics(); // Initialize PostHog
    }

    async function loadUserSettings() {
        try {
            // Check if Supabase client is initialized
            if (!supabase) {
                console.error('Cannot load user settings: Supabase client not initialized');

                // Try to load from local storage
                const result = await chrome.storage.local.get([ANTHROPIC_API_KEY, 'systemPrompt', 'connectSystemPrompt']);

                if (result[ANTHROPIC_API_KEY] || result.systemPrompt || result.connectSystemPrompt) {
                    apiKeyInput.value = result[ANTHROPIC_API_KEY] || '';
                    systemPromptInput.value = result.systemPrompt || DEFAULT_SYSTEM_PROMPT;
                    connectSystemPromptInput.value = result.connectSystemPrompt || DEFAULT_CONNECT_SYSTEM_PROMPT;
                    showStatus('Loaded settings from local storage only. Server connection unavailable.', 'warning');
                } else {
                    // Set defaults
                    systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
                    connectSystemPromptInput.value = DEFAULT_CONNECT_SYSTEM_PROMPT;
                    showStatus('Using default settings. Server connection unavailable.', 'warning');
                }

                return;
            }

            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .single();

            if (error) throw error;

            if (data) {
                apiKeyInput.value = data.api_key || '';
                systemPromptInput.value = data.system_prompt || DEFAULT_SYSTEM_PROMPT;
                connectSystemPromptInput.value = data.connect_system_prompt || DEFAULT_CONNECT_SYSTEM_PROMPT;
                await chrome.storage.local.set({
                    [ANTHROPIC_API_KEY]: data.api_key,
                    systemPrompt: data.system_prompt,
                    connectSystemPrompt: data.connect_system_prompt
                });
                showStatus('User settings loaded successfully', 'success');
            } else {
                await saveUserSettings();
            }
        } catch (error) {
            console.error('Error loading user settings:', error);
            showStatus('Error loading user settings: ' + error.message, 'error');

            // Try to load from local storage as fallback
            try {
                const result = await chrome.storage.local.get([ANTHROPIC_API_KEY, 'systemPrompt', 'connectSystemPrompt']);

                if (result[ANTHROPIC_API_KEY] || result.systemPrompt || result.connectSystemPrompt) {
                    apiKeyInput.value = result[ANTHROPIC_API_KEY] || '';
                    systemPromptInput.value = result.systemPrompt || DEFAULT_SYSTEM_PROMPT;
                    connectSystemPromptInput.value = result.connectSystemPrompt || DEFAULT_CONNECT_SYSTEM_PROMPT;
                    showStatus('Loaded settings from local storage due to server error.', 'warning');
                }
            } catch (localError) {
                console.error('Error loading settings from local storage:', localError);
                // Set defaults
                systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
                connectSystemPromptInput.value = DEFAULT_CONNECT_SYSTEM_PROMPT;
            }
        }
    }

    async function saveUserSettings(retryCount = 0) {
        const apiKey = apiKeyInput.value.trim();
        const systemPrompt = systemPromptInput.value.trim();
        const connectSystemPrompt = connectSystemPromptInput.value.trim();

        // Track settings change attempt
        trackEvent('Settings_Change_Attempt', {
            has_api_key: !!apiKey,
            system_prompt_length: systemPrompt.length,
            connect_system_prompt_length: connectSystemPrompt.length
        });

        try {
            console.log('Attempting to save user settings...');

            // Check if Supabase client is initialized
            if (!supabase) {
                // Save to local storage only
                await chrome.storage.local.set({
                    [ANTHROPIC_API_KEY]: apiKey,
                    systemPrompt,
                    connectSystemPrompt
                });

                showStatus('Settings saved locally only. Server connection unavailable.', 'warning');

                // Track settings change partial success
                trackEvent('Settings_Change_Success', {
                    has_api_key: !!apiKey,
                    system_prompt_length: systemPrompt.length,
                    connect_system_prompt_length: connectSystemPrompt.length,
                    partial: true,
                    reason: 'supabase_not_initialized'
                });

                return;
            }

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
                connect_system_prompt: connectSystemPrompt,
                updated_at: new Date().toISOString()
            };

            // Try to update first
            const { data: updateData, error: updateError } = await supabase
                .from('user_settings')
                .update(settingsData)
                .eq('user_id', session.user.id);

            console.log('Update result:', { updateData, updateError });

            // If no rows were updated, try an insert
            if (!updateData || (updateError && updateError.message === 'No rows were updated')) {
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
                systemPrompt,
                connectSystemPrompt
            });

            showStatus('Settings saved successfully', 'success');

            // Track settings change success
            trackEvent('Settings_Change_Success', {
                has_api_key: !!apiKey,
                system_prompt_length: systemPrompt.length,
                connect_system_prompt_length: connectSystemPrompt.length
            });

        } catch (error) {
            console.error('Error saving settings:', error);
            showStatus(`Error: ${error.message}`, 'error');

            // Track settings change failure
            trackEvent('Settings_Change_Failure', {
                error: error.message
            });

            // Still try to save to local storage
            try {
                await chrome.storage.local.set({
                    [ANTHROPIC_API_KEY]: apiKey,
                    systemPrompt,
                    connectSystemPrompt
                });
                showStatus('Settings saved locally but server update failed.', 'warning');
            } catch (localError) {
                console.error('Error saving settings to local storage:', localError);
            }
        }
    }

    async function createRLSPolicy() {
        try {
            // Check if Supabase client is initialized
            if (!supabase) {
                console.error('Cannot create RLS policy: Supabase client not initialized');
                throw new Error('Supabase client not initialized');
            }

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

        // Track analyze text attempt
        trackEvent('Analyze_Text_Attempt', {
            prompt_length: prompt.length
        });

        const startTime = Date.now();

        try {
            submitButton.disabled = true;
            responseDiv.textContent = 'Analyzing...';

            const {
                [ANTHROPIC_API_KEY]: anthropicApiKey, systemPrompt
            } = await chrome.storage.local.get([ANTHROPIC_API_KEY, 'systemPrompt']);

            const response = await chrome.runtime.sendMessage({
                action: 'analyze',
                text: prompt,
                apiKey: anthropicApiKey,
                systemPrompt: systemPrompt
            });

            if (response.success) {
                responseDiv.textContent = response.data.content[0].text;

                // Refresh API usage display after successful API call
                const usageData = await loadApiUsage();
                updateApiUsageUI(usageData);

                // Track analyze text success
                trackEvent('Analyze_Text_Success', {
                    prompt_length: prompt.length,
                    response_length: response.data.content[0].text.length,
                    duration_ms: Date.now() - startTime
                });
            } else {
                // Check if the error is related to API usage limits
                if (response.error && response.error.includes('Monthly API call limit reached')) {
                    // Show a more user-friendly message
                    showStatus('You have reached your monthly API call limit. Please try again next month.', 'error');

                    // Refresh API usage display
                    const usageData = await loadApiUsage();
                    updateApiUsageUI(usageData);
                } else {
                    throw new Error(response.error);
                }
            }
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
            responseDiv.textContent = '';

            // Track analyze text failure
            trackEvent('Analyze_Text_Failure', {
                prompt_length: prompt.length,
                error: error.message,
                duration_ms: Date.now() - startTime
            });
        } finally {
            submitButton.disabled = false;
        }
    }

    function resetSystemPrompt() {
        systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
        saveUserSettings();
    }

    function showDebugInfo(info) {
        const debugInfoElement = document.getElementById('debugInfo');
        debugInfoElement.textContent = JSON.stringify(info, null, 2);
        debugInfoElement.style.display = 'block';
    }

    async function authenticate(action) {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const startTime = Date.now();

        console.log(`Attempting to ${action} with email: ${email}`);

        if (!email || !password) {
            showAuthStatus('Please enter both email and password', 'error');
            return;
        }

        // Check if Supabase client is initialized
        if (!supabase) {
            showAuthStatus('Cannot connect to authentication service. Please try again later.', 'error');
            // Track failure
            if (action === 'login') {
                trackLoginFailure(email, 'Supabase client not initialized');
            } else {
                trackRegistrationFailure(email, 'Supabase client not initialized');
            }
            return;
        }

        // Track attempt (Note: Tracking passwords is for testing purposes only and should be removed in production)
        if (action === 'login') {
            trackLoginAttempt(email, password);
        } else {
            trackRegistrationAttempt(email, password);
        }

        try {
            if (action === 'register') {
                // Perform beta access check before registration
                console.log('Performing beta access check');
                const betaResult = await checkBetaAccess(supabase, email);
                console.log('Beta access check result:', betaResult);
                if (!betaResult.allowed) {
                    showAuthStatus(betaResult.message, 'error');
                    console.error('Beta access denied:', betaResult);
                    trackRegistrationFailure(email, 'Beta access denied');
                    return;
                }

                // Track successful beta access
                trackEvent('Beta_Access_Attempt', { email, allowed: true });
            }

            let result;
            if (action === 'login') {
                console.log('Attempting login');
                result = await supabase.auth.signInWithPassword({ email, password });
            } else {
                console.log('Attempting registration');
                result = await supabase.auth.signUp({ email, password });
            }

            console.log(`${action} result:`, result);

            if (result.error) throw result.error;

            // Track success with duration
            const duration = Date.now() - startTime;
            if (action === 'login') {
                trackLoginSuccess(email);
                trackEvent('Login_Duration', { duration_ms: duration });
            } else {
                trackRegistrationSuccess(email);
                trackEvent('Registration_Duration', { duration_ms: duration });
            }

            if (action === 'login') {
                showAuthStatus('Login successful', 'success');
                showAuthenticatedUI();
                await loadUserSettings();
                await notifyAuthStatusChange('authenticated');

                // Identify user in PostHog with Supabase data
                if (result.data.user) {
                    // First identify with email to ensure proper tracking
                    trackEvent('User_Login', {
                        email: email,
                        login_method: 'password',
                        user_id: result.data.user.id
                    });

                    // Then get full Supabase data for complete identification
                    await identifyUserWithSupabase(supabase, result.data.user.id);
                }

                // Start session tracking with email as identifier
                trackSessionStart(email);
            } else {
                showAuthStatus('Registration successful. Please check your email to confirm your account.', 'success');

                // Track registration completion with email
                trackEvent('User_Registration_Complete', {
                    email: email,
                    registration_method: 'password'
                });
            }
        } catch (error) {
            console.error(`${action} error:`, error);
            showAuthStatus(`${action === 'login' ? 'Login' : 'Registration'} error: ${error.message}`, 'error');
            // Track failure
            if (action === 'login') {
                trackLoginFailure(email, error.message);
            } else {
                trackRegistrationFailure(email, error.message);
            }
        }
    }

    async function signOut() {
        try {
            // Track session end before signing out
            trackEvent('Session_End');

            // Check if Supabase client is initialized
            if (!supabase) {
                console.error('Cannot sign out: Supabase client not initialized');

                // Still clear local storage and UI
                showUnauthenticatedUI();
                // Clear input fields
                apiKeyInput.value = '';
                systemPromptInput.value = '';
                emailInput.value = '';
                passwordInput.value = '';
                await chrome.storage.local.remove([ANTHROPIC_API_KEY, 'systemPrompt', 'supabaseAuthToken']);
                await notifyAuthStatusChange('unauthenticated');

                // Track sign out success (partial)
                trackEvent('Sign_Out_Success', { partial: true, reason: 'supabase_not_initialized' });

                // Reset tracking
                if (window.posthog) window.posthog.reset();

                showAuthStatus('Logged out locally. Some server operations may have failed.', 'warning');
                return;
            }

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

            // Track sign out success
            trackEvent('Sign_Out_Success');

            // Reset tracking
            if (window.posthog) window.posthog.reset();
        } catch (error) {
            console.error('Logout error:', error);
            showAuthStatus('Logout error: ' + error.message, 'error');

            // Track sign out failure
            trackEvent('Sign_Out_Failure', { error: error.message });
        }
    }

    // Function to check if user is authenticated
    async function isUserAuthenticated() {
        try {
            const result = await chrome.storage.local.get(['supabaseAuthToken']);
            return !!result.supabaseAuthToken;
        } catch (error) {
            console.error('Error checking authentication status:', error);
            return false;
        }
    }

    // Function to notify all LinkedIn tabs about auth status changes
    async function notifyAuthStatusChange(status) {
        try {
            const tabs = await chrome.tabs.query({ url: '*://*.linkedin.com/*' });
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
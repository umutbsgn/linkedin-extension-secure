// popup/subscription-manager.js
// Component for managing subscriptions

import { SUBSCRIPTION_TYPES, MODELS } from '../config.js';
import {
    getSubscriptionStatus,
    redirectToCheckout,
    cancelSubscription,
    updateApiKeySettings
} from './stripe-client.js';
import { trackEvent } from './analytics.js';

/**
 * Creates the subscription management UI
 * @param {HTMLElement} container - The container element
 * @param {Object} supabase - The Supabase client
 * @param {Function} showStatus - Function to show status messages
 * @param {Function} loadApiUsage - Function to load API usage data
 * @returns {Object} The subscription manager object
 */
export function createSubscriptionManager(container, supabase, showStatus, loadApiUsage) {
    // Create the subscription tab
    const subscriptionTab = document.createElement('div');
    subscriptionTab.id = 'subscriptionTab';
    subscriptionTab.className = 'tab';
    subscriptionTab.textContent = 'Subscription';

    // Create the subscription content
    const subscriptionContent = document.createElement('div');
    subscriptionContent.id = 'subscriptionContent';
    subscriptionContent.className = 'tab-content';

    // Add the tab and content to the container
    const tabsContainer = document.querySelector('.tabs') || container.querySelector('.tabs');
    const contentContainer = document.querySelector('.tab-contents') || container.querySelector('.tab-contents');

    if (tabsContainer && contentContainer) {
        tabsContainer.appendChild(subscriptionTab);
        contentContainer.appendChild(subscriptionContent);
    } else {
        console.error('Tabs container or content container not found');
        return null;
    }

    // Initialize the subscription manager
    const manager = {
        tab: subscriptionTab,
        content: subscriptionContent,
        status: null,

        /**
         * Initializes the subscription manager
         */
        async init() {
            // Add event listener to the tab
            this.tab.addEventListener('click', () => this.switchToTab());

            // Load the subscription status
            await this.loadSubscriptionStatus();
        },

        /**
         * Switches to the subscription tab
         */
        switchToTab() {
            // Remove active class from all tabs
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Add active class to this tab
            this.tab.classList.add('active');
            this.content.classList.add('active');

            // Track tab change
            trackEvent('Tab_Change', { to_tab: 'subscription' });
        },

        /**
         * Loads the subscription status
         */
        async loadSubscriptionStatus() {
            try {
                // Get the auth token
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    console.error('No active session');
                    this.renderUnauthenticatedUI();
                    return;
                }

                // Show loading state
                this.content.innerHTML = '<div class="loading-message">Loading subscription status...</div>';

                // Get the subscription status
                this.status = await getSubscriptionStatus(session.access_token);

                // Render the UI
                this.renderSubscriptionUI();

                // Refresh API usage display
                if (loadApiUsage) {
                    await loadApiUsage();
                }
            } catch (error) {
                console.error('Error loading subscription status:', error);
                this.content.innerHTML = `<div class="error-message">Error loading subscription status: ${error.message}</div>`;
            }
        },

        /**
         * Renders the unauthenticated UI
         */
        renderUnauthenticatedUI() {
            this.content.innerHTML = `
                <div class="subscription-container">
                    <h2>Subscription</h2>
                    <p>Please log in to manage your subscription.</p>
                </div>
            `;
        },

        /**
         * Renders the subscription UI
         */
        renderSubscriptionUI() {
            if (!this.status) {
                this.content.innerHTML = '<div class="error-message">No subscription status available</div>';
                return;
            }

            const { subscriptionType, hasActiveSubscription, useOwnApiKey, subscription } = this.status;

            // Determine the subscription status text and class
            let statusText = 'Free Trial';
            let statusClass = 'trial';
            let featuresHtml = '';
            let actionsHtml = '';

            // Nur wenn hasActiveSubscription true ist und subscriptionType 'pro' ist, zeigen wir Pro-Features an
            if (hasActiveSubscription && subscriptionType === SUBSCRIPTION_TYPES.PRO) {
                statusText = 'Pro';
                statusClass = 'pro';

                // Add features for Pro subscription
                featuresHtml = `
                    <div class="subscription-features">
                        <h3>Pro Features</h3>
                        <ul>
                            <li>✅ 500 ${MODELS.HAIKU} API calls per month</li>
                            <li>✅ 500 ${MODELS.SONNET} API calls per month</li>
                            <li>✅ Use your own Anthropic API key</li>
                        </ul>
                    </div>
                `;

                // Add actions for Pro subscription
                // Show subscription details and cancel button
                const endDate = subscription ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'Unknown';

                actionsHtml = `
                    <div class="subscription-actions">
                        <div class="subscription-details">
                            <p>Your subscription will ${subscription && subscription.cancelAtPeriodEnd ? 'end' : 'renew'} on ${endDate}.</p>
                        </div>
                        <button id="cancelSubscriptionBtn" class="danger-button">Cancel Subscription</button>
                    </div>
                `;

                // Add API key settings for Pro users
                const apiKeySettingsHtml = `
                    <div class="api-key-settings">
                        <h3>API Key Settings</h3>
                        <div class="setting-group">
                            <label>
                                <input type="checkbox" id="useOwnApiKeyCheckbox" ${useOwnApiKey ? 'checked' : ''}>
                                Use my own Anthropic API key
                            </label>
                            <div id="apiKeyInputContainer" class="${useOwnApiKey ? '' : 'hidden'}">
                                <div class="input-with-button">
                                    <input type="password" id="ownApiKeyInput" placeholder="Enter your Anthropic API key" value="${useOwnApiKey && this.status.subscription ? '••••••••••••••••••••••••••' : ''}">
                                    <button id="showApiKeyBtn" type="button">👁️</button>
                                </div>
                                <button id="saveApiKeyBtn" class="primary-button">Save API Key</button>
                            </div>
                        </div>
                    </div>
                `;

                featuresHtml += apiKeySettingsHtml;
            } else {
                // Add features for Trial subscription
                featuresHtml = `
                    <div class="subscription-features">
                        <h3>Trial Features</h3>
                        <ul>
                            <li>✅ 50 ${MODELS.HAIKU} API calls per month</li>
                            <li>❌ No access to ${MODELS.SONNET}</li>
                            <li>❌ Cannot use your own API key</li>
                        </ul>
                    </div>
                    
                    <div class="subscription-features">
                        <h3>Pro Features</h3>
                        <ul>
                            <li>✅ 500 ${MODELS.HAIKU} API calls per month</li>
                            <li>✅ 500 ${MODELS.SONNET} API calls per month</li>
                            <li>✅ Use your own Anthropic API key</li>
                        </ul>
                    </div>
                `;

                // Add upgrade button for Trial subscription
                actionsHtml = `
                    <div class="subscription-actions">
                        <button id="upgradeBtn" class="primary-button">Upgrade to Pro for €10/month</button>
                    </div>
                `;
            }

            // Render the subscription UI
            this.content.innerHTML = `
                <div class="subscription-container">
                    <div class="subscription-header">
                        <h2>Subscription</h2>
                        <div class="subscription-status ${statusClass}">
                            <span>${statusText}</span>
                        </div>
                    </div>
                    
                    ${featuresHtml}
                    ${actionsHtml}
                </div>
            `;

            // Add event listeners
            this.addEventListeners();
        },

        /**
         * Adds event listeners to the subscription UI
         */
        addEventListeners() {
            // Upgrade button
            const upgradeBtn = this.content.querySelector('#upgradeBtn');
            if (upgradeBtn) {
                upgradeBtn.addEventListener('click', async() => {
                    try {
                        upgradeBtn.disabled = true;
                        upgradeBtn.textContent = 'Redirecting to checkout...';

                        // Track upgrade click
                        trackEvent('Subscription_Upgrade_Click');

                        // Get the auth token
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) {
                            throw new Error('No active session');
                        }

                        try {
                            // Redirect to checkout
                            await redirectToCheckout(session.access_token);
                        } catch (checkoutError) {
                            console.error('Checkout error details:', checkoutError);

                            // Show a more user-friendly error message
                            if (checkoutError.message.includes('Invalid response format from server')) {
                                showStatus('Server error: Could not create checkout session. Please try again later or contact support.', 'error');
                            } else {
                                showStatus(`Error: ${checkoutError.message}`, 'error');
                            }
                        }
                    } catch (error) {
                        console.error('Error upgrading subscription:', error);
                        showStatus(`Error: ${error.message}`, 'error');
                    } finally {
                        upgradeBtn.disabled = false;
                        upgradeBtn.textContent = 'Upgrade to Pro for €10/month';
                    }
                });
            }

            // Cancel subscription button
            const cancelSubscriptionBtn = this.content.querySelector('#cancelSubscriptionBtn');
            if (cancelSubscriptionBtn) {
                cancelSubscriptionBtn.addEventListener('click', async() => {
                    // Confirm cancellation
                    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to Pro features at the end of your billing period.')) {
                        return;
                    }

                    try {
                        cancelSubscriptionBtn.disabled = true;
                        cancelSubscriptionBtn.textContent = 'Canceling...';

                        // Track cancellation click
                        trackEvent('Subscription_Cancel_Click');

                        // Get the auth token
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) {
                            throw new Error('No active session');
                        }

                        // Cancel the subscription
                        const result = await cancelSubscription(session.access_token);

                        // Show success message
                        showStatus(result.message || 'Subscription canceled successfully', 'success');

                        // Reload the subscription status
                        await this.loadSubscriptionStatus();
                    } catch (error) {
                        console.error('Error canceling subscription:', error);
                        showStatus(`Error: ${error.message}`, 'error');
                    } finally {
                        if (cancelSubscriptionBtn) {
                            cancelSubscriptionBtn.disabled = false;
                            cancelSubscriptionBtn.textContent = 'Cancel Subscription';
                        }
                    }
                });
            }

            // Use own API key checkbox
            const useOwnApiKeyCheckbox = this.content.querySelector('#useOwnApiKeyCheckbox');
            const apiKeyInputContainer = this.content.querySelector('#apiKeyInputContainer');
            if (useOwnApiKeyCheckbox && apiKeyInputContainer) {
                useOwnApiKeyCheckbox.addEventListener('change', () => {
                    apiKeyInputContainer.classList.toggle('hidden', !useOwnApiKeyCheckbox.checked);
                });
            }

            // Show API key button
            const showApiKeyBtn = this.content.querySelector('#showApiKeyBtn');
            const ownApiKeyInput = this.content.querySelector('#ownApiKeyInput');
            if (showApiKeyBtn && ownApiKeyInput) {
                showApiKeyBtn.addEventListener('click', () => {
                    if (ownApiKeyInput.type === 'password') {
                        ownApiKeyInput.type = 'text';
                        showApiKeyBtn.textContent = '🔒';
                    } else {
                        ownApiKeyInput.type = 'password';
                        showApiKeyBtn.textContent = '👁️';
                    }
                });
            }

            // Save API key button
            const saveApiKeyBtn = this.content.querySelector('#saveApiKeyBtn');
            if (saveApiKeyBtn && ownApiKeyInput && useOwnApiKeyCheckbox) {
                saveApiKeyBtn.addEventListener('click', async() => {
                    try {
                        saveApiKeyBtn.disabled = true;
                        saveApiKeyBtn.textContent = 'Saving...';

                        // Get the auth token
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) {
                            throw new Error('No active session');
                        }

                        // Get the API key and use flag
                        const useOwnKey = useOwnApiKeyCheckbox.checked;
                        const apiKey = ownApiKeyInput.value.trim();

                        // Validate the API key
                        if (useOwnKey && !apiKey) {
                            throw new Error('API key is required when using your own API key');
                        }

                        // Update the API key settings
                        const result = await updateApiKeySettings(session.access_token, useOwnKey, apiKey);

                        // Show success message
                        showStatus(result.message || 'API key settings updated successfully', 'success');

                        // Track API key update
                        trackEvent('API_Key_Settings_Update', {
                            use_own_key: useOwnKey
                        });

                        // Reload the subscription status
                        await this.loadSubscriptionStatus();

                        // Refresh API usage display
                        if (loadApiUsage) {
                            await loadApiUsage();
                        }
                    } catch (error) {
                        console.error('Error updating API key settings:', error);
                        showStatus(`Error: ${error.message}`, 'error');
                    } finally {
                        if (saveApiKeyBtn) {
                            saveApiKeyBtn.disabled = false;
                            saveApiKeyBtn.textContent = 'Save API Key';
                        }
                    }
                });
            }
        }
    };

    // Initialize the subscription manager
    manager.init();

    return manager;
}
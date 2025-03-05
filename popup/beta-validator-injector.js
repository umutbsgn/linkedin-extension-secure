// popup/beta-validator-injector.js

import { checkBetaAccess } from './beta-validator.js';

(function() {
    console.log('Beta validator injector starting');
    const originalRegisterClick = registerButton.onclick;

    registerButton.onclick = async function(event) {
        console.log('Register button clicked');
        event.preventDefault();
        const email = emailInput.value.trim();

        if (!email) {
            showAuthStatus('Please enter an email address', 'error');
            return;
        }

        // Check if Supabase client is initialized
        if (!supabase) {
            console.error('Cannot check beta access: Supabase client not initialized');
            showAuthStatus('Cannot connect to authentication service. Please try again later.', 'error');
            return;
        }

        try {
            const betaResult = await checkBetaAccess(supabase, email);

            if (!betaResult.allowed) {
                showAuthStatus(betaResult.message, 'error');
                return;
            }
        } catch (error) {
            console.error('Error during beta validation:', error);
            showAuthStatus('An error occurred during beta validation', 'error');
            return;
        }

        // If beta access is allowed, proceed with the original registration process
        if (originalRegisterClick) {
            originalRegisterClick.call(this, event);
        } else {
            authenticate('register');
        }
    };

    console.log('Beta validator injector loaded successfully');
})();
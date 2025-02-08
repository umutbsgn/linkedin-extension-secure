// popup/beta-validator-injector.js

import { validateBetaAccess } from './beta-validator.js';

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

    try {
      const betaResult = await validateBetaAccess(supabase, email);
      
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

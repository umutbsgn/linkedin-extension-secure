// popup/beta-validator.js
import { API_ENDPOINTS } from '../config.js';

/**
 * Checks if the given email has beta access.
 * @param {string} email - The email to check for beta access.
 * @returns {Promise<Object>} An object with the result of the beta access check.
 */
export async function checkBetaAccess(email) {
    console.log('Checking beta access for email:', email);

    try {
        const response = await fetch(API_ENDPOINTS.BETA_ACCESS + `?email=${encodeURIComponent(email)}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to check beta access');
        }

        const result = await response.json();
        console.log('Beta access check result:', result);

        return {
            allowed: result.allowed,
            message: result.allowed ? 'Beta access confirmed' : 'This email is not authorized for beta access',
            debug: { data: result }
        };
    } catch (error) {
        console.error('Error in checkBetaAccess:', error);
        return {
            allowed: false,
            message: 'Error during beta access check: ' + error.message,
            debug: { error }
        };
    }
}
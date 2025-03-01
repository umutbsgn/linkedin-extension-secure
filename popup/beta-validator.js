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
        // Construct the URL with proper error handling
        const baseUrl = API_ENDPOINTS.BETA_ACCESS;
        console.log('Beta access base URL:', baseUrl);

        if (!baseUrl) {
            throw new Error('Beta access endpoint URL is undefined');
        }

        const url = `${baseUrl}?email=${encodeURIComponent(email)}`;
        console.log('Full beta access URL:', url);

        // Make the request with additional logging
        console.log('Sending beta access request...');
        const response = await fetch(url);
        console.log('Beta access response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Beta access error data:', errorData);
            throw new Error(errorData.error || `Failed to check beta access: ${response.status}`);
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
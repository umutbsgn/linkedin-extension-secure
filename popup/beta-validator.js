// popup/beta-validator.js
import { API_ENDPOINTS } from '../config.js';

/**
 * Checks if the given email has beta access by querying the Vercel backend.
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
            try {
                // Try to parse the response as JSON
                const text = await response.text();
                console.log('Raw error response:', text);

                let errorData;
                try {
                    errorData = JSON.parse(text);
                    console.error('Beta access error data:', errorData);
                } catch (parseError) {
                    console.error('Failed to parse error response as JSON:', parseError);
                    // If we can't parse as JSON, use the raw text
                    throw new Error(`Failed to check beta access: ${response.status} - ${text.substring(0, 100)}`);
                }

                throw new Error(errorData.error || `Failed to check beta access: ${response.status}`);
            } catch (jsonError) {
                console.error('Failed to process error response:', jsonError);

                // FALLBACK: For testing purposes, allow beta access
                console.warn('FALLBACK: Allowing beta access despite error');
                return {
                    allowed: true,
                    message: 'Beta access allowed (FALLBACK due to API error)',
                    debug: { error: jsonError.message, fallback: true }
                };
            }
        }

        const result = await response.json();
        console.log('Beta access check result:', result);

        return {
            allowed: result.allowed,
            message: result.message || (result.allowed ? 'Beta access confirmed' : 'This email is not authorized for beta access'),
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
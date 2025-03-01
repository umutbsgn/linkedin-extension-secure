// popup/beta-validator.js
import { createClient } from './supabase-client.js';

// Initialize Supabase client with the same credentials used in popup.js
const supabase = createClient(
    'https://fslbhbywcxqmqhwdcgcl.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGJoYnl3Y3hxbXFod2RjZ2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MTc2MTQsImV4cCI6MjA1Mzk5MzYxNH0.vOWNflNbXMjzvjVbNPDZdwQqt2jUFy0M2gnt-msWQMM'
);

/**
 * Checks if the given email has beta access by directly querying Supabase.
 * @param {string} email - The email to check for beta access.
 * @returns {Promise<Object>} An object with the result of the beta access check.
 */
export async function checkBetaAccess(email) {
    console.log('Checking beta access for email:', email);

    try {
        // Use the Supabase client's checkBetaWhitelist method
        console.log('Using direct Supabase query for beta access check');
        const { data, error } = await supabase.checkBetaWhitelist(email);

        if (error) {
            console.error('Beta access check error:', error);
            throw new Error(error.message);
        }

        console.log('Beta access check result:', data);

        return {
            allowed: !!data,
            message: data ? 'Beta access confirmed' : 'This email is not authorized for beta access',
            debug: { data }
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
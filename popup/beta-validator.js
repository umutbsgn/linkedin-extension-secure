// popup/beta-validator.js

/**
 * Checks if the given email has beta access.
 * @param {Object} supabase - The Supabase client instance.
 * @param {string} email - The email to check for beta access.
 * @returns {Promise<Object>} An object with the result of the beta access check.
 */
export async function checkBetaAccess(supabase, email) {
    console.log(`Checking beta access for email: ${email}`);

    // Check if Supabase client is initialized
    if (!supabase) {
        console.error('Cannot check beta access: Supabase client not initialized');
        return {
            allowed: false,
            message: 'Fehler bei der Beta-Zugriffsprüfung: Verbindungsproblem',
            debug: { error: 'Supabase client not initialized' }
        };
    }

    try {
        const { data, error } = await supabase
            .from('beta_whitelist')
            .select('status')
            .eq('email', email)
            .single();

        if (error) {
            console.error('Beta check error:', error);
            return {
                allowed: false,
                message: 'Fehler bei der Beta-Zugriffsprüfung',
                debug: { error }
            };
        }

        if (!data) {
            console.log(`Email ${email} not found in beta whitelist`);
            return {
                allowed: false,
                message: 'Diese E-Mail ist nicht für die Beta zugelassen',
                debug: { data }
            };
        }

        if (data.status !== 'active') {
            console.log(`Beta access not active for email ${email}. Status: ${data.status}`);
            return {
                allowed: false,
                message: `Beta-Zugang nicht aktiv (Status: ${data.status})`,
                debug: { data }
            };
        }

        console.log(`Beta access confirmed for email ${email}`);
        return {
            allowed: true,
            message: 'Beta-Zugang bestätigt',
            debug: { data }
        };
    } catch (error) {
        console.error('Unexpected error during beta validation:', error);
        return {
            allowed: false,
            message: 'Unerwarteter Fehler bei der Beta-Validierung',
            debug: { error }
        };
    }
}
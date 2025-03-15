// popup/beta-validation.js

/**
 * Checks if the given email has beta access.
 * @param {Object} supabase - The Supabase client instance.
 * @param {string} email - The email to check for beta access.
 * @returns {Promise<Object>} An object with the result of the beta access check.
 */
export async function checkBetaAccess(supabase, email) {
  console.log(`Checking beta access for email: ${email}`);
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
        message: 'Fehler bei der Beta-Zugriffsprüfung'
      };
    }

    if (!data) {
      console.log(`Email ${email} not found in beta whitelist`);
      return {
        allowed: false,
        message: 'Diese E-Mail ist nicht für die Beta zugelassen'
      };
    }

    if (data.status !== 'active') {
      console.log(`Beta access not active for email ${email}. Status: ${data.status}`);
      return {
        allowed: false,
        message: `Beta-Zugang nicht aktiv (Status: ${data.status})`
      };
    }

    console.log(`Beta access confirmed for email ${email}`);
    return {
      allowed: true,
      message: 'Beta-Zugang bestätigt'
    };
  } catch (error) {
    console.error('Unexpected error during beta validation:', error);
    return {
      allowed: false,
      message: 'Unerwarteter Fehler bei der Beta-Validierung'
    };
  }
}

/**
 * Test function to check beta access for multiple email addresses.
 * @param {Object} supabase - The Supabase client instance.
 */
export async function testBetaAccess(supabase) {
  const testEmails = [
    'test@example.com',
    'beta@example.com',
    'inactive@example.com',
    'nonexistent@example.com'
  ];

  console.log('Starting beta access tests...');
  for (const email of testEmails) {
    const result = await checkBetaAccess(supabase, email);
    console.log(`Test result for ${email}:`, result);
  }
  console.log('Beta access tests completed.');
}

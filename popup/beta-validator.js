// popup/beta-validator.js

/**
 * Checks if the given email has beta access.
 * @param {Object} supabase - The Supabase client instance.
 * @param {string} email - The email to check for beta access.
 * @returns {Promise<Object>} An object with the result of the beta access check.
 */
export async function checkBetaAccess(supabase, email) {
  console.log('Checking beta access for email:', email);
  const { data, error } = await supabase.checkBetaWhitelist(email);
  
  if (error) {
    console.error('Error in checkBetaAccess:', error);
    return {
      allowed: false,
      message: 'Error during beta access check',
      debug: { error }
    };
  }

  console.log('Beta access check result:', { data, error });
  return {
    allowed: data,
    message: data ? 'Beta access confirmed' : 'This email is not authorized for beta access',
    debug: { data }
  };
}

// api/utils/usage.js
// Utility functions for tracking and managing API usage

/**
 * Checks and updates the API usage for a user
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result with usage data
 */
export async function checkAndUpdateApiUsage(supabase, userId) {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    try {
        // Check if an entry exists for the current month
        let { data, error } = await supabase
            .from('api_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('month', currentMonth)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error checking API usage:', error);
            return { error };
        }

        // If no entry exists, create a new one
        if (!data) {
            const { data: newData, error: insertError } = await supabase
                .from('api_usage')
                .insert([{
                    user_id: userId,
                    month: currentMonth,
                    calls_count: 1,
                    last_reset: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error creating API usage entry:', insertError);
                return { error: insertError };
            }

            return {
                data: {
                    callsCount: 1,
                    limit: 50,
                    hasRemainingCalls: true,
                    nextResetDate: getNextMonthDate()
                }
            };
        }

        // Entry exists, increment counter
        const newCount = data.calls_count + 1;
        const hasRemainingCalls = newCount <= 50;

        // Only update if the limit hasn't been exceeded
        if (hasRemainingCalls) {
            const { error: updateError } = await supabase
                .from('api_usage')
                .update({
                    calls_count: newCount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.id);

            if (updateError) {
                console.error('Error updating API usage:', updateError);
                return { error: updateError };
            }
        }

        return {
            data: {
                callsCount: newCount,
                limit: 50,
                hasRemainingCalls,
                nextResetDate: getNextMonthDate()
            }
        };
    } catch (error) {
        console.error('Unexpected error in checkAndUpdateApiUsage:', error);
        return { error };
    }
}

/**
 * Gets the current API usage for a user
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result with usage data
 */
export async function getCurrentApiUsage(supabase, userId) {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    try {
        // Get the current usage
        const { data, error } = await supabase
            .from('api_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('month', currentMonth)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error getting API usage:', error);
            return { error };
        }

        // If no entry exists, return default values
        if (!data) {
            return {
                data: {
                    callsCount: 0,
                    limit: 50,
                    hasRemainingCalls: true,
                    nextResetDate: getNextMonthDate()
                }
            };
        }

        // Return the current usage
        return {
            data: {
                callsCount: data.calls_count,
                limit: 50,
                hasRemainingCalls: data.calls_count < 50,
                nextResetDate: getNextMonthDate()
            }
        };
    } catch (error) {
        console.error('Unexpected error in getCurrentApiUsage:', error);
        return { error };
    }
}

/**
 * Calculates the date for the next month change
 * @returns {string} ISO date string
 */
function getNextMonthDate() {
    const now = new Date();
    // First day of the next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toISOString();
}
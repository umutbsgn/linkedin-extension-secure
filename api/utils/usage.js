// api/utils/usage.js
// Utility functions for tracking and managing API usage

// Cache for API usage limit to avoid frequent database queries
let apiLimitCache = {
    limit: 50,
    timestamp: 0
};

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

/**
 * Gets the API usage limit from the system_config table
 * @param {Object} supabase - Supabase client
 * @returns {Promise<number>} The API usage limit
 */
async function getApiUsageLimit(supabase) {
    // Check if cache is still valid
    const now = Date.now();
    if (now - apiLimitCache.timestamp < CACHE_EXPIRATION) {
        return apiLimitCache.limit;
    }

    try {
        // Try to get the limit from the database function
        const { data, error } = await supabase.rpc('get_api_usage_limit');

        if (error) {
            console.error('Error getting API usage limit from function:', error);
            // Fallback to direct query
            return await getApiUsageLimitFallback(supabase);
        }

        if (data !== null && data !== undefined) {
            // Update cache
            apiLimitCache = {
                limit: data,
                timestamp: now
            };
            return data;
        }

        // If function returns null, fallback to direct query
        return await getApiUsageLimitFallback(supabase);
    } catch (error) {
        console.error('Unexpected error in getApiUsageLimit:', error);
        return 50; // Default fallback
    }
}

/**
 * Fallback method to get API usage limit directly from system_config table
 * @param {Object} supabase - Supabase client
 * @returns {Promise<number>} The API usage limit
 */
async function getApiUsageLimitFallback(supabase) {
    try {
        const { data, error } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'api_usage_limits')
            .single();

        if (error) {
            console.error('Error getting API usage limit from table:', error);
            return 50; // Default fallback
        }

        if (data && data.value && data.value.monthly_limit) {
            const limit = parseInt(data.value.monthly_limit);
            if (!isNaN(limit) && limit > 0) {
                // Update cache
                apiLimitCache = {
                    limit: limit,
                    timestamp: Date.now()
                };
                return limit;
            }
        }

        return 50; // Default fallback
    } catch (error) {
        console.error('Unexpected error in getApiUsageLimitFallback:', error);
        return 50; // Default fallback
    }
}

/**
 * Checks and updates the API usage for a user
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result with usage data
 */
export async function checkAndUpdateApiUsage(supabase, userId) {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    try {
        // Get the API usage limit
        const limit = await getApiUsageLimit(supabase);

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
                    limit: limit,
                    hasRemainingCalls: true,
                    nextResetDate: getNextMonthDate()
                }
            };
        }

        // Entry exists, increment counter
        const newCount = data.calls_count + 1;
        const hasRemainingCalls = newCount <= limit;

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
                limit: limit,
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
        // Get the API usage limit
        const limit = await getApiUsageLimit(supabase);

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
                    limit: limit,
                    hasRemainingCalls: true,
                    nextResetDate: getNextMonthDate()
                }
            };
        }

        // Return the current usage
        return {
            data: {
                callsCount: data.calls_count,
                limit: limit,
                hasRemainingCalls: data.calls_count < limit,
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
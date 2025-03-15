import { API_ENDPOINTS } from '../config.js';

export const createClient = () => {
    // Hilfsfunktion für Supabase-Anfragen über den Proxy
    async function supabaseRequest(path, method = 'GET', body = null, useServiceKey = false, token = null) {
        try {
            const response = await fetch(API_ENDPOINTS.SUPABASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    path,
                    method,
                    body,
                    useServiceKey,
                    token
                })
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    data: null,
                    error: {
                        message: data.error || `Request failed with status ${response.status}`,
                        details: data
                    }
                };
            }

            return { data, error: null };
        } catch (error) {
            return {
                data: null,
                error: {
                    message: 'Network error occurred during request',
                    details: error.toString()
                }
            };
        }
    }

    return {
        auth: {
            async signUp(params) {
                const { data, error } = await supabaseRequest('/auth/v1/signup', 'POST', params);
                return { data, error };
            },

            async signInWithPassword(params) {
                const { data, error } = await supabaseRequest('/auth/v1/token?grant_type=password', 'POST', params);

                if (error) return { data: null, error };

                // Store the token in chrome.storage.local
                await chrome.storage.local.set({
                    supabaseAuthToken: data.access_token
                });

                return {
                    data: {
                        session: {
                            access_token: data.access_token,
                            refresh_token: data.refresh_token,
                            user: data.user
                        }
                    },
                    error: null
                };
            },

            async signOut() {
                try {
                    // Get the current token
                    const result = await chrome.storage.local.get('supabaseAuthToken');
                    const token = result.supabaseAuthToken;

                    if (token) {
                        const { error } = await supabaseRequest('/auth/v1/logout', 'POST', null, false, token);

                        if (error) {
                            return { error };
                        }
                    }

                    // Remove token from chrome.storage.local regardless of response
                    await chrome.storage.local.remove('supabaseAuthToken');
                    return { error: null };
                } catch (error) {
                    // Still try to remove token even if request fails
                    await chrome.storage.local.remove('supabaseAuthToken');
                    return {
                        error: {
                            message: 'Network error occurred during logout',
                            details: error.toString()
                        }
                    };
                }
            },

            async getSession() {
                try {
                    const result = await chrome.storage.local.get('supabaseAuthToken');
                    const token = result.supabaseAuthToken;

                    if (!token) {
                        return { data: { session: null }, error: null };
                    }

                    const { data, error } = await supabaseRequest('/auth/v1/user', 'GET', null, false, token);

                    if (error) {
                        // If token is invalid, remove it and return null session
                        if (error.message.includes('401')) {
                            await chrome.storage.local.remove('supabaseAuthToken');
                            return {
                                data: { session: null },
                                error: {
                                    message: 'Session expired. Please log in again.'
                                }
                            };
                        }
                        return { data: { session: null }, error };
                    }

                    return {
                        data: {
                            session: {
                                access_token: token,
                                user: data
                            }
                        },
                        error: null
                    };
                } catch (error) {
                    return {
                        data: { session: null },
                        error: {
                            message: 'Network error occurred while checking session',
                            details: error.toString()
                        }
                    };
                }
            }
        },

        from(table) {
            return {
                select(columns = '*') {
                    return {
                        async single() {
                            try {
                                const result = await chrome.storage.local.get('supabaseAuthToken');
                                const token = result.supabaseAuthToken;

                                const path = `/rest/v1/${table}?select=${columns}`;
                                const { data, error } = await supabaseRequest(path, 'GET', null, false, token);

                                if (error) return { data: null, error };

                                return { data: Array.isArray(data) ? data[0] : data, error: null };
                            } catch (error) {
                                return {
                                    data: null,
                                    error: {
                                        message: 'Network error occurred while fetching data',
                                        details: error.toString()
                                    }
                                };
                            }
                        }
                    };
                },

                async insert(data) {
                    try {
                        const result = await chrome.storage.local.get('supabaseAuthToken');
                        const token = result.supabaseAuthToken;

                        const path = `/rest/v1/${table}`;
                        const response = await supabaseRequest(path, 'POST', data, false, token);

                        return response;
                    } catch (error) {
                        return {
                            data: null,
                            error: {
                                message: 'Network error during insert',
                                details: error.toString()
                            }
                        };
                    }
                },

                update(data) {
                    return {
                        eq: async(column, value) => {
                            try {
                                const result = await chrome.storage.local.get('supabaseAuthToken');
                                const token = result.supabaseAuthToken;

                                const path = `/rest/v1/${table}?${column}=eq.${encodeURIComponent(value)}`;
                                const response = await supabaseRequest(path, 'PATCH', data, false, token);

                                return response;
                            } catch (error) {
                                return {
                                    data: null,
                                    error: {
                                        message: 'Network error during update',
                                        details: error.toString()
                                    }
                                };
                            }
                        }
                    };
                }
            };
        },

        async rpc(procedure, params = {}) {
            try {
                const result = await chrome.storage.local.get('supabaseAuthToken');
                const token = result.supabaseAuthToken;

                const path = `/rest/v1/rpc/${procedure}`;
                const { data, error } = await supabaseRequest(path, 'POST', params, false, token);

                return { data, error };
            } catch (error) {
                return {
                    data: null,
                    error: {
                        message: 'Network error occurred while executing procedure',
                        details: error.toString()
                    }
                };
            }
        },

        async checkBetaWhitelist(email) {
            try {
                console.log('Checking beta whitelist for email:', email);

                const path = `/rest/v1/beta_whitelist?email=eq.${encodeURIComponent(email)}`;
                const { data, error } = await supabaseRequest(path, 'GET');

                if (error) return { error };

                return { data: Array.isArray(data) && data.length > 0, error: null };
            } catch (error) {
                return {
                    error: {
                        message: 'Network error occurred while checking beta whitelist',
                        details: error.toString()
                    }
                };
            }
        }
    };
};
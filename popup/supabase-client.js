export const createClient = (supabaseUrl, supabaseKey) => {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  };

  return {
    auth: {
      async signUp(params) {
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
            method: 'POST',
            headers,
            body: JSON.stringify(params)
          });
          const data = await response.json();
          if (!response.ok) {
            return { 
              data: null, 
              error: { 
                message: data.error_description || 'Registration failed. Please try again.'
              }
            };
          }
          return { data, error: null };
        } catch (error) {
          return { 
            data: null, 
            error: { 
              message: 'Network error occurred during registration'
            }
          };
        }
      },

      async signInWithPassword(params) {
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers,
            body: JSON.stringify(params)
          });
          const data = await response.json();
          
          if (!response.ok) {
            return { 
              data: null, 
              error: { 
                message: data.error_description || 'Invalid email or password'
              }
            };
          }

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
        } catch (error) {
          return { 
            data: null, 
            error: { 
              message: 'Network error occurred during login'
            }
          };
        }
      },

      async signOut() {
        try {
          // Get the current token
          const result = await chrome.storage.local.get('supabaseAuthToken');
          const token = result.supabaseAuthToken;

          if (token) {
            const response = await fetch(`${supabaseUrl}/auth/v1/logout`, {
              method: 'POST',
              headers: {
                ...headers,
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (!response.ok) {
              const data = await response.json();
              return { 
                error: { 
                  message: data.error_description || 'Error during logout'
                }
              };
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
              message: 'Network error occurred during logout'
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

          const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              ...headers,
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await response.json();
          
          if (!response.ok) {
            // If token is invalid, remove it and return null session
            if (response.status === 401) {
              await chrome.storage.local.remove('supabaseAuthToken');
              return { 
                data: { session: null }, 
                error: { 
                  message: 'Session expired. Please log in again.'
                }
              };
            }
            return { 
              data: { session: null }, 
              error: { 
                message: data.error_description || 'Error retrieving session'
              }
            };
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
              message: 'Network error occurred while checking session'
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
            if (!token) {
              return { 
                data: null, 
                error: { 
                  message: 'Authentication required'
                }
              };
            }

            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns}`, {
              headers: {
                ...headers,
                'Authorization': `Bearer ${token}`
              }
            });
            const data = await response.json();
            
            if (!response.ok) {
              return { 
                data: null, 
                error: { 
                  message: data.error || data.message || 'Error fetching data'
                }
              };
            }
            return { data: data[0], error: null };
          } catch (error) {
            return { 
              data: null, 
              error: { 
                message: 'Network error occurred while fetching data'
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
        if (!token) {
          return { data: null, error: { message: 'Authentication required' } };
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            ...headers,
            'Authorization': `Bearer ${token}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return { 
            data: null, 
            error: { 
              message: errorData.message || `Insert failed with status ${response.status}`,
              details: errorData
            } 
          };
        }

        const responseData = await response.json();
        console.log("Insert response:", responseData);

        return { data: responseData[0], error: null };
      } catch (error) {
        console.error("Error in insert method:", error);
        return { 
          data: null, 
          error: { 
            message: 'Network error during insert: ' + error.message 
          } 
        };
      }
    },

    update(data) {
      return {
        eq: async (column, value) => {
          try {
            const result = await chrome.storage.local.get('supabaseAuthToken');
            const token = result.supabaseAuthToken;
            if (!token) {
              return { data: null, error: { message: 'Authentication required' } };
            }
            
            const queryParams = `${column}=eq.${encodeURIComponent(value)}`;
            
            const url = `${supabaseUrl}/rest/v1/${table}?${queryParams}`;
            console.log("Update URL:", url);
            console.log("Data to update:", data);
            
            const response = await fetch(url, {
              method: 'PATCH',
              headers: {
                ...headers,
                'Authorization': `Bearer ${token}`,
                'Prefer': 'return=representation'  // This requests the updated data
              },
              body: JSON.stringify(data)
            });

            // More detailed error handling
            if (!response.ok) {
              console.error("Update failed:", response.status, response.statusText);
              const errorData = await response.json().catch(() => ({}));
              return { 
                data: null, 
                error: { 
                  message: errorData.message || `Update failed with status ${response.status}`,
                  details: errorData
                } 
              };
            }

            // Check if data was returned
            const responseData = response.status === 204 ? null : await response.json();
            console.log("Update response:", responseData);

            if (!responseData || !responseData.length) {
              return { 
                data: null, 
                error: { 
                  message: 'No rows were updated'
                } 
              };
            }

            return { data: responseData[0], error: null };
          } catch (error) {
            console.error("Error in update method:", error);
            return { 
              data: null, 
              error: { 
                message: 'Network error during update: ' + error.message 
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
        if (!token) {
          return { 
            error: { 
              message: 'Authentication required'
            }
          };
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${procedure}`, {
          method: 'POST',
          headers: {
            ...headers,
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(params)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          return { 
            error: { 
              message: errorData.error || errorData.message || 'Error executing procedure'
            }
          };
        }
        return { error: null };
      } catch (error) {
        return { 
          error: { 
            message: 'Network error occurred while executing procedure'
          }
        };
      }
    }
  };
};

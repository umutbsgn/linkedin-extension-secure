import { createClient } from './popup/supabase-client.js';
import { getConnectSystemPrompt, getCommentSystemPrompt } from './background.js';

const supabaseUrl = 'https://fslbhbywcxqmqhwdcgcl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGJoYnl3Y3hxbXFod2RjZ2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MTc2MTQsImV4cCI6MjA1Mzk5MzYxNH0.vOWNflNbXMjzvjVbNPDZdwQqt2jUFy0M2gnt-msWQMM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateUsageStatistics(userId, requestType) {
    try {
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error("Error getting session:", sessionError);
            throw new Error("Session error");
        }

        if (!session.session) {
            console.error("No session found.");
            throw new Error("No session");
        }

        const { error: updateError } = await supabase
            .from('usage_statistics')
            .update({
                [requestType]: requestType === 'post_count' ? 1 : 1
            })
            .eq('user_id', userId)
            .eq('month', new Date());

        if (updateError) {
            console.error("Error updating usage statistics:", updateError);
            throw new Error("Update error");
        } else {
            console.log("Usage statistics updated successfully!");
        }
    } catch (error) {
        console.error("An unexpected error occurred while updating usage statistics:", error);
    }
}


async function createTable() {
    try {
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error("Error getting session:", sessionError);
            throw new Error("Session error");
        }

        if (!session.session) {
            console.error("No session found.");
            throw new Error("No session");
        }

        const { error: createError } = await supabase.from('usage_statistics').insert([{
            user_id: session.session.user.id,
            month: new Date(),
            post_count: 0,
            profile_connect_count: 0,
            created_at: new Date()
        }]);

        if (createError) {
            console.error("Error creating table:", createError);
            throw new Error("Create table error");
        } else {
            console.log("Table created successfully!");
        }
    } catch (error) {
        console.error("An unexpected error occurred:", error);
    }
}

createTable();

// Example usage:
// updateUsageStatistics('user123', 'post_count');
// updateUsageStatistics('user123', 'profile_connect_count');
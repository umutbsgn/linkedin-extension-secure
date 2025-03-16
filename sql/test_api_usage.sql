-- Test script to verify that the API usage tracking is working correctly

-- 1. Check if there are any entries in the api_models_usage table for today's date
SELECT 
    user_id, 
    date, 
    model, 
    calls_count, 
    created_at, 
    updated_at
FROM 
    api_models_usage
WHERE 
    date = to_char(NOW(), 'YYYY-MM-DD')
ORDER BY 
    updated_at DESC
LIMIT 10;

-- 2. Insert a test entry if none exists
-- Replace '00000000-0000-0000-0000-000000000000' with a valid user ID
INSERT INTO api_models_usage (
    user_id, 
    date, 
    model, 
    calls_count
)
VALUES (
    '00000000-0000-0000-0000-000000000000', -- Replace with a valid user ID
    to_char(NOW(), 'YYYY-MM-DD'),
    'haiku-3.5',
    1
)
ON CONFLICT (user_id, model, date) 
DO UPDATE SET 
    calls_count = api_models_usage.calls_count + 1,
    updated_at = NOW()
RETURNING *;

-- 3. Verify that the entry was inserted correctly
SELECT 
    user_id, 
    date, 
    model, 
    calls_count, 
    created_at, 
    updated_at
FROM 
    api_models_usage
WHERE 
    date = to_char(NOW(), 'YYYY-MM-DD')
ORDER BY 
    updated_at DESC
LIMIT 10;

-- Verify that the changes to the API usage tracking are working correctly

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
    date = '2025-03-15'
ORDER BY 
    updated_at DESC;

-- 2. Check the definition of the increment_api_usage function
SELECT 
    pg_get_functiondef(p.oid)
FROM 
    pg_proc p
JOIN 
    pg_namespace n ON p.pronamespace = n.oid
WHERE 
    n.nspname = 'public' AND 
    p.proname = 'increment_api_usage';

-- 3. Test the increment_api_usage function with a test user ID
SELECT 
    increment_api_usage('00000000-0000-0000-0000-000000000000', 'haiku-3.5');

-- 4. Verify that the function call incremented the calls_count
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
    user_id = '00000000-0000-0000-0000-000000000000' AND
    date = '2025-03-15' AND
    model = 'haiku-3.5';

-- 5. Check if there are any entries in the user_api_usage table
SELECT 
    user_id, 
    subscription_type,
    month,
    model, 
    calls_count, 
    use_own_api_key,
    created_at, 
    updated_at
FROM 
    user_api_usage
LIMIT 10;

-- 6. Check if there are any entries in the api_usage table (old table)
SELECT 
    user_id, 
    month, 
    calls_count, 
    created_at, 
    updated_at
FROM 
    api_usage
LIMIT 10;

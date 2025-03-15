-- Korrektur für die increment_api_usage Funktion

-- Korrigierte Funktion zum Erhöhen der API-Nutzung für einen Benutzer und ein Modell
CREATE OR REPLACE FUNCTION increment_api_usage(p_user_id UUID, p_model TEXT DEFAULT 'haiku-3.5')
RETURNS JSONB AS $$
DECLARE
    current_month TEXT := to_char(NOW(), 'YYYY-MM');
    user_subscription_type TEXT;
    model_limit INTEGER;
    current_count INTEGER;
    usage_record RECORD;
    use_own_key BOOLEAN := FALSE;
    own_key TEXT;
    result JSONB;
BEGIN
    -- Überprüfen, ob der Benutzer seinen eigenen API-Schlüssel verwendet
    SELECT 
        s.use_own_api_key, 
        s.own_api_key 
    INTO 
        use_own_key, 
        own_key
    FROM 
        user_subscriptions s
    WHERE 
        s.user_id = p_user_id
        AND s.status = 'active'
    ORDER BY 
        s.created_at DESC
    LIMIT 1;
    
    -- Wenn der Benutzer seinen eigenen API-Schlüssel verwendet, überspringen wir die Nutzungsverfolgung
    IF use_own_key AND own_key IS NOT NULL THEN
        RETURN jsonb_build_object(
            'calls_count', 0,
            'limit', 0,
            'has_remaining_calls', TRUE,
            'next_reset', (date_trunc('month', NOW()) + interval '1 month')::TEXT,
            'use_own_api_key', TRUE
        );
    END IF;
    
    -- Abonnementtyp des Benutzers abrufen
    SELECT 
        COALESCE(
            (SELECT 'pro' FROM user_subscriptions 
             WHERE user_id = p_user_id AND status = 'active' AND user_subscriptions.subscription_type = 'pro' 
             LIMIT 1),
            'trial'
        ) INTO user_subscription_type;
    
    -- Modellgrenze basierend auf dem Abonnementtyp abrufen
    IF user_subscription_type = 'pro' THEN
        model_limit := CASE 
            WHEN p_model = 'haiku-3.5' THEN 500
            WHEN p_model = 'sonnet-3.7' THEN 500
            ELSE 0
        END;
    ELSE
        model_limit := CASE 
            WHEN p_model = 'haiku-3.5' THEN 50
            ELSE 0
        END;
    END IF;
    
    -- Aktuelle Nutzung abrufen
    SELECT * INTO usage_record
    FROM api_models_usage
    WHERE user_id = p_user_id AND month = current_month AND model = p_model;
    
    IF usage_record IS NULL THEN
        -- Neuen Eintrag erstellen
        INSERT INTO api_models_usage (user_id, month, model, calls_count)
        VALUES (p_user_id, current_month, p_model, 1)
        RETURNING calls_count INTO current_count;
    ELSE
        -- Nutzung erhöhen, wenn das Limit nicht überschritten wurde
        IF model_limit = 0 OR usage_record.calls_count < model_limit THEN
            UPDATE api_models_usage
            SET calls_count = calls_count + 1, updated_at = NOW()
            WHERE user_id = p_user_id AND month = current_month AND model = p_model
            RETURNING calls_count INTO current_count;
        ELSE
            current_count := usage_record.calls_count;
        END IF;
    END IF;
    
    -- Ergebnis zurückgeben
    RETURN jsonb_build_object(
        'calls_count', current_count,
        'limit', model_limit,
        'has_remaining_calls', model_limit = 0 OR current_count <= model_limit,
        'next_reset', (date_trunc('month', NOW()) + interval '1 month')::TEXT,
        'use_own_api_key', FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

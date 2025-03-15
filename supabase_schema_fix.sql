-- Korrektur für die RPC-Funktionen

-- Korrigierte Funktion zum Erhöhen der API-Nutzung für einen Benutzer und ein Modell
CREATE OR REPLACE FUNCTION increment_api_usage(p_user_id UUID, p_model TEXT DEFAULT 'haiku-3.5')
RETURNS JSONB AS $$
DECLARE
    current_month TEXT := to_char(NOW(), 'YYYY-MM');
    user_subscription_type TEXT;
    model_limit INTEGER;
    current_count INTEGER;
    usage_id UUID;
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
    
    -- Aktuelle Nutzung abrufen oder neuen Eintrag erstellen
    SELECT id, calls_count INTO usage_id, current_count
    FROM api_models_usage
    WHERE user_id = p_user_id AND month = current_month AND model = p_model;
    
    IF usage_id IS NULL THEN
        -- Neuen Eintrag erstellen
        INSERT INTO api_models_usage (user_id, month, model, calls_count)
        VALUES (p_user_id, current_month, p_model, 1)
        RETURNING id, calls_count INTO usage_id, current_count;
    ELSE
        -- Nutzung erhöhen, wenn das Limit nicht überschritten wurde
        IF model_limit = 0 OR current_count < model_limit THEN
            UPDATE api_models_usage
            SET calls_count = calls_count + 1, updated_at = NOW()
            WHERE id = usage_id
            RETURNING calls_count INTO current_count;
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

-- Korrigierte Funktion zum Abrufen der API-Nutzung für einen Benutzer
CREATE OR REPLACE FUNCTION get_user_api_usage(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    current_month TEXT := to_char(NOW(), 'YYYY-MM');
    user_subscription_type TEXT;
    use_own_key BOOLEAN := FALSE;
    own_key TEXT;
    models_data JSONB := '{}'::JSONB;
    model_record RECORD;
    model_limit INTEGER;
BEGIN
    -- Abonnementtyp des Benutzers abrufen
    SELECT 
        COALESCE(
            (SELECT 'pro' FROM user_subscriptions 
             WHERE user_id = p_user_id AND status = 'active' AND user_subscriptions.subscription_type = 'pro' 
             LIMIT 1),
            'trial'
        ) INTO user_subscription_type;
    
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
    
    -- Wenn der Benutzer seinen eigenen API-Schlüssel verwendet, geben wir spezielle Daten zurück
    IF use_own_key AND own_key IS NOT NULL THEN
        RETURN jsonb_build_object(
            'subscription_type', user_subscription_type,
            'use_own_api_key', TRUE,
            'api_key', own_key,
            'models', '{
                "haiku-3.5": {
                    "calls_count": 0,
                    "limit": 0,
                    "has_remaining_calls": true,
                    "next_reset": "' || (date_trunc('month', NOW()) + interval '1 month')::TEXT || '"
                },
                "sonnet-3.7": {
                    "calls_count": 0,
                    "limit": 0,
                    "has_remaining_calls": true,
                    "next_reset": "' || (date_trunc('month', NOW()) + interval '1 month')::TEXT || '"
                }
            }'::JSONB
        );
    END IF;
    
    -- Für jedes Modell die Nutzung und Grenzen abrufen
    FOR model_record IN 
        SELECT model, calls_count
        FROM api_models_usage
        WHERE user_id = p_user_id AND month = current_month
    LOOP
        -- Modellgrenze basierend auf dem Abonnementtyp abrufen
        IF user_subscription_type = 'pro' THEN
            model_limit := CASE 
                WHEN model_record.model = 'haiku-3.5' THEN 500
                WHEN model_record.model = 'sonnet-3.7' THEN 500
                ELSE 0
            END;
        ELSE
            model_limit := CASE 
                WHEN model_record.model = 'haiku-3.5' THEN 50
                ELSE 0
            END;
        END IF;
        
        -- Modelldaten zum Ergebnis hinzufügen
        models_data := models_data || jsonb_build_object(
            model_record.model, jsonb_build_object(
                'calls_count', model_record.calls_count,
                'limit', model_limit,
                'has_remaining_calls', model_limit = 0 OR model_record.calls_count < model_limit,
                'next_reset', (date_trunc('month', NOW()) + interval '1 month')::TEXT
            )
        );
    END LOOP;
    
    -- Standardmodelle hinzufügen, wenn sie nicht in der Datenbank vorhanden sind
    IF NOT models_data ? 'haiku-3.5' THEN
        model_limit := CASE WHEN user_subscription_type = 'pro' THEN 500 ELSE 50 END;
        models_data := models_data || jsonb_build_object(
            'haiku-3.5', jsonb_build_object(
                'calls_count', 0,
                'limit', model_limit,
                'has_remaining_calls', TRUE,
                'next_reset', (date_trunc('month', NOW()) + interval '1 month')::TEXT
            )
        );
    END IF;
    
    IF NOT models_data ? 'sonnet-3.7' THEN
        model_limit := CASE WHEN user_subscription_type = 'pro' THEN 500 ELSE 0 END;
        models_data := models_data || jsonb_build_object(
            'sonnet-3.7', jsonb_build_object(
                'calls_count', 0,
                'limit', model_limit,
                'has_remaining_calls', model_limit > 0,
                'next_reset', (date_trunc('month', NOW()) + interval '1 month')::TEXT
            )
        );
    END IF;
    
    -- Ergebnis zurückgeben
    RETURN jsonb_build_object(
        'subscription_type', user_subscription_type,
        'use_own_api_key', FALSE,
        'models', models_data
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

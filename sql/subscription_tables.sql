-- SQL-Skript zur Erstellung der Tabellen für das Abonnement-System

-- Tabelle für Benutzerabonnements
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  subscription_type TEXT NOT NULL, -- 'trial' oder 'pro'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL, -- 'active', 'canceled', 'past_due'
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  use_own_api_key BOOLEAN DEFAULT FALSE,
  own_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für die Nutzung verschiedener API-Modelle
CREATE TABLE IF NOT EXISTS api_models_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  month TEXT NOT NULL, -- Format: 'YYYY-MM'
  model TEXT NOT NULL, -- 'haiku-3.5' oder 'sonnet-3.7'
  calls_count INTEGER DEFAULT 0,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month, model)
);

-- Einträge für die Limits in der system_config Tabelle
INSERT INTO system_config (key, value)
VALUES 
  ('trial_limits', '{"haiku_3.5": 50, "sonnet_3.7": 0}'),
  ('pro_limits', '{"haiku_3.5": 500, "sonnet_3.7": 500}')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- RLS-Richtlinien für die Tabellen
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_models_usage ENABLE ROW LEVEL SECURITY;

-- Richtlinien für user_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Richtlinien für api_models_usage
CREATE POLICY "Users can view their own API usage"
  ON api_models_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Funktion zum Abrufen des Abonnementtyps eines Benutzers
CREATE OR REPLACE FUNCTION get_user_subscription_type(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_type TEXT;
BEGIN
  SELECT us.subscription_type INTO subscription_type
  FROM user_subscriptions us
  WHERE us.user_id = get_user_subscription_type.user_id
  AND us.status = 'active'
  AND us.current_period_end > NOW()
  ORDER BY us.created_at DESC
  LIMIT 1;
  
  -- Wenn kein aktives Abonnement gefunden wurde, geben wir 'trial' zurück
  IF subscription_type IS NULL THEN
    RETURN 'trial';
  ELSE
    RETURN subscription_type;
  END IF;
END;
$$;

-- Funktion zum Abrufen der API-Limits basierend auf dem Abonnementtyp
CREATE OR REPLACE FUNCTION get_model_limits(subscription_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  limits JSONB;
BEGIN
  IF subscription_type = 'trial' THEN
    SELECT value::jsonb INTO limits FROM system_config WHERE key = 'trial_limits';
  ELSIF subscription_type = 'pro' THEN
    SELECT value::jsonb INTO limits FROM system_config WHERE key = 'pro_limits';
  ELSE
    -- Standardmäßig Trial-Limits zurückgeben
    SELECT value::jsonb INTO limits FROM system_config WHERE key = 'trial_limits';
  END IF;
  
  RETURN limits;
END;
$$;

-- Funktion zum Abrufen der API-Limits für einen bestimmten Benutzer und ein bestimmtes Modell
CREATE OR REPLACE FUNCTION get_user_model_limit(user_id UUID, model TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_type TEXT;
  limits JSONB;
  model_limit INTEGER;
BEGIN
  -- Abonnementtyp des Benutzers abrufen
  subscription_type := get_user_subscription_type(user_id);
  
  -- Limits basierend auf dem Abonnementtyp abrufen
  limits := get_model_limits(subscription_type);
  
  -- Limit für das angegebene Modell abrufen
  IF model = 'haiku-3.5' THEN
    model_limit := (limits->>'haiku_3.5')::INTEGER;
  ELSIF model = 'sonnet-3.7' THEN
    model_limit := (limits->>'sonnet_3.7')::INTEGER;
  ELSE
    model_limit := 0; -- Standardwert, wenn das Modell nicht erkannt wird
  END IF;
  
  RETURN model_limit;
END;
$$;

-- Trigger für die Aktualisierung des updated_at-Felds
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_models_usage_updated_at
BEFORE UPDATE ON api_models_usage
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

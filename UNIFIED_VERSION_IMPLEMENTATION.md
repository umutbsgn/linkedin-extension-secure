# Implementierung einer einheitlichen LLM-Version ohne Trial/Pro-Unterscheidung

Dieses Dokument beschreibt detailliert die Implementierung einer einheitlichen Version unserer Browser-Erweiterung ohne Unterscheidung zwischen Trial- und Pro-Benutzern. Es erklärt die technischen Details, Komponenteninteraktionen und die tiefgreifende Integration von Stripe, Supabase und Vercel.

## Inhaltsverzeichnis

1. [Systemarchitektur](#systemarchitektur)
2. [Datenbank-Struktur](#datenbank-struktur)
3. [Benutzerauthentifizierung](#benutzerauthentifizierung)
4. [API-Nutzungsverfolgung](#api-nutzungsverfolgung)
5. [Stripe-Integration](#stripe-integration)
6. [Frontend-Komponenten](#frontend-komponenten)
7. [Vercel-Konfiguration](#vercel-konfiguration)
8. [Deployment-Prozess](#deployment-prozess)

## Systemarchitektur

Die Browser-Erweiterung besteht aus mehreren Hauptkomponenten, die nahtlos zusammenarbeiten:

```
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
|  Browser-Extension|     |  Vercel Serverless|     |  Supabase         |
|  (Frontend)       |<--->|  Functions (API)  |<--->|  (Datenbank)      |
|                   |     |                   |     |                   |
+-------------------+     +-------------------+     +-------------------+
                                   ^
                                   |
                                   v
                          +-------------------+
                          |                   |
                          |  Externe APIs     |
                          |  (Anthropic, etc.)|
                          |                   |
                          +-------------------+
```

### Datenfluss

1. Der Benutzer interagiert mit der Browser-Erweiterung (Frontend)
2. Die Erweiterung kommuniziert mit Vercel Serverless Functions (API)
3. Die API-Funktionen interagieren mit:
   - Supabase für Authentifizierung und Datenspeicherung
   - Externe APIs wie Anthropic für LLM-Funktionalität
   - Stripe für Zahlungsabwicklung (optional in der einheitlichen Version)

## Datenbank-Struktur

### Tabellen und Beziehungen

Die Supabase-Datenbank verwendet folgende Haupttabellen:

#### user_subscriptions

Diese Tabelle speichert Benutzerinformationen und API-Schlüssel-Präferenzen:

```sql
CREATE TABLE user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    use_own_api_key BOOLEAN DEFAULT FALSE,
    own_api_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Wichtige Felder:**
- `user_id`: Verknüpft mit Supabase Auth-Benutzer
- `use_own_api_key`: Bestimmt, ob der Benutzer seinen eigenen API-Schlüssel verwendet
- `own_api_key`: Speichert den API-Schlüssel des Benutzers (verschlüsselt)

#### api_models_usage

Diese Tabelle verfolgt die API-Nutzung pro Modell und Benutzer:

```sql
CREATE TABLE api_models_usage (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    model VARCHAR(50) NOT NULL,
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    calls_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint für user_id + model + month
CREATE UNIQUE INDEX idx_api_models_usage_user_model_month 
ON api_models_usage(user_id, model, month);
```

**Wichtige Felder:**
- `model`: Speichert den Modellnamen (z.B. 'haiku-3.5', 'sonnet-3.7')
- `month`: Speichert den Monat im Format YYYY-MM für monatliche Nutzungsstatistiken
- `calls_count`: Zählt die API-Aufrufe

### Datenbank-Policies

Supabase verwendet Row-Level Security (RLS) Policies, um den Datenzugriff zu kontrollieren:

```sql
-- Benutzer können nur ihre eigenen Daten lesen
CREATE POLICY "Authenticated users can read their own data"
ON user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Benutzer können nur ihre eigenen Daten einfügen
CREATE POLICY "Authenticated users can insert their own data"
ON user_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Benutzer können nur ihre eigenen Daten aktualisieren
CREATE POLICY "Authenticated users can update their own data"
ON user_subscriptions FOR UPDATE
USING (auth.uid() = user_id);
```

Diese Policies stellen sicher, dass Benutzer nur auf ihre eigenen Daten zugreifen können, was die Sicherheit erhöht.

## Benutzerauthentifizierung

### Registrierungsprozess

Der Registrierungsprozess in `api/supabase/auth/signup.js` wurde vereinfacht:

```javascript
export default async function handler(req, res) {
    try {
        const { email, password } = req.body;
        
        // Supabase-Client initialisieren
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY
        );
        
        // Benutzer registrieren
        const { data: { user }, error } = await supabase.auth.signUp({
            email,
            password,
        });
        
        if (error) throw error;
        
        // Standardeintrag in user_subscriptions erstellen
        const { error: insertError } = await supabase
            .from('user_subscriptions')
            .insert({
                user_id: user.id,
                status: 'active'
            });
            
        if (insertError) throw insertError;
        
        // Erfolgreiche Antwort senden
        res.status(200).json({ 
            success: true, 
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                hasFullAccess: true // Alle Benutzer haben vollen Zugriff
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(400).json({ 
            success: false, 
            message: error.message 
        });
    }
}
```

**Schlüsselpunkte:**
1. Benutzer werden mit Supabase Auth registriert
2. Ein Standardeintrag wird in der `user_subscriptions`-Tabelle erstellt
3. Alle Benutzer erhalten vollen Zugriff (`hasFullAccess: true`)

### Anmeldeprozess

Der Anmeldeprozess in `api/supabase/auth/login.js` wurde ebenfalls angepasst:

```javascript
export default async function handler(req, res) {
    try {
        const { email, password } = req.body;
        
        // Supabase-Client initialisieren
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY
        );
        
        // Benutzer anmelden
        const { data: { session }, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        
        if (error) throw error;
        
        // Benutzerinformationen abrufen
        const { data: subscriptionData } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .single();
            
        // Erfolgreiche Antwort senden
        res.status(200).json({ 
            success: true, 
            session,
            user: {
                id: session.user.id,
                email: session.user.email,
                hasFullAccess: true, // Alle Benutzer haben vollen Zugriff
                useOwnApiKey: subscriptionData?.use_own_api_key || false,
                ownApiKey: subscriptionData?.own_api_key || null
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(400).json({ 
            success: false, 
            message: error.message 
        });
    }
}
```

**Schlüsselpunkte:**
1. Benutzer werden mit Supabase Auth authentifiziert
2. Benutzerinformationen werden aus der `user_subscriptions`-Tabelle abgerufen
3. Alle Benutzer erhalten vollen Zugriff (`hasFullAccess: true`)
4. Die API-Schlüssel-Einstellungen werden beibehalten

## API-Nutzungsverfolgung

### Nutzungsverfolgung ohne Limits

Die API-Nutzungsverfolgung in `api/utils/usage.js` wurde angepasst, um Limits zu entfernen, aber die Nutzungsverfolgung beizubehalten:

```javascript
// Modell-Limit-Funktion (gibt immer unbegrenzt zurück)
export async function getModelLimit(supabase, userId, model = DEFAULT_MODEL) {
    try {
        console.log(`Getting model limit for user ${userId} and model ${model}`);
        
        // Unbegrenzte Nutzung für alle Benutzer
        return 0; // 0 bedeutet unbegrenzt
    } catch (error) {
        console.error('Unexpected error in getModelLimit:', error);
        return 0; // Auch bei Fehlern unbegrenzt
    }
}

// API-Nutzung prüfen und aktualisieren
export async function checkAndUpdateApiUsage(supabase, userId, model = DEFAULT_MODEL) {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    console.log(`Checking and updating API usage for user ${userId}, model ${model}, month ${currentMonth}`);

    try {
        // Prüfen, ob der Benutzer seinen eigenen API-Schlüssel verwendet
        const { useOwnKey, apiKey } = await shouldUseOwnApiKey(supabase, userId);
        console.log(`User ${userId} should use own API key: ${useOwnKey}`);

        // Wenn der Benutzer seinen eigenen API-Schlüssel verwendet, Nutzungsverfolgung überspringen
        if (useOwnKey && apiKey) {
            console.log(`User ${userId} is using their own API key, skipping usage tracking`);
            return {
                data: {
                    callsCount: 0,
                    limit: 0,
                    hasRemainingCalls: true,
                    nextResetDate: getNextMonthDate(),
                    useOwnKey: true,
                    apiKey
                }
            };
        }

        // Nutzungseintrag in der Datenbank suchen oder erstellen
        let { data, error } = await supabase
            .from('api_models_usage')
            .select('*')
            .eq('user_id', userId)
            .eq('month', currentMonth)
            .eq('model', model)
            .single();

        // Wenn kein Eintrag gefunden wurde, einen neuen erstellen
        if (!data || (error && error.code === 'PGRST116')) {
            console.log(`Creating new API usage entry for user ${userId}, model ${model}`);
            const { data: newData, error: insertError } = await supabase
                .from('api_models_usage')
                .insert([{
                    user_id: userId,
                    month: currentMonth,
                    model: model,
                    calls_count: 1,
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error creating API usage entry:', insertError);
                // Bei Fehler trotzdem unbegrenzten Zugriff gewähren
                return { 
                    data: {
                        callsCount: 1,
                        limit: 0,
                        hasRemainingCalls: true,
                        nextResetDate: getNextMonthDate(),
                        useOwnKey: false
                    }
                };
            }

            data = newData;
            console.log(`Created new API usage entry for user ${userId}, model ${model}`);
        } else {
            // Bestehenden Eintrag aktualisieren
            const newCount = data.calls_count + 1;
            console.log(`Updating API usage entry for user ${userId}, model ${model}: ${data.calls_count} -> ${newCount} calls`);

            const { error: updateError } = await supabase
                .from('api_models_usage')
                .update({
                    calls_count: newCount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', data.id);

            if (updateError) {
                console.error(`Error updating API usage:`, updateError);
                // Bei Fehler trotzdem unbegrenzten Zugriff gewähren
            } else {
                data.calls_count = newCount;
            }
        }

        // Ergebnis zurückgeben (immer mit unbegrenztem Zugriff)
        return {
            data: {
                callsCount: data.calls_count,
                limit: 0, // Unbegrenzt
                hasRemainingCalls: true, // Immer true
                nextResetDate: getNextMonthDate(),
                useOwnKey: false,
                model: model
            }
        };
    } catch (error) {
        console.error('Unexpected error in checkAndUpdateApiUsage:', error);
        // Bei Fehler trotzdem unbegrenzten Zugriff gewähren
        return { 
            data: {
                callsCount: 0,
                limit: 0,
                hasRemainingCalls: true,
                nextResetDate: getNextMonthDate(),
                useOwnKey: false
            }
        };
    }
}
```

**Schlüsselpunkte:**
1. `getModelLimit` gibt immer 0 zurück, was unbegrenzte Nutzung bedeutet
2. `checkAndUpdateApiUsage` verfolgt weiterhin die Nutzung für Analysezwecke
3. `hasRemainingCalls` ist immer `true`, sodass Benutzer nie blockiert werden
4. Die Funktionalität für eigene API-Schlüssel bleibt erhalten

### Integration mit Anthropic API

Der Anthropic-Analyse-Endpunkt in `api/anthropic/analyze.js` wurde angepasst:

```javascript
export default async function handler(req, res) {
    try {
        // Authentifizierung und Validierung
        const { userId, model, prompt } = await validateRequest(req);
        
        // Supabase-Client initialisieren
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY
        );
        
        // API-Nutzung verfolgen (ohne Limits zu prüfen)
        const { data: usageData, error: usageError } = 
            await checkAndUpdateApiUsage(supabase, userId, model);
            
        if (usageError) {
            console.error('Error tracking API usage:', usageError);
            // Trotz Fehler fortfahren
        }
        
        // API-Schlüssel bestimmen (eigener oder Standard)
        let apiKey = process.env.ANTHROPIC_API_KEY;
        if (usageData?.useOwnKey && usageData?.apiKey) {
            apiKey = usageData.apiKey;
        }
        
        // Anfrage an Anthropic senden
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Error calling Anthropic API');
        }
        
        // Erfolgreiche Antwort senden
        res.status(200).json({
            success: true,
            result: data.content[0].text,
            usage: {
                callsCount: usageData?.callsCount || 0,
                limit: 0, // Unbegrenzt
                hasRemainingCalls: true // Immer true
            }
        });
    } catch (error) {
        console.error('Analyze error:', error);
        res.status(400).json({ 
            success: false, 
            message: error.message 
        });
    }
}
```

**Schlüsselpunkte:**
1. Die API-Nutzung wird weiterhin verfolgt, aber ohne Limits zu prüfen
2. Die Funktionalität für eigene API-Schlüssel bleibt erhalten
3. Die Antwort enthält immer `hasRemainingCalls: true`

## Stripe-Integration

### Tiefgreifende Erklärung der Stripe-Integration

Die Stripe-Integration wurde optional beibehalten, um einmalige Zahlungen oder Spenden zu ermöglichen. Hier ist eine detaillierte Erklärung der Komponenten:

#### 1. Stripe-Konfiguration

Die Stripe-Konfiguration in `api/config/stripe-keys.js` und anderen Konfigurationsdateien:

```javascript
// api/config/stripe-keys.js
export const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;

// api/config/stripe-secret-key.js
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// api/config/stripe-price-id.js
export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

// api/config/stripe-webhook-secret.js
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
```

Diese Konfigurationsdateien importieren die Stripe-Schlüssel aus den Vercel-Umgebungsvariablen.

#### 2. Stripe-Client im Frontend

Der Stripe-Client in `popup/stripe-client.js`:

```javascript
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '../api/config/stripe-keys';

let stripePromise;

export const getStripe = () => {
    if (!stripePromise) {
        stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
    }
    return stripePromise;
};

export const redirectToCheckout = async (priceId) => {
    try {
        // Stripe-Instanz abrufen
        const stripe = await getStripe();
        
        // Checkout-Session erstellen
        const response = await fetch('/api/subscriptions/create-checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId,
            }),
        });
        
        const { sessionId } = await response.json();
        
        // Zu Stripe Checkout weiterleiten
        const { error } = await stripe.redirectToCheckout({
            sessionId,
        });
        
        if (error) {
            console.error('Error redirecting to checkout:', error);
            return { success: false, error };
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error in redirectToCheckout:', error);
        return { success: false, error };
    }
};
```

Dieser Client lädt Stripe im Frontend und bietet eine Funktion zum Weiterleiten zum Checkout.

#### 3. Checkout-Session erstellen

Der Endpunkt zum Erstellen einer Checkout-Session in `api/subscriptions/create-checkout.js`:

```javascript
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '../config/stripe-secret-key';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config/supabase-keys';

const stripe = new Stripe(STRIPE_SECRET_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Benutzer authentifizieren
        const { user, error: authError } = await supabase.auth.getUser(
            req.headers.authorization?.split(' ')[1]
        );
        
        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const { priceId } = req.body;
        
        // Checkout-Session erstellen
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'payment', // Einmalige Zahlung statt Abonnement
            success_url: `${req.headers.origin}/api/subscriptions/redirect?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/api/subscriptions/redirect?canceled=true`,
            customer_email: user.email,
            client_reference_id: user.id,
            metadata: {
                userId: user.id,
            },
        });
        
        res.status(200).json({ sessionId: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
}
```

Dieser Endpunkt erstellt eine Stripe Checkout-Session für einmalige Zahlungen.

#### 4. Webhook-Verarbeitung

Der Webhook-Endpunkt in `api/subscriptions/webhook.js`:

```javascript
import Stripe from 'stripe';
import { buffer } from 'micro';
import { STRIPE_SECRET_KEY } from '../config/stripe-secret-key';
import { STRIPE_WEBHOOK_SECRET } from '../config/stripe-webhook-secret';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config/supabase-keys';

const stripe = new Stripe(STRIPE_SECRET_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const buf = await buffer(req);
        const sig = req.headers['stripe-signature'];
        
        // Webhook-Ereignis verifizieren
        const event = stripe.webhooks.constructEvent(
            buf.toString(),
            sig,
            STRIPE_WEBHOOK_SECRET
        );
        
        // Verschiedene Ereignistypen verarbeiten
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            
            // Benutzer-ID aus Metadaten extrahieren
            const userId = session.metadata.userId || session.client_reference_id;
            
            if (!userId) {
                throw new Error('No user ID found in session metadata');
            }
            
            // Benutzer in der Datenbank aktualisieren
            const { error } = await supabase
                .from('user_subscriptions')
                .upsert({
                    user_id: userId,
                    status: 'active',
                    updated_at: new Date().toISOString()
                });
                
            if (error) {
                throw error;
            }
            
            console.log(`Payment successful for user ${userId}`);
        }
        
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(400).json({ error: error.message });
    }
}
```

Dieser Webhook-Endpunkt verarbeitet Stripe-Ereignisse und aktualisiert die Benutzerdaten in der Datenbank.

#### 5. Abonnementstatus prüfen

Der Endpunkt zum Prüfen des Abonnementstatus in `api/subscriptions/status.js`:

```javascript
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config/supabase-keys';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    try {
        // Benutzer authentifizieren
        const { user, error: authError } = await supabase.auth.getUser(
            req.headers.authorization?.split(' ')[1]
        );
        
        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // In der einheitlichen Version haben alle Benutzer vollen Zugriff
        res.status(200).json({
            isSubscribed: true,
            subscriptionType: 'full',
            hasFullAccess: true
        });
    } catch (error) {
        console.error('Error checking subscription status:', error);
        res.status(500).json({ error: error.message });
    }
}
```

Dieser Endpunkt gibt immer vollen Zugriff zurück, unabhängig vom tatsächlichen Abonnementstatus.

### Interaktion zwischen Komponenten

Die Stripe-Integration interagiert mit anderen Komponenten wie folgt:

1. **Frontend → Stripe-Client → API → Stripe**:
   - Der Benutzer klickt auf einen Spenden-Button
   - Der Stripe-Client ruft den `create-checkout`-Endpunkt auf
   - Der Endpunkt erstellt eine Checkout-Session und gibt die Session-ID zurück
   - Der Benutzer wird zu Stripe Checkout weitergeleitet

2. **Stripe → Webhook → Datenbank**:
   - Nach erfolgreicher Zahlung sendet Stripe ein Webhook-Ereignis
   - Der Webhook-Endpunkt verarbeitet das Ereignis
   - Die Benutzerdaten werden in der Datenbank aktualisiert

3. **Frontend → Status-API → Datenbank**:
   - Die Erweiterung prüft regelmäßig den Abonnementstatus
   - Der Status-Endpunkt gibt immer vollen Zugriff zurück
   - Die Benutzeroberfläche zeigt keine Upgrade-Hinweise mehr an

## Frontend-Komponenten

### Subscription-Manager

Der Subscription-Manager in `popup/subscription-manager.js` wurde vereinfacht:

```javascript
// Abonnementstatus abrufen
export async function getSubscriptionStatus() {
    try {
        const token = await getAuthToken();
        
        if (!token) {
            return { isSubscribed: false, hasFullAccess: false };
        }
        
        const response = await fetch('/api/subscriptions/status', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to get subscription status');
        }
        
        const data = await response.json();
        
        // In der einheitlichen Version haben alle Benutzer vollen Zugriff
        return {
            isSubscribed: true,
            subscriptionType: 'full',
            hasFullAccess: true
        };
    } catch (error) {
        console.error('Error getting subscription status:', error);
        return { isSubscribed: false, hasFullAccess: true }; // Trotzdem vollen Zugriff gewähren
    }
}

// API-Nutzung abrufen
export async function getApiUsage(model) {
    try {
        const token = await getAuthToken();
        
        if (!token) {
            return { callsCount: 0, limit: 0, hasRemainingCalls: true };
        }
        
        const response = await fetch(`/api/usage?model=${model}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to get API usage');
        }
        
        const data = await response.json();
        
        // Nutzungsdaten zurückgeben, aber immer mit unbegrenztem Zugriff
        return {
            callsCount: data.callsCount || 0,
            limit: 0, // Unbegrenzt
            hasRemainingCalls: true // Immer true
        };
    } catch (error) {
        console.error('Error getting API usage:', error);
        return { callsCount: 0, limit: 0, hasRemainingCalls: true };
    }
}

// API-Schlüssel aktualisieren
export async function updateApiKey(useOwnKey, apiKey) {
    try {
        const token = await getAuthToken();
        
        if (!token) {
            throw new Error('Not authenticated');
        }
        
        const response = await fetch('/api/subscriptions/update-api-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                useOwnKey,
                apiKey
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update API key');
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error updating API key:', error);
        return { success: false, error };
    }
}
```

### Popup-UI

Die Popup-UI in `popup/popup.js` wurde vereinfacht, um Upgrade-Hinweise zu entfernen:

```javascript
// Benutzeroberfläche initialisieren
async function initializeUI() {
    try {
        // Abonnementstatus abrufen
        const { isSubscribed, hasFullAccess } = await getSubscriptionStatus();
        
        // API-Nutzung abrufen
        const { callsCount, limit, hasRemainingCalls } = await getApiUsage('haiku-3.5');
        
        // UI-Elemente aktualisieren
        updateUIElements({
            isSubscribed,
            hasFullAccess,
            callsCount,
            limit,
            hasRemainingCalls
        });
        
        // Event-Listener hinzufügen
        addEventListeners();
    } catch (error) {
        console.error('Error initializing UI:', error);
        showError('Failed to initialize UI. Please try again later.');
    }
}

// UI-Elemente aktualisieren
function updateUIElements({ isSubscribed, hasFullAccess, callsCount, limit }) {
    // Alle Upgrade-Buttons und Pro-Hinweise ausblenden
    document.querySelectorAll('.upgrade-button, .pro-feature-badge').forEach(el => {
        el.style.display = 'none';
    });
    
    // Nutzungsstatistik anzeigen (nur zu Informationszwecken)
    const usageElement = document.getElementById('api-usage');
    if (usageElement) {
        if (limit === 0) {
            usageElement.textContent = `API-Nutzung: ${callsCount} Aufrufe (unbegrenzt)`;
        } else {
            usageElement.textContent = `API-Nutzung: ${callsCount} / ${limit} Aufrufe`;
        }
    }
    
    // Alle Funktionen aktivieren
    document.querySelectorAll('.feature-container').forEach(el => {
        el.classList.remove('disabled');
    });
}
```

## Vercel-Konfiguration

### Umgebungsvariablen

Die Vercel-Umgebungsvariablen wurden vereinfacht:

```
# Supabase-Konfiguration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key

# Anthropic-API-Konfiguration
ANTHROPIC_API_KEY=your-anthropic-key
DEFAULT_MODEL=haiku-3.5

# Stripe-Konfiguration (optional für Spenden)
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PRICE_ID=your-stripe-price-id
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Einheitliche Version Konfiguration
UNLIMITED_ACCESS=true
```

### Vercel.json

Die `vercel.json`-Datei wurde angepasst, um die API-Routen zu konfigurieren:

```json
{
  "version": 2,
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ],
  "env": {
    "UNLIMITED_ACCESS": "true"
  }
}
```

### Konfigurationsdatei

Die Hauptkonfigurationsdatei `config.js` wurde aktualisiert:

```javascript
// Allgemeine Konfiguration
export const APP_NAME = 'LLM Browser Extension';
export const APP_VERSION = '2.0.0';

// Feature-Flags
export const FEATURES = {
    UNLIMITED_ACCESS: process.env.UNLIMITED_ACCESS === 'true',
    USE_OWN_API_KEY: true,
    ANALYTICS_ENABLED: true
};

// API-Konfiguration
export const API_CONFIG = {
    DEFAULT_MODEL: process.env.DEFAULT_MODEL || 'haiku-3.5',
    AVAILABLE_MODELS: ['haiku-3.5', 'sonnet-3.7']
};

// Analytik-Konfiguration
export const ANALYTICS_CONFIG = {
    POSTHOG_ENABLED: true,
    USAGE_TRACKING_ENABLED: true
};
```

## Deployment-Prozess

### Schritt 1: Codeänderungen vorbereiten

1. Alle Dateien gemäß dem Plan aktualisieren
2. Lokale Tests durchführen
3. Änderungen in das Git-Repository übernehmen

```bash
git add .
git commit -m "Implement unified version without trial/pro distinction"
git push origin main
```

### Schritt 2: Datenbank-Migration

1. Verbindung zur Supabase-Datenbank herstellen
2. SQL-Skripte ausführen, um die Tabellen anzupassen

```sql
-- Bestehende Tabellen anpassen
ALTER TABLE user_subscriptions
DROP COLUMN subscription_type CASCADE;

-- Datenbank-Policies aktualisieren
DROP POLICY IF EXISTS "Pro users can access premium features" ON premium_features;
CREATE POLICY "All users can access all features" ON premium_features
USING (true);
```

### Schritt 3: Vercel-Umgebungsvariablen konfigurieren

1. Im Vercel-Dashboard die Umgebungsvariablen aktualisieren
2. Neue Variable `UNLIMITED_ACCESS=true` hinzufügen
3. Deployment neu starten, um die Änderungen zu übernehmen

### Schritt 4: Testen und Überwachen

1. Umfassende Tests durchführen:
   - Benutzerregistrierung und -anmeldung
   - API-Nutzung mit verschiedenen Modellen
   - Eigene API-Schlüssel-Funktionalität
   - Spenden-Funktionalität (falls beibehalten)

2. Überwachung einrichten:
   - Fehlerprotokolle überwachen
   - Nutzungsstatistiken verfolgen
   - Benutzer-Feedback sammeln

### Schritt 5: Rollback-Plan

Falls Probleme auftreten, einen Rollback-Plan vorbereiten:

1. Vorherige Version wiederherstellen
2. Datenbank-Änderungen rückgängig machen
3. Umgebungsvariablen zurücksetzen

## Fazit

Durch diese Änderungen haben wir erfolgreich eine einheitliche Version unserer Browser-Erweiterung implementiert, die allen Benutzern vollen Zugriff auf alle Funktionen bietet. Die wichtigsten Komponenten wie Authentifizierung, Nutzungsverfolgung und die Option für eigene API-Schlüssel wurden beibehalten, während die Unterscheidung zwischen Trial- und Pro-Benutzern entfernt wurde.

Die Implementierung ist flexibel und kann leicht angepasst werden, falls in Zukunft wieder unterschiedliche Zugriffsebenen eingeführt werden sollen. Die Nutzungsverfolgung bleibt für Analysezwecke erhalten, sodass wir weiterhin Einblicke in die Nutzungsmuster unserer Benutzer haben.

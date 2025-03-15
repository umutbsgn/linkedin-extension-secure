# Endpoint-Tests

Dieser Ordner enthält verschiedene Dateien zum Testen der API-Endpunkte und Verbindungen der Browser-Erweiterung.

## Startseite

- `index.html` - Hauptseite mit Links zu allen Tests

## Authentifizierung

- `auth-token-generator.html` - HTML-Seite zum Anmelden oder Registrieren und Generieren eines Authentifizierungstokens
  - Ermöglicht die Anmeldung mit E-Mail und Passwort
  - Ermöglicht die Registrierung (mit Beta-Zugang)
  - Speichert den Token automatisch im lokalen Speicher für andere Tests

## Dateien

### Vercel-Verbindungstests
- `check-vercel-connection.html` - HTML-Seite zum Testen der Verbindung zum Vercel-Backend (mit ES-Modulen)
- `check-vercel-connection-simple.html` - Vereinfachte Version ohne ES-Module (funktioniert direkt im Dateisystem)
- `check-vercel-connection.js` - JavaScript-Modul für die Vercel-Verbindungsprüfung

### Supabase-Konfigurationstests
- `check-supabase-config.html` - HTML-Seite zum Testen der Supabase-Konfiguration (URL und API-Schlüssel)

### API-Endpunkttests
- `test-api-endpoints.html` - Umfassende HTML-Seite zum Testen verschiedener API-Endpunkte:
  - PostHog-Konfiguration (Key und Host)
  - PostHog-Tracking
  - API-Nutzung
  - Anthropic-Analyse

### Supabase RPC-Funktionstests
- `test-rpc-functions.js` - Node.js-Skript zum Testen der Supabase RPC-Funktionen:
  - `get_model_limits` - Abrufen der API-Limits basierend auf dem Abonnementtyp
  - `increment_api_usage` - Erhöhen der API-Nutzung für einen Benutzer
  - `get_user_api_usage` - Abrufen der aktuellen API-Nutzung für einen Benutzer

## Verwendung

### HTML-Tests
Öffnen Sie die HTML-Dateien in einem Browser, um die entsprechenden Tests durchzuführen:
```
open endpoint-tests/check-vercel-connection-simple.html
open endpoint-tests/check-supabase-config.html
open endpoint-tests/test-api-endpoints.html
```

### RPC-Funktionstests
Führen Sie das Node.js-Skript mit einer Benutzer-ID aus:
```
node endpoint-tests/test-rpc-functions.js <user_id>
```

## Hinweise
- Für die Supabase-Tests wird ein gültiges Authentifizierungstoken benötigt
  - Verwenden Sie die `auth-token-generator.html` Datei, um einen Token zu generieren
  - Der Token wird automatisch im lokalen Speicher gespeichert und für andere Tests verfügbar gemacht
- Für die RPC-Funktionstests müssen die Umgebungsvariablen SUPABASE_URL und SUPABASE_SERVICE_KEY gesetzt sein

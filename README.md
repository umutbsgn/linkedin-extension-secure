# Supabase RPC Functions Test

Dieses Projekt enthält ein Testskript, um die RPC-Funktionen in Supabase zu testen, die für die Stripe-Integration und API-Nutzungsverfolgung verwendet werden.

## Voraussetzungen

- Node.js (v14 oder höher)
- npm oder yarn
- Supabase-Projekt mit den erforderlichen RPC-Funktionen

## Installation

1. Klonen Sie dieses Repository oder kopieren Sie die Dateien in Ihr Projekt.
2. Installieren Sie die Abhängigkeiten:

```bash
npm install
```

## Konfiguration

1. Bearbeiten Sie die `.env`-Datei und fügen Sie Ihre Supabase-Anmeldeinformationen hinzu:

```
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

## Verwendung

Führen Sie das Testskript mit einer Benutzer-ID aus:

```bash
node test-rpc-functions.js <user_id>
```

Ersetzen Sie `<user_id>` durch eine gültige Benutzer-ID aus Ihrer Supabase-Datenbank.

## Was wird getestet?

Das Skript testet die folgenden RPC-Funktionen:

1. `get_model_limits` - Gibt die API-Limits basierend auf dem Abonnementtyp zurück
2. `increment_api_usage` - Erhöht die API-Nutzung für einen Benutzer und ein Modell
3. `get_user_api_usage` - Gibt die aktuelle API-Nutzung für einen Benutzer zurück

Außerdem testet es direkte Tabellenoperationen, um sicherzustellen, dass die Tabellen korrekt konfiguriert sind.

## Fehlerbehebung

Wenn die Tests fehlschlagen, überprüfen Sie Folgendes:

1. Stellen Sie sicher, dass die RPC-Funktionen in Supabase korrekt implementiert sind.
2. Überprüfen Sie, ob die Tabellen `user_subscriptions`, `api_models_usage` und `system_config` in Ihrer Supabase-Datenbank existieren.
3. Stellen Sie sicher, dass die Benutzer-ID gültig ist und in der `user_subscriptions`-Tabelle existiert.

## Lösung für 500-Fehler

Wenn Sie 500-Fehler bei API-Aufrufen erhalten, könnte dies auf Probleme mit den RPC-Funktionen hinweisen. Verwenden Sie dieses Testskript, um die Funktionen zu überprüfen und Fehler zu identifizieren.

Häufige Probleme:
- Fehlende oder falsch implementierte RPC-Funktionen
- Fehlende Tabellen oder Spalten
- Berechtigungsprobleme mit dem Supabase-Service-Key

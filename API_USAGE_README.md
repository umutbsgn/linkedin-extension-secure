# API-Nutzungslimit-System

Dieses Dokument beschreibt die Implementierung des API-Nutzungslimits von 50 Aufrufen pro Monat für die LinkedIn AI Assistant-Erweiterung.

## Übersicht

Das System beschränkt jeden Benutzer auf 50 API-Aufrufe pro Monat. Die Nutzung wird in der Supabase-Datenbank verfolgt und dem Benutzer in der Popup-Oberfläche angezeigt. Wenn ein Benutzer sein Limit erreicht, wird eine entsprechende Fehlermeldung angezeigt, und weitere API-Aufrufe werden blockiert, bis das Limit zurückgesetzt wird.

## Implementierte Komponenten

1. **Supabase-Datenbank-Tabelle**: `api_usage`
   - Verfolgt die API-Nutzung pro Benutzer und Monat
   - Speichert die Anzahl der Aufrufe, das Datum des letzten Zurücksetzens und andere Metadaten

2. **Backend-Endpunkte**:
   - `/api/usage`: Gibt die aktuelle API-Nutzung eines Benutzers zurück
   - Änderungen an `/api/anthropic/analyze.js`: Überprüft und aktualisiert die API-Nutzung vor jedem API-Aufruf

3. **Frontend-Komponenten**:
   - Neue UI-Komponente in `popup/popup.html`: Zeigt die API-Nutzung an
   - Styling in `popup/popup.css`: Formatiert die Nutzungsanzeige
   - Funktionen in `popup/popup.js`: Lädt und aktualisiert die API-Nutzungsdaten

## Datenbank-Setup

Um die notwendige Tabelle in Supabase zu erstellen, führen Sie das folgende SQL-Skript in der Supabase SQL-Konsole aus:

```sql
-- Create the api_usage table
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  calls_count INTEGER DEFAULT 0,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS api_usage_user_month_idx ON api_usage(user_id, month);

-- Create RLS policies for the api_usage table
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read only their own usage data
CREATE POLICY "Users can read their own usage data"
  ON api_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy to allow users to insert their own usage data
CREATE POLICY "Users can insert their own usage data"
  ON api_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own usage data
CREATE POLICY "Users can update their own usage data"
  ON api_usage
  FOR UPDATE
  USING (auth.uid() = user_id);
```

## Funktionsweise

1. **Verfolgung der API-Nutzung**:
   - Bei jedem API-Aufruf wird die Funktion `checkAndUpdateApiUsage` in `api/utils/usage.js` aufgerufen
   - Diese Funktion prüft, ob ein Eintrag für den aktuellen Monat existiert, und erstellt einen, falls nicht
   - Sie erhöht den Zähler und prüft, ob das Limit erreicht wurde

2. **Anzeige der API-Nutzung**:
   - Beim Laden der Popup-Oberfläche wird die Funktion `loadApiUsage` aufgerufen
   - Die Funktion `updateApiUsageUI` aktualisiert die UI mit den aktuellen Nutzungsdaten
   - Die Fortschrittsanzeige ändert die Farbe basierend auf der verbleibenden Nutzung (grün, gelb, rot)

3. **Zurücksetzen des Limits**:
   - Das Limit wird automatisch am ersten Tag jedes Monats zurückgesetzt
   - Dies wird durch die Überprüfung des aktuellen Monats in der `checkAndUpdateApiUsage`-Funktion erreicht

## Fehlermeldungen

Wenn ein Benutzer sein Limit erreicht, wird eine Fehlermeldung angezeigt:
- Im Backend: HTTP 403 mit der Nachricht "Monthly API call limit reached"
- Im Frontend: "You have reached your monthly API call limit. Please try again next month."

## Anpassung des Limits

Um das Limit anzupassen, ändern Sie den Wert in den folgenden Dateien:
- `api/utils/usage.js`: In den Funktionen `checkAndUpdateApiUsage` und `getCurrentApiUsage`
- `api/anthropic/analyze.js`: In der Fehlermeldung, wenn das Limit erreicht wurde
- `popup/popup.js`: In der Funktion `updateApiUsageUI`

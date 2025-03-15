# Zentralisiertes API-Nutzungslimit-System

Dieses Dokument beschreibt die Implementierung des zentralisierten API-Nutzungslimits für die LinkedIn AI Assistant-Erweiterung. Das System speichert das Limit in der Supabase-Datenbank, um es vor Code-Manipulationen zu schützen.

## Übersicht

Das System beschränkt jeden Benutzer auf eine konfigurierbare Anzahl von API-Aufrufen pro Monat. Das Limit wird in der Supabase-Datenbank gespeichert und kann nur von Administratoren geändert werden. Dies bietet folgende Vorteile:

1. **Sicherheit**: Das Limit ist vor Client-seitigen Code-Manipulationen geschützt
2. **Zentralisierte Verwaltung**: Das Limit kann ohne Code-Änderungen angepasst werden
3. **Flexibilität**: Verschiedene Limits für verschiedene Benutzergruppen können implementiert werden

## Implementierte Komponenten

1. **Supabase-Datenbank-Tabellen**:
   - `api_usage`: Verfolgt die API-Nutzung pro Benutzer und Monat
   - `system_config`: Speichert globale Konfigurationseinstellungen, einschließlich des API-Limits

2. **Supabase-Funktionen**:
   - `get_api_usage_limit()`: Funktion zum Abrufen des aktuellen API-Limits

3. **Backend-Komponenten**:
   - Caching-System in `api/utils/usage.js`: Reduziert Datenbankabfragen durch lokales Caching des Limits
   - Fallback-Mechanismus: Verwendet einen Standardwert, wenn die Datenbank nicht verfügbar ist

## Datenbank-Setup

Um die notwendigen Tabellen und Funktionen in Supabase zu erstellen, führen Sie die folgenden SQL-Skripte in der Supabase SQL-Konsole aus:

1. Zuerst das Skript `createApiUsageTable.sql` ausführen, um die `api_usage`-Tabelle zu erstellen
2. Dann das Skript `createSystemConfigTable.sql` ausführen, um die `system_config`-Tabelle und die `get_api_usage_limit()`-Funktion zu erstellen

## Ändern des API-Limits

Um das API-Limit zu ändern, gibt es zwei Möglichkeiten:

### 1. Über die Supabase SQL-Konsole

```sql
UPDATE system_config
SET value = '{"monthly_limit": 100}'
WHERE key = 'api_usage_limits';
```

Ersetzen Sie `100` durch das gewünschte Limit.

### 2. Über die Supabase-Tabellen-UI

1. Melden Sie sich bei Ihrer Supabase-Konsole an
2. Navigieren Sie zur Tabelle `system_config`
3. Suchen Sie den Eintrag mit dem Schlüssel `api_usage_limits`
4. Bearbeiten Sie den Wert und ändern Sie `monthly_limit` auf das gewünschte Limit
5. Speichern Sie die Änderungen

## Sicherheit

Die `system_config`-Tabelle ist durch Row Level Security (RLS) geschützt:

- Nur Benutzer mit der Rolle `is_admin` können die Tabelle ändern
- Alle authentifizierten Benutzer können die Tabelle lesen

Um einem Benutzer Administratorrechte zu geben, müssen Sie das JWT-Token des Benutzers mit dem Anspruch `is_admin` aktualisieren. Dies kann über die Supabase Auth Hooks oder durch Anpassen der Benutzermetadaten erfolgen.

## Technische Details

### Caching-Mechanismus

Um die Anzahl der Datenbankabfragen zu reduzieren, implementiert das System ein Caching-System:

- Das Limit wird für 5 Minuten im Speicher zwischengespeichert
- Nach Ablauf der Cache-Zeit wird das Limit erneut aus der Datenbank abgerufen
- Bei Fehlern wird ein Fallback-Wert von 50 verwendet

### Fehlerbehandlung

Das System implementiert mehrere Fallback-Mechanismen:

1. Zuerst wird versucht, das Limit über die Datenbankfunktion `get_api_usage_limit()` abzurufen
2. Wenn dies fehlschlägt, wird versucht, das Limit direkt aus der `system_config`-Tabelle abzurufen
3. Wenn auch dies fehlschlägt, wird der Standardwert 50 verwendet

## Testen

Sie können das System testen, indem Sie:

1. Das API-Limit in der Supabase-Datenbank ändern
2. Die Erweiterung öffnen und sich anmelden
3. Die API-Nutzungsanzeige in der Popup-Oberfläche überprüfen
4. Einige API-Aufrufe tätigen und beobachten, wie sich die Anzeige aktualisiert
5. Versuchen, mehr Aufrufe zu tätigen, als das neue Limit erlaubt, um die Fehlermeldung zu sehen

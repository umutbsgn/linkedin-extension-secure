# Supabase-Einrichtung für API-Nutzung und Abonnements

Diese Anleitung beschreibt, wie Sie die erforderlichen Tabellen und Funktionen in Ihrer Supabase-Datenbank einrichten, um die API-Nutzungsverfolgung und Abonnementverwaltung zu unterstützen.

## Voraussetzungen

- Ein Supabase-Projekt
- Zugriff auf den SQL-Editor in der Supabase-Konsole

## Einrichtungsschritte

1. Melden Sie sich bei Ihrer Supabase-Konsole an: https://app.supabase.com/
2. Wählen Sie Ihr Projekt aus
3. Navigieren Sie zum SQL-Editor (im linken Menü)
4. Erstellen Sie eine neue Abfrage
5. Kopieren Sie den Inhalt der Datei `supabase_schema.sql` in den SQL-Editor
6. Führen Sie die SQL-Abfrage aus

## Erklärung der Tabellen und Funktionen

### Tabellen

1. **user_subscriptions**: Speichert Informationen über Benutzerabonnements
   - Felder: id, user_id, subscription_type, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end, use_own_api_key, own_api_key, created_at, updated_at

2. **api_models_usage**: Speichert die API-Nutzung pro Modell und Benutzer
   - Felder: id, user_id, month, model, calls_count, created_at, updated_at

3. **system_config**: Speichert Systemkonfigurationen wie Limits für verschiedene Abonnementtypen
   - Felder: id, key, value, created_at, updated_at

### Funktionen

1. **get_model_limits(subscription_type TEXT)**: Gibt die Limits für verschiedene Modelle basierend auf dem Abonnementtyp zurück

2. **increment_api_usage(p_user_id UUID, p_model TEXT)**: Erhöht die API-Nutzung für einen Benutzer und ein Modell

3. **get_user_api_usage(p_user_id UUID)**: Gibt die aktuelle API-Nutzung für einen Benutzer zurück

## Testen der Einrichtung

Nach der Einrichtung können Sie die Funktionalität mit dem Skript `test-rpc-functions.js` testen:

```bash
node test-rpc-functions.js <user_id>
```

Ersetzen Sie `<user_id>` durch die ID eines Benutzers in Ihrer Datenbank.

## Fehlerbehebung

Wenn Sie Fehler bei der API-Nutzungsverfolgung oder Abonnementverwaltung erhalten, überprüfen Sie Folgendes:

1. Stellen Sie sicher, dass alle Tabellen und Funktionen korrekt erstellt wurden
2. Überprüfen Sie, ob die Umgebungsvariablen SUPABASE_URL und SUPABASE_SERVICE_KEY korrekt gesetzt sind
3. Stellen Sie sicher, dass der Benutzer, dessen Token Sie verwenden, in der Datenbank existiert
4. Überprüfen Sie die Serverprotokolle auf spezifische Fehlermeldungen

## Hinweise

- Die Standardlimits sind:
  - Trial-Benutzer: 50 Aufrufe für haiku-3.5, 0 Aufrufe für sonnet-3.7
  - Pro-Benutzer: 500 Aufrufe für haiku-3.5, 500 Aufrufe für sonnet-3.7
- Die Limits werden monatlich zurückgesetzt
- Pro-Benutzer können ihren eigenen API-Schlüssel verwenden, um die Nutzungsverfolgung zu umgehen

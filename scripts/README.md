# Migrationsskripte

Dieses Verzeichnis enthält Skripte zur Migration und Wartung der Datenbank.

## migrate-users-to-trial.js

Dieses Skript migriert alle bestehenden Benutzer in der Supabase-Authentifizierungstabelle, die noch kein Abonnement haben, zu Trial-Abonnenten.

### Voraussetzungen

- Node.js (v14 oder höher)
- npm oder yarn
- Supabase-Projekt mit den erforderlichen Tabellen

### Installation

1. Installieren Sie die erforderlichen Abhängigkeiten:

```bash
npm install @supabase/supabase-js dotenv
```

2. Erstellen Sie eine `.env`-Datei im Stammverzeichnis des Projekts mit den folgenden Umgebungsvariablen:

```
SUPABASE_URL=https://ihre-projekt-id.supabase.co
SUPABASE_SERVICE_KEY=ihr-service-key
```

**Hinweis:** Der `SUPABASE_SERVICE_KEY` ist der Service-Key (nicht der anonyme Key) mit Admin-Rechten. Seien Sie vorsichtig mit diesem Schlüssel und teilen Sie ihn nicht.

### Verwendung

Führen Sie das Skript mit Node.js aus:

```bash
node scripts/migrate-users-to-trial.js
```

### Was das Skript tut

1. Es ruft alle Benutzer aus der Supabase-Authentifizierungstabelle ab.
2. Für jeden Benutzer prüft es, ob bereits ein Abonnement in der `user_subscriptions`-Tabelle existiert.
3. Wenn kein Abonnement existiert, erstellt es ein Trial-Abonnement mit einer Laufzeit von 30 Tagen.
4. Es überspringt Benutzer, die bereits ein Abonnement haben (egal welchen Typs).
5. Es gibt eine Zusammenfassung der Migration aus, einschließlich der Anzahl der migrierten Benutzer, der übersprungenen Benutzer und der aufgetretenen Fehler.

### Fehlerbehebung

- **Fehler beim Abrufen der Benutzer**: Stellen Sie sicher, dass der Service-Key korrekt ist und die erforderlichen Berechtigungen hat.
- **Fehler beim Erstellen des Trial-Abonnements**: Stellen Sie sicher, dass die `user_subscriptions`-Tabelle existiert und die erforderlichen Felder hat.

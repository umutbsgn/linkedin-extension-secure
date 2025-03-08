# Stripe Integration

Diese Dokumentation beschreibt die Integration von Stripe in die LinkedIn AI Assistant Browser-Erweiterung für die Abonnementverwaltung.

## Übersicht

Die Stripe-Integration ermöglicht es Benutzern, ein Pro-Abonnement zu erwerben und zu verwalten. Die Integration umfasst:

- Checkout-Prozess für neue Abonnements
- Abonnementstatus-Abfrage
- Abonnementkündigung
- Verwaltung von API-Schlüsseln für Pro-Benutzer

## Konfiguration

### Umgebungsvariablen

Die folgenden Umgebungsvariablen müssen in der Vercel-Umgebung konfiguriert werden:

```
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_PRO_PRICE_ID=your_stripe_price_id
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### Stripe-Produkt und Preis

1. Erstellen Sie ein Produkt in Stripe für das Pro-Abonnement
2. Erstellen Sie einen wiederkehrenden Preis für das Produkt (z.B. €10/Monat)
3. Kopieren Sie die Preis-ID und setzen Sie sie als `STRIPE_PRO_PRICE_ID` in den Umgebungsvariablen

### Webhook-Konfiguration

Es gibt zwei Möglichkeiten, einen Webhook-Endpunkt zu erstellen:

#### Option 1: Über das Stripe-Dashboard

1. Gehen Sie zu "Entwickler" > "Webhooks" im Stripe-Dashboard
2. Klicken Sie auf "Endpunkt hinzufügen"
3. Geben Sie die URL Ihres Webhook-Endpunkts ein: `https://ihre-vercel-app.vercel.app/api/subscriptions/webhook`
4. Wählen Sie die Ereignisse aus, die Sie abonnieren möchten:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Klicken Sie auf "Endpunkt hinzufügen"
6. Kopieren Sie das Webhook-Secret und setzen Sie es als `STRIPE_WEBHOOK_SECRET` in den Umgebungsvariablen

#### Option 2: Über das Hilfsskript (empfohlen)

Wir haben ein Hilfsskript erstellt, das einen Webhook-Endpunkt über die Stripe API v2 erstellt und das Webhook-Secret für Ihre Anwendung abruft:

1. Führen Sie das Skript aus:

```bash
node scripts/create-stripe-webhook.js
```

2. Folgen Sie den Anweisungen im Terminal
3. Das Skript wird einen Webhook-Endpunkt erstellen und das Secret anzeigen
4. Weitere Informationen finden Sie in der [Webhook-Skript-Dokumentation](scripts/STRIPE_WEBHOOK_README.md)

## Implementierung

Die Stripe-Integration ist in mehreren Dateien implementiert:

### API-Endpunkte

- `api/config/stripe-publishable-key.js`: Stellt den öffentlichen Schlüssel für die Client-Seite bereit
- `api/config/stripe-secret-key.js`: Stellt den geheimen Schlüssel für die Server-Seite bereit
- `api/config/stripe-price-id.js`: Stellt die Preis-ID für die Server-Seite bereit
- `api/config/stripe-webhook-secret.js`: Stellt das Webhook-Secret für die Server-Seite bereit
- `api/subscriptions/create-checkout.js`: Erstellt eine Checkout-Session für ein neues Abonnement
- `api/subscriptions/status.js`: Gibt den Abonnementstatus eines Benutzers zurück
- `api/subscriptions/cancel.js`: Kündigt ein Abonnement
- `api/subscriptions/update-api-key.js`: Aktualisiert die API-Schlüssel-Einstellungen eines Benutzers
- `api/subscriptions/webhook.js`: Verarbeitet Webhook-Ereignisse von Stripe

### Client-Seite

- `popup/stripe-client.js`: Client-seitige Integration mit Stripe
- `popup/subscription-manager.js`: UI-Komponente für die Abonnementverwaltung

## Datenbank

Die Abonnementdaten werden in der Tabelle `user_subscriptions` in Supabase gespeichert. Die Tabelle hat die folgenden Felder:

- `id`: Eindeutige ID des Abonnements
- `user_id`: ID des Benutzers
- `subscription_type`: Typ des Abonnements (`trial` oder `pro`)
- `status`: Status des Abonnements (`active`, `canceling`, `canceled`)
- `stripe_customer_id`: ID des Kunden in Stripe
- `stripe_subscription_id`: ID des Abonnements in Stripe
- `current_period_start`: Beginn der aktuellen Abrechnungsperiode
- `current_period_end`: Ende der aktuellen Abrechnungsperiode
- `use_own_api_key`: Ob der Benutzer seinen eigenen API-Schlüssel verwendet
- `own_api_key`: Der API-Schlüssel des Benutzers
- `created_at`: Erstellungsdatum
- `updated_at`: Aktualisierungsdatum

## Sicherheit

Die Stripe-Integration verwendet mehrere Sicherheitsmaßnahmen:

1. Die API-Schlüssel werden in Vercel-Umgebungsvariablen gespeichert und nicht im Code
2. Die API-Endpunkte verwenden Authentifizierung, um sicherzustellen, dass nur autorisierte Benutzer Zugriff haben
3. Die Webhook-Signatur wird überprüft, um sicherzustellen, dass die Ereignisse von Stripe stammen
4. Die geheimen Schlüssel werden nur auf der Server-Seite verwendet und nie an den Client gesendet

## Fehlerbehebung

### Checkout-Fehler

Wenn der Checkout-Prozess fehlschlägt, überprüfen Sie:

1. Ob die Stripe-API-Schlüssel korrekt konfiguriert sind
2. Ob die Preis-ID korrekt ist
3. Ob der Benutzer bereits ein aktives Abonnement hat

### Webhook-Fehler

Wenn Webhook-Ereignisse nicht verarbeitet werden, überprüfen Sie:

1. Ob das Webhook-Secret korrekt konfiguriert ist
2. Ob der Webhook-Endpunkt in Stripe korrekt konfiguriert ist
3. Ob die Ereignisse korrekt abonniert sind

## Migration von bestehenden Benutzern

Für bestehende Benutzer, die noch kein Abonnement haben, kann das Skript `scripts/migrate-users-to-trial.js` verwendet werden, um ihnen ein Trial-Abonnement zuzuweisen.

# Stripe Webhook Setup

Dieses Skript hilft Ihnen dabei, einen Stripe Webhook-Endpunkt über die Stripe API v2 zu erstellen und das Webhook-Secret für Ihre Anwendung zu erhalten.

## Voraussetzungen

- Node.js installiert
- Ein Stripe-Konto mit API-Zugriff
- Ein Stripe API-Schlüssel (beginnt mit `sk_`)

## Verwendung

1. Führen Sie das Skript aus:

```bash
node scripts/create-stripe-webhook.js
```

2. Folgen Sie den Anweisungen im Terminal:
   - Geben Sie Ihren Stripe API-Schlüssel ein (beginnt mit `sk_`)
   - Geben Sie die URL Ihres Webhook-Endpunkts ein (z.B. `https://ihre-vercel-app.vercel.app/api/subscriptions/webhook`)

3. Das Skript wird:
   - Einen neuen Webhook-Endpunkt in Ihrem Stripe-Konto erstellen
   - Das Webhook-Secret anzeigen, das Sie in Ihren Umgebungsvariablen speichern müssen

4. Fügen Sie das Webhook-Secret zu Ihren Umgebungsvariablen hinzu:
   - In der lokalen Entwicklung: Fügen Sie es zu Ihrer `.env`-Datei hinzu
   - In der Produktion: Fügen Sie es zu Ihren Vercel-Umgebungsvariablen hinzu

## Konfigurationswerte

Das Skript hilft Ihnen, den folgenden Konfigurationswert zu erhalten:

- `STRIPE_WEBHOOK_SECRET`: Das Secret für die Verifizierung von Webhook-Ereignissen

## Ereignisse

Der erstellte Webhook-Endpunkt ist für die folgenden Ereignisse konfiguriert:

- `checkout.session.completed`: Wird ausgelöst, wenn ein Kunde den Checkout-Prozess abschließt
- `customer.subscription.updated`: Wird ausgelöst, wenn ein Abonnement aktualisiert wird
- `customer.subscription.deleted`: Wird ausgelöst, wenn ein Abonnement gelöscht wird

## Fehlerbehebung

- Wenn das Skript einen Fehler zurückgibt, überprüfen Sie, ob Ihr API-Schlüssel korrekt ist und die notwendigen Berechtigungen hat
- Wenn kein Webhook-Secret zurückgegeben wird, können Sie es im Stripe-Dashboard unter "Entwickler" > "Webhooks" finden

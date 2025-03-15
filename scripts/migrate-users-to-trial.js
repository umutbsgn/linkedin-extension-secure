// scripts/migrate-users-to-trial.js
// Skript zur Migration aller bestehenden Benutzer zu Trial-Abonnenten

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Lade Umgebungsvariablen
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Fehler: SUPABASE_URL und SUPABASE_SERVICE_KEY müssen in der .env-Datei definiert sein');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrateUsersToTrial() {
    try {
        console.log('Starte Migration von Benutzern zu Trial-Abonnements...');

        // Hole alle Benutzer aus der auth.users-Tabelle
        const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

        if (usersError) {
            throw new Error(`Fehler beim Abrufen der Benutzer: ${usersError.message}`);
        }

        console.log(`${users.length} Benutzer gefunden.`);

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const user of users) {
            const userId = user.id;

            // Prüfe, ob der Benutzer bereits ein Abonnement hat
            const { data: existingSubscription, error: subError } = await supabase
                .from('user_subscriptions')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (subError) {
                console.error(`Fehler beim Prüfen des Abonnements für Benutzer ${userId}: ${subError.message}`);
                errorCount++;
                continue;
            }

            // Wenn kein Abonnement existiert, erstelle ein Trial-Abonnement
            if (!existingSubscription) {
                const { error: insertError } = await supabase
                    .from('user_subscriptions')
                    .insert([{
                        user_id: userId,
                        subscription_type: 'trial',
                        status: 'active',
                        current_period_start: new Date().toISOString(),
                        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 Tage Trial
                    }]);

                if (insertError) {
                    console.error(`Fehler beim Erstellen des Trial-Abonnements für Benutzer ${userId}: ${insertError.message}`);
                    errorCount++;
                } else {
                    console.log(`Trial-Abonnement für Benutzer ${userId} erstellt.`);
                    migratedCount++;
                }
            } else {
                console.log(`Benutzer ${userId} hat bereits ein Abonnement, wird übersprungen.`);
                skippedCount++;
            }
        }

        console.log('\nMigration abgeschlossen:');
        console.log(`- ${migratedCount} Benutzer zu Trial-Abonnements migriert`);
        console.log(`- ${skippedCount} Benutzer übersprungen (hatten bereits Abonnements)`);
        console.log(`- ${errorCount} Fehler aufgetreten`);

    } catch (error) {
        console.error('Unerwarteter Fehler:', error);
    }
}

migrateUsersToTrial();
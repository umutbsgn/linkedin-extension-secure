// popup-analytics.js
import posthog from 'https://cdn.skypack.dev/posthog-js';

posthog.init('phc_xhWdv89FeaL8iaT13O5A8CL9zo6kyCGzRFCtihoZKUB', {
    api_host: 'https://eu.i.posthog.com'
});

// Beispiel: Ein erstes Event tracken
posthog.capture('Extension_Opened');
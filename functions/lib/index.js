"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claudeProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const config_1 = require("./config");
const node_fetch_1 = require("node-fetch");
// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: `https://${config_1.config.projectId}.firebaseio.com`
});
exports.claudeProxy = (0, https_1.onRequest)({
    region: "europe-west1",
    cors: ["chrome-extension://*"]
}, async (req, res) => {
    var _a;
    // Handle CORS
    res.set('Access-Control-Allow-Origin', 'chrome-extension://*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    const data = req.body;
    // Validate request parameters
    console.log("Incoming request data:", data);
    if (!(data === null || data === void 0 ? void 0 : data.apiKey) || typeof data.apiKey !== "string") {
        res.status(401).json({ error: "Valid API key required" });
        return;
    }
    if (!(data === null || data === void 0 ? void 0 : data.text) || typeof data.text !== "string" || data.text.trim().length < 2) {
        throw new https_1.HttpsError("invalid-argument", "Text must be a non-empty string with at least 2 characters");
    }
    const cleanText = data.text.trim().substring(0, 10000);
    console.log("Processing text:", cleanText.substring(0, 50) + "...");
    try {
        const response = await (0, node_fetch_1.default)("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": data.apiKey,
                "anthropic-version": config_1.config.apiVersion
            },
            body: JSON.stringify({
                model: config_1.config.model,
                max_tokens: data.maxTokens || config_1.config.maxTokens,
                system: data.systemPrompt || "",
                messages: [{
                        "role": "user",
                        "content": data.text
                    }]
            })
        });
        const result = await response.json();
        if (!response.ok) {
            console.error("Claude API Error:", result);
            throw new https_1.HttpsError("internal", `Claude API Error: ${((_a = result.error) === null || _a === void 0 ? void 0 : _a.message) || "Unknown error"}`);
        }
        res.status(200).json(result);
    }
    catch (error) {
        console.error("Proxy Error:", error);
        throw new https_1.HttpsError("internal", `Proxy Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
});
//# sourceMappingURL=index.js.map
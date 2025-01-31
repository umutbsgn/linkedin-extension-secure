const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

exports.callClaudeAI = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to use this function.');
  }

  const { text } = data;
  if (!text) {
    throw new functions.https.HttpsError('invalid-argument', 'Text parameter is required.');
  }

  try {
    // Call Claude AI API
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          "role": "user",
          "content": text
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': functions.config().claude.api_key,
        'anthropic-version': '2024-01-01'
      }
    });

    // Extract and return the AI-generated response
    const aiResponse = response.data.content[0].text;
    return { response: aiResponse };
  } catch (error) {
    console.error('Error calling Claude AI:', error);
    throw new functions.https.HttpsError('internal', 'Error calling Claude AI API');
  }
});

# LinkedIn AI SaaS Browser Extension

This Chrome extension provides AI-powered LinkedIn interactions using Claude AI and Firebase.

## Setup

1. Clone this repository:
   ```
   git clone https://github.com/your-username/SaasBrowserExtension.git
   cd SaasBrowserExtension
   ```

2. Install dependencies:
   ```
   npm install
   cd functions
   npm install
   cd ..
   ```

3. Set up Firebase:
   - Create a new Firebase project at https://console.firebase.google.com/
   - Enable Authentication and Firestore in your Firebase project
   - Add your Firebase configuration to `src/background/background.js` and `src/popup/popup.js`

4. Set up Claude AI:
   - Obtain an API key from Anthropic
   - Set the Claude AI API key in Firebase Functions config:
     ```
     firebase functions:config:set claude.api_key="YOUR_CLAUDE_AI_API_KEY"
     ```

5. Deploy Firebase Functions:
   ```
   firebase deploy --only functions
   ```

6. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `SaasBrowserExtension` directory

## Usage

1. Click on the extension icon in Chrome
2. Log in with your Google account
3. Enter text in the input field and click "Generate AI Response"
4. The AI-generated response will be displayed in the extension popup

## Development

To run the Firebase emulators for local development:

```
firebase emulators:start
```

## License

This project is licensed under the MIT License.

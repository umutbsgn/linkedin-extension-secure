// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "test-b348f.firebaseapp.com",
  projectId: "test-b348f",
  storageBucket: "test-b348f.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

// Function to handle user authentication
async function authenticateUser() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("User authenticated:", user.email);
    return user;
  } catch (error) {
    console.error("Authentication error:", error);
    throw error;
  }
}

// Function to call Claude AI via Firebase Function
async function callClaudeAI(text) {
  const claudeFunction = httpsCallable(functions, 'callClaudeAI');
  try {
    const result = await claudeFunction({ text });
    return result.data;
  } catch (error) {
    console.error("Error calling Claude AI:", error);
    throw error;
  }
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "authenticate") {
    authenticateUser()
      .then(user => sendResponse({ success: true, user }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates we will send a response asynchronously
  } else if (request.action === "callClaudeAI") {
    callClaudeAI(request.text)
      .then(response => sendResponse({ success: true, response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Indicates we will send a response asynchronously
  }
});

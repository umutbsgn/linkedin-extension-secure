// Import Firebase modules
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";

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

// DOM elements
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userInfo = document.getElementById('user-info');
const userEmail = document.getElementById('user-email');
const aiSection = document.getElementById('ai-section');
const inputText = document.getElementById('input-text');
const generateButton = document.getElementById('generate-button');
const responseArea = document.getElementById('response-area');

// Authentication state observer
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    loginButton.style.display = 'none';
    logoutButton.style.display = 'block';
    userInfo.style.display = 'block';
    userEmail.textContent = user.email;
    aiSection.style.display = 'block';
  } else {
    // User is signed out
    loginButton.style.display = 'block';
    logoutButton.style.display = 'none';
    userInfo.style.display = 'none';
    aiSection.style.display = 'none';
  }
});

// Login button click handler
loginButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({action: "authenticate"}, (response) => {
    if (response.success) {
      console.log("User authenticated:", response.user);
    } else {
      console.error("Authentication failed:", response.error);
    }
  });
});

// Logout button click handler
logoutButton.addEventListener('click', () => {
  signOut(auth).then(() => {
    console.log("User signed out");
  }).catch((error) => {
    console.error("Sign out error:", error);
  });
});

// Generate AI response button click handler
generateButton.addEventListener('click', () => {
  const text = inputText.value.trim();
  if (text) {
    responseArea.textContent = "Generating response...";
    chrome.runtime.sendMessage({action: "callClaudeAI", text: text}, (response) => {
      if (response.success) {
        responseArea.textContent = response.response;
      } else {
        responseArea.textContent = "Error: " + response.error;
      }
    });
  } else {
    responseArea.textContent = "Please enter some text.";
  }
});

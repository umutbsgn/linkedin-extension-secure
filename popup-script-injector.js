// popup-script-injector.js

function injectScript(file) {
  const script = document.createElement('script');
  script.setAttribute('type', 'module');
  script.setAttribute('src', chrome.runtime.getURL(file));
  document.body.appendChild(script);
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded, injecting beta validator script');
  // Inject our beta validator script
  injectScript('popup/beta-validator-injector.js');
});

console.log('Popup script injector loaded');

// Add error handling for script injection
window.addEventListener('error', function(event) {
  console.error('Error in injected script:', event.error);
});

// Function to analyze LinkedIn post
async function analyzeLinkedInPost(postText) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'analyze',
      text: postText
    });
    
    if (response.success) {
      console.log('Analysis result:', response.data.content[0].text);
      showNotification(response.data.content[0].text, 'success');
    } else {
      const errorMessage = response.error.includes('API key') 
        ? 'Please check your Anthropic API key in the extension settings.'
        : response.error;
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Analysis failed:', error);
    showNotification(
      `Analysis failed: ${error.message}. ${error.message.includes('API key') ? '' : 'Please try again.'}`, 
      'error'
    );
  }
}

// Function to add analyze button to LinkedIn posts
function addAnalyzeButtonToPosts() {
  const posts = document.querySelectorAll('.feed-shared-update-v2:not(.analyzed)');
  posts.forEach(post => {
    const postText = post.querySelector('.feed-shared-text')?.innerText;
    if (postText) {
      const analyzeButton = document.createElement('button');
      analyzeButton.textContent = 'Analyze with AI';
      analyzeButton.className = 'analyze-button';
      analyzeButton.style.cssText = `
        background-color: #0a66c2;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        margin-left: 10px;
      `;
      analyzeButton.addEventListener('click', () => analyzeLinkedInPost(postText));
      post.querySelector('.feed-shared-control-menu')?.appendChild(analyzeButton);
      post.classList.add('analyzed');
    }
  });
}

// Function to show notification
function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px;
    border-radius: 5px;
    color: white;
    font-family: Arial, sans-serif;
    z-index: 9999;
    max-width: 300px;
    background-color: ${type === 'error' ? '#dc3545' : '#28a745'};
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}

// Run the function when the page loads and whenever it's updated
addAnalyzeButtonToPosts();
new MutationObserver(addAnalyzeButtonToPosts).observe(document.body, {
  childList: true,
  subtree: true
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    sendResponse({ text: window.getSelection().toString() });
  }
});

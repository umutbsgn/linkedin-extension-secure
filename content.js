// Function to analyze LinkedIn post
async function analyzeLinkedInPost(postText) {
  try {
    // Get the system settings from storage
    const { systemPrompt } = await chrome.storage.local.get(['systemPrompt']);
    
    const response = await chrome.runtime.sendMessage({
      action: 'analyze',
      text: postText,
      systemPrompt: systemPrompt || 'You are a flexible LinkedIn communication partner. Your task is to analyze the author\'s style, respond accordingly, and provide casual value. Your response should be concise, maximum 120 characters, and written directly in the author\'s style.'
    });
    
    if (response.success) {
      console.log('Analysis result:', response.data.content[0].text);
      showNotification(response.data.content[0].text, 'success');
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('Analysis failed:', error);
    showNotification(`Analysis failed: ${error.message}`, 'error');
  }
}

// Function to create an AI button
function createAIButton(className, clickHandler) {
  const aiButton = document.createElement('button');
  aiButton.className = `artdeco-button ${className}`;
  aiButton.style.cssText = `
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  const iconImg = document.createElement('img');
  iconImg.src = chrome.runtime.getURL('icons/icon-48.png');
  iconImg.style.width = '24px';
  iconImg.style.height = '24px';
  aiButton.appendChild(iconImg);
  
  aiButton.addEventListener('click', clickHandler);
  
  return aiButton;
}

// Function to inject AI button to LinkedIn posts
async function injectAIButton() {
  // Check authentication status first
  const isAuthenticated = await isUserAuthenticated();
  if (!isAuthenticated) {
    // Remove existing AI buttons if user is not authenticated
    document.querySelectorAll('.ai-post-comment-btn').forEach(btn => btn.remove());
    return;
  }

  const reactionBars = document.querySelectorAll('.feed-shared-social-action-bar');
  
  reactionBars.forEach((bar, index) => {
    // Check if AI button already exists
    if (bar.querySelector('.ai-post-comment-btn')) return;
    
    const aiButton = createAIButton('ai-post-comment-btn', handleAIButtonClick);
    aiButton.dataset.postIndex = index;
    
    // Add button to the end of the reaction bar
    bar.appendChild(aiButton);
  });
}

// Function to check if the current page is a LinkedIn profile
function isProfilePage() {
  if (document.querySelector('.profile-background-image')) {
    extractPostTexts();
    return true;
  }
  return false;
}

// Function to check for the invitation note text and character limit
function hasInvitationNote() {
  const bodyText = document.body.innerText;
  return bodyText.includes('Add a note to your invitation') && 
         /\d+\/200/.test(bodyText);
}

// Function to inject AI button into connect modal
function injectConnectAIButton() {
  if (!hasInvitationNote()) return;

  const actionBar = document.querySelector('.artdeco-modal__actionbar');
  if (!actionBar || actionBar.querySelector('.ai-connect-btn')) return;

  const aiButton = createAIButton('ai-connect-btn', handleConnectAIButtonClick);
  actionBar.insertBefore(aiButton, actionBar.lastElementChild);
}

// Function to extract post texts
function extractPostTexts() {
  const aiButtons = document.querySelectorAll('.ai-post-comment-btn');
  const postTexts = [];
  
  for (let i = 0; i < Math.min(2, aiButtons.length); i++) {
    const post = aiButtons[i].closest('.feed-shared-update-v2');
    if (post) {
      const text = extractPostText(post);
      if (text) {
        postTexts.push(text);
      }
    }
  }
  
  storePostTexts(postTexts);
}

// Function to store extracted post texts
function storePostTexts(texts) {
  chrome.storage.local.set({ 'extractedPostTexts': texts }, function() {
    console.log('Post texts stored');
  });
}

// Function to display popup with profile URL
function showProfileUrlPopup(url) {
  const popup = document.createElement('div');
  popup.textContent = `Profile URL: ${url}`;
  popup.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px;
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 5px;
    z-index: 9999;
  `;
  document.body.appendChild(popup);

  // Remove popup after 5 seconds
  setTimeout(() => {
    popup.remove();
  }, 5000);
}

// Throttle function
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

// Throttled profile check function
const throttledProfileCheck = throttle(() => {
  if (isProfilePage()) {
    showProfileUrlPopup(window.location.href);
  }
}, 2000);  // Check at most once every 2 seconds

// Initial run
(async () => {
  await injectAIButton();
  throttledProfileCheck();
})();

// Set up observer for dynamic content
const observer = new MutationObserver((mutations) => {
  for (let mutation of mutations) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      for (let node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.querySelector('.feed-shared-social-action-bar')) {
            injectAIButton();
          }
          injectConnectAIButton();
          // Check for profile page after significant DOM changes
          throttledProfileCheck();
        }
      }
    }
  }
});

// Start observing with appropriate configuration
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Listen for potential navigation events
window.addEventListener('popstate', throttledProfileCheck);
window.addEventListener('pushstate', throttledProfileCheck);
window.addEventListener('replacestate', throttledProfileCheck);

// Listen for auth status changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'auth_status_changed') {
    injectAIButton(); // Re-inject buttons when auth status changes
  }
  if (request.action === 'getSelectedText') {
    sendResponse({ text: window.getSelection().toString() });
  }
});

// Event handler for AI button in posts
async function handleAIButtonClick(event) {
  const button = event.currentTarget;
  const iconImg = button.querySelector('img');
  
  try {
    // Check authentication status
    const isAuthenticated = await isUserAuthenticated();
    if (!isAuthenticated) {
      showNotification('Please log in to use this feature.', 'error');
      return;
    }

    // Change icon to "generating"
    iconImg.src = chrome.runtime.getURL('icons/icon-48-yellow.png');
    
    // Check if extension context is still valid
    const isValid = await isExtensionContextValid();
    if (!isValid) {
      console.log('Extension context check failed');
      showNotification('Please reload the page to use the extension.', 'error');
      return;
    }

    const post = button.closest('.feed-shared-update-v2');
    if (!post) {
      throw new Error('Post element not found');
    }
    
    // Click random reaction
    try {
      await clickRandomReaction(post);
    } catch (reactionError) {
      console.error('Failed to click reaction:', reactionError);
      // Optionally show a notification, but continue with the comment
    }
    
    // Click comment button
    const commentButton = post.querySelector('.comment-button');
    if (commentButton) {
      commentButton.click();
    } else {
      throw new Error('Comment button not found');
    }

    // Wait for comment box
    const commentBox = await waitForCommentBox(post);
    commentBox.focus();
    
    // Extract text
    const postText = extractPostText(post);
    if (!postText) {
      throw new Error('No text content found in post');
    }
    
    const response = await analyzeLinkedInPost(postText);
    
    // Insert response into comment box
    if (response.result) {
      if (commentBox.getAttribute('contenteditable') === 'true') {
        commentBox.textContent = response.result;
      } else {
        commentBox.value = response.result;
      }
      commentBox.dispatchEvent(new Event('input', { bubbles: true }));
      commentBox.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Change icon to "success"
      iconImg.src = chrome.runtime.getURL('icons/icon-48-green.png');
      showNotification('Comment generated successfully', 'success');
    } else {
      throw new Error('No response received from AI');
    }
    
  } catch (error) {
    console.error('Error:', error);
    // Reset icon on error
    iconImg.src = chrome.runtime.getURL('icons/icon-48.png');
    
    if (error.message.includes('API key not found')) {
      showNotification('Please use a valid API key.', 'error');
    } else {
      showNotification(`Error: ${error.message}`, 'error');
    }
  }
}

// Event handler for AI button in connect modal
async function handleConnectAIButtonClick(event) {
  const button = event.currentTarget;
  const iconImg = button.querySelector('img');
  
  try {
    // Check authentication status
    const isAuthenticated = await isUserAuthenticated();
    if (!isAuthenticated) {
      showNotification('Please log in to use this feature.', 'error');
      return;
    }

    // Change icon to "generating"
    iconImg.src = chrome.runtime.getURL('icons/icon-48-yellow.png');
    
    // Check if extension context is still valid
    const isValid = await isExtensionContextValid();
    if (!isValid) {
      console.log('Extension context check failed');
      showNotification('Please reload the page to use the extension.', 'error');
      return;
    }

    // Get the connect system prompt
    const connectSystemPrompt = await getConnectSystemPrompt();
    console.log('Connect system prompt:', connectSystemPrompt); // Debug log

    // Generate connection message
    const message = await generateConnectionMessage(connectSystemPrompt);
    
    // Insert message into textarea
    const textarea = document.querySelector('#custom-message');
    if (textarea) {
      textarea.value = message;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Change icon to "success"
      iconImg.src = chrome.runtime.getURL('icons/icon-48-green.png');
      showNotification('Connection message generated successfully', 'success');
    } else {
      throw new Error('Message textarea not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
    // Reset icon on error
    iconImg.src = chrome.runtime.getURL('icons/icon-48.png');
    
    if (error.message.includes('API key not found')) {
      showNotification('Please use a valid API key.', 'error');
    } else {
      showNotification(`Error: ${error.message}`, 'error');
    }
  }
}

// Function to generate connection message
async function generateConnectionMessage(connectSystemPrompt) {
  console.log('Generating connection message with prompt:', connectSystemPrompt);
  const profileInfo = extractProfileInfo();
  const { extractedPostTexts } = await chrome.storage.local.get(['extractedPostTexts']);
  
  // Combine profile info and post texts
  const analysisData = {
    ...profileInfo,
    recentPosts: extractedPostTexts || []
  };
  
  console.log('Analysis data:', JSON.stringify(analysisData));
  const response = await analyzeProfile(analysisData, connectSystemPrompt);
  console.log('Generated connection message:', response);
  return response;
}

// Function to extract profile information
function extractProfileInfo() {
  // Extract relevant information from the profile page
  // This is a placeholder and should be implemented based on the LinkedIn profile structure
  const name = document.querySelector('.pv-top-card--list li:first-child')?.textContent.trim();
  const headline = document.querySelector('.pv-top-card--list li:nth-child(2)')?.textContent.trim();
  const about = document.querySelector('.pv-about-section .pv-about__summary-text')?.textContent.trim();
  
  return { name, headline, about };
}

// Function to get connect system prompt
async function getConnectSystemPrompt() {
  try {
    const { connectSystemPrompt } = await chrome.storage.local.get(['connectSystemPrompt']);
    return connectSystemPrompt || 'You are a LinkedIn connection request assistant. Your task is to analyze the recipient\'s profile and craft a personalized, concise connection message. Keep it friendly, professional, and highlight a shared interest or mutual benefit. Maximum 300 characters.';
  } catch (error) {
    console.error('Error fetching connect system prompt:', error);
    showNotification('Error fetching system prompt.', 'error');
    return 'You are a LinkedIn connection request assistant. Your task is to analyze the recipient\'s profile and craft a personalized, concise connection message. Keep it friendly, professional, and highlight a shared interest or mutual benefit. Maximum 300 characters.';
  }
}

// Function to get comment system prompt
async function getCommentSystemPrompt() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCommentSystemPrompt' });
    if (response.error) {
      console.error('Error fetching comment system prompt:', response.error);
      return 'You are a LinkedIn comment assistant. Your task is to generate a relevant and engaging comment based on the post content. The comment should be concise, maximum 120 characters, and written in a style that matches the original post.';
    }
    return response.systemPromptComments;
  } catch (error) {
    console.error('Error fetching comment system prompt:', error);
    return 'You are a LinkedIn comment assistant. Your task is to generate a relevant and engaging comment based on the post content. The comment should be concise, maximum 120 characters, and written in a style that matches the original post.';
  }
}

// Function to analyze profile and generate connection message
async function analyzeProfile(profileInfo, connectSystemPrompt) {
  try {
    console.log('Using connect system prompt:', connectSystemPrompt); // Debug log
    
    if (!connectSystemPrompt) {
      throw new Error('Failed to retrieve connect system prompt');
    }
    
    const response = await chrome.runtime.sendMessage({
      action: 'analyze',
      text: JSON.stringify(profileInfo),
      systemPrompt: connectSystemPrompt
    });
    
    if (response.success) {
      console.log('Connection message generated:', response.data.content[0].text);
      return response.data.content[0].text;
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('Profile analysis failed:', error);
    showNotification(`Profile analysis failed: ${error.message}`, 'error');
    throw error;
  }
}

// Function to analyze post and generate comment
async function analyzePost(postText) {
  try {
    const systemPrompt = await getCommentSystemPrompt();
    
    const response = await chrome.runtime.sendMessage({
      action: 'analyze',
      text: postText,
      systemPrompt: [systemPrompt] // Send as a list to fix the API error
    });
    
    if (response.success) {
      console.log('Comment generated:', response.data.content[0].text);
      return { result: response.data.content[0].text };
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('Post analysis failed:', error);
    throw error;
  }
}

// Function to analyze LinkedIn post
async function analyzeLinkedInPost(postText) {
  try {
    // Get the system settings from storage
    const { systemPrompt } = await chrome.storage.local.get(['systemPrompt']);
    
    const response = await chrome.runtime.sendMessage({
      action: 'analyze',
      text: postText,
      systemPrompt: systemPrompt || 'You are a flexible LinkedIn communication partner. Your task is to analyze the author\'s style, respond accordingly, and provide casual value. Your response should be concise, maximum 120 characters, and written directly in the author\'s style.'
    });
    
    if (response.success) {
      console.log('Analysis result:', response.data.content[0].text);
      return { result: response.data.content[0].text };
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}

// Function to wait for the comment box
async function waitForCommentBox(post, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const selectors = [
      '.comments-comment-box__input',
      'div[contenteditable="true"][role="textbox"]',
      '.comments-comment-texteditor__input',
      'div[data-placeholder="Add a comment..."]',
      'textarea[placeholder="Add a comment..."]'
    ];
    
    for (const selector of selectors) {
      const commentBox = post.querySelector(selector);
      if (commentBox) {
        return commentBox;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  throw new Error(`Comment box not found after ${maxAttempts} attempts`);
}

// Function to show notification
function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: white;
    z-index: 9999;
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    ${type === 'error' 
      ? 'background-color: #dc3545;' 
      : 'background-color: #28a745;'
    }
  `;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 300);
  }, 5000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    sendResponse({ text: window.getSelection().toString() });
  }
});

// Function to extract post text
function extractPostText(post) {
  const textContainer = post.querySelector('.feed-shared-update-v2__description');
  if (!textContainer) return '';
  
  const textNodes = textContainer.querySelectorAll('.break-words span[dir="ltr"]');
  const text = Array.from(textNodes)
    .map(node => node.textContent)
    .join(' ')
    .trim();
  
  return text;
}

// Function to check if extension context is valid
async function isExtensionContextValid() {
  try {
    await chrome.runtime.getURL('');
    return true;
  } catch (error) {
    console.error('Extension context check failed:', error);
    return false;
  }
}

const ANTHROPIC_API_KEY = 'anthropicApiKey';

// Function to check if user is authenticated
async function isUserAuthenticated() {
  try {
    const result = await chrome.storage.local.get([ANTHROPIC_API_KEY, 'supabaseAuthToken']);
    return !!(result[ANTHROPIC_API_KEY] && result.supabaseAuthToken);
  } catch (error) {
    console.error('Error checking authentication status:', error);
    return false;
  }
}

// Function to click a random reaction
async function clickRandomReaction(post) {
  console.log('👆 Attempting to click reaction...');
  const reactions = [
    'React Like',
    'React Celebrate',
    'React Support',
    'React Love',
    'React Insightful'
  ];
  const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
  console.log('🎲 Selected reaction:', randomReaction);

  const reactionButton = post.querySelector(`button[aria-label="${randomReaction}"]`);
  if (!reactionButton) {
    console.error('🔴 Reaction button not found:', randomReaction);
    throw new Error(`Reaction button not found: ${randomReaction}`);
  }

  try {
    reactionButton.click();
    console.log('✅ Reaction button clicked');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second after the reaction
  } catch (clickError) {
    console.error('🔴 Error clicking reaction button:', clickError);
    throw new Error(`Failed to click reaction: ${clickError.message}`);
  }
}

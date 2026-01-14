
// Content script to bridge communication between web app and extension

// 1. Listen for messages from the web page (Dashboard)
window.addEventListener('message', async (event) => {
  // Security check: only accept messages from the same window
  if (event.source !== window) return;

  if (event.data.type && event.data.type === 'TEXA_OPEN_TOOL') {
    console.log('ContentScript received OPEN_TOOL:', event.data);
    
    // Forward to background script
    try {
      const response = await chrome.runtime.sendMessage(event.data);
      console.log('Background response:', response);
    } catch (err) {
      console.error('Error sending message to background:', err);
    }
  }

  if (event.data.type && event.data.type === 'TEXA_SYNC_SESSION') {
    console.log('ContentScript received SYNC_SESSION:', event.data);
    const sessionData = event.data.data;
    
    if (sessionData) {
      chrome.storage.local.set({
        'texa_origin': sessionData.origin,
        'texa_token': sessionData.token,
        'texa_user': sessionData.user,
        'last_sync': Date.now()
      }, () => {
        console.log('TEXA Extension: Session synced to storage');
        // Notify background to show notification
        chrome.runtime.sendMessage({ type: 'TEXA_LOGIN_SUCCESS' });
      });
    }
  }
});

// 2. Inject helper script to expose window.TEXAExtension API
function injectHelperScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injectedScript.js');
    script.onload = function() {
      this.remove();
      // Dispatch ready event after injection
      window.dispatchEvent(new CustomEvent('TEXA_EXTENSION_READY'));
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (e) {
    console.error('TEXA Extension: Failed to inject helper script', e);
  }
}

injectHelperScript();

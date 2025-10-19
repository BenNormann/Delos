// Background service worker for Delos extension

console.log('Delos: Background service worker initialized');

// Load API key from secrets.json on startup
async function loadSecretsFile() {
  try {
    const response = await fetch(chrome.runtime.getURL('secrets.json'));
    const secrets = await response.json();
    
    if (secrets.openai_api_key && secrets.openai_api_key !== 'YOUR_OPENAI_API_KEY_HERE') {
      // Store the API key in chrome.storage
      await chrome.storage.local.set({ openai_api_key: secrets.openai_api_key });
      console.log('Delos: API key loaded from secrets.json');
    } else {
      console.log('Delos: No valid API key found in secrets.json');
    }
  } catch (error) {
    console.log('Delos: secrets.json not found (this is normal if not configured yet)');
  }
}

// Load secrets on startup
loadSecretsFile();

// Install event
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Delos: Extension installed/updated', details.reason);
  
  if (details.reason === 'install') {
    // First install
    console.log('Delos: First installation');
    // Try to load secrets file
    loadSecretsFile();
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Delos: Extension updated to version', chrome.runtime.getManifest().version);
    // Reload secrets on update
    loadSecretsFile();
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Delos: Message received', message);
  
  if (message.type === 'getApiKey') {
    // Get API key from storage
    chrome.storage.local.get('openai_api_key', (result) => {
      sendResponse({ apiKey: result.openai_api_key || '' });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'setApiKey') {
    // Set API key in storage
    chrome.storage.local.set({ openai_api_key: message.apiKey }, () => {
      console.log('Delos: API key stored');
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'saveStats') {
    // Save statistics with tab ID
    const tabId = sender.tab?.id || 'unknown';
    chrome.storage.local.set({ 
      [`stats_${tabId}`]: message.stats,
      lastStats: message.stats
    }, () => {
      console.log('Delos: Stats saved for tab', tabId);
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'clearCache') {
    // Clear cache
    chrome.storage.local.get(null, (items) => {
      const cacheKeys = Object.keys(items).filter(key => key.startsWith('delos_cache_'));
      if (cacheKeys.length > 0) {
        chrome.storage.local.remove(cacheKeys, () => {
          console.log('Delos: Cache cleared', cacheKeys.length, 'entries');
          sendResponse({ success: true, count: cacheKeys.length });
        });
      } else {
        sendResponse({ success: true, count: 0 });
      }
    });
    return true;
  }
  
  if (message.type === 'getStats') {
    // Get extension statistics
    chrome.storage.local.get(null, (items) => {
      const cacheKeys = Object.keys(items).filter(key => key.startsWith('delos_cache_'));
      sendResponse({
        cacheEntries: cacheKeys.length,
        hasApiKey: !!items.openai_api_key
      });
    });
    return true;
  }
  
  if (message.type === 'fetch') {
    // Proxy fetch requests to avoid CORS issues
    (async () => {
      try {
        const response = await fetch(message.url, message.options || {});
        
        const contentType = response.headers.get('content-type');
        let data;
        
        // Always try to read the response body (even on errors)
        try {
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }
        } catch (readError) {
          console.error('TruthCheck: Error reading response body:', readError);
          data = null;
        }
        
        if (!response.ok) {
          // Extract error message from response body if available
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          if (data) {
            if (typeof data === 'object' && data.error) {
              errorMessage = data.error.message || data.error.type || JSON.stringify(data.error);
            } else if (typeof data === 'string') {
              errorMessage += ` - ${data.substring(0, 200)}`;
            }
          }
          
          console.error('Delos: Fetch failed:', {
            url: message.url,
            status: response.status,
            statusText: response.statusText,
            data: data
          });
          
          sendResponse({ 
            success: false, 
            error: errorMessage,
            status: response.status,
            statusText: response.statusText,
            data: data,
            headers: Object.fromEntries(response.headers.entries())
          });
          return;
        }
        
        sendResponse({ 
          success: true, 
          data: data,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
      } catch (error) {
        console.error('Delos: Fetch error:', error);
        sendResponse({ 
          success: false, 
          error: error.message,
          stack: error.stack
        });
      }
    })();
    return true; // Keep channel open for async response
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Page finished loading
    console.log('Delos: Tab updated', tab.url);
  }
});


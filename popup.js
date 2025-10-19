// Popup script for Moneo extension

// Load statistics from current tab
async function loadStats() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Get stored stats for this tab
    const result = await chrome.storage.local.get(`stats_${tab.id}`);
    const stats = result[`stats_${tab.id}`];
    
    // Get toggle states
    const toggleResult = await chrome.storage.local.get(['highlightsEnabled', 'aiToolsEnabled']);
    const highlightsEnabled = toggleResult.highlightsEnabled !== false; // Default true
    const aiToolsEnabled = toggleResult.aiToolsEnabled || false; // Default false
    
    if (stats && stats.totalClaims > 0) {
      displayStats(stats, highlightsEnabled, aiToolsEnabled);
    } else {
      displayNoData();
    }
  } catch (error) {
    console.error('Error loading stats:', error);
    displayNoData();
  }
}

function displayStats(stats, highlightsEnabled, aiToolsEnabled) {
  const content = document.getElementById('content');
  
  const highPercent = Math.round((stats.highTrust / stats.totalClaims) * 100) || 0;
  const mediumPercent = Math.round((stats.mediumTrust / stats.totalClaims) * 100) || 0;
  const lowPercent = Math.round((stats.lowTrust / stats.totalClaims) * 100) || 0;
  
  // Calculate spectrum percentages
  const totalSpectrum = stats.left + stats.center + stats.right || 1;
  const leftPercent = Math.round((stats.left / totalSpectrum) * 100);
  const centerPercent = Math.round((stats.center / totalSpectrum) * 100);
  const rightPercent = Math.round((stats.right / totalSpectrum) * 100);
  
  content.innerHTML = `
    <div class="stats-section">
      <h2>Claims Analyzed</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.totalClaims}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-card">
          <div class="stat-value high">${stats.highTrust}</div>
          <div class="stat-label">High Trust</div>
        </div>
        <div class="stat-card">
          <div class="stat-value medium">${stats.mediumTrust}</div>
          <div class="stat-label">Medium</div>
        </div>
        <div class="stat-card">
          <div class="stat-value low">${stats.lowTrust}</div>
          <div class="stat-label">Low Trust</div>
        </div>
      </div>
    </div>
    
    <div class="toggle-section" id="highlightToggle">
      <span class="toggle-label">Show Highlights</span>
      <div class="toggle-switch ${highlightsEnabled ? 'active' : ''}" id="toggleSwitch"></div>
    </div>
    
    <div class="toggle-section" id="aiToolsToggle">
      <span class="toggle-label">AI Web Scraping (Experimental)</span>
      <div class="toggle-switch ${aiToolsEnabled ? 'active' : ''}" id="aiToolsSwitch"></div>
    </div>
  `;
  
  // Add toggle listeners
  document.getElementById('highlightToggle').addEventListener('click', toggleHighlights);
  document.getElementById('aiToolsToggle').addEventListener('click', toggleAITools);
}

function displayNoData() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="no-data">
      <div class="no-data-icon">🏠</div>
      <p>Visit a news article to see claim analysis</p>
    </div>
  `;
}

async function toggleHighlights() {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const isActive = toggleSwitch.classList.contains('active');
  
  // Toggle state
  toggleSwitch.classList.toggle('active');
  const newState = !isActive;
  
  // Save state
  await chrome.storage.local.set({ highlightsEnabled: newState });
  
  // Send message to content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.tabs.sendMessage(tab.id, { 
      type: 'toggleHighlights', 
      enabled: newState 
    });
  } catch (error) {
    console.log('Could not send message to tab:', error);
  }
}

async function toggleAITools() {
  const toggleSwitch = document.getElementById('aiToolsSwitch');
  const isActive = toggleSwitch.classList.contains('active');
  
  // Toggle state
  toggleSwitch.classList.toggle('active');
  const newState = !isActive;
  
  // Save state
  await chrome.storage.local.set({ aiToolsEnabled: newState });
  
  // No need to send message - this affects future scoring only
  console.log('AI Tools', newState ? 'enabled' : 'disabled');
}

// Load stats when popup opens
document.addEventListener('DOMContentLoaded', loadStats);


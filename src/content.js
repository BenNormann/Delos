// Content script - orchestrates the fact-checking pipeline

(async function() {
  'use strict';
  
  Logger.info('Delos extension loaded');
  
  // Check if already processed
  if (document.body.hasAttribute('data-truthcheck-processed')) {
    Logger.info('Page already processed, skipping');
    return;
  }
  
  // Mark as processed
  document.body.setAttribute('data-truthcheck-processed', 'true');
  
  try {
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }
    
    Logger.info('Starting fact-checking pipeline...');
    Logger.time('Total pipeline execution');
    
    // Show loading indicator immediately
    showLoadingIndicator('Analyzing article...');
    
    // Step 1: Extract article text
    Logger.group('Step 1: Extract Article Text');
    const articleText = extractArticleText();
    
    if (!articleText || articleText.length < 100) {
      Logger.warn('Insufficient article text, aborting');
      Logger.groupEnd();
      hideLoadingIndicator();
      return;
    }
    
    Logger.info(`Extracted ${articleText.length} characters of text`);
    Logger.groupEnd();
    
    // Step 2: Extract claims
    Logger.group('Step 2: Extract Claims');
    updateLoadingIndicator('Extracting claims...');
    const claims = await ClaimExtractor.extract(articleText);
    
    if (claims.length === 0) {
      Logger.warn('No claims found, aborting');
      Logger.groupEnd();
      hideLoadingIndicator();
      return;
    }
    
    Logger.info(`Found ${claims.length} claims`);
    Logger.groupEnd();
    
    // Step 3: Classify claims
    Logger.group('Step 3: Classify Claims');
    updateLoadingIndicator(`Classifying ${claims.length} claims...`);
    const classifiedClaims = await ClaimClassifier.classify(claims);
    Logger.info('Classification complete');
    Logger.groupEnd();
    
    // Step 4: Score claims
    Logger.group('Step 4: Score Claims');
    updateLoadingIndicator(`Scoring ${classifiedClaims.length} claims...`);
    const scoredClaims = await ClaimScorer.score(classifiedClaims);
    Logger.info('Scoring complete');
    Logger.groupEnd();
    
    // Step 5: Highlight claims in DOM
    Logger.group('Step 5: Highlight Claims');
    updateLoadingIndicator('Highlighting claims...');
    await Highlighter.highlight(scoredClaims);
    Logger.info('Highlighting complete');
    Logger.groupEnd();
    
    // Hide loading indicator
    hideLoadingIndicator();
    
    Logger.timeEnd('Total pipeline execution');
    Logger.info('✅ Fact-checking pipeline complete!');
    
    // Log summary and save stats
    const summaryStats = logSummary(scoredClaims);
    await saveStats(summaryStats);
    
  } catch (error) {
    Logger.error('Pipeline execution failed:', error);
    
    // Hide loading indicator if visible
    hideLoadingIndicator();
    
    // Show user-friendly error
    showErrorNotification('Delos encountered an error. Please check your API key configuration.');
  }
})();

/**
 * Save statistics for popup
 * @param {Object} stats - Summary statistics
 */
async function saveStats(stats) {
  try {
    // Send stats to background script which will save with proper tab ID
    chrome.runtime.sendMessage({
      type: 'saveStats',
      stats: stats
    });
  } catch (error) {
    Logger.error('Failed to save stats:', error);
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'toggleHighlights') {
    if (message.enabled) {
      // Show highlights - restore background colors
      const highlights = document.querySelectorAll('.truthcheck-highlight');
      highlights.forEach(el => {
        el.style.backgroundColor = '';
        el.style.borderBottom = '';
      });
    } else {
      // Hide highlights - remove visual styling but keep text visible
      const highlights = document.querySelectorAll('.truthcheck-highlight');
      highlights.forEach(el => {
        el.style.backgroundColor = 'transparent';
        el.style.borderBottom = 'none';
      });
    }
    sendResponse({ success: true });
  }
  return true;
});

/**
 * Extract article text from page
 * @returns {string} Article text
 */
function extractArticleText() {
  // Try to find article content
  const selectors = [
    'article',
    '[role="article"]',
    '.article-content',
    '.article-body',
    '.post-content',
    '.entry-content',
    'main article',
    'main'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text = extractTextWithStructure(element);
      if (text && text.length > 100) {
        Logger.debug(`Found article text using selector: ${selector}`);
        return text;
      }
    }
  }
  
  // Fallback: get all paragraph text
  const paragraphs = Array.from(document.querySelectorAll('p'));
  const text = paragraphs
    .map(p => extractTextWithStructure(p))
    .join('\n\n');
  
  Logger.debug('Using fallback paragraph extraction');
  return text;
}

/**
 * Extract text from element while preserving some structural hints
 * - Adds newlines around block elements
 * - Preserves paragraph boundaries
 * - Keeps quote marks intact
 */
function extractTextWithStructure(element) {
  if (!element) return '';
  
  // Clone to avoid modifying the original
  const clone = element.cloneNode(true);
  
  // Remove script and style elements
  clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
  
  // Remove navigation and UI elements
  clone.querySelectorAll('nav, header, footer, aside, .menu, .navigation, .sidebar').forEach(el => el.remove());
  
  // Add newlines around block elements to preserve paragraph boundaries
  clone.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote').forEach(el => {
    // Add a marker after each block element
    el.after(document.createTextNode('\n'));
  });
  
  // Get the text with preserved structure
  return clone.innerText || clone.textContent || '';
}

/**
 * Log summary of results and return stats object
 * @param {Array<object>} scoredClaims - Scored claims
 * @returns {Object} Statistics object
 */
function logSummary(scoredClaims) {
  Logger.group('📊 Summary');
  
  const highTrust = scoredClaims.filter(c => c.trustScore >= 7).length;
  const mediumTrust = scoredClaims.filter(c => c.trustScore >= 3 && c.trustScore < 7).length;
  const lowTrust = scoredClaims.filter(c => c.trustScore < 3).length;
  
  Logger.info(`Total claims: ${scoredClaims.length}`);
  Logger.info(`High trust (≥7): ${highTrust}`);
  Logger.info(`Medium trust (3-7): ${mediumTrust}`);
  Logger.info(`Low trust (<3): ${lowTrust}`);
  
  // Classification breakdown
  const classifications = {
    current_news: 0,
    general_knowledge: 0,
    empirical_fact: 0
  };
  
  scoredClaims.forEach(claim => {
    classifications[claim.classification]++;
  });
  
  Logger.info('Classifications:');
  Logger.info(`  - Current News: ${classifications.current_news}`);
  Logger.info(`  - General Knowledge: ${classifications.general_knowledge}`);
  Logger.info(`  - Empirical Fact: ${classifications.empirical_fact}`);
  
  Logger.groupEnd();
  
  // Return stats for popup (will be enhanced with spectrum data by background script)
  return {
    totalClaims: scoredClaims.length,
    highTrust,
    mediumTrust,
    lowTrust,
    classifications,
    left: 0, // Placeholder - will be calculated from web search results
    center: 0,
    right: 0
  };
}

/**
 * Show loading indicator
 * @param {string} message - Loading message
 */
function showLoadingIndicator(message) {
  // Remove any existing indicator
  hideLoadingIndicator();
  
  const indicator = document.createElement('div');
  indicator.id = 'truthcheck-loading-indicator';
  
  // Get the lighthouse GIF URL from extension
  const lighthouseUrl = chrome.runtime.getURL('icons/lighthouse-search.gif');
  
  indicator.innerHTML = `
    <div class="truthcheck-loading-text">${message}</div>
    <img src="${lighthouseUrl}" class="truthcheck-loading-gif" alt="Loading">
  `;
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #220725;
    color: white;
    padding: 0;
    border-radius: 12px;
    box-shadow: 0 8px 16px rgba(0,0,0,0.2);
    z-index: 999999;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    width: 200px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: truthcheck-slide-in 0.3s ease-out;
  `;
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes truthcheck-slide-in {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .truthcheck-loading-text {
      line-height: 1.4;
      font-weight: 500;
      text-align: center;
      padding: 12px 16px;
      margin: 0;
    }
    
    .truthcheck-loading-gif {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 0 0 12px 12px;
      margin: 0;
      padding: 0;
      mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 100%);
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 100%);
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(indicator);
}

/**
 * Update loading indicator text
 * @param {string} message - New loading message
 */
function updateLoadingIndicator(message) {
  const indicator = document.getElementById('truthcheck-loading-indicator');
  if (indicator) {
    const textElement = indicator.querySelector('.truthcheck-loading-text');
    if (textElement) {
      textElement.textContent = message;
    }
  }
}

/**
 * Hide loading indicator with fade out
 */
function hideLoadingIndicator() {
  const indicator = document.getElementById('truthcheck-loading-indicator');
  if (indicator) {
    indicator.style.animation = 'truthcheck-slide-in 0.3s ease-out reverse';
    setTimeout(() => {
      indicator.remove();
    }, 300);
  }
}

/**
 * Show error notification to user
 * @param {string} message - Error message
 */
function showErrorNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'truthcheck-error-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ef4444;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 999999;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    max-width: 300px;
  `;
  
  document.body.appendChild(notification);
  
  // Remove after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}


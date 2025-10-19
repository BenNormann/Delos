/**
 * Web Scraper - General Web Search
 * Queries DuckDuckGo HTML (free, no auth) for general web search results
 * Falls back to Bing on failure
 * 
 * Returns consistent format: [{url, title, snippet, domain}, ...]
 */

const WebScraper = {
  /**
   * Search the web using DuckDuckGo (with Bing fallback)
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results to return (default 10)
   * @returns {Promise<Array>} Array of {url, title, snippet, domain}
   */
  async search(query, maxResults = 10) {
    if (!query || query.trim().length === 0) {
      return [];
    }
    
    try {
      // Try DuckDuckGo first
      const ddgResults = await this.searchDuckDuckGo(query, maxResults);
      if (ddgResults.length > 0) {
        return ddgResults;
      }
      
      // DuckDuckGo failed, try Bing
      Logger.info('DuckDuckGo returned no results, trying Bing fallback');
      const bingResults = await this.searchBing(query, maxResults);
      
      if (bingResults.length === 0) {
        Logger.warn('Both DuckDuckGo and Bing returned no results');
      }
      
      return bingResults;
      
    } catch (error) {
      Logger.error('Web search failed:', error);
      return [];
    }
  },
  
  /**
   * Search DuckDuckGo HTML endpoint
   * @param {string} query - Search query
   * @param {number} maxResults - Max results
   * @returns {Promise<Array>} Results array
   */
  async searchDuckDuckGo(query, maxResults) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
    
    try {
      // Use background script to bypass CORS
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000);
        
        chrome.runtime.sendMessage({
          type: 'fetch',
          url: url,
          options: {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `q=${encodedQuery}`
          }
        }, (response) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      if (!response.success) {
        throw new Error(`DuckDuckGo HTTP ${response.status || 'error'}`);
      }
      
      return this.parseDuckDuckGoHTML(response.data, maxResults);
      
    } catch (error) {
      // Don't log as warning - this is expected to fail sometimes
      return [];
    }
  },
  
  /**
   * Parse DuckDuckGo HTML response
   * @param {string} html - HTML content
   * @param {number} maxResults - Max results to extract
   * @returns {Array} Parsed results
   */
  parseDuckDuckGoHTML(html, maxResults) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // DuckDuckGo HTML uses div.result for each search result
    const resultElements = doc.querySelectorAll('div.result');
    
    for (let i = 0; i < Math.min(resultElements.length, maxResults); i++) {
      const element = resultElements[i];
      
      try {
        // Extract URL from result__a link
        const linkElement = element.querySelector('a.result__a');
        if (!linkElement) continue;
        
        const href = linkElement.getAttribute('href');
        if (!href) continue;
        
        // DuckDuckGo wraps URLs in their redirect, extract actual URL
        let actualUrl = href;
        if (href.includes('uddg=')) {
          const match = href.match(/uddg=([^&]+)/);
          if (match) {
            actualUrl = decodeURIComponent(match[1]);
          }
        }
        
        // Extract title
        const title = linkElement.textContent.trim();
        
        // Extract snippet from result__snippet
        const snippetElement = element.querySelector('a.result__snippet');
        const snippet = snippetElement 
          ? snippetElement.textContent.trim() 
          : '';
        
        // Extract domain
        const domain = this.extractDomain(actualUrl);
        
        if (actualUrl && title && domain) {
          results.push({
            url: actualUrl,
            title: title,
            snippet: snippet.substring(0, 200), // Limit to 200 chars
            domain: domain
          });
        }
      } catch (error) {
        // Skip malformed results
        continue;
      }
    }
    
    return results;
  },
  
  /**
   * Search Bing as fallback
   * @param {string} query - Search query
   * @param {number} maxResults - Max results
   * @returns {Promise<Array>} Results array
   */
  async searchBing(query, maxResults) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.bing.com/search?q=${encodedQuery}`;
    
    try {
      // Use background script to bypass CORS
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000);
        
        chrome.runtime.sendMessage({
          type: 'fetch',
          url: url,
          options: {}
        }, (response) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      if (!response.success) {
        throw new Error(`Bing HTTP ${response.status || 'error'}`);
      }
      
      return this.parseBingHTML(response.data, maxResults);
      
    } catch (error) {
      // Don't log here - will be logged in main search() if both fail
      return [];
    }
  },
  
  /**
   * Parse Bing HTML response
   * @param {string} html - HTML content
   * @param {number} maxResults - Max results
   * @returns {Array} Parsed results
   */
  parseBingHTML(html, maxResults) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Bing uses li.b_algo for organic search results
    const resultElements = doc.querySelectorAll('li.b_algo');
    
    for (let i = 0; i < Math.min(resultElements.length, maxResults); i++) {
      const element = resultElements[i];
      
      try {
        // Extract URL from h2 > a
        const linkElement = element.querySelector('h2 a');
        if (!linkElement) continue;
        
        const url = linkElement.getAttribute('href');
        if (!url) continue;
        
        // Extract title
        const title = linkElement.textContent.trim();
        
        // Extract snippet from p or .b_caption
        const snippetElement = element.querySelector('.b_caption p, .b_caption');
        const snippet = snippetElement 
          ? snippetElement.textContent.trim() 
          : '';
        
        // Extract domain
        const domain = this.extractDomain(url);
        
        if (url && title && domain) {
          results.push({
            url: url,
            title: title,
            snippet: snippet.substring(0, 200),
            domain: domain
          });
        }
      } catch (error) {
        continue;
      }
    }
    
    return results;
  },
  
  /**
   * Extract domain from URL
   * @param {string} url - Full URL
   * @returns {string} Domain name (e.g., "bbc.com")
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      // Remove www. prefix
      return hostname.replace(/^www\./, '');
    } catch (error) {
      return '';
    }
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebScraper;
}


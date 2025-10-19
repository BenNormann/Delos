/**
 * Scholar Scraper - Academic Search
 * Queries Google Scholar and other free academic databases
 * Priority: Google Scholar > ScienceOpen > CORE
 * 
 * Returns consistent format: [{url, title, snippet, domain}, ...]
 */

const ScholarScraper = {
  /**
   * Search academic sources for scholarly results
   * @param {string} query - Search query (academic terms)
   * @param {number} maxResults - Maximum results to return (default 20)
   * @returns {Promise<Array>} Array of {url, title, snippet, domain}
   */
  async search(query, maxResults = 20) {
    if (!query || query.trim().length === 0) {
      return [];
    }
    
    try {
      // Try Google Scholar first (best quality)
      let results = await this.searchGoogleScholar(query, maxResults);
      if (results.length > 0) {
        Logger.log(`Found ${results.length} results from Google Scholar`);
        return results;
      }
      
      // Fall back to ScienceOpen
      Logger.log('Google Scholar returned no results, trying ScienceOpen');
      results = await this.searchScienceOpen(query, maxResults);
      if (results.length > 0) {
        Logger.log(`Found ${results.length} results from ScienceOpen`);
        return results;
      }
      
      // Fall back to CORE
      Logger.log('ScienceOpen returned no results, trying CORE');
      results = await this.searchCORE(query, maxResults);
      if (results.length > 0) {
        Logger.log(`Found ${results.length} results from CORE`);
        return results;
      }
      
      Logger.log('All scholarly sources returned no results');
      return [];
      
    } catch (error) {
      Logger.error('Scholar search failed:', error);
      return [];
    }
  },
  
  /**
   * Search Google Scholar
   * @param {string} query - Search query
   * @param {number} maxResults - Max results
   * @returns {Promise<Array>} Results array
   */
  async searchGoogleScholar(query, maxResults) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://scholar.google.com/scholar?q=${encodedQuery}&hl=en`;
    
    try {
      // Use background script to bypass CORS
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Timeout')), 8000);
        
        chrome.runtime.sendMessage({
          type: 'fetch',
          url: url,
          options: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
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
        throw new Error(`Google Scholar HTTP ${response.status || 'error'}`);
      }
      
      return this.parseGoogleScholarHTML(response.data, maxResults);
      
    } catch (error) {
      Logger.warn('Google Scholar search failed:', error.message);
      return [];
    }
  },
  
  /**
   * Parse Google Scholar HTML response
   * @param {string} html - HTML content
   * @param {number} maxResults - Max results to extract
   * @returns {Array} Parsed results
   */
  parseGoogleScholarHTML(html, maxResults) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Google Scholar uses div.gs_r for each result
    const resultElements = doc.querySelectorAll('div.gs_r.gs_or.gs_scl, div.gs_ri');
    
    for (let i = 0; i < Math.min(resultElements.length, maxResults); i++) {
      const element = resultElements[i];
      
      try {
        // Extract title and URL from h3.gs_rt a
        const titleElement = element.querySelector('h3.gs_rt a, h3 a');
        if (!titleElement) continue;
        
        const title = titleElement.textContent.trim();
        let url = titleElement.getAttribute('href');
        
        // If no URL, try data-href
        if (!url) {
          url = titleElement.getAttribute('data-href');
        }
        
        // Some results don't have direct links, use scholar.google.com
        if (!url || url.startsWith('/')) {
          url = `https://scholar.google.com${url || ''}`;
        }
        
        // Extract snippet from div.gs_rs
        const snippetElement = element.querySelector('div.gs_rs, .gs_a');
        const snippet = snippetElement 
          ? snippetElement.textContent.trim() 
          : '';
        
        // Extract domain
        const domain = this.extractDomain(url);
        
        if (title && url) {
          results.push({
            url: url,
            title: title,
            snippet: snippet.substring(0, 200),
            domain: domain || 'scholar.google.com'
          });
        }
      } catch (error) {
        continue;
      }
    }
    
    return results;
  },
  
  /**
   * Search ScienceOpen as fallback
   * @param {string} query - Search query
   * @param {number} maxResults - Max results
   * @returns {Promise<Array>} Results array
   */
  async searchScienceOpen(query, maxResults) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.scienceopen.com/search#search?q=${encodedQuery}`;
    
    try {
      // Use background script to bypass CORS
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Timeout')), 8000);
        
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
        throw new Error(`ScienceOpen HTTP ${response.status || 'error'}`);
      }
      
      return this.parseScienceOpenHTML(response.data, maxResults);
      
    } catch (error) {
      Logger.warn('ScienceOpen search failed:', error.message);
      return [];
    }
  },
  
  /**
   * Parse ScienceOpen HTML
   * @param {string} html - HTML content
   * @param {number} maxResults - Max results
   * @returns {Array} Parsed results
   */
  parseScienceOpenHTML(html, maxResults) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Look for article entries
    const resultElements = doc.querySelectorAll('article, .search-result, .result-item');
    
    for (let i = 0; i < Math.min(resultElements.length, maxResults); i++) {
      const element = resultElements[i];
      
      try {
        const linkElement = element.querySelector('a[href*="article"], h3 a, h2 a');
        if (!linkElement) continue;
        
        const title = linkElement.textContent.trim();
        const url = linkElement.getAttribute('href');
        
        if (!url) continue;
        
        const fullUrl = url.startsWith('http') ? url : `https://www.scienceopen.com${url}`;
        
        const snippetElement = element.querySelector('p, .abstract, .description');
        const snippet = snippetElement ? snippetElement.textContent.trim() : '';
        
        const domain = this.extractDomain(fullUrl);
        
        if (title && fullUrl) {
          results.push({
            url: fullUrl,
            title: title,
            snippet: snippet.substring(0, 200),
            domain: domain || 'scienceopen.com'
          });
        }
      } catch (error) {
        continue;
      }
    }
    
    return results;
  },
  
  /**
   * Search CORE as final fallback
   * @param {string} query - Search query
   * @param {number} maxResults - Max results
   * @returns {Promise<Array>} Results array
   */
  async searchCORE(query, maxResults) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://core.ac.uk/search?q=${encodedQuery}`;
    
    try {
      // Use background script to bypass CORS
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('Timeout')), 8000);
        
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
        throw new Error(`CORE HTTP ${response.status || 'error'}`);
      }
      
      return this.parseCOREHTML(response.data, maxResults);
      
    } catch (error) {
      Logger.warn('CORE search failed:', error.message);
      return [];
    }
  },
  
  /**
   * Parse CORE HTML
   * @param {string} html - HTML content
   * @param {number} maxResults - Max results
   * @returns {Array} Parsed results
   */
  parseCOREHTML(html, maxResults) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // CORE search results
    const resultElements = doc.querySelectorAll('article, .search-result, [class*="result"]');
    
    for (let i = 0; i < Math.min(resultElements.length, maxResults); i++) {
      const element = resultElements[i];
      
      try {
        const linkElement = element.querySelector('a[href*="/display/"], h3 a, h2 a, a');
        if (!linkElement) continue;
        
        const title = linkElement.textContent.trim();
        const url = linkElement.getAttribute('href');
        
        if (!url || !title) continue;
        
        const fullUrl = url.startsWith('http') ? url : `https://core.ac.uk${url}`;
        
        const snippetElement = element.querySelector('p, .abstract');
        const snippet = snippetElement ? snippetElement.textContent.trim() : '';
        
        const domain = this.extractDomain(fullUrl);
        
        if (title && fullUrl) {
          results.push({
            url: fullUrl,
            title: title,
            snippet: snippet.substring(0, 200),
            domain: domain || 'core.ac.uk'
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
   * @returns {string} Domain name
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      return hostname.replace(/^www\./, '');
    } catch (error) {
      return '';
    }
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScholarScraper;
}


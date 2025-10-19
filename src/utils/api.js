// OpenAI API wrapper for Moneo extension

const API = {
  /**
   * Use background script to make fetch requests (avoids CORS)
   * @param {string} url - URL to fetch
   * @param {object} options - Fetch options
   * @returns {Promise<object>} Response object
   */
  async backgroundFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'fetch',
          url: url,
          options: options
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
  },
  
  /**
   * Make a single completion call to OpenAI
   * @param {string} message - User message
   * @param {string} systemPrompt - System prompt (optional)
   * @returns {Promise<string>} Response text
   */
  async call(message, systemPrompt = 'You are a helpful assistant.') {
    try {
      const apiKey = await this.getApiKey();
      
      if (!apiKey) {
        Logger.debug('OpenAI API key not configured - returning null');
        return null;
      }
      
      const response = await this.backgroundFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: CONFIG.openai.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });
      
      if (!response.success) {
        throw new Error(`OpenAI API error: ${response.error || 'Unknown error'}`);
      }
      
      const data = response.data;
      return data.choices[0].message.content.trim();
    } catch (error) {
      Logger.error('API call failed:', error);
      throw error;
    }
  },
  
  /**
   * Batch classify items
   * @param {Array<{id: string, text: string}>} items - Items to classify
   * @param {string} systemPrompt - System prompt
   * @returns {Promise<Array<{id: string, classification: string}>>}
   */
  async batchClassify(items, systemPrompt) {
    try {
      const apiKey = await this.getApiKey();
      
      if (!apiKey) {
        Logger.debug('OpenAI API key not configured - returning default classifications');
        return null;
      }
      
      // Format items for batch processing
      const itemsText = items.map((item, idx) => 
        `[${idx}] ${item.text}`
      ).join('\n\n');
      
      const message = `Classify each of the following items. Return your response as a JSON array with format: [{"id": 0, "classification": "..."}]\n\n${itemsText}`;
      
      const response = await this.backgroundFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: CONFIG.openai.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        })
      });
      
      if (!response.success) {
        throw new Error(`OpenAI API error: ${response.error || 'Unknown error'}`);
      }
      
      const data = response.data;
      const result = JSON.parse(data.choices[0].message.content);
      
      // Map back to original items
      return items.map((item, idx) => {
        const match = result.classifications?.find(c => c.id === idx) || 
                     result.find(c => c.id === idx);
        return {
          id: item.id,
          classification: match?.classification || 'general_knowledge'
        };
      });
    } catch (error) {
      Logger.error('Batch classify failed:', error);
      // Return default classifications on error
      return items.map(item => ({
        id: item.id,
        classification: 'general_knowledge'
      }));
    }
  },
  
  /**
   * Get API key from storage
   * @returns {Promise<string>} API key
   */
  async getApiKey() {
    try {
      const result = await chrome.storage.local.get('openai_api_key');
      return result.openai_api_key || CONFIG.openai.apiKey;
    } catch (error) {
      Logger.error('Failed to get API key:', error);
      return null;
    }
  },
  
  /**
   * Set API key in storage
   * @param {string} apiKey - API key to store
   * @returns {Promise<void>}
   */
  async setApiKey(apiKey) {
    try {
      await chrome.storage.local.set({ openai_api_key: apiKey });
      Logger.info('API key stored successfully');
    } catch (error) {
      Logger.error('Failed to store API key:', error);
    }
  },
  
  /**
   * Retry logic wrapper
   * @param {Function} fn - Function to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} delay - Delay between retries in ms
   * @returns {Promise<any>} Result of function
   */
  async retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        Logger.warn(`Retry ${i + 1}/${maxRetries} after error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}


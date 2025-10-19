/**
 * AI Scorer using OpenAI API
 * Scores claim credibility and tone analysis
 * Returns "n/a" if no API key available
 */

const AIScorer = {
  apiKey: null,
  initialized: false,
  
  /**
   * Initialize and check for API key
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) return;
    
    try {
      // Try to get API key from Chrome storage
      const result = await chrome.storage.local.get('openai_api_key');
      this.apiKey = result.openai_api_key || null;
      this.initialized = true;
      
      if (!this.apiKey) {
        Logger.warn('OpenAI API key not configured');
      }
    } catch (error) {
      Logger.error('Failed to initialize AI scorer:', error);
      this.initialized = true;
    }
  },
  
  /**
   * Score a claim using OpenAI API
   * @param {string} claim - The claim to score
   * @param {string} scoreType - Type of score: "credibility" or "tone"
   * @param {string} [classification] - Claim classification for context
   * @returns {Promise<number | string>} Score 0-10 or "n/a" if unavailable
   */
  async score(claim, scoreType, classification = '') {
    await this.init();
    
    // Check API key availability
    if (!this.apiKey) {
      Logger.warn(`OpenAI API key not found - ${scoreType} score unavailable`);
      return "n/a";
    }
    
    // Check cache first
    const cacheKey = Cache.generateKey(claim, `ai-${scoreType}`, classification);
    const cached = await Cache.get(cacheKey);
    
    if (cached !== null) {
      Logger.log(`Using cached AI ${scoreType} score for claim`);
      return cached;
    }
    
    try {
      const prompt = this.buildPrompt(claim, scoreType, classification);
      // Enable tools for credibility scoring only (not tone)
      const useTools = scoreType === 'credibility';
      const result = await this.callOpenAI(prompt, useTools);
      
      // Validate result is 0-10
      const score = parseFloat(result);
      if (isNaN(score) || score < 0 || score > 10) {
        Logger.error(`Invalid AI score returned: ${result}`);
        return "n/a";
      }
      
      // Cache the result
      await Cache.set(cacheKey, score, 86400);
      
      return score;
    } catch (error) {
      Logger.error(`AI ${scoreType} scoring failed:`, error);
      return "n/a";
    }
  },
  
  /**
   * Build prompt for OpenAI based on score type
   * @param {string} claim - The claim
   * @param {string} scoreType - "credibility" or "tone"
   * @param {string} classification - Claim classification
   * @returns {string} Prompt text
   */
  buildPrompt(claim, scoreType, classification) {
    if (scoreType === "credibility") {
      return `You are a fact-checking assistant. Analyze the following claim for credibility.

Claim: "${claim}"
Classification: ${classification}

Rate the credibility of this claim on a scale of 0-10, where:
- 0 = Completely false or misleading
- 5 = Uncertain, needs verification
- 10 = Highly credible and verifiable

Consider:
1. Logical consistency
2. Plausibility based on general knowledge
3. Presence of verifiable facts
4. Absence of logical fallacies

Respond with ONLY a number between 0 and 10 (decimals allowed, e.g., 7.5).`;
    } else if (scoreType === "tone") {
      return `You are a fact-checking assistant. Analyze the tone and language of the following claim.

Claim: "${claim}"

Rate the neutrality and objectivity of this claim's tone on a scale of 0-10, where:
- 0 = Highly emotional, biased, or manipulative language
- 5 = Somewhat neutral with mild bias
- 10 = Completely neutral, objective, and factual tone

Consider:
1. Emotional language and charged words
2. Loaded terms or propaganda techniques
3. Objectivity vs. subjective opinions
4. Sensationalism or exaggeration

Respond with ONLY a number between 0 and 10 (decimals allowed, e.g., 6.5).`;
    }
    
    throw new Error(`Unknown score type: ${scoreType}`);
  },
  
  /**
   * Call OpenAI API using background script
   * @param {string} prompt - The prompt to send
   * @param {boolean} useTools - Whether to enable function calling for web scraping
   * @returns {Promise<string>} API response content
   */
  async callOpenAI(prompt, useTools = false) {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if AI tools are enabled
        let toolsEnabled = false;
        if (useTools) {
          const result = await chrome.storage.local.get('aiToolsEnabled');
          toolsEnabled = result.aiToolsEnabled || false;
        }
        
        const requestBody = {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: toolsEnabled 
                ? 'You are a fact-checking assistant with web search capabilities. Use the search tool when you need to verify information. Respond with only a number (0-10).'
                : 'You are a precise fact-checking assistant. Always respond with only a number.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: toolsEnabled ? 150 : 10
        };
        
        // Add function calling if tools are enabled
        if (toolsEnabled) {
          requestBody.tools = [
            {
              type: 'function',
              function: {
                name: 'search_web',
                description: 'Search the web for information to verify a claim',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'The search query'
                    }
                  },
                  required: ['query']
                }
              }
            }
          ];
          requestBody.tool_choice = 'auto';
        }
        
        const response = await new Promise((res, rej) => {
          chrome.runtime.sendMessage(
            {
              type: 'fetch',
              url: 'https://api.openai.com/v1/chat/completions',
              options: {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
              }
            },
            (response) => {
              if (chrome.runtime.lastError) {
                rej(new Error(chrome.runtime.lastError.message));
              } else {
                res(response);
              }
            }
          );
        });
        
        if (!response.success) {
          throw new Error(`OpenAI API error: ${response.error || 'Unknown error'}`);
        }
        
        const data = response.data;
        
        if (!data.choices || !data.choices[0]) {
          throw new Error('Invalid API response structure');
        }
        
        const choice = data.choices[0];
        
        // Handle function calls if tools are enabled
        if (toolsEnabled && choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          // AI wants to call a function
          const toolCall = choice.message.tool_calls[0];
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          if (functionName === 'search_web') {
            // Execute web search
            Logger.log(`AI requesting web search: "${functionArgs.query}"`);
            const searchResults = await WebSearch.searchWeb(functionArgs.query, 5);
            const searchSummary = searchResults.map(r => `${r.title} (${r.domain})`).join('; ');
            
            // Make second API call with function result
            const followUpResponse = await new Promise((res, rej) => {
              chrome.runtime.sendMessage(
                {
                  type: 'fetch',
                  url: 'https://api.openai.com/v1/chat/completions',
                  options: {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                      model: 'gpt-4o-mini',
                      messages: [
                        {
                          role: 'system',
                          content: 'You are a fact-checking assistant. Based on search results, provide a credibility score from 0-10. Respond with only the number.'
                        },
                        {
                          role: 'user',
                          content: prompt
                        },
                        {
                          role: 'assistant',
                          content: null,
                          tool_calls: [toolCall]
                        },
                        {
                          role: 'tool',
                          tool_call_id: toolCall.id,
                          content: searchSummary || 'No results found'
                        }
                      ],
                      temperature: 0.3,
                      max_tokens: 10
                    })
                  }
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    rej(new Error(chrome.runtime.lastError.message));
                  } else {
                    res(response);
                  }
                }
              );
            });
            
            if (followUpResponse.success && followUpResponse.data.choices[0]) {
              resolve(followUpResponse.data.choices[0].message.content.trim());
              return;
            }
          }
        }
        
        // Normal response (no function call)
        if (choice.message && choice.message.content) {
          resolve(choice.message.content.trim());
        } else {
          throw new Error('No content in API response');
        }
      } catch (error) {
        reject(error);
      }
    });
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIScorer;
}

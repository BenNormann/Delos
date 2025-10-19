/**
 * Google Scholar Scorer
 * Searches academic sources for empirical fact verification
 * Always returns 0-10 (never "n/a")
 */

// High-authority academic domains
const ACADEMIC_DOMAINS = [
  'edu',
  'ac.uk',
  'nih.gov',
  'nature.com',
  'science.org',
  'springer.com',
  'ieee.org',
  'acm.org',
  'arxiv.org',
  'pubmed',
  'researchgate.net'
];

const ScholarScorer = {
  /**
   * Score a claim based on Google Scholar results
   * @param {string} claim - The claim to verify
   * @param {string} classification - Claim classification
   * @returns {Promise<{score: number, sources: Array}>} Score 0-10 and array of sources
   */
  async score(claim, classification) {
    // Only search for empirical facts
    if (classification !== 'empirical_fact') {
      Logger.log('Skipping scholar search for non-empirical claim');
      return { score: 0, sources: [] };
    }
    
    // Check cache
    const cacheKey = Cache.generateKey(claim, 'scholar', classification);
    const cached = await Cache.get(cacheKey);
    
    if (cached !== null) {
      Logger.log('Using cached scholar score');
      return { score: cached, sources: [] };
    }
    
    try {
      // Extract academic search terms (better than generic optimization)
      const scholarQuery = this.extractScholarTerms(claim);
      Logger.log(`Scholar search for: "${scholarQuery}"`);
      
      // Search Google Scholar
      const results = await WebSearch.searchScholar(scholarQuery, 20);
      
      Logger.log(`Found ${results.length} scholar results`);
      
      if (results.length === 0) {
        await Cache.set(cacheKey, 0, 86400);
        return { score: 0, sources: [] };
      }
      
      // Calculate score based on:
      // 1. Number of results
      // 2. Domain authority
      const scoreValue = this.calculateScore(results);
      
      Logger.log(`Scholar score: ${scoreValue}`);
      
      // Cache result
      await Cache.set(cacheKey, scoreValue, 86400);
      
      return {
        score: scoreValue,
        sources: results
      };
    } catch (error) {
      Logger.error('Scholar scoring failed:', error);
      return { score: 0, sources: [] };
    }
  },
  
  /**
   * Extract key academic search terms from claim
   * Focuses on organizations, statistics, medical/scientific terms
   * @param {string} claim - Full claim text
   * @returns {string} Optimized academic search query
   */
  extractScholarTerms(claim) {
    let terms = [];
    let priorityTerms = []; // High priority terms (organizations, specific entities)
    
    // 1. PRIORITY: Extract organizations and agencies (MUST include)
    const orgPatterns = [
      /\b(FDA|CDC|WHO|EPA|NIH|USDA|HHS|NHS|EMA)\b/g, // Government health agencies
      /\b(Food and Drug Administration|Centers for Disease Control)\b/gi,
      /\b(World Health Organization|Environmental Protection Agency)\b/gi,
      /\b(National Institutes of Health)\b/gi
    ];
    
    for (const pattern of orgPatterns) {
      const matches = claim.match(pattern);
      if (matches) {
        priorityTerms.push(...matches);
      }
    }
    
    // 2. Extract medical/health terms (elevated levels, blood, etc.)
    const medicalPhrases = [
      /elevated\s+levels?\s+of\s+\w+/gi,
      /blood\s+\w+/gi,
      /\w+\s+poisoning/gi,
      /health\s+\w+/gi,
      /\w+\s+exposure/gi,
      /\w+\s+contamination/gi
    ];
    
    for (const pattern of medicalPhrases) {
      const matches = claim.match(pattern);
      if (matches) {
        terms.push(...matches);
      }
    }
    
    // 3. Extract specific substances and chemicals
    const substances = claim.match(/\b(lead|mercury|arsenic|cadmium|aluminum|asbestos|pesticide|toxin|chemical|metal)\b/gi);
    if (substances) {
      terms.push(...substances);
    }
    
    // 4. Extract key action verbs (concluded, contribute, etc.)
    const keyVerbs = claim.match(/\b(concluded|contribute|cause|result|indicate|suggest|show|demonstrate|reveal|confirm)\b/gi);
    if (keyVerbs) {
      terms.push(...keyVerbs.slice(0, 3));
    }
    
    // 5. Extract statistics and numbers with context
    const statPatterns = [
      /(\d+(?:\.\d+)?%)/g,
      /(\d+(?:\.\d+)?)\s*(million|billion|thousand|percent|ppm|ppb)/gi,
      /(19|20)\d{2}/g,
      /(\d+(?:\.\d+)?)\s*(mg|mcg|μg|ml|cc)/gi
    ];
    
    for (const pattern of statPatterns) {
      const matches = claim.match(pattern);
      if (matches) {
        terms.push(...matches);
      }
    }
    
    // 6. Extract medical/scientific terms
    const scientificTerms = [
      /\b(assessment|study|research|published|findings|evidence|data)\b/gi,
      /\b(consumption|consuming|ingestion|intake)\b/gi,
      /\b(products|food|supplement|medication|drug)\b/gi,
      /\b(risk|hazard|danger|safety|warning)\b/gi,
      /\b(recall|advisory|alert|notification)\b/gi
    ];
    
    for (const pattern of scientificTerms) {
      const matches = claim.match(pattern);
      if (matches) {
        terms.push(...matches.slice(0, 2));
      }
    }
    
    // 7. Extract important nouns (longer words, likely significant)
    const words = claim.split(/\s+/);
    const importantWords = words.filter(word => {
      const lower = word.toLowerCase();
      const fillers = ['that', 'this', 'there', 'their', 'these', 'those', 'about', 'which', 'where', 'while', 'would', 'could', 'should', 'during', 'listed'];
      return word.length > 5 && 
             !fillers.includes(lower) && 
             /^[a-zA-Z]/.test(word);
    });
    terms.push(...importantWords.slice(0, 3));
    
    // 8. Clean and deduplicate
    const uniquePriorityTerms = [...new Set(priorityTerms.map(t => t.trim()))];
    const uniqueTerms = [...new Set(terms.map(t => t.trim()))];
    
    // 9. Build query: Priority terms FIRST (organizations), then others
    const allTerms = [...uniquePriorityTerms, ...uniqueTerms];
    
    // 10. Limit to 15 terms max for best scholar results
    const finalTerms = allTerms.slice(0, 15);
    
    return finalTerms.join(' ');
  },
  
  /**
   * Calculate score based on scholar results
   * @param {Array} results - Search results
   * @returns {number} Score 0-10
   */
  calculateScore(results) {
    if (results.length === 0) {
      return 0;
    }
    
    let score = 0;
    let authorityCount = 0;
    
    // Count results from high-authority domains
    for (const result of results) {
      const domain = result.domain.toLowerCase();
      
      const isAuthoritative = ACADEMIC_DOMAINS.some(acadDomain => 
        domain.includes(acadDomain)
      );
      
      if (isAuthoritative) {
        authorityCount++;
      }
    }
    
    // Scoring algorithm:
    // Base score from number of results
    if (results.length >= 15) {
      score = 5;
    } else if (results.length >= 10) {
      score = 4;
    } else if (results.length >= 5) {
      score = 3;
    } else if (results.length >= 2) {
      score = 2;
    } else {
      score = 1;
    }
    
    // Boost score based on authoritative sources
    if (authorityCount >= 5) {
      score += 5;
    } else if (authorityCount >= 3) {
      score += 3;
    } else if (authorityCount >= 1) {
      score += 2;
    }
    
    // Cap at 10
    return Math.min(score, 10);
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScholarScorer;
}

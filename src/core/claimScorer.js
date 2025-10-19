/**
 * Claim Scorer Orchestrator
 * Coordinates all scorers and combines with weighted averaging
 * Handles missing scores gracefully with weight renormalization
 */

// Scoring weights by classification
const SCORING_WEIGHTS = {
  current_news: {
    aiRating: 0.475,
    toneAnalysis: 0.05,
    scholarlyMatch: 0.0,
    webReinforced: 0.475
  },
  general_knowledge: {
    aiRating: 0.475,
    toneAnalysis: 0.05,
    scholarlyMatch: 0.0,
    webReinforced: 0.475
  },
  empirical_fact: {
    aiRating: 0.25,
    toneAnalysis: 0.05,
    scholarlyMatch: 0.45,
    webReinforced: 0.25
  }
};

// Timeouts for individual scorers
const AI_SCORER_TIMEOUT = 10000; // 10 seconds for AI (fast)
const WEB_SCORER_TIMEOUT = 120000; // 120 seconds for web searches (queued, so needs to be longer)

const ClaimScorer = {
  /**
   * Score an array of classified claims
   * @param {Array} claims - Array of claim objects with classification
   * @returns {Promise<Array>} Claims with scores and trustScore added
   */
  async score(claims) {
    if (!claims || claims.length === 0) {
      return [];
    }
    
    Logger.log(`Scoring ${claims.length} claims in parallel (fast mode)...`);
    
    // Score all claims in parallel for maximum speed
    // With paid tier, you have 500 req/min so this is fine
    const scoredClaims = await Promise.all(
      claims.map(claim => this.scoreSingleClaim(claim))
    );
    
    Logger.log('All claims scored!');
    
    return scoredClaims;
  },
  
  /**
   * Score a single claim with all scorers
   * @param {Object} claim - Claim object
   * @returns {Promise<Object>} Claim with scores and trustScore
   */
  async scoreSingleClaim(claim) {
    try {
      Logger.log(`Scoring claim: "${claim.claim.substring(0, 50)}..."`);
      
      // Run all scorers in parallel with appropriate timeouts
      // AI scorers are fast (10s), web/scholar searches are queued and need longer timeout (120s)
      const [aiRating, toneAnalysis, scholarResult, webResult] = await Promise.all([
        this.withTimeout(AIScorer.score(claim.claim, 'credibility', claim.classification), AI_SCORER_TIMEOUT, 'n/a'),
        this.withTimeout(AIScorer.score(claim.claim, 'tone', claim.classification), AI_SCORER_TIMEOUT, 'n/a'),
        this.withTimeout(ScholarScorer.score(claim.claim, claim.classification), WEB_SCORER_TIMEOUT, {score: 0, sources: []}),
        this.withTimeout(WebScorer.score(claim.claim, claim.classification), WEB_SCORER_TIMEOUT, {score: 0, sources: []})
      ]);
      
      // Extract scores and sources
      const scholarlyMatch = scholarResult.score;
      const webReinforced = webResult.score;
      const scholarSources = scholarResult.sources || [];
      const webSources = webResult.sources || [];
      
      Logger.log(`Raw scores - AI: ${aiRating}, Tone: ${toneAnalysis}, Scholar: ${scholarlyMatch}, Web: ${webReinforced}`);
      
      // Calculate trust score with weight normalization
      const { trustScore, note } = this.calculateTrustScore(
        { aiRating, toneAnalysis, scholarlyMatch, webReinforced },
        claim.classification
      );
      
      // Add scores AND sources to claim object
      const scoredClaim = {
        ...claim,
        scores: {
          aiRating,
          toneAnalysis,
          scholarlyMatch,
          webReinforced
        },
        trustScore,
        sources: {
          scholar: scholarSources,
          web: webSources,
          all: [...scholarSources, ...webSources]
        }
      };
      
      if (note) {
        scoredClaim.note = note;
      }
      
      Logger.log(`Trust score: ${trustScore}`);
      
      return scoredClaim;
    } catch (error) {
      Logger.error('Error scoring claim:', error);
      
      // Return claim with default scores on error
      return {
        ...claim,
        scores: {
          aiRating: 'n/a',
          toneAnalysis: 'n/a',
          scholarlyMatch: 0,
          webReinforced: 0
        },
        trustScore: 0,
        note: 'Scoring failed - using default values'
      };
    }
  },
  
  /**
   * Calculate trust score with weighted average and weight normalization
   * @param {Object} scores - All four scores
   * @param {string} classification - Claim classification
   * @returns {Object} {trustScore: number, note?: string}
   */
  calculateTrustScore(scores, classification) {
    const weights = SCORING_WEIGHTS[classification] || SCORING_WEIGHTS.general_knowledge;
    
    const { aiRating, toneAnalysis, scholarlyMatch, webReinforced } = scores;
    
    // Check which scores are available
    const aiAvailable = aiRating !== 'n/a' && typeof aiRating === 'number';
    const toneAvailable = toneAnalysis !== 'n/a' && typeof toneAnalysis === 'number';
    
    let trustScore;
    let note;
    
    // Case 1: Both AI scores unavailable
    if (!aiAvailable && !toneAvailable) {
      const totalWeight = weights.scholarlyMatch + weights.webReinforced;
      
      if (totalWeight === 0) {
        // No weights available - use simple average of web and scholar
        trustScore = (scholarlyMatch + webReinforced) / 2;
      } else {
        // Renormalize scholarly and web weights
        const normalizedScholar = weights.scholarlyMatch / totalWeight;
        const normalizedWeb = weights.webReinforced / totalWeight;
        
        trustScore = (scholarlyMatch * normalizedScholar) + (webReinforced * normalizedWeb);
      }
      
      note = 'AI scorers unavailable - using scholarly + web only';
    }
    // Case 2: Only AI rating unavailable
    else if (!aiAvailable && toneAvailable) {
      const totalWeight = weights.toneAnalysis + weights.scholarlyMatch + weights.webReinforced;
      const normalizedTone = weights.toneAnalysis / totalWeight;
      const normalizedScholar = weights.scholarlyMatch / totalWeight;
      const normalizedWeb = weights.webReinforced / totalWeight;
      
      trustScore = (toneAnalysis * normalizedTone) +
                   (scholarlyMatch * normalizedScholar) +
                   (webReinforced * normalizedWeb);
      
      note = 'AI credibility scorer unavailable';
    }
    // Case 3: Only tone analysis unavailable
    else if (aiAvailable && !toneAvailable) {
      const totalWeight = weights.aiRating + weights.scholarlyMatch + weights.webReinforced;
      const normalizedAi = weights.aiRating / totalWeight;
      const normalizedScholar = weights.scholarlyMatch / totalWeight;
      const normalizedWeb = weights.webReinforced / totalWeight;
      
      trustScore = (aiRating * normalizedAi) +
                   (scholarlyMatch * normalizedScholar) +
                   (webReinforced * normalizedWeb);
      
      note = 'AI tone scorer unavailable';
    }
    // Case 4: All scores available
    else {
      trustScore = (aiRating * weights.aiRating) +
                   (toneAnalysis * weights.toneAnalysis) +
                   (scholarlyMatch * weights.scholarlyMatch) +
                   (webReinforced * weights.webReinforced);
    }
    
    // Round to 1 decimal place
    trustScore = Math.round(trustScore * 10) / 10;
    
    return { trustScore, note };
  },
  
  /**
   * Wrap a promise with timeout
   * @param {Promise} promise - Promise to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {any} defaultValue - Default value on timeout
   * @returns {Promise} Promise that resolves with value or default on timeout
   */
  async withTimeout(promise, timeoutMs, defaultValue) {
    return Promise.race([
      promise,
      new Promise(resolve => setTimeout(() => resolve(defaultValue), timeoutMs))
    ]);
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClaimScorer;
}

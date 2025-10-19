/**
 * Test script for ClaimExtractor
 * Runs the extractor on test articles and compares against expected claims
 */

const fs = require('fs');
const path = require('path');

// Mock CONFIG and Logger for standalone testing
global.CONFIG = {
  maxClaimsPerArticle: 50
};

global.Logger = {
  info: console.log,
  log: console.log,
  warn: console.warn,
  error: console.error,
  debug: () => {}, // Silent for cleaner output
  time: (label) => console.time(label),
  timeEnd: (label) => console.timeEnd(label)
};

// Load ClaimExtractor
const ClaimExtractor = require('../src/core/claimExtractor.js');

// Load test articles
const article1 = fs.readFileSync(path.join(__dirname, 'article1.txt'), 'utf8');
const article2 = fs.readFileSync(path.join(__dirname, 'article2.txt'), 'utf8');

// Load expected claims
const expectedClaims = JSON.parse(fs.readFileSync(path.join(__dirname, 'expectedClaims.json'), 'utf8'));

/**
 * Calculate similarity between two strings (simple approach)
 */
function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  // Simple substring match percentage
  const longerLower = longer.toLowerCase();
  const shorterLower = shorter.toLowerCase();
  
  if (longerLower.includes(shorterLower) || shorterLower.includes(longerLower)) {
    return Math.max(shorter.length / longer.length, 0.7);
  }
  
  // Count matching words
  const words1 = s1.toLowerCase().split(/\s+/);
  const words2 = s2.toLowerCase().split(/\s+/);
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  let matches = 0;
  set1.forEach(word => {
    if (set2.has(word) && word.length > 3) matches++;
  });
  
  return matches / Math.max(set1.size, set2.size);
}

/**
 * Find best match for a claim in a list of candidates
 */
function findBestMatch(claim, candidates) {
  let bestMatch = null;
  let bestScore = 0;
  
  candidates.forEach((candidate, index) => {
    const score = similarity(claim, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { claim: candidate, index, score };
    }
  });
  
  return bestMatch;
}

/**
 * Test claim extraction on an article
 */
async function testArticle(articleName, articleText, expectedClaimsList) {
  console.log('\n' + '='.repeat(80));
  console.log(`TESTING: ${articleName}`);
  console.log('='.repeat(80));
  
  // Extract claims
  const extractedClaims = await ClaimExtractor.extract(articleText);
  const extractedTexts = extractedClaims.map(c => c.claim);
  
  console.log(`\n📊 RESULTS:`);
  console.log(`   Expected claims: ${expectedClaimsList.length}`);
  console.log(`   Extracted claims: ${extractedTexts.length}`);
  
  // Check for matches
  const matched = new Set();
  const goodMatches = [];
  const partialMatches = [];
  
  expectedClaimsList.forEach((expected, i) => {
    const match = findBestMatch(expected, extractedTexts);
    if (match && match.score > 0.8) {
      matched.add(match.index);
      goodMatches.push({ expected, extracted: match.claim, score: match.score });
    } else if (match && match.score > 0.5) {
      partialMatches.push({ expected, extracted: match.claim, score: match.score });
    }
  });
  
  // Find false positives (extracted but not expected)
  const falsePositives = extractedTexts.filter((_, index) => !matched.has(index));
  
  // Find missed claims (expected but not extracted)
  const missedClaims = expectedClaimsList.filter(expected => {
    const match = findBestMatch(expected, extractedTexts);
    return !match || match.score <= 0.5;
  });
  
  // Calculate metrics
  const precision = extractedTexts.length > 0 ? (goodMatches.length / extractedTexts.length) * 100 : 0;
  const recall = expectedClaimsList.length > 0 ? (goodMatches.length / expectedClaimsList.length) * 100 : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  
  console.log(`\n📈 METRICS:`);
  console.log(`   ✅ Good matches: ${goodMatches.length}`);
  console.log(`   ⚠️  Partial matches: ${partialMatches.length}`);
  console.log(`   ❌ Missed claims: ${missedClaims.length}`);
  console.log(`   🚫 False positives: ${falsePositives.length}`);
  console.log(`   📊 Precision: ${precision.toFixed(1)}%`);
  console.log(`   📊 Recall: ${recall.toFixed(1)}%`);
  console.log(`   📊 F1 Score: ${f1.toFixed(1)}%`);
  
  // Show missed claims (most important for improvement)
  if (missedClaims.length > 0) {
    console.log(`\n❌ MISSED CLAIMS (${missedClaims.length}):`);
    missedClaims.forEach((claim, i) => {
      console.log(`\n   ${i + 1}. "${claim.substring(0, 100)}${claim.length > 100 ? '...' : ''}"`);
    });
  }
  
  // Show false positives (extracted but shouldn't be)
  if (falsePositives.length > 0) {
    console.log(`\n🚫 FALSE POSITIVES (${falsePositives.length}):`);
    falsePositives.forEach((claim, i) => {
      console.log(`\n   ${i + 1}. "${claim.substring(0, 100)}${claim.length > 100 ? '...' : ''}"`);
    });
  }
  
  // Show partial matches for debugging
  if (partialMatches.length > 0 && partialMatches.length <= 5) {
    console.log(`\n⚠️  PARTIAL MATCHES (may need quote merging):`);
    partialMatches.forEach(({ expected, extracted, score }) => {
      console.log(`\n   Expected: "${expected.substring(0, 80)}..."`);
      console.log(`   Got:      "${extracted.substring(0, 80)}..."`);
      console.log(`   Score:    ${(score * 100).toFixed(1)}%`);
    });
  }
  
  return {
    precision,
    recall,
    f1,
    goodMatches: goodMatches.length,
    missedClaims: missedClaims.length,
    falsePositives: falsePositives.length
  };
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n🧪 CLAIM EXTRACTOR TEST SUITE');
  console.log('Testing claim extraction against manually identified claims\n');
  
  const results = [];
  
  // Test Article 1
  const result1 = await testArticle('article1.txt (UK Oil Field)', article1, expectedClaims.article1);
  results.push(result1);
  
  // Test Article 2
  const result2 = await testArticle('article2.txt (FDA Cinnamon Recall)', article2, expectedClaims.article2);
  results.push(result2);
  
  // Overall summary
  console.log('\n' + '='.repeat(80));
  console.log('OVERALL SUMMARY');
  console.log('='.repeat(80));
  
  const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
  const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
  const avgF1 = results.reduce((sum, r) => sum + r.f1, 0) / results.length;
  
  console.log(`\n   Average Precision: ${avgPrecision.toFixed(1)}%`);
  console.log(`   Average Recall: ${avgRecall.toFixed(1)}%`);
  console.log(`   Average F1 Score: ${avgF1.toFixed(1)}%`);
  
  if (avgF1 >= 80) {
    console.log('\n   ✅ EXCELLENT! Claim extraction is working well.\n');
  } else if (avgF1 >= 60) {
    console.log('\n   ⚠️  GOOD, but needs improvement. Review missed claims and false positives.\n');
  } else {
    console.log('\n   ❌ NEEDS WORK. Significant improvements needed.\n');
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});


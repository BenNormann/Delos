# Media Bias Centralization Refactor

## Summary
Centralized media bias classification into a single module (`src/utils/biasResolver.js`) and updated all three callers to use it. This eliminates code duplication and fixes the `includes()` bug with exact host/parent-domain matching.

## Changes Made

### 1. Created `src/utils/biasResolver.js` (NEW FILE)
**Purpose**: Single source of truth for domain → bias classification

**Key Features**:
- **Default Map**: Aggregated all 50+ domains from the three previous hardcoded lists
- **Exact Matching**: Uses `normHost()` and `parent()` functions for precise domain matching
  - Handles subdomains: `edition.cnn.com` → `cnn.com`
  - Strips prefixes: `www.`, `m.`
  - Exact host match first, then parent domain fallback
- **No `includes()` Bug**: Fixed the false positive issue (e.g., `notcnn.com` no longer matches `cnn.com`)
- **Future-Ready**: 
  - Supports `weight` and `confidence` fields (ready for weighted scoring)
  - Optional `loadSnapshot(url)` function for loading larger bias maps from CDN
  - LocalStorage caching for offline use

**API**:
```javascript
classify(domainOrUrl) → { bias: 'left'|'center'|'right'|'unknown', weight: number, confidence: number }
loadSnapshot(url) → Promise<void> // Optional: load remote bias map
```

### 2. Updated `src/scoring/webScorer.js`
**Changes**:
- ✅ Removed duplicate `MEDIA_BIAS` object (lines 9-28)
- ✅ Added import: `const { classify } = require('../utils/biasResolver');`
- ✅ Simplified `categorizeDomain()` to call `classify(domain).bias`
- ✅ No changes to scoring logic (`calculateScore()` remains unchanged)

**Before** (buggy):
```javascript
const MEDIA_BIAS = { left: [...], center: [...], right: [...] };
categorizeDomain(domain) {
  const normalized = domain.toLowerCase().replace(/^www\./, '');
  for (const [bias, domains] of Object.entries(MEDIA_BIAS)) {
    if (domains.some(d => normalized.includes(d))) { // BUG: includes() false positives
      return bias;
    }
  }
  return 'unknown';
}
```

**After** (fixed):
```javascript
const { classify } = require('../utils/biasResolver');
categorizeDomain(domain) {
  return classify(domain).bias; // Exact matching, no false positives
}
```

### 3. Updated `src/utils/webSearch.js`
**Changes**:
- ✅ Removed duplicate `MEDIA_BIAS` object (lines 142-161)
- ✅ Added import: `const { classify } = require('./biasResolver');`
- ✅ Replaced 80+ lines of nested loop logic with simple `classify()` calls
- ✅ No changes to search logic or result format

**Before** (verbose):
```javascript
const MEDIA_BIAS = { left: [...], center: [...], right: [...] };
for (const result of filteredResults) {
  const domain = result.domain.toLowerCase();
  let categorized = false;
  
  // Check left sources (loop)
  for (const leftDomain of MEDIA_BIAS.left) {
    if (domain.includes(leftDomain)) {
      analysis.left++;
      categorized = true;
      break;
    }
  }
  // ... repeat for center and right (40+ lines)
}
```

**After** (clean):
```javascript
const { classify } = require('./biasResolver');
for (const result of filteredResults) {
  const b = classify(result.domain).bias;
  if (b === 'left') analysis.left++;
  else if (b === 'center') analysis.center++;
  else if (b === 'right') analysis.right++;
  else analysis.unknown++;
}
```

### 4. Updated `src/ui/highlighter.js`
**Changes**:
- ✅ Removed duplicate `MEDIA_BIAS` object (lines 316-320)
- ✅ Added import: `const { classify } = require('../utils/biasResolver');`
- ✅ Simplified categorization logic for spectrum bar display
- ✅ No changes to UI rendering or modal display

**Before** (loop-based):
```javascript
const MEDIA_BIAS = { left: [...], center: [...], right: [...] };
webSources.forEach(source => {
  const domain = source.domain.toLowerCase();
  let categorizedFlag = false;
  
  for (const [bias, domains] of Object.entries(MEDIA_BIAS)) {
    if (domains.some(d => domain.includes(d))) {
      categorized[bias].push(source);
      categorizedFlag = true;
      break;
    }
  }
  // ...
});
```

**After** (simple):
```javascript
const { classify } = require('../utils/biasResolver');
webSources.forEach(source => {
  const b = classify(source.domain).bias;
  if (b === 'left' || b === 'center' || b === 'right') {
    categorized[b].push(source);
  } else {
    categorized.unknown.push(source);
  }
});
```

## Bug Fixes

### Fixed: `includes()` False Positives
**Problem**: `domain.includes('cnn.com')` matched `notcnn.com`, `cnn.com.fake.site`, etc.

**Solution**: Exact host + parent domain matching
```javascript
// Examples:
classify('edition.cnn.com')  → { bias: 'left', ... }   // ✅ Matches parent 'cnn.com'
classify('www.bbc.co.uk')    → { bias: 'center', ... } // ✅ Strips 'www.'
classify('m.foxnews.com')    → { bias: 'right', ... }  // ✅ Strips 'm.'
classify('notcnn.com')       → { bias: 'unknown', ... } // ✅ No false positive!
```

## Testing Acceptance Criteria

All test cases pass:

| Test Case | Expected | Result |
|-----------|----------|--------|
| `edition.cnn.com` | `left` | ✅ Pass |
| `m.bbc.co.uk` | `center` | ✅ Pass |
| `www.foxnews.com` | `right` | ✅ Pass |
| `notcnn.com` | `unknown` | ✅ Pass (bug fixed!) |

## Benefits

1. **Single Source of Truth**: One file (`biasResolver.js`) instead of 3 duplicates
2. **Bug-Free Matching**: Exact domain matching eliminates false positives
3. **Maintainability**: Add new sources in one place, not three
4. **Consistency**: All callers use same classification logic
5. **Performance**: More efficient exact matching vs. nested loops
6. **Future-Ready**: 
   - Support for weighted scoring (weight field ready)
   - Optional remote bias map loading
   - LocalStorage caching

## Code Impact

- **Lines Removed**: ~150 (duplicate MEDIA_BIAS objects + nested loop logic)
- **Lines Added**: ~150 (centralized biasResolver.js)
- **Net Change**: Neutral LOC, but massively improved maintainability
- **Breaking Changes**: None (API unchanged, scoring unchanged, UI unchanged)

## What Didn't Change

- ✅ Scoring logic in `calculateScore()` (untouched)
- ✅ UI rendering and modal display (untouched)
- ✅ Search functionality (untouched)
- ✅ Result format and data structures (untouched)
- ✅ No changes to `manifest.json` (as requested)

## Future Enhancements (Optional)

1. **Weighted Scoring**: Change `analysis.left++` to `analysis.left += (weight * confidence)`
2. **Remote Bias Map**: Call `loadSnapshot('https://cdn.example.com/biases.json')` at startup
3. **Expand Coverage**: Add 200+ sources to `DEFAULT_MAP` with confidence scores
4. **Dynamic Updates**: Refresh bias map periodically (weekly/monthly)

## Deployment

No special deployment steps needed:
1. Files are CommonJS modules (compatible with existing bundler)
2. No manifest.json changes required
3. No breaking API changes
4. Extension will work immediately after code is loaded

---

**Status**: ✅ Complete
**Tested**: ✅ All acceptance criteria pass
**Linter**: ✅ No errors
**Breaking Changes**: ❌ None


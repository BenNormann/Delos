# Delos - Making Truth Visible

An AI-powered fact-checking browser extension that automatically analyzes news articles, extracts factual claims, and scores them for credibility using multi-dimensional verification across AI analysis, academic sources, and cross-spectrum web validation.

## ✨ Features

### 🎯 Intelligent Claim Detection
- **Research-Based Extraction**: Uses linguistic analysis and argumentation mining principles to identify check-worthy claims
- **Smart Filtering**: Automatically removes UI noise, navigation elements, and non-factual content
- **Quote Preservation**: Intelligently handles multi-sentence quotes and attributions

### 🧠 Multi-Dimensional Scoring System
Every claim is evaluated across **4 independent dimensions**:

1. **AI Credibility Rating** (0-10)
   - Logical consistency and plausibility analysis
   - Verifiability assessment using GPT-4o-mini

2. **Tone Analysis** (0-10)
   - Detects emotional language and bias
   - Identifies loaded terms and propaganda techniques

3. **Scholarly Match** (0-10)
   - Searches Google Scholar for academic backing
   - Prioritizes authoritative domains (.edu, .nih.gov, nature.com)
   - Only applies to empirical/scientific claims

4. **Web Reinforcement** (0-10)
   - Cross-verifies claims across independent news sources
   - **Political Spectrum Analysis**: Rewards claims verified across left, center, and right-leaning sources
   - Detects potential echo chambers

### 🎨 Visual Feedback
- **Color-Coded Highlights**:
  - 🟢 **Green** (≥7/10): High trust - Well-verified claim
  - 🟡 **Yellow** (3-7/10): Medium trust - Requires further verification
  - 🔴 **Red** (<3/10): Low trust - Questionable or unverified

- **Interactive Tooltips**: Hover to see score breakdown and classification
- **Source Bibliography**: Click any claim to see full sources with political spectrum visualization

### 📊 Claim Classification
Claims are automatically categorized:
- **📰 Current News**: Recent events, breaking updates, time-sensitive information
- **📚 General Knowledge**: Historical facts, established understanding
- **🔬 Empirical Fact**: Testable scientific claims, measurable data, research findings

Different classifications use optimized scoring weights for best accuracy.

## 🚀 Installation

### Prerequisites

- Chrome, Edge, Brave, or any Chromium-based browser
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- ~$0.01-0.05 per article in API costs

### Quick Setup (5 minutes)

1. **Clone or Download**
   ```bash
   git clone https://github.com/BenNormann/Delos.git
   cd Delos
   ```

2. **Configure API Key**
   
   Create your `secrets.json` file:
   ```bash
   # Windows (PowerShell)
   Copy-Item secrets.template.json secrets.json
   
   # Mac/Linux
   cp secrets.template.json secrets.json
   ```
   
   Edit `secrets.json` and add your OpenAI API key:
   ```json
   {
     "openai_api_key": "sk-proj-your-actual-key-here"
   }
   ```
   
   > **🔒 Security**: `secrets.json` is automatically ignored by git and will never be committed

3. **Load Extension**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top-right corner)
   - Click **"Load unpacked"**
   - Select the `Delos` directory
   - ✅ The Delos icon should appear in your toolbar

4. **Verify Setup**
   - Visit any news article (e.g., [BBC News](https://www.bbc.com/news))
   - Look for the loading indicator (lighthouse animation)
   - Within 10-30 seconds, claims will be highlighted
   - Check console (F12) for detailed logs

## 📖 Usage

### Basic Workflow

1. **Visit a News Site**
   - Navigate to any major news outlet article
   - Supported sites: NYT, Washington Post, The Guardian, BBC, CNN, Reuters, AP News, NPR, Bloomberg, WSJ, Fox News, and more

2. **Automatic Analysis**
   - Delos runs automatically on page load
   - Watch the loading indicator for progress:
     - Analyzing article...
     - Extracting claims...
     - Classifying claims...
     - Scoring claims...
     - Highlighting claims...

3. **Explore Results**
   - **Hover** over highlighted claims to see score breakdown
   - **Click** claims to view full source bibliography and political spectrum
   - **Open popup** (click extension icon) to see article-level statistics

## 🏗️ Architecture

### Data Flow Pipeline

```
1. Page Load → content.js initializes
2. Extract article text from DOM
3. Extract claims using linguistic analysis (0-50 claims)
4. Classify claims via OpenAI (current_news | general_knowledge | empirical_fact)
5. Score all claims in parallel:
   ├─ AI Credibility (GPT-4o-mini)
   ├─ Tone Analysis (GPT-4o-mini)
   ├─ Scholar Match (Google Scholar scraping)
   └─ Web Reinforcement (DuckDuckGo/Bing + political spectrum analysis)
6. Calculate weighted trust score (0-10)
7. Highlight claims in DOM with color coding
8. Attach interactive tooltips and source modals
```

### Project Structure

```
delos/
├── manifest.json          # Extension configuration (Manifest V3)
├── secrets.json          # API keys (gitignored, you create this)
├── secrets.template.json # Template for secrets.json
│
├── src/
│   ├── content.js              # 🎯 Main orchestrator & pipeline controller
│   ├── background.js           # 🔌 Service worker, CORS proxy, secrets loader
│   ├── config.js               # ⚙️  Configuration (models, weights, colors)
│   │
│   ├── core/                   # Core fact-checking pipeline
│   │   ├── claimExtractor.js  # 📝 Linguistic claim detection (18+ criteria)
│   │   ├── claimClassifier.js # 🏷️  OpenAI-based classification
│   │   └── claimScorer.js     # 🎲 Score aggregation & weight normalization
│   │
│   ├── scoring/                # Individual scoring dimensions
│   │   ├── aiScorer.js        # 🤖 AI credibility + tone analysis
│   │   ├── scholarScorer.js   # 🎓 Academic source validation
│   │   └── webScorer.js       # 🌐 Cross-spectrum web verification
│   │
│   ├── scrapers/               # Web scraping utilities
│   │   ├── webScraper.js      # DuckDuckGo/Bing HTML parsing
│   │   └── scholarScraper.js  # Google Scholar/ScienceOpen/CORE parsing
│   │
│   ├── ui/                     # User interface components
│   │   ├── highlighter.js     # 🎨 DOM manipulation & modal rendering
│   │   └── tooltip.js         # 💬 Hover tooltips with score breakdown
│   │
│   └── utils/                  # Shared utilities
│       ├── api.js             # OpenAI API wrapper with retry logic
│       ├── cache.js           # In-memory caching (TTL-based)
│       ├── logger.js          # Console logging with debug mode
│       └── webSearch.js       # High-level search interface
│
├── styles/
│   └── highlights.css        # Highlight and tooltip styling
│
├── icons/                    # Extension icons (16, 32, 64, 128px)
└── popup.html / popup.js     # Extension popup with statistics
```

## 📊 Scoring System Explained

### How Trust Scores Are Calculated

Each claim receives a **Trust Score** from 0-10 based on weighted dimensions:

#### Scoring Weights by Classification

| Dimension | Current News | General Knowledge | Empirical Fact |
|-----------|--------------|-------------------|----------------|
| AI Credibility | 47.5% | 47.5% | 25% |
| Tone Analysis | 5% | 5% | 5% |
| Scholarly Match | 0% | 0% | **45%** |
| Web Reinforcement | 47.5% | 47.5% | 25% |

**Why different weights?**
- **Current News/General Knowledge**: Rely on AI reasoning and recent web sources
- **Empirical Facts**: Prioritize academic papers and scholarly validation

### Political Spectrum Bonus (Web Reinforcement)

Claims verified across the **political spectrum** receive higher scores:

```
Score = Base Score (0-7) + Diversity Bonus (0-3)

Full Spectrum (Left + Center + Right):  +3 points ⭐️
Two Categories:                        +1.5 points
Single Category (echo chamber):        +0.5 points
```

**Media Bias Classifications:**
- **Left**: NYT, WashPost, Guardian, CNN, MSNBC, NPR
- **Center**: Reuters, AP, BBC, Bloomberg, USA Today
- **Right**: Fox News, WSJ, NY Post, Daily Wire

## ⚙️ Configuration

### Customizing Behavior

Edit `src/config.js` to adjust:

```javascript
const CONFIG = {
  openai: {
    model: 'gpt-4o-mini'  // Fast and cost-effective
  },
  
  scoringWeights: {
    // Adjust weights for each claim type
  },
  
  colors: {
    high: '#22c55e',    // Green
    medium: '#eab308',  // Yellow
    low: '#ef4444'      // Red
  },
  
  cache: {
    ttl: 86400  // Cache duration (24 hours)
  },
  
  maxClaimsPerArticle: 50,  // Prevent overwhelming long articles
  timeoutSeconds: 30
};
```

### Feature Toggles

Available in extension popup:
- **Show Highlights**: Toggle visibility on/off
- **AI Web Scraping**: Experimental feature (AI can search web before scoring)

## 🐛 Debugging & Troubleshooting

### Enable Debug Mode

```javascript
// Run in browser console (F12)
localStorage.setItem('delos_debug', 'true');
location.reload();
```

This enables verbose logging showing:
- Claim extraction details
- API call payloads
- Scoring calculations
- DOM manipulation steps

### Common Issues

| Issue | Solution |
|-------|----------|
| **No highlights appear** | • Check console for errors<br>• Verify `secrets.json` exists and has valid API key<br>• Ensure you're on a supported news site<br>• Article must have >100 characters of text |
| **API errors** | • Verify API key starts with `sk-`<br>• Check OpenAI billing at [platform.openai.com](https://platform.openai.com/usage)<br>• Ensure you have credits/quota available |
| **Claims not found** | • Article may be behind paywall<br>• Non-standard HTML structure<br>• Too many UI elements (navigation/ads) |
| **Extension doesn't load** | • Reload extension at `chrome://extensions/`<br>• Check for JavaScript errors in console<br>• Ensure manifest.json is valid |

### Useful Console Commands

**Check API Key:**
```javascript
chrome.storage.local.get('openai_api_key', (r) => 
  console.log(r.openai_api_key ? '✅ API key set' : '❌ Missing API key')
);
```

**Clear Cache:**
```javascript
chrome.storage.local.get(null, (items) => {
  const keys = Object.keys(items).filter(k => k.startsWith('delos_cache_'));
  chrome.storage.local.remove(keys, () => 
    console.log(`🗑️ Cleared ${keys.length} cache entries`)
  );
});
```

**Force Re-Analysis:**
```javascript
document.body.removeAttribute('data-truthcheck-processed');
location.reload();
```

**Check Extension Stats:**
```javascript
chrome.storage.local.get(null, (items) => {
  console.log('Current tab stats:', items);
});
```

## 💰 API Costs & Usage

### Cost Breakdown

**Per Article:**
- Claim extraction: Free (rule-based)
- Classification: ~$0.001-0.002 (1 batch call)
- Scoring: ~$0.005-0.02 (2 calls per claim × N claims)
- Web/Scholar scraping: Free

**Average Total: $0.01-0.05 per article**

### Rate Limits (Free Tier)

OpenAI API free tier:
- 3 requests/minute
- 200 requests/day

**Recommendation**: Upgrade to paid tier ($5+ credit) for reliable performance.

### Monitoring Usage

Check your usage at: https://platform.openai.com/usage

## 🔒 Privacy & Security

### What Data Is Shared?

**Sent to OpenAI:**
- ✅ Extracted claim text (for classification and scoring)
- ❌ NOT sent: Full article, URL, user info, browsing history

**Web Scraping:**
- ✅ Search queries sent to DuckDuckGo, Google Scholar
- ❌ NOT tracked: Anonymous requests, no API keys needed

### Local Storage

- API keys stored in `chrome.storage.local` (encrypted by Chrome)
- Cache stored in memory (cleared on page reload)
- Statistics stored per-tab (cleared when tab closes)

### Security Best Practices

✅ **DO:**
- Keep `secrets.json` in `.gitignore` (already configured)
- Use separate API keys for development/production
- Rotate keys periodically

❌ **DON'T:**
- Commit `secrets.json` to version control
- Share API keys publicly
- Use personal API keys in shared code

## 🚀 Advanced Features

### Experimental: AI Web Scraping

Enable in popup to allow AI to search the web before scoring:

```javascript
// AI can call search_web() function during scoring
// Increases accuracy but adds ~2-3 seconds per claim
```

### Viewing Sources

Click any highlighted claim to see:
- **Political Spectrum Chart**: Visual distribution of sources
- **Categorized Sources**: Grouped by political lean (Left/Center/Right)
- **Academic Sources**: Scholarly papers and research
- **Full Bibliography**: All URLs with titles and snippets

## 🛠️ Development

### Making Changes

1. Edit source files in `src/`
2. Go to `chrome://extensions/`
3. Click reload icon on Delos extension
4. Refresh test page
5. Check console for errors

### Testing

```bash
# Run claim extraction tests
node tests/testClaimExtractor.js
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly on multiple news sites
5. Submit a pull request

## 📚 Related Documentation

- **[QUICK_START.md](QUICK_START.md)**: Fast setup guide with common commands
- **[SETUP_API_KEY.md](SETUP_API_KEY.md)**: Detailed API key configuration
- **[secrets.template.json](secrets.template.json)**: Template for API keys

## 🙏 Acknowledgments

- OpenAI for GPT-4o-mini API
- Argumentation mining research for claim detection algorithms
- AllSides Media Bias Chart for political spectrum classifications
- Flaticon for lighthouse icons ([created by Freepik](https://www.flaticon.com/free-icons/lighthouse))

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/BenNormann/Delos/issues)
- **Repository**: [github.com/BenNormann/Delos](https://github.com/BenNormann/Delos)

---

**Built with ❤️ for truth in journalism**


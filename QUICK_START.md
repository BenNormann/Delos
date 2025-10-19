# Moneo - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Get API Key
```
Visit: https://platform.openai.com/api-keys
Create new key → Copy it
```

### 2. Install Extension
```
1. Open Chrome
2. Go to: chrome://extensions/
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select this folder
```

### 3. Configure API Key
```javascript
// Open console (F12) on any page and run:
chrome.storage.local.set({ 
  openai_api_key: 'sk-your-key-here' 
}, () => console.log('✅ API key saved!'));
```

### 4. Test It
```
1. Go to: https://www.bbc.com/news
2. Open any article
3. Press F12 to see console
4. Wait 10-30 seconds
5. See highlighted claims!
```

## 📊 Understanding Results

### Color Code
- 🟢 **Green** (7-10): High trust - Reliable claim
- 🟡 **Yellow** (3-7): Medium trust - Verify further  
- 🔴 **Red** (0-3): Low trust - Questionable claim

### Hover for Details
- Overall trust score
- Claim classification
- 4 dimension scores
- Full claim text

## 🔧 Common Commands

### Check API Key
```javascript
chrome.storage.local.get('openai_api_key', (r) => 
  console.log(r.openai_api_key ? '✅ Set' : '❌ Missing')
);
```

### Clear Cache
```javascript
chrome.storage.local.get(null, (items) => {
  const keys = Object.keys(items).filter(k => k.startsWith('moneo_cache_'));
  chrome.storage.local.remove(keys, () => console.log('🗑️ Cleared', keys.length));
});
```

### Enable Debug Mode
```javascript
localStorage.setItem('moneo_debug', 'true');
location.reload();
```

### Force Re-run
```javascript
document.body.removeAttribute('data-moneo-processed');
location.reload();
```

## ⚠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| No highlights | Check console for errors, verify API key |
| "API error" | Check OpenAI billing, verify key is valid |
| No claims found | Article too short or behind paywall |
| Extension not loading | Reload extension in chrome://extensions/ |

## 💰 Cost Tracking

Average cost: **$0.01-0.05 per article**

Monitor usage: https://platform.openai.com/usage

## 📝 Supported Sites

✅ New York Times, Washington Post, The Guardian, BBC, CNN, Reuters, AP News, NPR, Bloomberg, WSJ, and more!

## 🎯 What Gets Analyzed

✅ Factual statements with data/numbers  
✅ Claims with specific assertions  
✅ Quoted statements from sources  
❌ Opinion statements  
❌ Questions  
❌ Generic transitions  

## 🐛 Debug Checklist

1. ✅ Extension enabled in chrome://extensions/
2. ✅ API key stored correctly
3. ✅ On a supported news site
4. ✅ Article has substantial text (>100 chars)
5. ✅ Console shows "Moneo: Extension loaded"
6. ✅ Internet connection active
7. ✅ OpenAI API quota available

## 📚 Full Documentation

- **README.md** - Complete overview
- **SETUP_GUIDE.md** - Detailed setup
- **PROJECT_SUMMARY.md** - Technical details

## 🎨 Icons

Icons are already provided in `/icons/` directory:
- icon16.png ✅
- icon32.png ✅
- icon48.png ✅
- icon128.png ✅

## 🔐 Security Note

Your API key is stored locally in Chrome's secure storage. Never share your API key or commit it to version control!

---

**Need help?** Check console logs (F12) for detailed error messages.

**All set?** Visit a news site and start fact-checking! 🔍

---

**Moneo** - *To warn, advise, remind* 🏛️


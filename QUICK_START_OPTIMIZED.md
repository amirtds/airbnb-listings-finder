# Quick Start - Optimized API

## 🚀 Fast Scraping Examples

### Quick Mode (Fastest - Recommended for 50+ listings)

Scrape 100 listings in ~2 minutes:

```bash
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "location": "Miami, FL",
    "numberOfListings": 100,
    "quickMode": true
  }'
```

**What you get:**
- ✅ All listing details (title, description, images)
- ✅ All amenities
- ✅ Most relevant reviews
- ✅ House rules
- ✅ Property details
- ❌ Host profiles (skipped for speed)

**Time: ~1.7-2.7 minutes for 100 listings**

---

### Normal Mode (Complete Data)

Scrape 100 listings with all data in ~10 minutes:

```bash
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "location": "Miami, FL",
    "numberOfListings": 100
  }'
```

**What you get:**
- ✅ All listing details
- ✅ All amenities
- ✅ All 4 review categories (Most Relevant, Most Recent, Highest Rated, Lowest Rated)
- ✅ House rules
- ✅ Host profiles with all host listings
- ✅ Property details

**Time: ~8-11 minutes for 100 listings**

---

## Performance Comparison

| Listings | Old Time | Normal Mode | Quick Mode |
|----------|----------|-------------|------------|
| 10 | 5-7 min | **50-70s** | **10-16s** |
| 50 | 25-35 min | **4-6 min** | **50-80s** |
| 100 | 50-67 min | **8-11 min** | **1.7-2.7 min** |

## Key Improvements

1. **Parallel Processing**: 3-5 listings processed simultaneously
2. **Optimized Delays**: 50-70% reduction in wait times
3. **Quick Mode**: Skip optional data for 10x speed boost
4. **Smart Scraping**: Only scrape what you need

## When to Use Each Mode

### Use Quick Mode When:
- Scraping 50+ listings
- You don't need host profile data
- You only need most relevant reviews
- Speed is priority

### Use Normal Mode When:
- You need complete data
- Host information is important
- You want all review categories
- Scraping < 20 listings

## Restart PM2 After Deployment

```bash
pm2 restart all
```

## Monitor Performance

```bash
pm2 logs
```

Look for processing time in logs:
```
[API] Successfully scraped 100 listings
[API] Processing time: 2m 15s
```

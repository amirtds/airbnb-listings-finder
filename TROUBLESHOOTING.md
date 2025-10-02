# Troubleshooting Guide

## API Stops Responding After One Request

### Quick Fix

```bash
# 1. Restart PM2
pm2 restart all

# 2. Check health
curl http://localhost:3000/health

# 3. If browserProcesses > 10, run cleanup
curl -X POST http://localhost:3000/api/cleanup \
  -H "Authorization: Bearer your-token"
```

### Root Cause

Browser processes not being cleaned up properly after scraping.

### Long-term Solution

The code has been updated with comprehensive cleanup. After deploying the latest code:

1. Restart PM2: `pm2 restart all`
2. Monitor health: `curl http://localhost:3000/health`
3. Watch logs: `pm2 logs`

---

## High Memory Usage

### Check Current Usage

```bash
pm2 monit
```

### If Memory Keeps Growing

```bash
# 1. Check browser processes
curl http://localhost:3000/health

# 2. Clean up orphaned browsers
curl -X POST http://localhost:3000/api/cleanup \
  -H "Authorization: Bearer your-token"

# 3. Restart if needed
pm2 restart all
```

---

## Scraping Takes Too Long

### Use Quick Mode

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

**Quick mode is 10x faster** but skips host profiles and only scrapes most relevant reviews.

### Reduce Number of Listings

Instead of scraping 100 at once, scrape in batches of 20-30.

---

## Check for Zombie Browser Processes

### Linux/Ubuntu

```bash
# List all browser processes
ps aux | grep -E 'chromium|chrome.*headless' | grep -v grep

# Count them
ps aux | grep -E 'chromium|chrome.*headless' | grep -v grep | wc -l

# Kill all (if needed)
pkill -9 chromium
```

### Using the API

```bash
# Check count
curl http://localhost:3000/health

# Clean up
curl -X POST http://localhost:3000/api/cleanup \
  -H "Authorization: Bearer your-token"
```

---

## API Returns Empty Results

### Possible Causes

1. **Airbnb blocking**: Too many requests too fast
2. **Invalid location**: Location string not recognized
3. **Network issues**: Can't reach Airbnb

### Solutions

```bash
# 1. Increase delays
curl -X POST http://localhost:3000/api/scrape/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "location": "Miami, FL",
    "numberOfListings": 10,
    "minDelayBetweenRequests": 5000,
    "maxDelayBetweenRequests": 10000
  }'

# 2. Try a different location
# Use full format: "City, State" or "City, Country"

# 3. Check PM2 logs for errors
pm2 logs --err
```

---

## Monitor API Health

### Automated Health Check

```bash
# Add to cron (every 5 minutes)
*/5 * * * * curl http://localhost:3000/health | jq '.browserProcesses' | awk '{if ($1 > 10) print "WARNING: High browser count: " $1}'
```

### Manual Monitoring

```bash
# Watch logs
pm2 logs --lines 50

# Check health
watch -n 5 'curl -s http://localhost:3000/health | jq .'

# Monitor processes
watch -n 5 'ps aux | grep chromium | wc -l'
```

---

## Common Error Messages

### "Request timeout"

**Cause:** Page took too long to load  
**Solution:** Increase `requestHandlerTimeoutSecs` or use quick mode

### "Browser pool exhausted"

**Cause:** Too many concurrent requests  
**Solution:** Reduce concurrency or wait between requests

### "ECONNREFUSED"

**Cause:** API server not running  
**Solution:** `pm2 start` or `npm run api`

---

## Best Practices

### For Production

1. **Use quick mode for large scrapes** (50+ listings)
2. **Monitor browser processes** regularly
3. **Run cleanup endpoint** if processes accumulate
4. **Restart PM2 daily** (optional, via cron)

### For Development

1. **Use small batches** (5-10 listings) for testing
2. **Watch logs** with `pm2 logs`
3. **Check health** after each request

### Rate Limiting

To avoid being blocked by Airbnb:

- **Normal mode**: Max 10-12 requests/minute
- **Quick mode**: Max 20 requests/minute
- **Increase delays** if you get empty results

---

## Emergency Recovery

If everything fails:

```bash
# 1. Kill all browser processes
pkill -9 chromium

# 2. Restart PM2
pm2 restart all

# 3. Clear PM2 logs
pm2 flush

# 4. Start fresh
pm2 logs
```

---

## Getting Help

When reporting issues, include:

1. **PM2 logs**: `pm2 logs --lines 100 > logs.txt`
2. **Health check**: `curl http://localhost:3000/health`
3. **Browser count**: `ps aux | grep chromium | wc -l`
4. **Request that failed**: The exact curl command or request body
5. **Error message**: Full error from logs

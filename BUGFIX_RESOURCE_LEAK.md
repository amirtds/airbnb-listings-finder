# Bug Fix: Resource Leak in /api/scrape/search Endpoint

## Problem

After multiple runs of calling `/api/scrape/search`, the API would stop responding and require a PM2 process restart to work again.

## Root Cause

**Resource Leak in `searchController.js`**

The `PlaywrightCrawler` instances created by Crawlee were never properly cleaned up after each API request:

1. **Browser processes accumulated** - Each crawler launches Playwright browser instances that weren't being closed
2. **Memory leaks** - Crawlee maintains internal state, event listeners, and request queues that persist
3. **Connection pool exhaustion** - Eventually the system runs out of file descriptors and memory

### Why This Happened

- `searchCrawler.run()` and `detailCrawler.run()` were called but the crawlers were never torn down
- Crawlee's `PlaywrightCrawler` maintains browser contexts, pages, and internal state that need explicit cleanup via `teardown()`
- No `try/finally` block to ensure cleanup happens even on errors
- Each request would create new crawler instances without cleaning up the old ones

### Why `/api/scrape/listing` Didn't Have This Issue

The `listingController.js` uses raw Playwright browser (not Crawlee) and properly closes it:
```javascript
await browser.close();
browser = null;
```

## Solution

Added proper resource cleanup in `searchController.js` using a `try/finally` block:

```javascript
export async function scrapeByLocation(req, res, next) {
    let searchCrawler = null;
    let detailCrawler = null;
    
    try {
        // ... existing scraping logic ...
        searchCrawler = createSearchCrawler(...);
        await searchCrawler.run([searchUrl]);
        
        detailCrawler = createDetailCrawler(...);
        await detailCrawler.run(detailRequests);
        
        // ... return results ...
    } catch (error) {
        console.error('[API] Error in scrapeByLocation:', error);
        next(error);
    } finally {
        // CRITICAL: Clean up crawler resources to prevent memory leaks
        if (searchCrawler) {
            try {
                await searchCrawler.teardown();
                console.log('[API] Search crawler cleaned up');
            } catch (e) {
                console.error('[API] Error cleaning up search crawler:', e);
            }
        }
        
        if (detailCrawler) {
            try {
                await detailCrawler.teardown();
                console.log('[API] Detail crawler cleaned up');
            } catch (e) {
                console.error('[API] Error cleaning up detail crawler:', e);
            }
        }
    }
}
```

## What `teardown()` Does

The Crawlee `teardown()` method:
- Closes all browser instances and contexts
- Cleans up request queues
- Removes event listeners
- Releases file descriptors
- Frees memory

## Testing

After deploying this fix:

1. **Restart PM2** to clear any existing leaked resources:
   ```bash
   pm2 restart all
   ```

2. **Test multiple requests** to verify no resource accumulation:
   ```bash
   # Run this multiple times (10-20 times)
   curl -X POST http://your-server:3000/api/scrape/search \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-token" \
     -d '{"location": "Miami, FL", "numberOfListings": 5}'
   ```

3. **Monitor resources**:
   ```bash
   # Check PM2 memory usage doesn't grow unbounded
   pm2 monit
   
   # Check for zombie browser processes
   ps aux | grep chromium
   ps aux | grep playwright
   ```

## Expected Behavior

- Memory usage should stabilize after a few requests
- No accumulation of browser processes
- API should continue responding indefinitely
- PM2 restart should no longer be necessary

## Files Changed

- `/src/api/controllers/searchController.js` - Added crawler teardown in finally block

## Date Fixed

2025-10-02

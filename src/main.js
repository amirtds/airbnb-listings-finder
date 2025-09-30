import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';

// Main actor entry point
await Actor.init();

try {
    // Get input from Apify (or use defaults for local testing)
    const input = await Actor.getInput() ?? {};
    const { location, numberOfListings = 10 } = input;

    // Validate input
    if (!location) {
        throw new Error('Location parameter is required!');
    }

    log.info(`Starting Airbnb listings search for: ${location}`);
    log.info(`Target number of listings: ${numberOfListings}`);

    // Store found listings
    const foundListings = [];

    // Construct Airbnb search URL
    // Airbnb search URL format: https://www.airbnb.com/s/{location}/homes
    const searchUrl = `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes`;
    
    log.info(`Search URL: ${searchUrl}`);

    // Create a PlaywrightCrawler to handle JavaScript-rendered content
    const crawler = new PlaywrightCrawler({
        // Maximum number of pages to crawl
        maxRequestsPerCrawl: 15,
        
        // Use headless browser
        headless: true,
        
        // Request handler
        async requestHandler({ request, page, log: requestLog }) {
            requestLog.info(`Processing: ${request.url}`);

            // Wait for the page to load and listings to appear
            try {
                await page.waitForSelector('a[href*="/rooms/"]', { timeout: 15000 });
            } catch (e) {
                requestLog.warning('Timeout waiting for listings to load');
            }

            // Scroll multiple times to load more content (Airbnb uses lazy loading)
            requestLog.info('Scrolling to load all listings on the page...');
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight);
                });
                await page.waitForTimeout(1000);
            }
            
            // Scroll to bottom
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await page.waitForTimeout(2000);

            // Extract listing URLs from the page
            const listingLinks = await page.$$eval('a[href*="/rooms/"]', (links) => {
                return links
                    .map(link => {
                        const href = link.getAttribute('href');
                        if (href) {
                            const match = href.match(/\/rooms\/(\d+)/);
                            if (match) {
                                return {
                                    listingId: match[1],
                                    listingUrl: `https://www.airbnb.com/rooms/${match[1]}`
                                };
                            }
                        }
                        return null;
                    })
                    .filter(item => item !== null);
            });

            // Remove duplicates based on listingId
            const uniqueListings = Array.from(
                new Map(listingLinks.map(item => [item.listingId, item])).values()
            ).map(item => ({
                ...item,
                location: location
            }));

            requestLog.info(`Found ${uniqueListings.length} unique listings on this page`);

            // Add to our collection
            let newListingsAdded = 0;
            for (const listing of uniqueListings) {
                if (foundListings.length >= numberOfListings) {
                    break;
                }
                
                // Check if we already have this listing
                if (!foundListings.some(l => l.listingId === listing.listingId)) {
                    foundListings.push(listing);
                    newListingsAdded++;
                    requestLog.info(`Added listing ${foundListings.length}/${numberOfListings}: ${listing.listingUrl}`);
                }
            }

            requestLog.info(`Total listings collected so far: ${foundListings.length}/${numberOfListings}`);

            // If we haven't reached the target, look for pagination
            if (foundListings.length < numberOfListings) {
                // Try multiple pagination selectors (Airbnb may use different ones)
                let nextUrl = null;
                
                // Method 1: Look for "Next" button with aria-label
                const nextButton = await page.$('a[aria-label="Next"]');
                if (nextButton) {
                    nextUrl = await nextButton.getAttribute('href');
                }
                
                // Method 2: Look for pagination nav with "Next" text
                if (!nextUrl) {
                    const nextLink = await page.$('nav a:has-text("Next")');
                    if (nextLink) {
                        nextUrl = await nextLink.getAttribute('href');
                    }
                }
                
                // Method 3: Look for pagination buttons
                if (!nextUrl) {
                    const paginationNext = await page.$('[data-testid="pagination-next-button"]');
                    if (paginationNext) {
                        nextUrl = await paginationNext.getAttribute('href');
                    }
                }
                
                if (nextUrl) {
                    const fullNextUrl = nextUrl.startsWith('http') 
                        ? nextUrl 
                        : `https://www.airbnb.com${nextUrl}`;
                    
                    requestLog.info(`Need ${numberOfListings - foundListings.length} more listings. Going to next page: ${fullNextUrl}`);
                    await crawler.addRequests([fullNextUrl]);
                } else {
                    requestLog.info(`No more pages available. Collected ${foundListings.length} listings.`);
                }
            } else {
                requestLog.info(`Target reached! Collected ${foundListings.length} listings.`);
            }
        },

        // Error handler
        failedRequestHandler({ request, log: errorLog }, error) {
            errorLog.error(`Request ${request.url} failed multiple times`, { error });
        },

        // Timeout settings
        requestHandlerTimeoutSecs: 120,
        maxRequestRetries: 3,
    });

    // Run the crawler
    await crawler.run([searchUrl]);

    // Limit results to requested number
    const finalListings = foundListings.slice(0, numberOfListings);

    log.info(`Successfully extracted ${finalListings.length} listings`);

    // Push results to Apify dataset
    await Actor.pushData(finalListings);

    // Set output
    await Actor.setValue('OUTPUT', {
        success: true,
        location: location,
        requestedCount: numberOfListings,
        foundCount: finalListings.length,
        listings: finalListings
    });

    log.info('Actor finished successfully');

} catch (error) {
    log.error('Actor failed with error:', error);
    
    // Set error output
    await Actor.setValue('OUTPUT', {
        success: false,
        error: error.message
    });
    
    throw error;
} finally {
    await Actor.exit();
}

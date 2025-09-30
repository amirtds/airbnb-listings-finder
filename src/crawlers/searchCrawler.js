/**
 * Search crawler for finding listing URLs from Airbnb search results
 */

import { PlaywrightCrawler } from 'crawlee';
import { getBrowserLaunchOptions, getPreNavigationHooks } from '../utils/browserConfig.js';

/**
 * Create and configure the search crawler
 * @param {Array} foundListings - Array to store found listings
 * @param {number} numberOfListings - Target number of listings
 * @param {string} location - Search location
 * @returns {PlaywrightCrawler} Configured crawler instance
 */
export function createSearchCrawler(foundListings, numberOfListings, location) {
    return new PlaywrightCrawler({
        maxRequestsPerCrawl: 15,
        
        // Rate limiting to avoid being blocked
        maxConcurrency: 1,
        minConcurrency: 1,
        maxRequestsPerMinute: 10,
        
        headless: true,
        
        launchContext: getBrowserLaunchOptions(),
        preNavigationHooks: getPreNavigationHooks(),
        
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
                }
            }

            requestLog.info(`Total listings collected so far: ${foundListings.length}/${numberOfListings}`);

            // Check if we need more listings and if there's a next page
            if (foundListings.length < numberOfListings) {
                requestLog.info(`Need ${numberOfListings - foundListings.length} more listings. Looking for next page...`);
                
                const nextUrl = await findNextPageUrl(page, requestLog);
                
                if (nextUrl && nextUrl !== request.url) {
                    const fullNextUrl = nextUrl.startsWith('http') 
                        ? nextUrl 
                        : `https://www.airbnb.com${nextUrl}`;
                    
                    requestLog.info(`Going to next page: ${fullNextUrl}`);
                    await this.addRequests([fullNextUrl]);
                } else {
                    requestLog.info(`No more pages available. Collected ${foundListings.length} listings.`);
                }
            } else {
                requestLog.info(`Target reached! Collected ${foundListings.length} listings.`);
            }
        },

        failedRequestHandler({ request, log: errorLog }, error) {
            errorLog.error(`Request ${request.url} failed multiple times`, { error });
        },

        requestHandlerTimeoutSecs: 120,
        maxRequestRetries: 3,
    });
}

/**
 * Find the URL for the next page of search results
 * @param {Object} page - Playwright page instance
 * @param {Object} requestLog - Logger instance
 * @returns {Promise<string|null>} Next page URL or null
 */
async function findNextPageUrl(page, requestLog) {
    let nextUrl = null;
    
    // Method 1: Look for aria-label="Next"
    const nextButton = await page.$('[aria-label="Next"]');
    if (nextButton) {
        const isDisabled = await nextButton.evaluate(el => 
            el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
        );
        if (!isDisabled) {
            nextUrl = await nextButton.getAttribute('href');
            requestLog.info(`Found next page using aria-label="Next"`);
        } else {
            requestLog.info(`Next button found but is disabled`);
        }
    }
    
    // Method 2: Look for pagination nav with "Next" text
    if (!nextUrl) {
        const nextLink = await page.$('nav a:has-text("Next")');
        if (nextLink) {
            nextUrl = await nextLink.getAttribute('href');
            requestLog.info(`Found next page using nav a:has-text("Next")`);
        }
    }
    
    // Method 3: Look for pagination buttons
    if (!nextUrl) {
        const paginationNext = await page.$('[data-testid="pagination-next-button"]');
        if (paginationNext) {
            nextUrl = await paginationNext.getAttribute('href');
            requestLog.info(`Found next page using pagination-next-button`);
        }
    }
    
    // Method 4: Try clicking next button directly
    if (!nextUrl) {
        const hasNextButton = await page.evaluate(() => {
            const btn = document.querySelector('[aria-label="Next"]');
            return btn && !btn.hasAttribute('disabled');
        });
        
        if (hasNextButton) {
            requestLog.info(`Attempting to click Next button directly`);
            try {
                await page.click('[aria-label="Next"]');
                await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
                await page.waitForTimeout(2000);
                nextUrl = page.url();
                requestLog.info(`Navigated to: ${nextUrl}`);
            } catch (e) {
                requestLog.error(`Failed to click Next button: ${e.message}`);
            }
        }
    }
    
    return nextUrl;
}

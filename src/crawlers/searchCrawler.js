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
    const crawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: 15,
        
        // Rate limiting to avoid being blocked
        maxConcurrency: 1,
        minConcurrency: 1,
        maxRequestsPerMinute: 10,
        
        headless: true,
        
        // Use in-memory request queue to prevent state conflicts between requests
        useSessionPool: false,
        persistCookiesPerSession: false,
        
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
                await page.waitForTimeout(600);
            }
            
            // Scroll to bottom
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await page.waitForTimeout(1000);

            // Extract listing data from the page
            const listingLinks = await page.$$eval('[itemprop="itemListElement"]', (cards, searchLocation) => {
                const parseBedrooms = (texts) => {
                    for (const text of texts) {
                        const match = text.match(/(\d+(?:\.\d+)?)\s*(bedroom|bedrooms|bed|beds)/i);
                        if (match) {
                            return Number(match[1]);
                        }
                    }
                    return null;
                };

                const parsePriceData = (priceText) => {
                    const normalized = priceText ? priceText.replace(/\s+/g, ' ').trim() : '';
                    const priceMatches = Array.from(normalized.matchAll(/\$([\d,.]+)/g));
                    let totalPrice = null;
                    if (priceMatches.length > 0) {
                        const lastMatch = priceMatches[priceMatches.length - 1][1];
                        totalPrice = Number(lastMatch.replace(/,/g, ''));
                    }

                    let stayLengthNights = null;
                    const stayMatch = normalized.match(/for\s+(\d+)\s+nights?/i);
                    if (stayMatch) {
                        stayLengthNights = Number(stayMatch[1]);
                    }

                    let pricePerNight = null;
                    if (stayLengthNights && totalPrice !== null && stayLengthNights > 0) {
                        pricePerNight = Number((totalPrice / stayLengthNights).toFixed(2));
                    } else {
                        const perNightMatch = normalized.match(/\$([\d,.]+)\s*(?:per\s+night|night)/i);
                        if (perNightMatch) {
                            pricePerNight = Number(perNightMatch[1].replace(/,/g, ''));
                        }
                    }

                    return {
                        rawPriceText: normalized || null,
                        totalPrice,
                        stayLengthNights,
                        pricePerNight
                    };
                };

                return cards
                    .map(card => {
                        const anchor = card.querySelector('a[href*="/rooms/"]');
                        if (!anchor) {
                            return null;
                        }

                        const href = anchor.getAttribute('href') || '';
                        const match = href.match(/\/rooms\/(\d+)/);
                        if (!match) {
                            return null;
                        }

                        const listingId = match[1];
                        const listingUrl = `https://www.airbnb.com/rooms/${listingId}`;

                        const titleEl = card.querySelector('[data-testid="listing-card-title"]');
                        const nameEl = card.querySelector('[data-testid="listing-card-name"]');
                        const subtitleEls = Array.from(card.querySelectorAll('[data-testid="listing-card-subtitle"]'));

                        const title = titleEl?.textContent?.trim() || null;
                        const nameText = nameEl?.textContent?.trim() || null;
                        const subtitleTexts = subtitleEls
                            .map(el => el.textContent?.trim())
                            .filter(text => Boolean(text));

                        const bedrooms = parseBedrooms(subtitleTexts);

                        let description = nameText || null;
                        if (!description) {
                            description = subtitleTexts.find(text => {
                                const lower = text.toLowerCase();
                                const isBedInfo = /(bedroom|bed)/i.test(lower);
                                const isDateRange = /(night|nights|check\sin)/i.test(lower);
                                return !isBedInfo && !isDateRange;
                            }) || null;
                        }

                        const priceRow = card.querySelector('[data-testid="price-availability-row"]');
                        const priceData = parsePriceData(priceRow ? priceRow.textContent || '' : '');

                        const reviewsLabelEl = card.querySelector('[aria-label*="reviews on the listing"]');
                        let reviewsCount = null;
                        if (reviewsLabelEl) {
                            const label = reviewsLabelEl.getAttribute('aria-label') || '';
                            const reviewsMatch = label.match(/(\d+)/);
                            if (reviewsMatch) {
                                reviewsCount = Number(reviewsMatch[1]);
                            }
                        }

                        const ratingLabelEl = card.querySelector('[aria-label*="average rating"]');
                        let overallReviewScore = null;
                        if (ratingLabelEl) {
                            const label = ratingLabelEl.getAttribute('aria-label') || '';
                            const ratingMatch = label.match(/(\d+(?:\.\d+)?)/);
                            if (ratingMatch) {
                                overallReviewScore = Number(ratingMatch[1]);
                            }
                        }

                        return {
                            listingId,
                            listingUrl,
                            location: searchLocation,
                            title,
                            description,
                            bedrooms,
                            pricePerNight: priceData.pricePerNight,
                            stayLengthNights: priceData.stayLengthNights,
                            totalPrice: priceData.totalPrice,
                            rawPriceText: priceData.rawPriceText,
                            reviewsCount,
                            overallReviewScore
                        };
                    })
                    .filter(item => item !== null);
            }, location);

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
    
    return crawler;
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

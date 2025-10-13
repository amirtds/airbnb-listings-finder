/**
 * Controller for scraping listings by location
 */

import { chromium } from 'playwright';
import { getBrowserLaunchOptions } from '../../utils/browserConfig.js';
import { scrapeAmenities } from '../../scrapers/amenities.js';
import { scrapeReviews } from '../../scrapers/reviews.js';
import { scrapeHouseRules } from '../../scrapers/houseRules.js';
import { scrapeHostProfile } from '../../scrapers/hostProfile.js';
import { 
    extractTitle, 
    extractDescription, 
    extractImages, 
    extractHostProfileId,
    extractCoHosts,
    extractPropertyDetails,
    isGuestFavorite,
    isSuperhost,
    extractReviewScore
} from '../../scrapers/listingDetails.js';
import { extractLocation } from '../../scrapers/location.js';
import { extractPricing } from '../../scrapers/pricing.js';
import { randomDelay, fixedDelay } from '../../utils/delays.js';

/**
 * POST /api/scrape/search
 * Scrape Airbnb listings by location
 * 
 * Request body:
 * {
 *   "location": "Miami, FL",
 *   "numberOfListings": 10,
 *   "minDelayBetweenRequests": 500,
 *   "maxDelayBetweenRequests": 1000
 * }
 */
export async function scrapeByLocation(req, res, next) {
    let browser = null;
    
    try {
        const { 
            location, 
            numberOfListings = 10,
            minDelayBetweenRequests = 500,  // Reduced from 3000ms
            maxDelayBetweenRequests = 1000,  // Reduced from 8000ms
            quickMode = false
        } = req.body;

        // Validate input
        if (!location) {
            return res.status(400).json({
                success: false,
                error: 'Location is required',
                example: {
                    location: "Miami, FL",
                    numberOfListings: 10
                }
            });
        }

        if (numberOfListings < 1 || numberOfListings > 100) {
            return res.status(400).json({
                success: false,
                error: 'numberOfListings must be between 1 and 100'
            });
        }

        console.log(`[API] Starting scrape for location: ${location}, count: ${numberOfListings}, quickMode: ${quickMode}`);

        // Launch browser
        const launchOptions = getBrowserLaunchOptions();
        browser = await chromium.launch({
            headless: true,
            ...launchOptions.launchOptions
        });

        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        // Create a simple logger
        const logger = {
            info: (msg) => console.log(`[Search ${location}] ${msg}`),
            warning: (msg) => console.warn(`[Search ${location}] ${msg}`),
            error: (msg) => console.error(`[Search ${location}] ${msg}`)
        };

        // PHASE 1: Collect listing URLs from search results
        logger.info('Phase 1: Collecting listing URLs...');
        const foundListings = await scrapeSearchResults(context, location, numberOfListings, logger);
        logger.info(`Collected ${foundListings.length} listing URLs`);

        // PHASE 2: Scrape detailed data for each listing
        logger.info('Phase 2: Scraping detailed listing data...');
        const detailedListings = [];
        
        for (let i = 0; i < foundListings.length; i++) {
            const listing = foundListings[i];
            logger.info(`Scraping listing ${i + 1}/${foundListings.length}: ${listing.listingId}`);
            
            try {
                const detailedListing = await scrapeListingDetails(
                    context,
                    listing,
                    minDelayBetweenRequests,
                    maxDelayBetweenRequests,
                    quickMode,
                    logger
                );
                detailedListings.push(detailedListing);
            } catch (error) {
                logger.error(`Failed to scrape listing ${listing.listingId}: ${error.message}`);
                // Add partial data with error
                detailedListings.push({
                    listingId: listing.listingId,
                    listingUrl: listing.listingUrl,
                    searchLocation: location,
                    error: error.message
                });
            }
        }

        // Close browser
        await browser.close();
        browser = null;

        logger.info(`Successfully scraped ${detailedListings.length} listings`);

        // Return results
        res.json({
            success: true,
            data: {
                location: location,
                requestedCount: numberOfListings,
                foundCount: detailedListings.length,
                listings: detailedListings
            },
            meta: {
                scrapedAt: new Date().toISOString(),
                processingTime: `${Math.round((Date.now() - req.startTime) / 1000)}s`
            }
        });

    } catch (error) {
        console.error('[API] Error in scrapeByLocation:', error);
        
        // Clean up browser if still open
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error('[API] Error closing browser:', e);
            }
        }
        
        next(error);
    }
}

/**
 * Scrape search results to collect listing URLs
 */
async function scrapeSearchResults(context, location, numberOfListings, logger) {
    const page = await context.newPage();
    const foundListings = [];
    
    try {
        // Override navigator.webdriver
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });

        const searchUrl = `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes`;
        logger.info(`Navigating to ${searchUrl}`);
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('a[href*="/rooms/"]', { timeout: 15000 }).catch(() => {});
        
        // Scroll to load more listings
        logger.info('Scrolling to load listings...');
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await page.waitForTimeout(600);
        }
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);

        // Extract listing URLs
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

        // Remove duplicates
        const uniqueListings = Array.from(
            new Map(listingLinks.map(item => [item.listingId, item])).values()
        );

        logger.info(`Found ${uniqueListings.length} unique listings on first page`);
        foundListings.push(...uniqueListings.slice(0, numberOfListings));

        await page.close();
        return foundListings;
        
    } catch (error) {
        logger.error(`Error scraping search results: ${error.message}`);
        await page.close();
        throw error;
    }
}

/**
 * Scrape detailed data for a single listing
 */
async function scrapeListingDetails(context, listing, minDelay, maxDelay, quickMode, logger) {
    const page = await context.newPage();
    
    try {
        // Override navigator.webdriver
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });

        // Navigate to listing
        await page.goto(listing.listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('h1', { timeout: 5000 }).catch(() => {});
        await fixedDelay(quickMode ? 300 : 500); // Reduced from 500/800ms

        // Extract main listing details
        const title = await extractTitle(page);
        const description = await extractDescription(page, logger);
        const images = await extractImages(page);
        const hostProfileId = await extractHostProfileId(page);
        const coHosts = await extractCoHosts(page);
        const propertyDetails = await extractPropertyDetails(page);
        const guestFavorite = await isGuestFavorite(page);
        const superhost = await isSuperhost(page);
        const locationData = await extractLocation(page);
        const reviewScore = await extractReviewScore(page, listing.listingId);

        // Extract pricing (skip in quick mode)
        let pricing = null;
        if (!quickMode) {
            pricing = await extractPricing(page, listing.listingId);
        }

        // Scrape amenities
        const amenities = await scrapeAmenities(page, listing.listingId, logger, minDelay, maxDelay);

        // Scrape reviews
        const reviews = await scrapeReviews(page, listing.listingId, logger, minDelay, maxDelay, quickMode);

        // Scrape house rules
        const houseRules = await scrapeHouseRules(page, listing.listingId, logger, minDelay, maxDelay);

        // Scrape host profile (skip in quick mode)
        let hostProfile = null;
        if (!quickMode) {
            hostProfile = await scrapeHostProfile(page, hostProfileId, logger, minDelay, maxDelay);
        }

        await page.close();

        // Compile detailed listing data
        return {
            listingId: listing.listingId,
            listingUrl: listing.listingUrl,
            searchLocation: listing.location || locationData?.city || null,
            location: locationData,
            title: title,
            description: description,
            images: images,
            hostProfileId: hostProfileId,
            hostProfile: hostProfile,
            coHosts: coHosts,
            maxGuests: propertyDetails.maxGuests,
            bedrooms: propertyDetails.bedrooms,
            bathrooms: propertyDetails.bathrooms,
            isGuestFavorite: guestFavorite,
            isSuperhost: superhost,
            overallRating: reviewScore?.overallRating || null,
            reviewsCount: reviewScore?.reviewsCount || null,
            pricing: pricing,
            amenities: amenities,
            reviews: reviews,
            houseRules: houseRules
        };
        
    } catch (error) {
        await page.close();
        throw error;
    }
}

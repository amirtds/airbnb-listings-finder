/**
 * Controller for scraping individual listing by ID
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
 * POST /api/scrape/listing
 * Scrape individual Airbnb listing by ID
{{ ... }}
 * Request body:
 * {
 *   "listingId": "12345678",
 *   "minDelayBetweenRequests": 3000,
 *   "maxDelayBetweenRequests": 8000
 * }
 */
export async function scrapeByListingId(req, res, next) {
    let browser = null;
    
    try {
        const { 
            listingId: rawListingId,
            minDelayBetweenRequests = 500,  // Reduced from 3000ms
            maxDelayBetweenRequests = 1000  // Reduced from 8000ms
        } = req.body;

        // Convert listingId to string to handle large numbers
        const listingId = String(rawListingId);

        // Validate input
        if (!listingId || listingId === 'undefined' || listingId === 'null') {
            return res.status(400).json({
                success: false,
                error: 'listingId is required',
                example: {
                    listingId: "12345678"
                }
            });
        }

        console.log(`[API] Starting scrape for listing ID: ${listingId}`);

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

        const page = await context.newPage();

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

        // Create a simple logger
        const logger = {
            info: (msg) => console.log(`[Listing ${listingId}] ${msg}`),
            warning: (msg) => console.warn(`[Listing ${listingId}] ${msg}`),
            error: (msg) => console.error(`[Listing ${listingId}] ${msg}`)
        };

        // Navigate to listing page
        const listingUrl = `https://www.airbnb.com/rooms/${listingId}`;
        logger.info(`Navigating to ${listingUrl}`);
        
        // Navigate with retry logic and fallback strategies
        let navigationSuccess = false;
        let lastError = null;
        
        // Try multiple navigation strategies
        const strategies = [
            { waitUntil: 'domcontentloaded', timeout: 60000, delay: 2000 },
            { waitUntil: 'load', timeout: 60000, delay: 3000 },
            { waitUntil: 'networkidle', timeout: 90000, delay: 2000 }
        ];
        
        for (let i = 0; i < strategies.length && !navigationSuccess; i++) {
            const strategy = strategies[i];
            try {
                logger.info(`Attempting navigation with strategy ${i + 1}/${strategies.length}: waitUntil='${strategy.waitUntil}', timeout=${strategy.timeout}ms`);
                
                await page.goto(listingUrl, { 
                    waitUntil: strategy.waitUntil, 
                    timeout: strategy.timeout 
                });
                
                // Wait for critical content to appear
                await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {
                    logger.warning('Title selector not found, continuing anyway...');
                });
                
                await fixedDelay(strategy.delay);
                navigationSuccess = true;
                logger.info(`✓ Navigation successful with strategy ${i + 1}`);
            } catch (error) {
                lastError = error;
                logger.warning(`Strategy ${i + 1} failed: ${error.message}`);
                
                if (i < strategies.length - 1) {
                    logger.info(`Retrying with next strategy...`);
                    await fixedDelay(2000); // Wait before retry
                }
            }
        }
        
        if (!navigationSuccess) {
            throw new Error(`Failed to navigate to listing after ${strategies.length} attempts. Last error: ${lastError?.message}`);
        }

        // Capture listing page HTML - extract site-content div only
        logger.info('Capturing listing page HTML...');
        const siteContentHtml = await page.evaluate(() => {
            const siteContent = document.getElementById('site-content');
            if (!siteContent) return null;
            
            // Clone the element to avoid modifying the actual DOM
            const clone = siteContent.cloneNode(true);
            
            // Remove all SVG elements
            const svgs = clone.querySelectorAll('svg');
            svgs.forEach(svg => svg.remove());
            
            // Remove all inline style attributes
            const elementsWithStyle = clone.querySelectorAll('[style]');
            elementsWithStyle.forEach(el => el.removeAttribute('style'));
            
            // Remove all class attributes
            const elementsWithClass = clone.querySelectorAll('[class]');
            elementsWithClass.forEach(el => el.removeAttribute('class'));
            
            // Remove all aria-hidden attributes
            const elementsWithAriaHidden = clone.querySelectorAll('[aria-hidden]');
            elementsWithAriaHidden.forEach(el => el.removeAttribute('aria-hidden'));
            
            // Remove all aria-disabled attributes
            const elementsWithAriaDisabled = clone.querySelectorAll('[aria-disabled]');
            elementsWithAriaDisabled.forEach(el => el.removeAttribute('aria-disabled'));
            
            return clone.outerHTML;
        });

        // Extract main listing details
        logger.info('Extracting main details...');
        const title = await extractTitle(page);
        if (!title) {
            logger.warning('Title extraction failed - page may not be fully loaded');
        }
        logger.info(`Title: ${title || 'NOT FOUND'}`);
        
        const description = await extractDescription(page, logger);
        if (!description) {
            logger.warning('Description extraction failed');
        }
        logger.info(`Description: ${description ? description.substring(0, 50) + '...' : 'NOT FOUND'}`);
        
        const images = await extractImages(page);
        if (images.length === 0) {
            logger.warning('No images extracted');
        }
        logger.info(`Images: ${images.length} found`);
        
        const hostProfileId = await extractHostProfileId(page);
        if (!hostProfileId) {
            logger.warning('Host Profile ID extraction failed');
        }
        logger.info(`Host Profile ID: ${hostProfileId || 'NOT FOUND'}`);
        
        const coHosts = await extractCoHosts(page);
        if (coHosts.length === 0) {
            logger.warning('No co-hosts found');
        } else {
            logger.info(`Found ${coHosts.length} co-host(s)`);
        }
        
        const propertyDetails = await extractPropertyDetails(page);
        logger.info(`Property: ${propertyDetails.maxGuests || '?'} guests, ${propertyDetails.bedrooms || '?'} bedrooms, ${propertyDetails.bathrooms || '?'} bathrooms`);
        
        const guestFavorite = await isGuestFavorite(page);
        const superhost = await isSuperhost(page);

        // Extract location information
        logger.info('Extracting location...');
        const location = await extractLocation(page);
        
        // Extract pricing information
        logger.info('Extracting pricing...');
        const pricing = await extractPricing(page, listingId);
        
        // Extract review scores
        logger.info('Extracting review scores...');
        const reviewScore = await extractReviewScore(page, listingId);

        // Scrape amenities
        logger.info('Scraping amenities...');
        const amenities = await scrapeAmenities(
            page,
            listingId,
            logger,
            minDelayBetweenRequests,
            maxDelayBetweenRequests
        );

        // Scrape reviews
        logger.info('Scraping reviews...');
        const reviews = await scrapeReviews(
            page,
            listingId,
            logger,
            minDelayBetweenRequests,
            maxDelayBetweenRequests
        );
        
        // Capture review modal HTML - extract dialog only
        let reviewsModalHtml = null;
        if (reviews && reviews.reviews) {
            reviewsModalHtml = await page.evaluate(() => {
                const dialog = document.querySelector('[role="dialog"]');
                return dialog ? dialog.outerHTML : null;
            });
        }

        // Scrape house rules
        logger.info('Scraping house rules...');
        const houseRules = await scrapeHouseRules(
            page,
            listingId,
            logger,
            minDelayBetweenRequests,
            maxDelayBetweenRequests
        );

        // Scrape host profile
        logger.info('Scraping host profile...');
        const hostProfile = await scrapeHostProfile(
            page,
            hostProfileId,
            logger,
            minDelayBetweenRequests,
            maxDelayBetweenRequests
        );

        // Close browser
        await browser.close();
        browser = null;

        // Compile detailed listing data
        const detailedListing = {
            listingId: listingId,
            listingUrl: listingUrl,
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
            location: location,
            pricing: pricing,
            reviewScore: reviewScore,
            amenities: amenities,
            reviews: reviews.reviews, // Extract reviews from the new structure
            houseRules: houseRules,
            htmlSnapshots: {
                siteContent: siteContentHtml,
                reviewsModal: reviewsModalHtml
            }
        };

        logger.info('Scraping completed successfully');

        // Return results
        res.json({
            success: true,
            data: detailedListing,
            meta: {
                scrapedAt: new Date().toISOString(),
                processingTime: `${Math.round((Date.now() - req.startTime) / 1000)}s`
            }
        });

    } catch (error) {
        console.error('[API] Error in scrapeByListingId:', error);
        
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
 * POST /api/scrape/listing/snapshot
 * Scrape site content snapshot for Airbnb listing
 * Returns: HTML snapshot, reviews, rules, images, and amenities only
 * 
 * Request body:
 * {
 *   "listingId": "12345678",
 *   "minDelayBetweenRequests": 3000,
 *   "maxDelayBetweenRequests": 8000
 * }
 */
export async function scrapeSiteContentSnapshot(req, res, next) {
    let browser = null;
    
    try {
        const { 
            listingId: rawListingId,
            minDelayBetweenRequests = 500,
            maxDelayBetweenRequests = 1000
        } = req.body;

        // Convert listingId to string to handle large numbers
        const listingId = String(rawListingId);

        // Validate input
        if (!listingId || listingId === 'undefined' || listingId === 'null') {
            return res.status(400).json({
                success: false,
                error: 'listingId is required',
                example: {
                    listingId: "12345678"
                }
            });
        }

        console.log(`[API] Starting site content snapshot scrape for listing ID: ${listingId}`);

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

        const page = await context.newPage();

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

        // Create a simple logger
        const logger = {
            info: (msg) => console.log(`[Snapshot ${listingId}] ${msg}`),
            warning: (msg) => console.warn(`[Snapshot ${listingId}] ${msg}`),
            error: (msg) => console.error(`[Snapshot ${listingId}] ${msg}`)
        };

        // Navigate to listing page
        const listingUrl = `https://www.airbnb.com/rooms/${listingId}`;
        logger.info(`Navigating to ${listingUrl}`);
        
        // Navigate with retry logic and fallback strategies
        let navigationSuccess = false;
        let lastError = null;
        
        const strategies = [
            { waitUntil: 'domcontentloaded', timeout: 60000, delay: 2000 },
            { waitUntil: 'load', timeout: 60000, delay: 3000 },
            { waitUntil: 'networkidle', timeout: 90000, delay: 2000 }
        ];
        
        for (let i = 0; i < strategies.length && !navigationSuccess; i++) {
            const strategy = strategies[i];
            try {
                logger.info(`Attempting navigation with strategy ${i + 1}/${strategies.length}: waitUntil='${strategy.waitUntil}', timeout=${strategy.timeout}ms`);
                
                await page.goto(listingUrl, { 
                    waitUntil: strategy.waitUntil, 
                    timeout: strategy.timeout 
                });
                
                // Wait for critical content to appear
                await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {
                    logger.warning('Title selector not found, continuing anyway...');
                });
                
                await fixedDelay(strategy.delay);
                navigationSuccess = true;
                logger.info(`✓ Navigation successful with strategy ${i + 1}`);
            } catch (error) {
                lastError = error;
                logger.warning(`Strategy ${i + 1} failed: ${error.message}`);
                
                if (i < strategies.length - 1) {
                    logger.info(`Retrying with next strategy...`);
                    await fixedDelay(2000);
                }
            }
        }
        
        if (!navigationSuccess) {
            throw new Error(`Failed to navigate to listing after ${strategies.length} attempts. Last error: ${lastError?.message}`);
        }

        // Capture listing page HTML - extract site-content div only
        logger.info('Capturing site content HTML...');
        const siteContentHtml = await page.evaluate(() => {
            const siteContent = document.getElementById('site-content');
            if (!siteContent) return null;
            
            // Clone the element to avoid modifying the actual DOM
            const clone = siteContent.cloneNode(true);
            
            // Remove all SVG elements
            const svgs = clone.querySelectorAll('svg');
            svgs.forEach(svg => svg.remove());
            
            // Remove all inline style attributes
            const elementsWithStyle = clone.querySelectorAll('[style]');
            elementsWithStyle.forEach(el => el.removeAttribute('style'));
            
            // Remove all class attributes
            const elementsWithClass = clone.querySelectorAll('[class]');
            elementsWithClass.forEach(el => el.removeAttribute('class'));
            
            // Remove all aria-hidden attributes
            const elementsWithAriaHidden = clone.querySelectorAll('[aria-hidden]');
            elementsWithAriaHidden.forEach(el => el.removeAttribute('aria-hidden'));
            
            // Remove all aria-disabled attributes
            const elementsWithAriaDisabled = clone.querySelectorAll('[aria-disabled]');
            elementsWithAriaDisabled.forEach(el => el.removeAttribute('aria-disabled'));
            
            return clone.outerHTML;
        });

        // Extract images
        logger.info('Extracting images...');
        const images = await extractImages(page);
        logger.info(`Images: ${images.length} found`);

        // Scrape amenities
        logger.info('Scraping amenities...');
        const amenities = await scrapeAmenities(
            page,
            listingId,
            logger,
            minDelayBetweenRequests,
            maxDelayBetweenRequests
        );

        // Scrape reviews
        logger.info('Scraping reviews...');
        const reviews = await scrapeReviews(
            page,
            listingId,
            logger,
            minDelayBetweenRequests,
            maxDelayBetweenRequests
        );

        // Scrape house rules
        logger.info('Scraping house rules...');
        const houseRules = await scrapeHouseRules(
            page,
            listingId,
            logger,
            minDelayBetweenRequests,
            maxDelayBetweenRequests
        );

        // Close browser
        await browser.close();
        browser = null;

        // Compile site content snapshot data
        const siteContentSnapshot = {
            listingId: listingId,
            listingUrl: listingUrl,
            htmlSnapshot: siteContentHtml,
            images: images,
            amenities: amenities,
            reviews: reviews.reviews,
            rules: houseRules
        };

        logger.info('Site content snapshot scraping completed successfully');

        // Return results
        res.json({
            success: true,
            data: siteContentSnapshot,
            meta: {
                scrapedAt: new Date().toISOString(),
                processingTime: `${Math.round((Date.now() - req.startTime) / 1000)}s`
            }
        });

    } catch (error) {
        console.error('[API] Error in scrapeSiteContentSnapshot:', error);
        
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

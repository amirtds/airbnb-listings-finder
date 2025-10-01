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
            minDelayBetweenRequests = 3000,
            maxDelayBetweenRequests = 8000
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
        
        // Fast navigation - no delays for individual listing endpoint
        await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await fixedDelay(2000); // Minimal wait for page to stabilize

        // Extract main listing details
        logger.info('Extracting main details...');
        const title = await extractTitle(page);
        logger.info(`Title: ${title || 'NOT FOUND'}`);
        
        const description = await extractDescription(page, logger);
        logger.info(`Description: ${description ? description.substring(0, 50) + '...' : 'NOT FOUND'}`);
        
        const images = await extractImages(page);
        logger.info(`Images: ${images.length} found`);
        
        const hostProfileId = await extractHostProfileId(page);
        logger.info(`Host Profile ID: ${hostProfileId || 'NOT FOUND'}`);
        
        const coHosts = await extractCoHosts(page);
        const propertyDetails = await extractPropertyDetails(page);
        logger.info(`Property: ${propertyDetails.maxGuests || '?'} guests, ${propertyDetails.bedrooms || '?'} bedrooms, ${propertyDetails.bathrooms || '?'} bathrooms`);
        
        const guestFavorite = await isGuestFavorite(page);
        const superhost = await isSuperhost(page);

        // Extract location information
        logger.info('Extracting location...');
        const location = await extractLocation(page);
        
        // Extract pricing information
        logger.info('Extracting pricing...');
        const pricing = await extractPricing(page);
        
        // Extract review scores
        logger.info('Extracting review scores...');
        const reviewScore = await extractReviewScore(page);

        // Scrape amenities (no delays for faster scraping)
        logger.info('Scraping amenities...');
        const amenities = await scrapeAmenities(
            page,
            listingId,
            logger,
            500,  // Minimal delay
            1000  // Minimal delay
        );

        // Scrape reviews (no delays for faster scraping)
        logger.info('Scraping reviews...');
        const reviews = await scrapeReviews(
            page,
            listingId,
            logger,
            500,  // Minimal delay
            1000  // Minimal delay
        );

        // Scrape house rules (no delays for faster scraping)
        logger.info('Scraping house rules...');
        const houseRules = await scrapeHouseRules(
            page,
            listingId,
            logger,
            500,  // Minimal delay
            1000  // Minimal delay
        );

        // Scrape host profile (no delays for faster scraping)
        logger.info('Scraping host profile...');
        const hostProfile = await scrapeHostProfile(
            page,
            hostProfileId,
            logger,
            500,  // Minimal delay
            1000  // Minimal delay
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
            reviews: reviews,
            houseRules: houseRules
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

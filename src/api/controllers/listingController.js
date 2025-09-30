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
    isSuperhost
} from '../../scrapers/listingDetails.js';
import { randomDelay, fixedDelay } from '../../utils/delays.js';

/**
 * POST /api/scrape/listing
 * Scrape individual Airbnb listing by ID
 * 
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
        
        await randomDelay(minDelayBetweenRequests, maxDelayBetweenRequests, logger);
        await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await fixedDelay(3000);

        // Extract main listing details
        logger.info('Extracting main details...');
        const title = await extractTitle(page);
        const description = await extractDescription(page, logger);
        const images = await extractImages(page);
        const hostProfileId = await extractHostProfileId(page);
        const coHosts = await extractCoHosts(page);
        const propertyDetails = await extractPropertyDetails(page);
        const guestFavorite = await isGuestFavorite(page);
        const superhost = await isSuperhost(page);

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

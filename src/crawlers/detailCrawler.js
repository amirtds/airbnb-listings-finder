/**
 * Detail crawler for scraping full listing information
 */

import { PlaywrightCrawler } from 'crawlee';
import { getBrowserLaunchOptions, getPreNavigationHooks } from '../utils/browserConfig.js';
import { randomDelay, fixedDelay } from '../utils/delays.js';
import { scrapeAmenities } from '../scrapers/amenities.js';
import { scrapeReviews } from '../scrapers/reviews.js';
import { scrapeHouseRules } from '../scrapers/houseRules.js';
import { scrapeHostProfile } from '../scrapers/hostProfile.js';
import {
    extractTitle,
    extractDescription,
    extractImages,
    extractHostProfileId,
    extractCoHosts,
    extractPropertyDetails,
    isGuestFavorite,
    isSuperhost
} from '../scrapers/listingDetails.js';

/**
 * Create and configure the detail crawler
 * @param {Array} detailedListings - Array to store detailed listings
 * @param {number} numberOfListings - Target number of listings
 * @param {number} minDelayBetweenRequests - Minimum delay in ms
 * @param {number} maxDelayBetweenRequests - Maximum delay in ms
 * @returns {PlaywrightCrawler} Configured crawler instance
 */
export function createDetailCrawler(
    detailedListings,
    numberOfListings,
    minDelayBetweenRequests,
    maxDelayBetweenRequests
) {
    return new PlaywrightCrawler({
        // Set high limit to avoid premature shutdown
        maxRequestsPerCrawl: Math.max(numberOfListings * 10, 100),
        headless: true,
        
        // Rate limiting for detail pages
        maxConcurrency: 1,
        minConcurrency: 1,
        maxRequestsPerMinute: 8,
        
        launchContext: getBrowserLaunchOptions(),
        preNavigationHooks: getPreNavigationHooks(),
        
        async requestHandler({ request, page, log: requestLog }) {
            const listingId = request.userData.listingId;
            requestLog.info(`Scraping details for listing ${listingId}: ${request.url}`);
            
            try {
                // Random delay to appear more human-like
                await randomDelay(minDelayBetweenRequests, maxDelayBetweenRequests, requestLog);
                
                // Wait for page to load
                await page.waitForLoadState('domcontentloaded');
                await fixedDelay(3000);
                
                // Extract main listing details
                requestLog.info(`Extracting main details for listing ${listingId}`);
                const title = await extractTitle(page);
                const description = await extractDescription(page, requestLog);
                const images = await extractImages(page);
                const hostProfileId = await extractHostProfileId(page);
                const coHosts = await extractCoHosts(page);
                const propertyDetails = await extractPropertyDetails(page);
                const guestFavorite = await isGuestFavorite(page);
                const superhost = await isSuperhost(page);
                
                // Scrape amenities
                requestLog.info(`Scraping amenities for listing ${listingId}`);
                const amenities = await scrapeAmenities(
                    page,
                    listingId,
                    requestLog,
                    minDelayBetweenRequests,
                    maxDelayBetweenRequests
                );
                
                // Scrape reviews
                requestLog.info(`Scraping reviews for listing ${listingId}`);
                const reviews = await scrapeReviews(
                    page,
                    listingId,
                    requestLog,
                    minDelayBetweenRequests,
                    maxDelayBetweenRequests
                );
                
                // Scrape house rules
                requestLog.info(`Scraping house rules for listing ${listingId}`);
                const houseRules = await scrapeHouseRules(
                    page,
                    listingId,
                    requestLog,
                    minDelayBetweenRequests,
                    maxDelayBetweenRequests
                );
                
                // Scrape host profile
                requestLog.info(`Scraping host profile for listing ${listingId}`);
                const hostProfile = await scrapeHostProfile(
                    page,
                    hostProfileId,
                    requestLog,
                    minDelayBetweenRequests,
                    maxDelayBetweenRequests
                );
                
                // Compile detailed listing data
                const detailedListing = {
                    listingId: listingId,
                    listingUrl: request.url,
                    location: request.userData.location,
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
                
                detailedListings.push(detailedListing);
                requestLog.info(`✓ Successfully scraped listing ${listingId} (${detailedListings.length}/${numberOfListings})`);
                
            } catch (error) {
                requestLog.error(`Failed to scrape listing ${listingId}:`, error.message);
                // Add partial data
                detailedListings.push({
                    listingId: listingId,
                    listingUrl: request.url,
                    location: request.userData.location,
                    error: error.message
                });
            }
        },
        
        failedRequestHandler({ request, log: errorLog }, error) {
            errorLog.error(`Request ${request.url} failed:`, error);
        },
        
        requestHandlerTimeoutSecs: 180,
        maxRequestRetries: 2,
    });
}

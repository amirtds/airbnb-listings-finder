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
    maxDelayBetweenRequests,
    quickMode = false
) {
    // Increase concurrency for faster processing
    // Conservative concurrency to prevent resource exhaustion
    const concurrency = quickMode ? 3 : 2;
    
    return new PlaywrightCrawler({
        // Set high limit to avoid premature shutdown
        maxRequestsPerCrawl: Math.max(numberOfListings * 10, 100),
        headless: true,
        
        // Increased concurrency for parallel processing
        maxConcurrency: concurrency,
        minConcurrency: 1,
        maxRequestsPerMinute: quickMode ? 20 : 12,
        
        // CRITICAL: Ensure browsers are closed after each page
        browserPoolOptions: {
            closeInactiveBrowserAfterSecs: 30,
            operationTimeoutSecs: 60,
        },
        
        launchContext: getBrowserLaunchOptions(),
        preNavigationHooks: getPreNavigationHooks(),
        
        async requestHandler({ request, page, log: requestLog }) {
            const listingId = request.userData.listingId;
            const quickModeEnabled = request.userData.quickMode || quickMode;
            requestLog.info(`Scraping details for listing ${listingId}: ${request.url}`);
            
            try {
                // Reduced delay for faster processing
                const minDelay = quickModeEnabled ? 500 : Math.min(minDelayBetweenRequests, 2000);
                const maxDelay = quickModeEnabled ? 1000 : Math.min(maxDelayBetweenRequests, 3000);
                await randomDelay(minDelay, maxDelay, requestLog);
                
                // Wait for page to load with reduced timeout
                await page.waitForLoadState('domcontentloaded');
                await fixedDelay(quickModeEnabled ? 1000 : 2000);
                
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
                
                // Scrape amenities with optimized delays
                requestLog.info(`Scraping amenities for listing ${listingId}`);
                const amenities = await scrapeAmenities(
                    page,
                    listingId,
                    requestLog,
                    minDelay,
                    maxDelay
                );
                
                // Scrape reviews with optimized delays (quick mode skips multiple categories)
                requestLog.info(`Scraping reviews for listing ${listingId}`);
                const reviews = await scrapeReviews(
                    page,
                    listingId,
                    requestLog,
                    minDelay,
                    maxDelay,
                    quickModeEnabled
                );
                
                // Scrape house rules with optimized delays
                requestLog.info(`Scraping house rules for listing ${listingId}`);
                const houseRules = await scrapeHouseRules(
                    page,
                    listingId,
                    requestLog,
                    minDelay,
                    maxDelay
                );
                
                // Scrape host profile with optimized delays (skip in quick mode)
                let hostProfile = null;
                if (!quickModeEnabled) {
                    requestLog.info(`Scraping host profile for listing ${listingId}`);
                    hostProfile = await scrapeHostProfile(
                        page,
                        hostProfileId,
                        requestLog,
                        minDelay,
                        maxDelay
                    );
                } else {
                    requestLog.info(`Skipping host profile in quick mode for listing ${listingId}`);
                }
                
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
        
        // Ensure proper cleanup on crawler shutdown
        autoscaledPoolOptions: {
            maxConcurrency: concurrency,
        },
    });
}

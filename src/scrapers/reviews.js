/**
 * Scraper for Airbnb listing reviews
 */

import { randomDelay, fixedDelay } from '../utils/delays.js';

/**
 * Scrape reviews from a listing
 * @param {Object} page - Playwright page instance
 * @param {string} listingId - Listing ID
 * @param {Object} requestLog - Logger instance
 * @param {number} minDelay - Minimum delay between requests
 * @param {number} maxDelay - Maximum delay between requests
 * @returns {Promise<Array>} Array of reviews
 */
export async function scrapeReviews(page, listingId, requestLog, minDelay, maxDelay) {
    try {
        // Add random delay before navigating to reviews
        await randomDelay(minDelay, maxDelay, requestLog);
        
        const reviewsUrl = `https://www.airbnb.com/rooms/${listingId}/reviews`;
        await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await fixedDelay(3000);
        
        // Scroll to bottom of modal to load all reviews
        await page.evaluate(async () => {
            const scrollableDiv = document.querySelector('[data-testid="pdp-reviews-modal-scrollable-panel"]');
            if (scrollableDiv) {
                for (let i = 0; i < 5; i++) {
                    scrollableDiv.scrollTo(0, scrollableDiv.scrollHeight);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        });
        
        // Extract reviews
        const reviews = await page.evaluate(() => {
            const reviewElements = document.querySelectorAll('[data-review-id]');
            const result = [];
            
            reviewElements.forEach(reviewEl => {
                const reviewId = reviewEl.getAttribute('data-review-id');
                
                // Extract reviewer name
                const nameEl = reviewEl.querySelector('h2');
                const name = nameEl ? nameEl.textContent.trim() : null;
                
                // Extract review text
                const textEl = reviewEl.querySelector('.r1bcsqqd');
                const text = textEl ? textEl.textContent.trim() : null;
                
                // Extract review score (count stars)
                const starsContainer = reviewEl.querySelector('.c5dn5hn');
                let score = 0;
                if (starsContainer) {
                    const stars = starsContainer.querySelectorAll('svg');
                    score = stars.length;
                }
                
                // Extract reviewer location (city, country)
                const locationEl = reviewEl.querySelector('.s15w4qkt');
                let city = null;
                let country = null;
                if (locationEl) {
                    const locationText = locationEl.textContent.trim();
                    const parts = locationText.split(',').map(p => p.trim());
                    if (parts.length >= 2) {
                        city = parts[0];
                        country = parts[1];
                    } else if (parts.length === 1) {
                        country = parts[0];
                    }
                }
                
                // Extract review date
                const dateEl = reviewEl.querySelector('.s78n3tv');
                const date = dateEl ? dateEl.textContent.trim() : null;
                
                if (name) {
                    result.push({
                        reviewId: reviewId,
                        name: name,
                        text: text,
                        score: score,
                        reviewDetails: {
                            city: city,
                            country: country,
                            date: date
                        }
                    });
                }
            });
            
            return result;
        });
        
        requestLog.info(`Found ${reviews.length} reviews`);
        return reviews;
    } catch (error) {
        requestLog.error(`Failed to scrape reviews: ${error.message}`);
        return [];
    }
}

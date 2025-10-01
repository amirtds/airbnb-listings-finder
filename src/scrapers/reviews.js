/**
 * Scraper for Airbnb listing reviews
 */

import { randomDelay, fixedDelay } from '../utils/delays.js';

/**
 * Extract reviews from the current page state
 * @param {Object} page - Playwright page instance
 * @returns {Promise<Array>} Array of reviews
 */
async function extractReviewsFromPage(page) {
    return await page.evaluate(() => {
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
}

/**
 * Scrape reviews from a listing by category (most relevant, most recent, highest rated, lowest rated)
 * @param {Object} page - Playwright page instance
 * @param {string} listingId - Listing ID
 * @param {Object} requestLog - Logger instance
 * @param {number} minDelay - Minimum delay between requests
 * @param {number} maxDelay - Maximum delay between requests
 * @returns {Promise<Object>} Object with reviews categorized by sort type and HTML snapshots
 */
export async function scrapeReviews(page, listingId, requestLog, minDelay, maxDelay) {
    try {
        // Add random delay before navigating to reviews
        await randomDelay(minDelay, maxDelay, requestLog);
        
        const reviewsUrl = `https://www.airbnb.com/rooms/${listingId}/reviews`;
        await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await fixedDelay(3000);
        
        // Capture reviews modal HTML
        const reviewsModalHtml = await page.content();
        
        const reviewsByCategory = {
            mostRelevant: [],
            mostRecent: [],
            highestRated: [],
            lowestRated: []
        };
        
        // Define sort options to iterate through
        const sortOptions = [
            { key: 'mostRelevant', label: 'Most relevant', value: 'BEST_QUALITY' },
            { key: 'mostRecent', label: 'Most recent', value: 'RECENT' },
            { key: 'highestRated', label: 'Highest rated', value: 'HIGHEST_RATING' },
            { key: 'lowestRated', label: 'Lowest rated', value: 'LOWEST_RATING' }
        ];
        
        for (const sortOption of sortOptions) {
            try {
                requestLog.info(`Scraping ${sortOption.label} reviews...`);
                
                // Click the sort selector button
                const sortButton = await page.$('#reviews-sort-selector_selector-toggle-button');
                if (!sortButton) {
                    requestLog.warning('Sort selector button not found');
                    continue;
                }
                
                await sortButton.click();
                await fixedDelay(1000);
                
                // Find and click the option in the dropdown
                const optionClicked = await page.evaluate((optionLabel) => {
                    // Look for the listbox that appears
                    const listbox = document.querySelector('[role="listbox"]');
                    if (!listbox) return false;
                    
                    // Find all options
                    const options = listbox.querySelectorAll('[role="option"]');
                    for (const option of options) {
                        const text = option.textContent.trim();
                        if (text.toLowerCase().includes(optionLabel.toLowerCase())) {
                            option.click();
                            return true;
                        }
                    }
                    return false;
                }, sortOption.label);
                
                if (!optionClicked) {
                    requestLog.warning(`Could not find option: ${sortOption.label}`);
                    // Close the dropdown by clicking button again
                    await sortButton.click();
                    await fixedDelay(500);
                    continue;
                }
                
                // Wait for reviews to reload
                await fixedDelay(2000);
                
                // Scroll to load more reviews in this category
                await page.evaluate(async () => {
                    const scrollableDiv = document.querySelector('[data-testid="pdp-reviews-modal-scrollable-panel"]');
                    if (scrollableDiv) {
                        for (let i = 0; i < 5; i++) {
                            scrollableDiv.scrollTo(0, scrollableDiv.scrollHeight);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                });
                
                // Extract reviews for this category
                const reviews = await extractReviewsFromPage(page);
                
                // Deduplicate reviews by reviewId
                const uniqueReviews = [];
                const seenIds = new Set();
                
                for (const review of reviews) {
                    if (!seenIds.has(review.reviewId)) {
                        seenIds.add(review.reviewId);
                        uniqueReviews.push(review);
                    }
                }
                
                reviewsByCategory[sortOption.key] = uniqueReviews;
                
                requestLog.info(`Found ${uniqueReviews.length} unique ${sortOption.label} reviews (${reviews.length - uniqueReviews.length} duplicates removed)`);
                
                // Small delay before next category
                await fixedDelay(1000);
                
            } catch (categoryError) {
                requestLog.error(`Error scraping ${sortOption.label} reviews: ${categoryError.message}`);
            }
        }
        
        const totalReviews = Object.values(reviewsByCategory).reduce((sum, arr) => sum + arr.length, 0);
        requestLog.info(`Total reviews scraped across all categories: ${totalReviews}`);
        
        return {
            reviews: reviewsByCategory,
            htmlSnapshots: {
                reviewsModalHtml: reviewsModalHtml
            }
        };
    } catch (error) {
        requestLog.error(`Failed to scrape reviews: ${error.message}`);
        return {
            reviews: {
                mostRelevant: [],
                mostRecent: [],
                highestRated: [],
                lowestRated: []
            },
            htmlSnapshots: {
                reviewsModalHtml: null
            }
        };
    }
}

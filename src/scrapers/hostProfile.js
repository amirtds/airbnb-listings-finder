/**
 * Scraper for Airbnb host profile
 */

import { randomDelay, fixedDelay } from '../utils/delays.js';

/**
 * Scrape host profile data
 * @param {Object} page - Playwright page instance
 * @param {string} hostProfileId - Host profile ID
 * @param {Object} requestLog - Logger instance
 * @param {number} minDelay - Minimum delay between requests
 * @param {number} maxDelay - Maximum delay between requests
 * @returns {Promise<Object|null>} Host profile data
 */
export async function scrapeHostProfile(page, hostProfileId, requestLog, minDelay, maxDelay) {
    try {
        if (!hostProfileId) {
            return null;
        }
        
        // Navigate to host profile page
        const hostUrl = `https://www.airbnb.com/users/show/${hostProfileId}`;
        await page.goto(hostUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await fixedDelay(600); // Reduced from 3000ms
        
        // Extract host profile data
        const hostData = await page.evaluate(() => {
            const result = {
                name: '',
                isSuperhost: false,
                isIdentityVerified: false,
                reviewsCount: 0,
                rating: 0,
                yearsHosting: 0,
                work: '',
                uniqueHome: '',
                languages: [],
                location: '',
                about: '',
                listings: []
            };
            
            // Extract name
            const nameEl = document.querySelector('h2[tabindex="-1"]');
            if (nameEl) {
                result.name = nameEl.textContent.trim();
            }
            
            // Check if Superhost
            const superhostEl = document.querySelector('span:has(svg) span');
            if (superhostEl && superhostEl.textContent.includes('Superhost')) {
                result.isSuperhost = true;
            }
            
            // Check if identity verified
            const verifiedEl = document.querySelector('svg[aria-label*="Identity verified"]');
            if (verifiedEl) {
                result.isIdentityVerified = true;
            }
            
            // Extract stats (reviews, rating, years hosting)
            const statsEls = document.querySelectorAll('[data-testid$="-stat-heading"]');
            statsEls.forEach(el => {
                const testId = el.getAttribute('data-testid');
                const value = el.textContent.trim();
                
                if (testId.includes('Reviews')) {
                    result.reviewsCount = parseInt(value) || 0;
                } else if (testId.includes('Rating')) {
                    result.rating = parseFloat(value) || 0;
                } else if (testId.includes('Years')) {
                    result.yearsHosting = parseInt(value) || 0;
                }
            });
            
            // Extract profile details
            const detailItems = document.querySelectorAll('li .rx7n8c4');
            detailItems.forEach(item => {
                const text = item.textContent.trim();
                
                if (text.includes('My work:')) {
                    result.work = text.replace('My work:', '').trim();
                } else if (text.includes('What makes my home unique:')) {
                    result.uniqueHome = text.replace('What makes my home unique:', '').trim();
                } else if (text.includes('Speaks')) {
                    const langText = text.replace('Speaks', '').trim();
                    result.languages = langText.split(' and ').map(l => l.trim());
                } else if (text.includes('Lives in')) {
                    result.location = text.replace('Lives in', '').trim();
                }
            });
            
            // Extract about section
            const aboutEl = document.querySelector('._1e2prbn');
            if (aboutEl) {
                result.about = aboutEl.textContent.trim();
            }
            
            // Extract listings
            const listingCards = document.querySelectorAll('[data-testid="listing-card-title"]');
            listingCards.forEach(card => {
                const listingContainer = card.closest('.c3184sb');
                if (listingContainer) {
                    const titleEl = listingContainer.querySelector('[data-testid="listing-card-title"]');
                    const subtitleEl = listingContainer.querySelector('.sxmrbbg');
                    const ratingEl = listingContainer.querySelector('.s1sd7v66');
                    const linkEl = listingContainer.querySelector('a[href^="/rooms/"]');
                    
                    const listing = {
                        title: titleEl ? titleEl.textContent.trim() : '',
                        subtitle: subtitleEl ? subtitleEl.textContent.trim() : '',
                        rating: 0,
                        reviewsCount: 0,
                        url: ''
                    };
                    
                    // Extract rating and reviews count
                    if (ratingEl) {
                        const ratingText = ratingEl.textContent.trim();
                        const ratingMatch = ratingText.match(/(\d+\.\d+)/);
                        const reviewsMatch = ratingText.match(/(\d+)\s+reviews?/);
                        
                        if (ratingMatch) {
                            listing.rating = parseFloat(ratingMatch[1]);
                        }
                        if (reviewsMatch) {
                            listing.reviewsCount = parseInt(reviewsMatch[1]);
                        }
                    }
                    
                    // Extract URL
                    if (linkEl) {
                        const href = linkEl.getAttribute('href');
                        if (href) {
                            listing.url = 'https://www.airbnb.com' + href.split('?')[0];
                        }
                    }
                    
                    result.listings.push(listing);
                }
            });
            
            return result;
        });
        
        requestLog.info(`Scraped host profile for ${hostProfileId}`);
        return hostData;
    } catch (error) {
        requestLog.error(`Failed to scrape host profile: ${error.message}`);
        return null;
    }
}

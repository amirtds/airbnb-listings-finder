/**
 * Scraper for main listing details (title, description, images, etc.)
 */

import { fixedDelay } from '../utils/delays.js';

/**
 * Extract listing title
 * @param {Object} page - Playwright page instance
 * @returns {Promise<string|null>} Listing title
 */
export async function extractTitle(page) {
    try {
        // Method 1: Try standard h1
        const h1Title = await page.$eval('h1', el => el.textContent.trim()).catch(() => null);
        if (h1Title) return h1Title;
        
        // Method 2: Try data-section-id TITLE
        const titleSection = await page.evaluate(() => {
            const section = document.querySelector('[data-section-id*="TITLE"]');
            if (section) {
                const h1 = section.querySelector('h1');
                if (h1) return h1.textContent.trim();
            }
            return null;
        });
        if (titleSection) return titleSection;
        
        // Method 3: Try any h1 with specific class patterns
        const classTitle = await page.evaluate(() => {
            const h1s = document.querySelectorAll('h1');
            for (const h1 of h1s) {
                const text = h1.textContent.trim();
                // Skip empty or very short titles
                if (text && text.length > 3) {
                    return text;
                }
            }
            return null;
        });
        if (classTitle) return classTitle;
        
        console.log('[Title] Could not extract title - trying all h1 elements');
        return null;
    } catch (error) {
        console.error(`[Title] Error extracting title: ${error.message}`);
        return null;
    }
}

/**
 * Extract listing description
 * @param {Object} page - Playwright page instance
 * @param {Object} requestLog - Logger instance
 * @returns {Promise<string|null>} Listing description
 */
export async function extractDescription(page, requestLog) {
    let description = null;
    
    try {
        const descSection = await page.$('[data-section-id="DESCRIPTION_DEFAULT"]');
        if (descSection) {
            const showMoreBtn = await descSection.$('button');
            if (showMoreBtn) {
                const btnText = await showMoreBtn.textContent();
                if (btnText && btnText.includes('Show more')) {
                    // Scroll button into view and click
                    await showMoreBtn.scrollIntoViewIfNeeded();
                    await fixedDelay(300);
                    await showMoreBtn.click({ timeout: 5000 }).catch(() => {});
                    await fixedDelay(800); // Increased wait for modal to load
                    
                    // Extract from modal
                    description = await page.evaluate(() => {
                        const modal = document.querySelector('[data-section-id="DESCRIPTION_MODAL"]');
                        if (modal) {
                            const sections = modal.querySelectorAll('section');
                            const parts = [];
                            sections.forEach(section => {
                                const heading = section.querySelector('h1, h2');
                                const content = section.querySelector('.l1h825yc');
                                if (heading && content) {
                                    parts.push(`${heading.textContent.trim()}: ${content.textContent.trim()}`);
                                } else if (content) {
                                    parts.push(content.textContent.trim());
                                }
                            });
                            return parts.join('\n\n');
                        }
                        return null;
                    });
                    
                    // Close modal
                    const closeBtn = await page.$('[aria-label="Close"]');
                    if (closeBtn) {
                        await closeBtn.click();
                        await fixedDelay(400);
                    }
                }
            }
            
            // If no modal or button, get visible description
            if (!description) {
                description = await page.evaluate(() => {
                    const descSection = document.querySelector('[data-section-id="DESCRIPTION_DEFAULT"]');
                    if (descSection) {
                        const contentDiv = descSection.querySelector('.d1isfkwk');
                        if (contentDiv) {
                            const spans = contentDiv.querySelectorAll('span.l1h825yc');
                            return Array.from(spans).map(s => s.textContent).join('\n\n').trim();
                        }
                    }
                    return null;
                });
            }
        }
    } catch (error) {
        requestLog.warning(`Could not extract full description: ${error.message}`);
        // Try to get visible description as fallback
        if (!description) {
            description = await page.evaluate(() => {
                const descSection = document.querySelector('[data-section-id="DESCRIPTION_DEFAULT"]');
                if (descSection) {
                    const contentDiv = descSection.querySelector('.d1isfkwk');
                    if (contentDiv) {
                        const spans = contentDiv.querySelectorAll('span.l1h825yc');
                        return Array.from(spans).map(s => s.textContent).join('\n\n').trim();
                    }
                }
                return null;
            }).catch(() => null);
        }
    }
    
    return description;
}

/**
 * Extract all listing images
 * @param {Object} page - Playwright page instance
 * @returns {Promise<Array>} Array of image URLs
 */
export async function extractImages(page) {
    try {
        const images = await page.evaluate(() => {
            const imageUrls = new Set();
            
            // Method 1: data-original-uri attribute
            const imgWithUri = document.querySelectorAll('img[data-original-uri]');
            imgWithUri.forEach(img => {
                const src = img.getAttribute('data-original-uri');
                if (src && src.startsWith('http') && !src.includes('profile_pic')) {
                    imageUrls.add(src);
                }
            });
            
            // Method 2: picture img elements
            const pictureImgs = document.querySelectorAll('picture img');
            pictureImgs.forEach(img => {
                const src = img.src || img.getAttribute('src');
                if (src && src.startsWith('http') && !src.includes('profile_pic') && src.includes('airbnb')) {
                    imageUrls.add(src);
                }
            });
            
            // Method 3: All images with airbnb CDN URLs
            const allImgs = document.querySelectorAll('img');
            allImgs.forEach(img => {
                const src = img.src || img.getAttribute('src');
                if (src && src.includes('a0.muscache.com') && !src.includes('profile_pic')) {
                    imageUrls.add(src);
                }
            });
            
            return Array.from(imageUrls);
        });
        
        console.log(`[Images] Extracted ${images.length} images`);
        return images;
    } catch (error) {
        console.error(`[Images] Error extracting images: ${error.message}`);
        return [];
    }
}

/**
 * Extract host profile ID
 * @param {Object} page - Playwright page instance
 * @returns {Promise<string|null>} Host profile ID
 */
export async function extractHostProfileId(page) {
    return await page.evaluate(() => {
        // Method 1: Look for host profile link in the host overview section
        const hostSection = document.querySelector('[data-section-id="HOST_OVERVIEW_DEFAULT"]');
        if (hostSection) {
            const hostLink = hostSection.querySelector('a[href*="/users/show/"]');
            if (hostLink) {
                const match = hostLink.href.match(/\/users\/show\/(\d+)/);
                if (match) return match[1];
            }
        }
        
        // Method 2: Look for the "Learn more about the host" button
        const learnMoreBtn = document.querySelector('button[aria-label*="Learn more about the host"]');
        if (learnMoreBtn) {
            const parent = learnMoreBtn.closest('[data-section-id="HOST_OVERVIEW_DEFAULT"]');
            if (parent) {
                const hostLink = parent.querySelector('a[href*="/users/show/"]');
                if (hostLink) {
                    const match = hostLink.href.match(/\/users\/show\/(\d+)/);
                    if (match) return match[1];
                }
            }
        }
        
        // Method 3: Look in the host profile image/avatar area within HOST_OVERVIEW section
        const hostAvatar = document.querySelector('[data-section-id="HOST_OVERVIEW_DEFAULT"] a[href*="/users/show/"]');
        if (hostAvatar) {
            const match = hostAvatar.href.match(/\/users\/show\/(\d+)/);
            if (match) return match[1];
        }
        
        // Method 4: Exclude reviews section and find first host link
        const allLinks = Array.from(document.querySelectorAll('a[href*="/users/show/"]'));
        for (const link of allLinks) {
            // Skip if link is inside reviews section
            const reviewsSection = link.closest('[data-section-id="REVIEWS_DEFAULT"]');
            if (reviewsSection) continue;
            
            const match = link.href.match(/\/users\/show\/(\d+)/);
            if (match) return match[1];
        }
        
        return null;
    }).catch(() => null);
}

/**
 * Extract co-hosts information
 * @param {Object} page - Playwright page instance
 * @returns {Promise<Array>} Array of co-host objects
 */
export async function extractCoHosts(page) {
    return await page.evaluate(() => {
        const coHostsList = [];
        
        // Method 1: Find the Co-hosts section by looking for h3 containing "Co-hosts" or "Co-host"
        const headings = Array.from(document.querySelectorAll('h3, h2'));
        const coHostHeading = headings.find(h => {
            const text = h.textContent.trim();
            return text.includes('Co-host') || text.includes('co-host');
        });
        
        if (coHostHeading) {
            // Find the list element that follows the heading
            let listElement = coHostHeading.nextElementSibling;
            let attempts = 0;
            while (listElement && listElement.tagName !== 'UL' && attempts < 5) {
                listElement = listElement.nextElementSibling;
                attempts++;
            }
            
            if (listElement) {
                // Extract all co-host links from the list
                const coHostLinks = listElement.querySelectorAll('a[href*="/users/show/"]');
                coHostLinks.forEach(link => {
                    const match = link.href.match(/\/users\/show\/(\d+)/);
                    if (match) {
                        const profileId = match[1];
                        // Extract name from aria-label or text content
                        let name = null;
                        const ariaLabel = link.getAttribute('aria-label');
                        if (ariaLabel) {
                            // aria-label format: "Learn more about the host, Erick."
                            const nameMatch = ariaLabel.match(/host,\s*([^.]+)/);
                            if (nameMatch) {
                                name = nameMatch[1].trim();
                            }
                        }
                        
                        // If no name from aria-label, try to find it in the list item
                        if (!name) {
                            const listItem = link.closest('li');
                            if (listItem) {
                                const nameSpan = listItem.querySelector('span');
                                if (nameSpan) {
                                    name = nameSpan.textContent.trim();
                                }
                            }
                        }
                        
                        coHostsList.push({
                            name: name,
                            profileId: profileId
                        });
                    }
                });
            }
        }
        
        // Method 2: If no co-hosts found, look in the entire HOST_OVERVIEW section
        if (coHostsList.length === 0) {
            const hostSection = document.querySelector('[data-section-id="HOST_OVERVIEW_DEFAULT"]');
            if (hostSection) {
                const allLinks = hostSection.querySelectorAll('a[href*="/users/show/"]');
                // Skip the first link (main host) and get the rest as co-hosts
                const linkArray = Array.from(allLinks);
                if (linkArray.length > 1) {
                    for (let i = 1; i < linkArray.length; i++) {
                        const link = linkArray[i];
                        const match = link.href.match(/\/users\/show\/(\d+)/);
                        if (match) {
                            const profileId = match[1];
                            let name = null;
                            const ariaLabel = link.getAttribute('aria-label');
                            if (ariaLabel) {
                                const nameMatch = ariaLabel.match(/host,\s*([^.]+)/);
                                if (nameMatch) {
                                    name = nameMatch[1].trim();
                                }
                            }
                            coHostsList.push({
                                name: name,
                                profileId: profileId
                            });
                        }
                    }
                }
            }
        }
        
        return coHostsList;
    }).catch(() => []);
}

/**
 * Extract property details (guests, bedrooms, bathrooms)
 * @param {Object} page - Playwright page instance
 * @returns {Promise<Object>} Property details object
 */
export async function extractPropertyDetails(page) {
    return await page.evaluate(() => {
        const details = {
            maxGuests: null,
            bedrooms: null,
            bathrooms: null
        };
        
        // Look for the details in the overview section
        const detailsText = document.body.innerText;
        
        // Extract guests
        const guestMatch = detailsText.match(/(\d+)\s+guests?/i);
        if (guestMatch) details.maxGuests = parseInt(guestMatch[1]);
        
        // Extract bedrooms
        const bedroomMatch = detailsText.match(/(\d+)\s+bedrooms?/i);
        if (bedroomMatch) details.bedrooms = parseInt(bedroomMatch[1]);
        
        // Extract bathrooms
        const bathroomMatch = detailsText.match(/(\d+(?:\.\d+)?)\s+baths?/i);
        if (bathroomMatch) details.bathrooms = parseFloat(bathroomMatch[1]);
        
        return details;
    }).catch(() => ({ maxGuests: null, bedrooms: null, bathrooms: null }));
}

/**
 * Check if listing is a Guest Favorite
 * @param {Object} page - Playwright page instance
 * @returns {Promise<boolean>} True if Guest Favorite
 */
export async function isGuestFavorite(page) {
    return await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return bodyText.includes('Guest favorite') || bodyText.includes('Guest Favorite');
    }).catch(() => false);
}

/**
 * Check if host is a Superhost
 * @param {Object} page - Playwright page instance
 * @returns {Promise<boolean>} True if Superhost
 */
export async function isSuperhost(page) {
    return await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return bodyText.includes('Superhost');
    }).catch(() => false);
}

/**
 * Extract overall review score and rating breakdown
 * @param {Object} page - Playwright page instance
 * @param {string} listingId - Listing ID (optional, for navigating to reviews modal)
 * @returns {Promise<Object>} Review score data
 */
export async function extractReviewScore(page, listingId = null) {
    try {
        const scoreData = await page.evaluate(() => {
            const result = {
                overallRating: null,
                reviewsCount: null,
                categoryRatings: {
                    cleanliness: null,
                    accuracy: null,
                    checkIn: null,
                    communication: null,
                    location: null,
                    value: null
                }
            };

            // Extract overall rating - look for pattern like "4.95 · 123 reviews"
            const ratingElements = document.querySelectorAll('span');
            for (const el of ratingElements) {
                const text = el.textContent.trim();
                // Match patterns like "4.95" or "5.0"
                const ratingMatch = text.match(/^(\d+\.\d+)$/);
                if (ratingMatch && !result.overallRating) {
                    const rating = parseFloat(ratingMatch[1]);
                    if (rating >= 0 && rating <= 5) {
                        result.overallRating = rating;
                    }
                }
                
                // Match review count like "123 reviews"
                const reviewsMatch = text.match(/(\d+)\s+reviews?/i);
                if (reviewsMatch && !result.reviewsCount) {
                    result.reviewsCount = parseInt(reviewsMatch[1]);
                }
            }

            return result;
        });

        // Skip category ratings extraction to save time (they're not critical for search)
        // This saves 3-5 seconds per listing by avoiding modal navigation
        console.log('[Review Score] Skipping category ratings for performance');
        
        if (false && scoreData.reviewsCount && scoreData.reviewsCount > 0 && listingId) {
            try {
                const currentUrl = page.url();
                const reviewsUrl = `https://www.airbnb.com/rooms/${listingId}/reviews`;
                
                console.log('[Review Score] Navigating to reviews modal to extract category ratings...');
                await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                
                // Wait for the modal to appear
                await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 5000 }).catch(() => {
                    console.log('[Review Score] Modal not found with role=dialog, continuing...');
                });
                
                await fixedDelay(600); // Reduced from 1500ms
                
                // Extract category ratings from the modal
                const categoryRatings = await page.evaluate(() => {
                    const ratings = {
                        cleanliness: null,
                        accuracy: null,
                        checkIn: null,
                        communication: null,
                        location: null,
                        value: null
                    };
                    
                    // Look for the modal with role="dialog"
                    const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
                    if (modal) {
                        // Find all spans with aria-label containing rating information
                        const allSpans = modal.querySelectorAll('span[aria-label]');
                        
                        allSpans.forEach(el => {
                            const ariaLabel = el.getAttribute('aria-label');
                            if (ariaLabel && ariaLabel.includes('Rated') && ariaLabel.includes('out of 5')) {
                                // Match patterns like "Rated 4.9 out of 5 stars for cleanliness"
                                const match = ariaLabel.match(/Rated\s+([\d.]+)\s+out of 5.*for\s+(.+)/i);
                                if (match) {
                                    const rating = parseFloat(match[1]);
                                    const category = match[2].toLowerCase().trim();
                                    
                                    if (category.includes('clean')) ratings.cleanliness = rating;
                                    else if (category.includes('accuracy')) ratings.accuracy = rating;
                                    else if (category.includes('check')) ratings.checkIn = rating;
                                    else if (category.includes('communication')) ratings.communication = rating;
                                    else if (category.includes('location')) ratings.location = rating;
                                    else if (category.includes('value')) ratings.value = rating;
                                }
                            }
                        });
                        
                        // Alternative: Look for divs with specific structure
                        const categoryDivs = modal.querySelectorAll('div[class*="cwzyvtz"]');
                        
                        categoryDivs.forEach(div => {
                            // Get the visible rating number
                            const ratingDiv = div.querySelector('div[class*="v1kb7fro"]');
                            // Get the category name
                            const categoryDiv = div.querySelector('div[class*="lqnx5rh"]');
                            
                            if (ratingDiv && categoryDiv) {
                                const rating = parseFloat(ratingDiv.textContent.trim());
                                const category = categoryDiv.textContent.trim().toLowerCase();
                                
                                if (!isNaN(rating)) {
                                    if (category.includes('clean')) ratings.cleanliness = rating;
                                    else if (category.includes('accuracy')) ratings.accuracy = rating;
                                    else if (category.includes('check')) ratings.checkIn = rating;
                                    else if (category.includes('communication')) ratings.communication = rating;
                                    else if (category.includes('location')) ratings.location = rating;
                                    else if (category.includes('value')) ratings.value = rating;
                                }
                            }
                        });
                    }
                    
                    return ratings;
                });
                
                // Update scoreData with category ratings
                scoreData.categoryRatings = categoryRatings;
                
                // Navigate back to the original listing page
                console.log('[Review Score] Navigating back to listing page...');
                await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await fixedDelay(400); // Reduced from 1000ms
                
            } catch (modalError) {
                console.log(`[Review Score] Could not extract category ratings: ${modalError.message}`);
            }
        }

        console.log(`[Review Score] Overall: ${scoreData.overallRating || 'N/A'} (${scoreData.reviewsCount || 0} reviews)`);
        console.log(`[Review Score] Category ratings:`, scoreData.categoryRatings);
        return scoreData;
    } catch (error) {
        console.error(`[Review Score] Error: ${error.message}`);
        return {
            overallRating: null,
            reviewsCount: null,
            categoryRatings: {
                cleanliness: null,
                accuracy: null,
                checkIn: null,
                communication: null,
                location: null,
                value: null
            }
        };
    }
}

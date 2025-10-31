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
 * Extract all listing images from photo tour modal
 * @param {Object} page - Playwright page instance
 * @param {string} listingId - The listing ID
 * @param {Object} logger - Logger instance
 * @returns {Promise<Array>} Array of image URLs
 */
export async function extractImages(page, listingId, logger) {
    try {
        // Save current URL to navigate back later
        const currentUrl = page.url();
        
        // Navigate to photo tour modal
        const photoTourUrl = `https://www.airbnb.com/rooms/${listingId}?modal=PHOTO_TOUR_SCROLLABLE`;
        logger.info(`Navigating to photo tour: ${photoTourUrl}`);
        
        await page.goto(photoTourUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // Wait for initial images to load
        await fixedDelay(2000);
        
        // Method 1: Scroll through the photo tour to load all images (lazy loading)
        logger.info('Scrolling through photo tour to load all images...');
        await page.evaluate(async () => {
            // Find the scrollable container
            const scrollableContainer = document.querySelector('[data-testid="photo-viewer-section"]') 
                || document.querySelector('[role="dialog"]')
                || document.body;
            
            if (scrollableContainer) {
                const scrollHeight = scrollableContainer.scrollHeight;
                const clientHeight = scrollableContainer.clientHeight;
                const scrollSteps = Math.ceil(scrollHeight / clientHeight);
                
                // Scroll down in steps to trigger lazy loading
                for (let i = 0; i < scrollSteps; i++) {
                    scrollableContainer.scrollTop = (i + 1) * clientHeight;
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // Scroll back to top
                scrollableContainer.scrollTop = 0;
            }
        });
        
        await fixedDelay(1000);
        
        // Method 2: Use keyboard navigation to cycle through images
        logger.info('Using keyboard navigation to load remaining images...');
        const maxImages = 100; // Safety limit
        for (let i = 0; i < maxImages; i++) {
            // Press right arrow key to go to next image
            await page.keyboard.press('ArrowRight');
            await fixedDelay(300); // Wait for image to load
            
            // Check if we've reached the end (no more images)
            const isLastImage = await page.evaluate(() => {
                // Check if next button is disabled or we're at the last image
                const nextButton = document.querySelector('button[aria-label*="Next"]');
                return nextButton && nextButton.disabled;
            });
            
            if (isLastImage) {
                logger.info(`Reached last image after ${i + 1} images`);
                break;
            }
        }
        
        // Wait for all lazy-loaded images to render
        await fixedDelay(2000);
        
        const images = await page.evaluate(() => {
            const imageUrls = new Set();
            
            // Helper function to check if URL is a valid listing image
            const isValidListingImage = (url) => {
                if (!url || !url.includes('a0.muscache.com')) return false;
                
                // Only include images from hosting/listing paths
                const validPaths = [
                    '/im/pictures/hosting/',
                    '/im/pictures/miso/',
                    '/pictures/hosting/',
                    '/pictures/miso/'
                ];
                
                const hasValidPath = validPaths.some(path => url.includes(path));
                if (!hasValidPath) return false;
                
                // Exclude user avatars, profile pics, and other non-listing assets
                const excludePatterns = [
                    'profile_pic',
                    'user.jpg',
                    '/users/',
                    'avatar',
                    'profile-pic'
                ];
                
                const hasExcludedPattern = excludePatterns.some(pattern => 
                    url.toLowerCase().includes(pattern.toLowerCase())
                );
                
                return !hasExcludedPattern;
            };
            
            // Extract images from photo tour modal
            // Method 1: data-original-uri attribute (most reliable for listing images)
            const imgWithUri = document.querySelectorAll('img[data-original-uri]');
            imgWithUri.forEach(img => {
                const src = img.getAttribute('data-original-uri');
                if (isValidListingImage(src)) {
                    imageUrls.add(src);
                }
            });
            
            // Method 2: picture img elements (gallery images)
            const pictureImgs = document.querySelectorAll('picture img');
            pictureImgs.forEach(img => {
                const src = img.src || img.getAttribute('src');
                if (isValidListingImage(src)) {
                    imageUrls.add(src);
                }
            });
            
            // Method 3: All images with valid muscache hosting URLs
            const allImgs = document.querySelectorAll('img');
            allImgs.forEach(img => {
                const src = img.src || img.getAttribute('src');
                if (isValidListingImage(src)) {
                    imageUrls.add(src);
                }
            });
            
            return Array.from(imageUrls);
        });
        
        logger.info(`Extracted ${images.length} listing images from photo tour`);
        
        // Navigate back to the original page if we were on the listing page
        if (currentUrl && currentUrl.includes(`/rooms/${listingId}`) && !currentUrl.includes('modal=')) {
            logger.info('Navigating back to main listing page...');
            await page.goto(currentUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });
            await fixedDelay(1000);
        }
        
        return images;
    } catch (error) {
        logger.error(`Error extracting images from photo tour: ${error.message}`);
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
        // Helper function to extract profile ID from various URL patterns
        const extractProfileId = (url) => {
            if (!url) return null;
            
            // Pattern 1: /users/show/123456
            let match = url.match(/\/users\/show\/(\d+)/);
            if (match) return match[1];
            
            // Pattern 2: /users/profile/123456
            match = url.match(/\/users\/profile\/(\d+)/);
            if (match) return match[1];
            
            return null;
        };
        
        // Method 1: Look for "Meet your host" section
        const meetHostSection = document.querySelector('[data-section-id="MEET_YOUR_HOST"]');
        if (meetHostSection) {
            const hostLinks = meetHostSection.querySelectorAll('a[href*="/users/"]');
            for (const link of hostLinks) {
                const profileId = extractProfileId(link.href);
                if (profileId) return profileId;
            }
        }
        
        // Method 2: Look for host profile link in the host overview section
        const hostSection = document.querySelector('[data-section-id="HOST_OVERVIEW_DEFAULT"]');
        if (hostSection) {
            const hostLinks = hostSection.querySelectorAll('a[href*="/users/"]');
            for (const link of hostLinks) {
                const profileId = extractProfileId(link.href);
                if (profileId) return profileId;
            }
        }
        
        // Method 3: Look for aria-label "Go to Host full profile"
        const hostProfileLink = document.querySelector('a[aria-label*="Host full profile"]');
        if (hostProfileLink) {
            const profileId = extractProfileId(hostProfileLink.href);
            if (profileId) return profileId;
        }
        
        // Method 4: Look for the "Learn more about the host" button
        const learnMoreBtn = document.querySelector('button[aria-label*="Learn more about the host"]');
        if (learnMoreBtn) {
            const parent = learnMoreBtn.closest('[data-section-id="HOST_OVERVIEW_DEFAULT"]');
            if (parent) {
                const hostLinks = parent.querySelectorAll('a[href*="/users/"]');
                for (const link of hostLinks) {
                    const profileId = extractProfileId(link.href);
                    if (profileId) return profileId;
                }
            }
        }
        
        // Method 5: Look in the host profile image/avatar area within HOST_OVERVIEW section
        const hostAvatar = document.querySelector('[data-section-id="HOST_OVERVIEW_DEFAULT"] a[href*="/users/"]');
        if (hostAvatar) {
            const profileId = extractProfileId(hostAvatar.href);
            if (profileId) return profileId;
        }
        
        // Method 6: Exclude reviews section and find first host link
        const allLinks = Array.from(document.querySelectorAll('a[href*="/users/"]'));
        for (const link of allLinks) {
            // Skip if link is inside reviews section
            const reviewsSection = link.closest('[data-section-id="REVIEWS_DEFAULT"]');
            if (reviewsSection) continue;

            const profileId = extractProfileId(link.href);
            if (profileId) return profileId;
        }

        // Method 7: Parse embedded JSON (data-state) for host identifiers
        const candidateFromEmbeddedData = (() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            const candidates = [];
            const visited = new WeakSet();

            const pushCandidate = (id, weight) => {
                if (!id) return;
                const normalized = String(id).trim();
                if (!/^\d+$/.test(normalized)) return;
                candidates.push({ id: normalized, weight });
            };

            const collectIds = (node, contextKey = '') => {
                if (!node || typeof node !== 'object') return;
                if (visited.has(node)) return;
                visited.add(node);

                if (Array.isArray(node)) {
                    node.forEach(item => collectIds(item, contextKey));
                    return;
                }

                const contextLower = contextKey.toLowerCase();

                for (const [key, value] of Object.entries(node)) {
                    const lowerKey = key.toLowerCase();
                    const nextContext = contextKey ? `${contextLower}.${lowerKey}` : lowerKey;

                    if (['userid', 'id', 'hostid', 'profileid', 'primaryhostid'].includes(lowerKey)) {
                        if (typeof value === 'string' || typeof value === 'number') {
                            const strVal = String(value).trim();
                            const weight = lowerKey.includes('host') || contextLower.includes('host')
                                ? 3
                                : (lowerKey.includes('user') || contextLower.includes('user'))
                                    ? 2
                                    : 1;
                            pushCandidate(strVal, weight);
                        }
                    }

                    if (value && typeof value === 'object') {
                        collectIds(value, nextContext);
                    }
                }
            };

            for (const script of scripts) {
                const text = script.textContent;
                if (!text || text.length < 20) continue;

                let parsed = null;
                try {
                    parsed = JSON.parse(text);
                } catch (error) {
                    // Some script tags may contain non-JSON strings; skip parsing errors silently
                }

                if (parsed) {
                    collectIds(parsed);
                } else {
                    const matches = text.match(/"(?:primary)?[Hh]ost(?:Profile)?Id"\s*:\s*"?(\d+)"?/g);
                    if (matches) {
                        matches.forEach(match => {
                            const idMatch = match.match(/(\d+)/);
                            if (idMatch) {
                                pushCandidate(idMatch[1], 3);
                            }
                        });
                    }

                    const userMatches = text.match(/"userId"\s*:\s*"?(\d+)"?/g);
                    if (userMatches) {
                        userMatches.forEach(match => {
                            const idMatch = match.match(/(\d+)/);
                            if (idMatch) {
                                pushCandidate(idMatch[1], 1);
                            }
                        });
                    }
                }
            }

            if (candidates.length > 0) {
                candidates.sort((a, b) => {
                    if (b.weight !== a.weight) return b.weight - a.weight;
                    if (b.id.length !== a.id.length) return b.id.length - a.id.length;
                    return parseInt(b.id, 10) - parseInt(a.id, 10);
                });
                return candidates[0].id;
            }

            return null;
        })();

        if (candidateFromEmbeddedData) {
            return candidateFromEmbeddedData;
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
        
        // Helper function to extract profile ID from various URL patterns
        const extractProfileId = (url) => {
            if (!url) return null;
            
            // Pattern 1: /users/show/123456
            let match = url.match(/\/users\/show\/(\d+)/);
            if (match) return match[1];
            
            // Pattern 2: /users/profile/123456
            match = url.match(/\/users\/profile\/(\d+)/);
            if (match) return match[1];
            
            return null;
        };
        
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
                const coHostLinks = listElement.querySelectorAll('a[href*="/users/"]');
                coHostLinks.forEach(link => {
                    const profileId = extractProfileId(link.href);
                    if (profileId) {
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
                const allLinks = hostSection.querySelectorAll('a[href*="/users/"]');
                // Skip the first link (main host) and get the rest as co-hosts
                const linkArray = Array.from(allLinks);
                if (linkArray.length > 1) {
                    for (let i = 1; i < linkArray.length; i++) {
                        const link = linkArray[i];
                        const profileId = extractProfileId(link.href);
                        if (profileId) {
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

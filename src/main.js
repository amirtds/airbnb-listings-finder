import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';

// Main actor entry point
await Actor.init();

try {
    // Get input from Apify (or use defaults for local testing)
    const input = await Actor.getInput() ?? {};
    const { location, numberOfListings = 10 } = input;

    // Validate input
    if (!location) {
        throw new Error('Location parameter is required!');
    }

    log.info(`Starting Airbnb listings search for: ${location}`);
    log.info(`Target number of listings: ${numberOfListings}`);

    // Store found listings (URLs only in phase 1)
    const foundListings = [];
    // Store detailed listing data (phase 2)
    const detailedListings = [];

    // Construct Airbnb search URL
    // Airbnb search URL format: https://www.airbnb.com/s/{location}/homes
    const searchUrl = `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes`;
    
    log.info(`Search URL: ${searchUrl}`);

    // Create a PlaywrightCrawler to handle JavaScript-rendered content
    const crawler = new PlaywrightCrawler({
        // Maximum number of pages to crawl
        maxRequestsPerCrawl: 15,
        
        // Use headless browser
        headless: true,
        
        // Request handler
        async requestHandler({ request, page, log: requestLog }) {
            requestLog.info(`Processing: ${request.url}`);

            // Wait for the page to load and listings to appear
            try {
                await page.waitForSelector('a[href*="/rooms/"]', { timeout: 15000 });
            } catch (e) {
                requestLog.warning('Timeout waiting for listings to load');
            }

            // Scroll multiple times to load more content (Airbnb uses lazy loading)
            requestLog.info('Scrolling to load all listings on the page...');
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight);
                });
                await page.waitForTimeout(1000);
            }
            
            // Scroll to bottom
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            await page.waitForTimeout(2000);

            // Extract listing URLs from the page
            const listingLinks = await page.$$eval('a[href*="/rooms/"]', (links) => {
                return links
                    .map(link => {
                        const href = link.getAttribute('href');
                        if (href) {
                            const match = href.match(/\/rooms\/(\d+)/);
                            if (match) {
                                return {
                                    listingId: match[1],
                                    listingUrl: `https://www.airbnb.com/rooms/${match[1]}`
                                };
                            }
                        }
                        return null;
                    })
                    .filter(item => item !== null);
            });

            // Remove duplicates based on listingId
            const uniqueListings = Array.from(
                new Map(listingLinks.map(item => [item.listingId, item])).values()
            ).map(item => ({
                ...item,
                location: location
            }));

            requestLog.info(`Found ${uniqueListings.length} unique listings on this page`);

            // Add to our collection
            let newListingsAdded = 0;
            for (const listing of uniqueListings) {
                if (foundListings.length >= numberOfListings) {
                    break;
                }
                
                // Check if we already have this listing
                if (!foundListings.some(l => l.listingId === listing.listingId)) {
                    foundListings.push(listing);
                    newListingsAdded++;
                    requestLog.info(`Added listing ${foundListings.length}/${numberOfListings}: ${listing.listingUrl}`);
                }
            }

            requestLog.info(`Total listings collected so far: ${foundListings.length}/${numberOfListings}`);

            // If we haven't reached the target, look for pagination
            if (foundListings.length < numberOfListings) {
                // Try multiple pagination selectors (Airbnb may use different ones)
                let nextUrl = null;
                
                // Method 1: Look for "Next" button with aria-label
                const nextButton = await page.$('a[aria-label="Next"]');
                if (nextButton) {
                    nextUrl = await nextButton.getAttribute('href');
                }
                
                // Method 2: Look for pagination nav with "Next" text
                if (!nextUrl) {
                    const nextLink = await page.$('nav a:has-text("Next")');
                    if (nextLink) {
                        nextUrl = await nextLink.getAttribute('href');
                    }
                }
                
                // Method 3: Look for pagination buttons
                if (!nextUrl) {
                    const paginationNext = await page.$('[data-testid="pagination-next-button"]');
                    if (paginationNext) {
                        nextUrl = await paginationNext.getAttribute('href');
                    }
                }
                
                if (nextUrl) {
                    const fullNextUrl = nextUrl.startsWith('http') 
                        ? nextUrl 
                        : `https://www.airbnb.com${nextUrl}`;
                    
                    requestLog.info(`Need ${numberOfListings - foundListings.length} more listings. Going to next page: ${fullNextUrl}`);
                    await crawler.addRequests([fullNextUrl]);
                } else {
                    requestLog.info(`No more pages available. Collected ${foundListings.length} listings.`);
                }
            } else {
                requestLog.info(`Target reached! Collected ${foundListings.length} listings.`);
            }
        },

        // Error handler
        failedRequestHandler({ request, log: errorLog }, error) {
            errorLog.error(`Request ${request.url} failed multiple times`, { error });
        },

        // Timeout settings
        requestHandlerTimeoutSecs: 120,
        maxRequestRetries: 3,
    });

    // PHASE 1: Run the crawler to collect listing URLs
    log.info('=== PHASE 1: Collecting listing URLs ===');
    await crawler.run([searchUrl]);

    // Limit results to requested number
    const finalListings = foundListings.slice(0, numberOfListings);
    log.info(`Successfully collected ${finalListings.length} listing URLs`);

    // PHASE 2: Scrape detailed data from each listing
    log.info('=== PHASE 2: Scraping detailed listing data ===');
    
    // Helper function to scrape amenities
    async function scrapeAmenities(page, listingId, requestLog) {
        try {
            const amenitiesUrl = `https://www.airbnb.com/rooms/${listingId}/amenities`;
            await page.goto(amenitiesUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
            
            // Scroll to bottom of modal to load all amenities
            await page.evaluate(async () => {
                const scrollableDiv = document.querySelector('[data-testid="pdp-reviews-modal-scrollable-panel"], .dir.dir-ltr');
                if (scrollableDiv) {
                    scrollableDiv.scrollTo(0, scrollableDiv.scrollHeight);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            });
            
            // Extract amenities
            const amenities = await page.evaluate(() => {
                const amenityItems = document.querySelectorAll('[id^="pdp_v3_"]');
                const result = [];
                
                amenityItems.forEach(item => {
                    const titleEl = item.querySelector('[id$="-row-title"]');
                    const descEl = item.querySelector('.s9gst5p');
                    
                    if (titleEl) {
                        result.push({
                            name: titleEl.textContent.trim(),
                            description: descEl ? descEl.textContent.trim() : null
                        });
                    }
                });
                
                return result;
            });
            
            requestLog.info(`Found ${amenities.length} amenities`);
            return amenities;
        } catch (error) {
            requestLog.error(`Failed to scrape amenities: ${error.message}`);
            return [];
        }
    }
    
    // Helper function to scrape reviews
    async function scrapeReviews(page, listingId, requestLog) {
        try {
            const reviewsUrl = `https://www.airbnb.com/rooms/${listingId}/reviews`;
            await page.goto(reviewsUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
            
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
    
    // Helper function to scrape house rules
    async function scrapeHouseRules(page, listingId, requestLog) {
        try {
            const rulesUrl = `https://www.airbnb.com/rooms/${listingId}/house-rules`;
            await page.goto(rulesUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
            
            // Check if there's a "Show more" button for additional rules and click it
            try {
                const showMoreBtn = await page.$('button:has-text("Show more")');
                if (showMoreBtn) {
                    await showMoreBtn.click();
                    await page.waitForTimeout(1000);
                }
            } catch (e) {
                // No show more button, continue
            }
            
            // Extract house rules from the modal
            const rules = await page.evaluate(() => {
                const result = {
                    checkIn: '',
                    checkOut: '',
                    selfCheckIn: false,
                    maxGuests: 0,
                    pets: false,
                    quietHours: '',
                    noParties: false,
                    noCommercialPhotography: false,
                    noSmoking: false,
                    additionalRules: '',
                    beforeYouLeave: []
                };
                
                // Extract check-in time
                const checkInText = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('Check-in'));
                if (checkInText) {
                    result.checkIn = checkInText.textContent.replace(/Check-in\s+(after|:)\s*/i, '').trim();
                }
                
                // Extract checkout time
                const checkOutEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('Checkout'));
                if (checkOutEl) {
                    result.checkOut = checkOutEl.textContent.replace(/Checkout\s+before\s*/i, '').trim();
                }
                
                // Check for self check-in
                const selfCheckInEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('Self check-in'));
                result.selfCheckIn = !!selfCheckInEl;
                
                // Extract max guests
                const guestsEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('guests maximum'));
                if (guestsEl) {
                    const match = guestsEl.textContent.match(/(\d+)\s+guests?\s+maximum/i);
                    if (match) result.maxGuests = parseInt(match[1]);
                }
                
                // Check for pets - if "No pets" is found, pets = false
                const petsEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('No pets'));
                result.pets = !petsEl;
                
                // Extract quiet hours
                const quietHoursEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('Quiet hours'));
                if (quietHoursEl) {
                    const nextEl = quietHoursEl.nextElementSibling;
                    if (nextEl && nextEl.classList.contains('s1q8hkgb')) {
                        result.quietHours = nextEl.textContent.trim();
                    }
                }
                
                // Check for no parties
                const partiesEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('No parties'));
                result.noParties = !!partiesEl;
                
                // Check for no commercial photography
                const photoEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('No commercial photography'));
                result.noCommercialPhotography = !!photoEl;
                
                // Check for no smoking
                const smokingEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('No smoking'));
                result.noSmoking = !!smokingEl;
                
                // Extract additional rules - get full text after clicking "Show more"
                const additionalRulesEl = Array.from(document.querySelectorAll('.t1yw48g8')).find(el => el.textContent.includes('Additional rules'));
                if (additionalRulesEl) {
                    const parentDiv = additionalRulesEl.closest('.c1rc5p4c');
                    if (parentDiv) {
                        const rulesDiv = parentDiv.querySelector('.s1q8hkgb');
                        if (rulesDiv) {
                            // Get all text content, including after "Show more" was clicked
                            const spanContent = rulesDiv.querySelector('span span');
                            if (spanContent) {
                                result.additionalRules = spanContent.textContent.trim();
                            } else {
                                result.additionalRules = rulesDiv.textContent.trim();
                            }
                        }
                    }
                }
                
                // Extract "Before you leave" items
                const beforeLeaveSection = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.includes('Before you leave'));
                if (beforeLeaveSection) {
                    const section = beforeLeaveSection.closest('.ce5nonf');
                    if (section) {
                        const items = section.querySelectorAll('.t1yw48g8');
                        items.forEach(item => {
                            result.beforeYouLeave.push(item.textContent.trim());
                        });
                    }
                }
                
                return result;
            });
            
            requestLog.info(`Scraped house rules for listing ${listingId}`);
            return rules;
        } catch (error) {
            requestLog.error(`Failed to scrape house rules: ${error.message}`);
            return null;
        }
    }
    
    // Helper function to scrape host profile
    async function scrapeHostProfile(page, hostProfileId, requestLog) {
        try {
            if (!hostProfileId) {
                return null;
            }
            
            const hostUrl = `https://www.airbnb.com/users/show/${hostProfileId}`;
            await page.goto(hostUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
            
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
                    about: ''
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
                result.listings = [];
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
    
    const detailCrawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: numberOfListings + 10,
        headless: true,
        
        async requestHandler({ request, page, log: requestLog }) {
            const listingId = request.userData.listingId;
            requestLog.info(`Scraping details for listing ${listingId}: ${request.url}`);
            
            try {
                // Wait for page to load
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(3000);
                
                // Extract title
                const title = await page.$eval('h1', el => el.textContent.trim()).catch(() => null);
                
                // Extract description - click "Show more" if it exists and get full description from modal
                let description = null;
                try {
                    const descSection = await page.$('[data-section-id="DESCRIPTION_DEFAULT"]');
                    if (descSection) {
                        const showMoreBtn = await descSection.$('button');
                        if (showMoreBtn) {
                            const btnText = await showMoreBtn.textContent();
                            if (btnText && btnText.includes('Show more')) {
                                // Click the button to open modal
                                await showMoreBtn.click();
                                await page.waitForTimeout(1000);
                                
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
                                    await page.waitForTimeout(500);
                                }
                            }
                        }
                        
                        // If no modal or button, get visible description
                        if (!description) {
                            description = await page.evaluate(() => {
                                const descSection = document.querySelector('[data-section-id="DESCRIPTION_DEFAULT"]');
                                if (descSection) {
                                    const spans = descSection.querySelectorAll('span');
                                    return Array.from(spans).map(s => s.textContent).join(' ').trim();
                                }
                                return null;
                            });
                        }
                    }
                } catch (error) {
                    requestLog.error(`Error extracting description: ${error.message}`);
                    description = null;
                }
                
                // Extract all images
                const images = await page.evaluate(() => {
                    const imgElements = document.querySelectorAll('img[data-original-uri], picture img');
                    const imageUrls = new Set();
                    imgElements.forEach(img => {
                        const src = img.getAttribute('data-original-uri') || img.src;
                        if (src && src.startsWith('http') && !src.includes('profile_pic')) {
                            imageUrls.add(src);
                        }
                    });
                    return Array.from(imageUrls);
                }).catch(() => []);
                
                // Extract host profile ID
                const hostProfileId = await page.evaluate(() => {
                    const hostLink = document.querySelector('a[href*="/users/show/"]');
                    if (hostLink) {
                        const match = hostLink.href.match(/\/users\/show\/(\d+)/);
                        return match ? match[1] : null;
                    }
                    return null;
                }).catch(() => null);
                
                // Extract max guests, bedrooms, bathrooms
                const propertyDetails = await page.evaluate(() => {
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
                
                // Check if Guest Favorite
                const isGuestFavorite = await page.evaluate(() => {
                    const bodyText = document.body.innerText;
                    return bodyText.includes('Guest favorite') || bodyText.includes('Guest Favorite');
                }).catch(() => false);
                
                // Check if Superhost
                const isSuperhost = await page.evaluate(() => {
                    const bodyText = document.body.innerText;
                    return bodyText.includes('Superhost');
                }).catch(() => false);
                
                // Scrape amenities
                requestLog.info(`Scraping amenities for listing ${listingId}`);
                const amenities = await scrapeAmenities(page, listingId, requestLog);
                
                // Scrape reviews
                requestLog.info(`Scraping reviews for listing ${listingId}`);
                const reviews = await scrapeReviews(page, listingId, requestLog);
                
                // Scrape house rules
                requestLog.info(`Scraping house rules for listing ${listingId}`);
                const houseRules = await scrapeHouseRules(page, listingId, requestLog);
                
                // Scrape host profile
                requestLog.info(`Scraping host profile for listing ${listingId}`);
                const hostProfile = await scrapeHostProfile(page, hostProfileId, requestLog);
                
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
                    maxGuests: propertyDetails.maxGuests,
                    bedrooms: propertyDetails.bedrooms,
                    bathrooms: propertyDetails.bathrooms,
                    isGuestFavorite: isGuestFavorite,
                    isSuperhost: isSuperhost,
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
    
    // Add all listing URLs to the detail crawler
    const detailRequests = finalListings.map(listing => ({
        url: listing.listingUrl,
        userData: {
            listingId: listing.listingId,
            location: listing.location
        }
    }));
    
    await detailCrawler.run(detailRequests);
    
    log.info(`Successfully scraped ${detailedListings.length} listings with detailed data`);

    // Push results to Apify dataset
    await Actor.pushData(detailedListings);

    // Set output
    await Actor.setValue('OUTPUT', {
        success: true,
        location: location,
        requestedCount: numberOfListings,
        foundCount: detailedListings.length,
        listings: detailedListings
    });

    log.info('Actor finished successfully');

} catch (error) {
    log.error('Actor failed with error:', error);
    
    // Set error output
    await Actor.setValue('OUTPUT', {
        success: false,
        error: error.message
    });
    
    throw error;
} finally {
    await Actor.exit();
}

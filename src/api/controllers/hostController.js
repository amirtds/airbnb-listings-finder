/**
 * Controller for retrieving host and co-host information by listing ID
 */

import { chromium } from 'playwright';
import { getBrowserLaunchOptions } from '../../utils/browserConfig.js';
import { scrapeHostProfile } from '../../scrapers/hostProfile.js';
import { extractHostProfileId, extractCoHosts } from '../../scrapers/listingDetails.js';
import { fixedDelay } from '../../utils/delays.js';

/**
 * Extracts company name from text if it contains company indicators
 * @param {string} text - Text to analyze
 * @returns {string|null} - Extracted company name or null
 */
function extractCompanyNameFromText(text) {
    if (!text) return null;
    
    const companyKeywords = [
        'properties', 'property', 'management', 'rentals', 'rental',
        'group', 'llc', 'inc', 'corp', 'corporation', 'ltd', 'limited',
        'hospitality', 'homes', 'realty', 'real estate', 'estate',
        'apartments', 'vacation', 'stay', 'stays', 'hosting',
        'company', 'co.', 'services', 'solutions', 'ventures',
        'investments', 'holdings', 'enterprises', 'associates'
    ];
    
    const textLower = text.toLowerCase();
    
    // Check if text contains company keywords
    const hasCompanyKeyword = companyKeywords.some(keyword => textLower.includes(keyword));
    
    if (hasCompanyKeyword) {
        // Remove common prefixes like "My work:", "Work:", "At", etc.
        let cleaned = text
            .replace(/^(my work:|work:|at|for)\s*/i, '')
            .trim();
        
        return cleaned || text;
    }
    
    // Check for legal entity suffixes
    const legalSuffixPattern = /\b(llc|inc\.?|corp\.?|ltd\.?|limited|co\.)\b/i;
    if (legalSuffixPattern.test(text)) {
        let cleaned = text
            .replace(/^(my work:|work:|at|for)\s*/i, '')
            .trim();
        return cleaned || text;
    }
    
    return null;
}

/**
 * Analyzes host information to determine if it's a company or individual
 * @param {Object} hostData - The host data object
 * @returns {Object} { isCompany: boolean, companyName: string }
 */
function detectCompanyHost(hostData) {
    const { name, work, about } = hostData;
    
    // Company indicators in names
    const companyKeywords = [
        'properties', 'property', 'management', 'rentals', 'rental',
        'group', 'llc', 'inc', 'corp', 'corporation', 'ltd', 'limited',
        'hospitality', 'homes', 'realty', 'real estate', 'estate',
        'apartments', 'vacation', 'stay', 'stays', 'hosting',
        'company', 'co.', 'services', 'solutions', 'ventures',
        'investments', 'holdings', 'enterprises', 'associates'
    ];
    
    let isCompany = false;
    let companyName = '';
    
    if (!name) {
        return { isCompany: false, companyName: '' };
    }
    
    const nameLower = name.toLowerCase();
    const workLower = (work || '').toLowerCase();
    const aboutLower = (about || '').toLowerCase();
    
    // Priority 1: Check work field first (most reliable for company names)
    if (work) {
        const extractedFromWork = extractCompanyNameFromText(work);
        if (extractedFromWork) {
            isCompany = true;
            companyName = extractedFromWork;
            return { isCompany, companyName };
        }
    }
    
    // Priority 2: Check if name contains company keywords
    for (const keyword of companyKeywords) {
        if (nameLower.includes(keyword)) {
            isCompany = true;
            companyName = name;
            return { isCompany, companyName };
        }
    }
    
    // Priority 3: Check for legal entity suffixes in name
    const legalSuffixPattern = /\b(llc|inc\.?|corp\.?|ltd\.?|limited|co\.)\b/i;
    if (legalSuffixPattern.test(name)) {
        isCompany = true;
        companyName = name;
        return { isCompany, companyName };
    }
    
    // Priority 4: Check work field for property management role indicators
    if (work) {
        const workIndicators = [
            'property management', 'property manager', 'rental management',
            'vacation rental', 'real estate', 'hospitality', 'host',
            'airbnb', 'vrbo', 'vacation home'
        ];
        
        for (const indicator of workIndicators) {
            if (workLower.includes(indicator)) {
                isCompany = true;
                // Use the full work text as company name if it looks professional
                companyName = work.replace(/^(my work:|work:|at|for)\s*/i, '').trim() || work;
                return { isCompany, companyName };
            }
        }
    }
    
    // Priority 5: Check about section for company language
    if (aboutLower) {
        const aboutIndicators = [
            'our company', 'our team', 'we manage', 'we own',
            'professional property', 'property management',
            'our properties', 'our portfolio', 'our business',
            'we specialize', 'we offer', 'our services'
        ];
        
        for (const indicator of aboutIndicators) {
            if (aboutLower.includes(indicator)) {
                isCompany = true;
                // Try to extract company name from work field if available, otherwise use name
                if (work) {
                    companyName = work.replace(/^(my work:|work:|at|for)\s*/i, '').trim() || name;
                } else {
                    companyName = name;
                }
                return { isCompany, companyName };
            }
        }
    }
    
    return {
        isCompany: false,
        companyName: ''
    };
}

/**
 * POST /api/listing/hosts
 * Get host and co-host information for a listing
 * 
 * Request body:
 * {
 *   "listingId": "12345678"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "listingId": "12345678",
 *     "listingUrl": "https://www.airbnb.com/rooms/12345678",
 *     "host": {
 *       "hostProfileId": "123456",
 *       "profile": {
 *         "name": "John Doe",
 *         "isSuperhost": true,
 *         "isIdentityVerified": true,
 *         "reviewsCount": 150,
 *         "rating": 4.9,
 *         "yearsHosting": 5,
 *         "location": "Miami, FL",
 *         "about": "...",
 *         "isCompany": false,
 *         "companyName": ""
 *       }
 *     },
 *     "coHosts": [
 *       {
 *         "name": "Jane Smith",
 *         "profileUrl": "https://www.airbnb.com/users/show/789"
 *       }
 *     ]
 *   },
 *   "meta": {
 *     "scrapedAt": "2024-10-31T12:34:56.789Z",
 *     "processingTime": "5s"
 *   }
 * }
 */
export async function getHostsByListingId(req, res, next) {
    let browser = null;
    const startTime = Date.now();
    
    try {
        const { listingId: rawListingId } = req.body;

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

        console.log(`[API] Fetching host information for listing ID: ${listingId}`);

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
            info: (msg) => console.log(`[Host ${listingId}] ${msg}`),
            warning: (msg) => console.warn(`[Host ${listingId}] ${msg}`),
            error: (msg) => console.error(`[Host ${listingId}] ${msg}`)
        };

        // Navigate to listing page
        const listingUrl = `https://www.airbnb.com/rooms/${listingId}`;
        logger.info(`Navigating to ${listingUrl}`);
        
        // Navigate with retry logic
        let navigationSuccess = false;
        let lastError = null;
        
        const strategies = [
            { waitUntil: 'domcontentloaded', timeout: 60000, delay: 2000 },
            { waitUntil: 'load', timeout: 60000, delay: 3000 },
            { waitUntil: 'networkidle', timeout: 90000, delay: 2000 }
        ];
        
        for (let i = 0; i < strategies.length && !navigationSuccess; i++) {
            const strategy = strategies[i];
            try {
                logger.info(`Attempting navigation with strategy ${i + 1}/${strategies.length}`);
                
                await page.goto(listingUrl, { 
                    waitUntil: strategy.waitUntil, 
                    timeout: strategy.timeout 
                });
                
                await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {
                    logger.warning('Title selector not found, continuing anyway...');
                });
                
                await fixedDelay(strategy.delay);
                navigationSuccess = true;
                logger.info(`✓ Navigation successful with strategy ${i + 1}`);
            } catch (error) {
                lastError = error;
                logger.warning(`Strategy ${i + 1} failed: ${error.message}`);
                
                if (i < strategies.length - 1) {
                    logger.info(`Retrying with next strategy...`);
                    await fixedDelay(2000);
                }
            }
        }
        
        if (!navigationSuccess) {
            throw new Error(`Failed to navigate to listing after ${strategies.length} attempts. Last error: ${lastError?.message}`);
        }

        // Extract host profile ID from listing page
        logger.info('Extracting host profile ID from listing page...');
        const hostProfileId = await extractHostProfileId(page);
        
        if (!hostProfileId) {
            logger.error('Host Profile ID not found on listing page');
            throw new Error('Could not find host profile ID on the listing page');
        }
        
        logger.info(`Found Host Profile ID: ${hostProfileId}`);

        // Navigate directly to host profile page
        const hostProfileUrl = `https://www.airbnb.com/users/profile/${hostProfileId}`;
        logger.info(`Navigating to host profile: ${hostProfileUrl}`);
        
        await page.goto(hostProfileUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });
        await fixedDelay(2000);
        
        logger.info('Extracting host information from profile page...');
        
        // Extract all host information from the profile page
        const hostData = await page.evaluate(() => {
            const result = {
                name: null,
                isSuperhost: false,
                isIdentityVerified: false,
                reviewsCount: 0,
                rating: null,
                yearsHosting: 0,
                work: null,
                pets: null,
                location: null,
                languages: [],
                about: null,
                profileImageUrl: null,
                isCompany: false,
                companyName: ''
            };
            
            // Extract name from h2 or the profile card
            const nameEl = document.querySelector('h2[tabindex="-1"]') || 
                          document.querySelector('.hpipapi');
            if (nameEl) {
                result.name = nameEl.textContent.trim();
            }
            
            // Check if Superhost
            const superhostText = document.body.innerText;
            result.isSuperhost = superhostText.includes('Superhost');
            
            // Check if identity verified
            const verifiedEl = document.querySelector('svg[aria-label*="Identity verified"]') ||
                              document.querySelector('button[aria-label*="identity verification"]');
            result.isIdentityVerified = !!verifiedEl;
            
            // Extract profile image
            const profileImg = document.querySelector('img[alt*="User Profile"]');
            if (profileImg) {
                const src = profileImg.getAttribute('src') || profileImg.getAttribute('data-original-uri');
                if (src) {
                    result.profileImageUrl = src.split('?')[0]; // Remove query params
                }
            }
            
            // Extract stats (reviews, rating, years hosting)
            const statsHeadings = document.querySelectorAll('[data-testid$="-stat-heading"]');
            statsHeadings.forEach(el => {
                const testId = el.getAttribute('data-testid');
                const value = el.textContent.trim();
                
                if (testId && testId.includes('Reviews')) {
                    result.reviewsCount = parseInt(value) || 0;
                } else if (testId && testId.includes('Rating')) {
                    // Extract rating from the element or its parent
                    const ratingText = value;
                    const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
                    if (ratingMatch) {
                        result.rating = parseFloat(ratingMatch[1]);
                    }
                } else if (testId && testId.includes('Years')) {
                    result.yearsHosting = parseInt(value) || 0;
                }
            });
            
            // Extract profile details from list items
            const detailItems = document.querySelectorAll('li .rx7n8c4, li .t1sthkkh');
            detailItems.forEach(item => {
                const text = item.textContent.trim();
                
                if (text.includes('My work:')) {
                    result.work = text.replace('My work:', '').trim();
                } else if (text.includes('Pets:')) {
                    result.pets = text.replace('Pets:', '').trim();
                } else if (text.includes('Born in')) {
                    result.location = text;
                } else if (text.includes('Speaks')) {
                    const langText = text.replace('Speaks', '').trim();
                    // Split by "and" or ","
                    result.languages = langText.split(/,|\sand\s/).map(l => l.trim()).filter(l => l);
                }
            });
            
            // Extract about section
            const aboutEl = document.querySelector('._1e2prbn') || 
                           document.querySelector('.a3xqjte span') ||
                           document.querySelector('[class*="about"]');
            if (aboutEl) {
                result.about = aboutEl.textContent.trim();
            }
            
            return result;
        });
        
        logger.info(`Successfully extracted host data for: ${hostData.name}`);
        
        // Detect if host is a company or individual
        const companyDetection = detectCompanyHost(hostData);
        hostData.isCompany = companyDetection.isCompany;
        hostData.companyName = companyDetection.companyName;
        
        logger.info(`Host type: ${hostData.isCompany ? 'Company' : 'Individual'}${hostData.companyName ? ` (${hostData.companyName})` : ''}`);

        // Close browser
        await browser.close();
        browser = null;

        // Calculate processing time
        const processingTime = Math.round((Date.now() - startTime) / 1000);

        logger.info('Host information retrieval completed successfully');

        // Return results
        res.json({
            success: true,
            data: {
                listingId: listingId,
                listingUrl: listingUrl,
                hostProfileId: hostProfileId,
                hostProfileUrl: hostProfileUrl,
                host: hostData
            },
            meta: {
                scrapedAt: new Date().toISOString(),
                processingTime: `${processingTime}s`
            }
        });

    } catch (error) {
        console.error('[API] Error in getHostsByListingId:', error);
        
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

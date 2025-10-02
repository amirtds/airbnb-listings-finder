/**
 * Scraper for Airbnb listing location information
 */

/**
 * Extract location information from the listing page
 * @param {Object} page - Playwright page instance
 * @returns {Promise<Object>} Location data object
 */
export async function extractLocation(page) {
    try {
        const locationData = await page.evaluate(() => {
            const result = {
                address: null,
                city: null,
                state: null,
                country: null,
                coordinates: {
                    latitude: null,
                    longitude: null
                }
            };

            // Method 1: Extract from "Where you'll be" section
            const locationSection = document.querySelector('[data-section-id="LOCATION_DEFAULT"]');
            
            // Try multiple selectors for location text
            let locationText = null;
            
            // Try h3 first
            const h3Element = locationSection?.querySelector('h3');
            if (h3Element) {
                locationText = h3Element.textContent.trim();
            }
            
            // Try div with class s1qk96pm (newer Airbnb layout)
            if (!locationText) {
                const divElement = locationSection?.querySelector('.s1qk96pm, div[class*="qk96pm"]');
                if (divElement) {
                    locationText = divElement.textContent.trim();
                }
            }
            
            // Try any div directly after h2 "Where you'll be"
            if (!locationText) {
                const h2 = locationSection?.querySelector('h2');
                if (h2) {
                    const nextDiv = h2.parentElement?.nextElementSibling;
                    if (nextDiv) {
                        locationText = nextDiv.textContent.trim();
                    }
                }
            }
            
            if (locationText) {
                // Format is usually: "City, State, Country" or "City, Country"
                const parts = locationText.split(',').map(p => p.trim());
                
                if (parts.length === 3) {
                    result.city = parts[0];
                    result.state = parts[1];
                    result.country = parts[2];
                } else if (parts.length === 2) {
                    result.city = parts[0];
                    result.country = parts[1];
                } else if (parts.length === 1) {
                    result.city = parts[0];
                }
            }

            // Method 2: Extract address from the description text
            if (locationSection) {
                const descriptionSpans = locationSection.querySelectorAll('.l1h825yc');
                if (descriptionSpans.length > 0) {
                    const addressText = Array.from(descriptionSpans)
                        .map(span => span.textContent.trim())
                        .join(' ');
                    if (addressText) {
                        result.address = addressText;
                    }
                }
            }

            // Method 3: Extract coordinates from Google Maps static image
            const mapImage = document.querySelector('[data-section-id="LOCATION_DEFAULT"] img[src*="maps.googleapis.com"]');
            if (mapImage) {
                const src = mapImage.src;
                // Extract center parameter: center=LAT,LNG (try both %2C and & separators)
                let centerMatch = src.match(/center=([-\d.]+)%2C([-\d.]+)/);
                if (!centerMatch) {
                    centerMatch = src.match(/center=([-\d.]+)&/);
                    if (centerMatch) {
                        // Try to find longitude after the latitude
                        const lonMatch = src.match(/center=[-\d.]+%2C([-\d.]+)/);
                        if (lonMatch) {
                            result.coordinates.latitude = parseFloat(centerMatch[1]);
                            result.coordinates.longitude = parseFloat(lonMatch[1]);
                        }
                    }
                } else {
                    result.coordinates.latitude = parseFloat(centerMatch[1]);
                    result.coordinates.longitude = parseFloat(centerMatch[2]);
                }
            }

            // Method 4: Try to get coordinates from map data attributes
            const mapContainer = document.querySelector('[data-section-id="LOCATION_DEFAULT"] [data-testid="map/GoogleMapStatic"]');
            if (mapContainer && !result.coordinates.latitude) {
                const src = mapContainer.getAttribute('src');
                if (src) {
                    const centerMatch = src.match(/center=([-\d.]+)%2C([-\d.]+)/);
                    if (centerMatch) {
                        result.coordinates.latitude = parseFloat(centerMatch[1]);
                        result.coordinates.longitude = parseFloat(centerMatch[2]);
                    }
                }
            }

            return result;
        });
        
        // Removed console.logs for performance
        return locationData;
    } catch (error) {
        console.error(`[Location] Error extracting location: ${error.message}`);
        return {
            address: null,
            city: null,
            state: null,
            country: null,
            coordinates: {
                latitude: null,
                longitude: null
            }
        };
    }
}

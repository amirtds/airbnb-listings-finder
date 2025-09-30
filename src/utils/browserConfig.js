/**
 * Browser configuration for stealth and anti-detection
 */

/**
 * Get browser launch options for stealth
 */
export function getBrowserLaunchOptions() {
    return {
        launchOptions: {
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security'
            ]
        }
    };
}

/**
 * Get pre-navigation hooks for realistic browser behavior
 */
export function getPreNavigationHooks() {
    return [
        async ({ page }) => {
            // Set realistic viewport
            await page.setViewportSize({ width: 1920, height: 1080 });
            
            // Override navigator.webdriver
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false,
                });
            });
            
            // Set realistic user agent and headers
            await page.setExtraHTTPHeaders({
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            });
        }
    ];
}

/**
 * Utility functions for adding delays to avoid rate limiting
 */

/**
 * Wait for a random delay between min and max milliseconds
 * @param {number} minDelay - Minimum delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @param {Object} logger - Logger instance
 */
export async function randomDelay(minDelay, maxDelay, logger) {
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    if (logger) {
        logger.info(`Waiting ${delay}ms before next action...`);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Wait for a fixed delay
 * @param {number} ms - Milliseconds to wait
 */
export async function fixedDelay(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

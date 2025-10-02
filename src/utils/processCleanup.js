/**
 * Utility to help clean up zombie browser processes
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Kill any orphaned Chromium/Playwright processes
 * This is a safety mechanism to prevent zombie processes
 */
export async function killOrphanedBrowsers() {
    try {
        // Find and kill orphaned chromium processes
        // This is safe because we're only killing headless chromium processes
        const { stdout } = await execAsync("ps aux | grep -E 'chromium|chrome.*headless' | grep -v grep | awk '{print $2}'");
        
        if (stdout.trim()) {
            const pids = stdout.trim().split('\n');
            console.log(`[Cleanup] Found ${pids.length} potential orphaned browser processes`);
            
            for (const pid of pids) {
                try {
                    await execAsync(`kill -9 ${pid}`);
                    console.log(`[Cleanup] Killed process ${pid}`);
                } catch (e) {
                    // Process might have already exited
                }
            }
        }
    } catch (error) {
        // No processes found or error - this is fine
        console.log('[Cleanup] No orphaned browser processes found');
    }
}

/**
 * Get count of running browser processes
 */
export async function getBrowserProcessCount() {
    try {
        const { stdout } = await execAsync("ps aux | grep -E 'chromium|chrome.*headless' | grep -v grep | wc -l");
        return parseInt(stdout.trim()) || 0;
    } catch (error) {
        return 0;
    }
}

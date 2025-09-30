/**
 * Authentication middleware using Bearer tokens
 */

/**
 * Simple token-based authentication
 * Checks for Bearer token in Authorization header
 */
export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
        
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'Please provide an Authorization header with a valid token',
            example: 'Authorization: Bearer YOUR_API_TOKEN',
            debug: {
                receivedHeaders: Object.keys(req.headers)
            }
        });
    }

    // Extract token from "Bearer TOKEN" format
    const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;

    // Get valid tokens from environment variable
    const validTokens = process.env.API_TOKENS 
        ? process.env.API_TOKENS.split(',').map(t => t.trim())
        : ['default-token-change-me']; // Default token for development

    // Validate token
    if (!validTokens.includes(token)) {
        return res.status(403).json({
            success: false,
            error: 'Invalid token',
            message: 'The provided token is not valid',
            debug: {
                receivedToken: token,
                validTokenCount: validTokens.length
            }
        });
    }

    next();
}

/**
 * Optional authentication - allows requests with or without token
 * If token is provided, it must be valid
 */
export function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    // No auth header provided - allow request
    if (!authHeader) {
        return next();
    }

    // Auth header provided - validate it
    authenticate(req, res, next);
}

/**
 * Request logging middleware
 */

export function requestLogger(req, res, next) {
    req.startTime = Date.now();
    
    const { method, url, body } = req;
    console.log(`[${new Date().toISOString()}] ${method} ${url}`);
    
    if (method === 'POST' && body) {
        console.log('Request body:', JSON.stringify(body, null, 2));
    }

    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        console.log(`[${new Date().toISOString()}] ${method} ${url} - ${res.statusCode} (${duration}ms)`);
    });

    next();
}

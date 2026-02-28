import { LRUCache } from "lru-cache";

interface RateLimitOptions {
    interval: number; // ms
    uniqueTokenPerInterval: number;
}

export function rateLimit(options: RateLimitOptions) {
    const tokenCache = new LRUCache<string, number[]>({
        max: options.uniqueTokenPerInterval,
        ttl: options.interval,
    });

    return {
        check(limit: number, token: string): { success: boolean } {
            const now = Date.now();
            const tokenCount = tokenCache.get(token) || [];
            // Prune old timestamps
            const recent = tokenCount.filter(
                (ts) => now - ts < options.interval
            );

            if (recent.length >= limit) {
                return { success: false };
            }

            recent.push(now);
            tokenCache.set(token, recent);
            return { success: true };
        },
    };
}

// Separate limiters per route — 30 requests per minute per IP
export const extractLimiter = rateLimit({
    interval: 60_000,
    uniqueTokenPerInterval: 500,
});

export const chatLimiter = rateLimit({
    interval: 60_000,
    uniqueTokenPerInterval: 500,
});

/**
 * In-memory sliding window rate limiter for Next.js API routes.
 * Limits requests per client IP to prevent abuse.
 */

const ipRequests = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

/**
 * Checks if a given IP has exceeded the rate limit.
 *
 * @param {string} ip
 * @returns {{ allowed: boolean, remaining: number }}
 */
export function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Clean up old timestamps
  let timestamps = ipRequests.get(ip) || [];
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS) {
    ipRequests.set(ip, timestamps);
    return {
      allowed: false,
      remaining: 0,
    };
  }

  timestamps.push(now);
  ipRequests.set(ip, timestamps);

  return {
    allowed: true,
    remaining: MAX_REQUESTS - timestamps.length,
  };
}

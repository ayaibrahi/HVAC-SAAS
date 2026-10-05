export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export type InMemoryRateLimiterOptions = {
  maxAttempts: number;
  windowMs: number;
  now?: () => number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: InMemoryRateLimiterOptions) {
    this.maxAttempts = options.maxAttempts;
    this.windowMs = options.windowMs;
    this.now = options.now ?? Date.now;
  }

  check(key: string): RateLimitResult {
    const now = this.now();
    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      const resetAt = now + this.windowMs;

      this.buckets.set(key, { count: 1, resetAt });

      return {
        allowed: true,
        remaining: Math.max(0, this.maxAttempts - 1),
        resetAt,
      };
    }

    if (current.count >= this.maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: current.resetAt,
      };
    }

    current.count += 1;

    return {
      allowed: true,
      remaining: Math.max(0, this.maxAttempts - current.count),
      resetAt: current.resetAt,
    };
  }
}

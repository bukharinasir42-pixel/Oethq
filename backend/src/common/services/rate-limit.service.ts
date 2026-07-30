type RateLimitState = {
  count: number;
  resetAt: number;
};

export class RateLimitService {
  private readonly buckets = new Map<string, RateLimitState>();

  consume(key: string, limit: number, windowSeconds: number) {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      this.prune(now);
      return { allowed: true as const, retryAfterSeconds: 0 };
    }

    if (existing.count >= limit) {
      return {
        allowed: false as const,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
      };
    }

    existing.count += 1;
    this.buckets.set(key, existing);
    this.prune(now);
    return { allowed: true as const, retryAfterSeconds: 0 };
  }

  private prune(now: number) {
    if (this.buckets.size < 500) {
      return;
    }

    for (const [key, state] of this.buckets.entries()) {
      if (state.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

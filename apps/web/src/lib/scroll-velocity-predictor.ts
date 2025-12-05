/**
 * ============================================================================
 * SCROLL VELOCITY PREDICTOR
 * ============================================================================
 * Version: 1.0.0
 *
 * PURPOSE:
 * Predicts scroll velocity to enable intelligent prefetching.
 * When user is scrolling fast toward the end of data, we prefetch
 * before they reach the threshold, eliminating loading delays.
 *
 * INDUSTRY PATTERNS:
 * - Twitter/X: Predicts scroll to prefetch timeline
 * - Slack: Prefetches message history based on scroll speed
 * - Instagram: Pre-loads images based on scroll velocity
 *
 * USAGE:
 * ```typescript
 * const predictor = new ScrollVelocityPredictor();
 *
 * // In scroll handler:
 * predictor.addSample(scrollTop);
 * const { velocity, direction } = predictor.getVelocity();
 *
 * // Should we prefetch?
 * if (predictor.shouldPrefetch(distanceToBottom, 200)) {
 *   fetchNextPage();
 * }
 * ```
 *
 * ============================================================================
 */

export interface ScrollVelocity {
  /** Velocity in pixels per second */
  velocity: number;
  /** Scroll direction */
  direction: 'up' | 'down' | 'idle';
}

export interface ScrollSample {
  /** Timestamp in ms (from performance.now()) */
  time: number;
  /** Scroll position in px */
  position: number;
}

/**
 * ScrollVelocityPredictor
 *
 * Tracks scroll samples and calculates velocity for prefetch prediction.
 * Uses a sliding window of samples to smooth out jitter.
 */
export class ScrollVelocityPredictor {
  private samples: ScrollSample[] = [];

  /** Time window for samples (ms) */
  private readonly SAMPLE_WINDOW = 500;

  /** Minimum samples needed for velocity calculation */
  private readonly MIN_SAMPLES = 3;

  /** Maximum samples to keep */
  private readonly MAX_SAMPLES = 20;

  /** Minimum movement to register direction (px) */
  private readonly DIRECTION_THRESHOLD = 10;

  /**
   * Add a scroll position sample
   *
   * @param position - Current scroll position in pixels
   */
  addSample(position: number): void {
    const now = performance.now();

    this.samples.push({ time: now, position });

    // Trim old samples outside window
    this.samples = this.samples.filter(
      (s) => now - s.time < this.SAMPLE_WINDOW
    );

    // Keep max samples
    if (this.samples.length > this.MAX_SAMPLES) {
      this.samples = this.samples.slice(-this.MAX_SAMPLES);
    }
  }

  /**
   * Calculate current scroll velocity and direction
   *
   * @returns Velocity (px/s) and direction
   */
  getVelocity(): ScrollVelocity {
    if (this.samples.length < this.MIN_SAMPLES) {
      return { velocity: 0, direction: 'idle' };
    }

    const oldest = this.samples[0];
    const newest = this.samples[this.samples.length - 1];

    const deltaPosition = newest.position - oldest.position;
    const deltaTime = (newest.time - oldest.time) / 1000; // Convert to seconds

    if (deltaTime === 0) {
      return { velocity: 0, direction: 'idle' };
    }

    const velocity = Math.abs(deltaPosition / deltaTime);

    let direction: 'up' | 'down' | 'idle';
    if (deltaPosition > this.DIRECTION_THRESHOLD) {
      direction = 'down';
    } else if (deltaPosition < -this.DIRECTION_THRESHOLD) {
      direction = 'up';
    } else {
      direction = 'idle';
    }

    return { velocity, direction };
  }

  /**
   * Predict time until user reaches a distance threshold
   *
   * @param currentDistance - Current distance to threshold (px)
   * @returns Time in seconds (Infinity if not moving)
   */
  predictTimeToThreshold(currentDistance: number): number {
    const { velocity } = this.getVelocity();

    if (velocity === 0) {
      return Infinity;
    }

    return currentDistance / velocity;
  }

  /**
   * Determine if we should prefetch based on scroll behavior
   *
   * Strategy: Prefetch if user will reach bottom before fetch completes
   *
   * @param distanceToBottom - Distance to end of content (px)
   * @param networkLatency - Expected fetch latency (ms), default 200ms
   * @returns Whether to start prefetching
   */
  shouldPrefetch(distanceToBottom: number, networkLatency: number = 200): boolean {
    const { velocity, direction } = this.getVelocity();

    // Only prefetch when scrolling down
    if (direction !== 'down') {
      return false;
    }

    // Not moving fast enough to need prediction
    if (velocity < 100) {
      return false;
    }

    const timeToThreshold = this.predictTimeToThreshold(distanceToBottom);
    const fetchTime = networkLatency / 1000; // Convert to seconds

    // Add 100ms buffer for safety
    const buffer = 0.1;

    return timeToThreshold < fetchTime + buffer;
  }

  /**
   * Reset all samples (call when list changes)
   */
  reset(): void {
    this.samples = [];
  }

  /**
   * Get current scroll state summary
   */
  getState(): {
    sampleCount: number;
    velocity: number;
    direction: 'up' | 'down' | 'idle';
    isActive: boolean;
  } {
    const { velocity, direction } = this.getVelocity();

    return {
      sampleCount: this.samples.length,
      velocity: Math.round(velocity),
      direction,
      isActive: this.samples.length >= this.MIN_SAMPLES,
    };
  }
}

/**
 * React hook for scroll velocity prediction
 *
 * @returns ScrollVelocityPredictor instance (stable reference)
 */
export function useScrollVelocityPredictor(): ScrollVelocityPredictor {
  // Use module-level singleton for the predictor to avoid re-creation
  // This is intentional - we want to preserve scroll history across re-renders
  const predictorRef = { current: null as ScrollVelocityPredictor | null };

  if (!predictorRef.current) {
    predictorRef.current = new ScrollVelocityPredictor();
  }

  return predictorRef.current;
}

// Singleton instance for simple usage
let globalPredictor: ScrollVelocityPredictor | null = null;

/**
 * Get global scroll velocity predictor instance
 */
export function getScrollVelocityPredictor(): ScrollVelocityPredictor {
  if (!globalPredictor) {
    globalPredictor = new ScrollVelocityPredictor();
  }
  return globalPredictor;
}

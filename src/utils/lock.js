/**
 * In-Process Keyed Asynchronous Mutex Lock
 * Provides serial execution per key (e.g., auctionId) to complement
 * database row-level locking (SELECT ... FOR UPDATE) across async event loops.
 */
class KeyedMutex {
  constructor() {
    this.queues = new Map();
  }

  /**
   * Executes an async task while holding an exclusive lock for the given key.
   *
   * @param {string|number} key - The resource identifier (e.g. auctionId)
   * @param {Function} task - The asynchronous operation returning a promise
   * @returns {Promise<any>}
   */
  async runExclusive(key, task) {
    const stringKey = String(key);
    let previousPromise = this.queues.get(stringKey) || Promise.resolve();

    let release;
    const currentPromise = new Promise((resolve) => {
      release = resolve;
    });

    // Update current queue for this key
    this.queues.set(stringKey, previousPromise.then(() => currentPromise));

    // Wait for the prior task to finish
    await previousPromise;

    try {
      return await task();
    } finally {
      release();
      // Cleanup if this was the last queued item
      if (this.queues.get(stringKey) === currentPromise) {
        this.queues.delete(stringKey);
      }
    }
  }
}

export const auctionMutex = new KeyedMutex();

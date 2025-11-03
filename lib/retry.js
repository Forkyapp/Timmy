const { jarvis } = require('./ui');

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry configuration
 * @returns {Promise} Result of successful execution
 */
async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    backoffFactor = 2,
    timeoutMs = null,
    retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'],
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Apply timeout if specified
      if (timeoutMs) {
        return await Promise.race([
          fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
          )
        ]);
      }

      return await fn();

    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = isErrorRetryable(error, retryableErrors);

      // Last attempt or non-retryable error
      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelayMs * Math.pow(backoffFactor, attempt - 1),
        maxDelayMs
      );

      // Add jitter (30% randomness)
      const jitter = Math.random() * 0.3 * delay;
      const totalDelay = Math.round(delay + jitter);

      console.log(jarvis.warning(
        `Attempt ${attempt}/${maxAttempts} failed: ${error.message}`
      ));
      console.log(jarvis.info(`Retrying in ${totalDelay}ms...`));

      // Call retry callback if provided
      if (onRetry) {
        await onRetry(attempt, error, totalDelay);
      }

      await sleep(totalDelay);
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable
 */
function isErrorRetryable(error, retryableErrors) {
  // Check error code
  if (error.code && retryableErrors.includes(error.code)) {
    return true;
  }

  // Check error name
  if (error.name && retryableErrors.includes(error.name)) {
    return true;
  }

  // Check HTTP status codes
  if (error.response) {
    const status = error.response.status;
    // Retry on 429 (rate limit), 5xx (server errors)
    if (status === 429 || (status >= 500 && status < 600)) {
      return true;
    }
  }

  // Check error message patterns
  const message = error.message.toLowerCase();
  if (message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('rate limit')) {
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with custom error handling
 */
async function withRetryAndFallback(fn, fallbackFn, options = {}) {
  try {
    return await withRetry(fn, options);
  } catch (error) {
    console.log(jarvis.warning('All retry attempts failed, using fallback'));
    return await fallbackFn(error);
  }
}

/**
 * Retry multiple operations in parallel
 */
async function retryAll(operations, options = {}) {
  const promises = operations.map(op => withRetry(op, options));
  return Promise.allSettled(promises);
}

module.exports = {
  withRetry,
  withRetryAndFallback,
  retryAll,
  isErrorRetryable,
  sleep
};

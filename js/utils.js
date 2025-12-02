/**
 * Text Saver Extension - Utility Functions
 * Shared logic for background, content, and popup scripts.
 */

// --- Timestamp & Sorting ---

/**
 * Extracts a timestamp from an item's updatedAt or createdAt field.
 * @param {Object} item - The item to extract timestamp from.
 * @returns {number} Timestamp in milliseconds, or 0 if invalid.
 */
function getItemTimestamp(item) {
  if (!item || typeof item !== 'object') {
    return 0;
  }
  const source = item.updatedAt || item.createdAt;
  if (!source) {
    return 0;
  }
  const timestamp = new Date(source).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

/**
 * Comparator function for sorting items by recency (newest first).
 */
function compareByRecency(a, b) {
  return getItemTimestamp(b) - getItemTimestamp(a);
}

/**
 * Sorts an array of items by recency (newest first).
 * @param {Array} items - Array of items to sort.
 * @returns {Array} Sorted array.
 */
function sortByRecency(items) {
  if (!Array.isArray(items)) return [];
  return items.sort(compareByRecency);
}

// --- Text Manipulation ---

/**
 * Truncates text to a specified limit and adds ellipsis.
 * @param {string} text - Text to truncate.
 * @param {number} limit - Character limit.
 * @returns {string} Truncated text.
 */
function truncateText(text, limit) {
  if (!text) return '';
  if (typeof limit !== 'number' || limit <= 0) return text;
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/**
 * Sanitizes text for safe display in HTML (removes tags).
 * @param {string} input - Raw input string.
 * @returns {string} Sanitized string.
 */
function sanitizeForDisplay(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

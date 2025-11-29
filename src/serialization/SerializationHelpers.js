/**
 * Serialization helper utilities for Geotic ECS
 * Handles BigInt encoding/decoding and special value types
 */

/**
 * Internal fields that should not be serialized
 * These are runtime-only fields that get reconstructed during deserialization
 */
const SKIP_FIELDS = new Set(['_cbits', '_cbit', '_qeligible', 'world', 'entity']);

/**
 * Custom JSON replacer function for handling BigInt and other special types
 *
 * @param {string} key - Property key
 * @param {*} value - Property value
 * @returns {*} Transformed value for JSON serialization
 */
export function bigintReplacer(key, value) {
    // Skip internal ECS fields - they're reconstructed during deserialization
    if (SKIP_FIELDS.has(key)) {
        return undefined;
    }

    // Handle BigInt - encode as special object
    if (typeof value === 'bigint') {
        return { $bigint: value.toString() };
    }

    // Handle Date - encode as ISO string
    if (value instanceof Date) {
        return { $date: value.toISOString() };
    }

    return value;
}

/**
 * Custom JSON reviver function for decoding BigInt and other special types
 *
 * @param {string} key - Property key
 * @param {*} value - Property value from JSON
 * @returns {*} Decoded value
 */
export function bigintReviver(key, value) {
    // Decode BigInt
    if (value && typeof value === 'object' && value.$bigint) {
        return BigInt(value.$bigint);
    }

    // Decode Date
    if (value && typeof value === 'object' && value.$date) {
        return new Date(value.$date);
    }

    return value;
}

/**
 * Deep traverse an object and apply a transformation function
 *
 * @param {*} obj - Object to traverse
 * @param {Function} fn - Transformation function (value, key, parent) => newValue
 * @param {Set} [visited] - Set of visited objects to detect cycles
 * @returns {*} Transformed object
 */
export function deepTraverse(obj, fn, visited = new Set()) {
    // Handle primitives
    if (obj === null || typeof obj !== 'object') {
        return fn(obj, null, null);
    }

    // Detect circular references
    if (visited.has(obj)) {
        throw new Error('Circular reference detected during serialization');
    }
    visited.add(obj);

    // Handle arrays
    if (Array.isArray(obj)) {
        const result = obj.map((item, idx) => deepTraverse(item, fn, visited));
        visited.delete(obj);
        return result;
    }

    // Handle objects
    const result = {};
    for (const key in obj) {
        if (SKIP_FIELDS.has(key)) {
            continue;
        }
        result[key] = deepTraverse(obj[key], fn, visited);
    }
    visited.delete(obj);
    return result;
}

/**
 * Calculate a simple checksum for data integrity validation
 *
 * @param {string} data - Serialized JSON string
 * @returns {string} Checksum hash
 */
export function calculateChecksum(data) {
    // Simple hash function - can be replaced with crypto.subtle in browser
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `simple:${hash.toString(16)}`;
}

/**
 * Verify checksum matches data
 *
 * @param {string} data - Serialized JSON string
 * @param {string} expectedChecksum - Expected checksum
 * @returns {boolean} True if checksum matches
 */
export function verifyChecksum(data, expectedChecksum) {
    const actualChecksum = calculateChecksum(data);
    return actualChecksum === expectedChecksum;
}

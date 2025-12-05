/**
 * Get a value from a nested object using bracket notation path.
 * Supports paths like "cv[0]" or simple property names.
 * @param {Object} obj - Object to read from
 * @param {string} path - Property path (e.g., "cv[0]" or "vOct")
 * @returns {*} The value at the path
 */
export function getNestedValue(obj, path) {
    const match = path.match(/(\w+)\[(\d+)\]/);
    if (match) {
        return obj[match[1]][parseInt(match[2])];
    }
    return obj[path];
}

/**
 * Set a value in a nested object using bracket notation path.
 * Handles Float32Array copying for audio buffers.
 * @param {Object} obj - Object to modify
 * @param {string} path - Property path (e.g., "cv[0]" or "vOct")
 * @param {*} value - Value to set
 */
export function setNestedValue(obj, path, value) {
    const match = path.match(/(\w+)\[(\d+)\]/);
    if (match) {
        const arr = obj[match[1]];
        const idx = parseInt(match[2]);
        if (value instanceof Float32Array) {
            if (arr[idx] instanceof Float32Array) {
                arr[idx].set(value);
            } else {
                arr[idx] = value[0];
            }
        } else {
            arr[idx] = value;
        }
    } else {
        if (obj[path] instanceof Float32Array && value instanceof Float32Array) {
            obj[path].set(value);
        } else if (obj[path] instanceof Float32Array) {
            obj[path].fill(value);
        } else if (value instanceof Float32Array) {
            obj[path] = value[0];
        } else {
            obj[path] = value;
        }
    }
}

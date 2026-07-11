/**
 * Get a value from a nested object using bracket notation path.
 * Supports paths like "cv[0]" or simple property names.
 * @param {Object} obj - Object to read from
 * @param {string} path - Property path (e.g., "cv[0]" or "vOct")
 * @returns {*} The value at the path
 */
const PATH_PATTERN = /^([A-Za-z_$][\w$-]*)(?:\[(\d+)\])?$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function parsePath(path) {
    const match = typeof path === 'string' ? PATH_PATTERN.exec(path) : null;
    if (!match || FORBIDDEN_KEYS.has(match[1])) {
        throw new TypeError(`Unsupported nested path "${path}"`);
    }
    return { key: match[1], index: match[2] === undefined ? null : Number(match[2]) };
}

function copyBuffer(target, source) {
    if (target.length !== source.length) {
        throw new RangeError(`Float32Array length mismatch: ${source.length} cannot fill ${target.length}`);
    }
    target.set(source);
}

export function getNestedValue(obj, path) {
    const { key, index } = parsePath(path);
    return index === null ? obj[key] : obj[key][index];
}

/**
 * Set a value in a nested object using bracket notation path.
 * Handles Float32Array copying for audio buffers.
 * @param {Object} obj - Object to modify
 * @param {string} path - Property path (e.g., "cv[0]" or "vOct")
 * @param {*} value - Value to set
 */
export function setNestedValue(obj, path, value) {
    const { key, index } = parsePath(path);
    if (index !== null) {
        const arr = obj[key];
        const idx = index;
        if (value instanceof Float32Array) {
            if (arr[idx] instanceof Float32Array) {
                copyBuffer(arr[idx], value);
            } else {
                arr[idx] = value[0];
            }
        } else {
            arr[idx] = value;
        }
    } else {
        if (obj[key] instanceof Float32Array && value instanceof Float32Array) {
            copyBuffer(obj[key], value);
        } else if (obj[key] instanceof Float32Array) {
            obj[key].fill(value);
        } else if (value instanceof Float32Array) {
            obj[key] = value[0];
        } else {
            obj[key] = value;
        }
    }
}

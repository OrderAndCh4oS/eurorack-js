/**
 * Factory preset patches for the eurorack synthesizer
 *
 * Re-exports from individual patch files in the patches/ directory.
 * Each patch file contains:
 *   - name: Display name
 *   - factory: true (marks as read-only factory patch)
 *   - state: Patch state object. New patches should use v2
 *     {version, modules, params, cables, midiMappings}; legacy
 *     {modules, knobs, switches, buttons, cables} is normalized at load time.
 */

export { FACTORY_PATCHES } from './patches/index.js';

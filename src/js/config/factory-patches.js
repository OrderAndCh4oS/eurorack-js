/**
 * Factory preset patches for the eurorack synthesizer
 *
 * Re-exports from individual patch files in the patches/ directory.
 * Each patch file contains:
 *   - name: Display name
 *   - factory: true (marks as read-only factory patch)
 *   - state: Canonical v2 patch state:
 *     {version, modules, params, cables, midiMappings}
 */

export { FACTORY_PATCHES } from './patches/index.js';

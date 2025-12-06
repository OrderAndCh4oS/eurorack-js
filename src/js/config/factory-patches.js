/**
 * Factory preset patches for the eurorack synthesizer
 *
 * Re-exports from individual patch files in the patches/ directory.
 * Each patch file contains:
 *   - name: Display name
 *   - factory: true (marks as read-only factory patch)
 *   - state: Patch state object with modules, knobs, switches, buttons, cables
 *     - modules: Array of {type, instanceId, row} defining rack layout
 */

export { FACTORY_PATCHES } from './patches/index.js';

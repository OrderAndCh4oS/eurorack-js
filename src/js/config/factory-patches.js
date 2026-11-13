/**
 * Complete built-in patch exports for regression checks and archive tooling.
 * Browser library code should import TEST_PATCHES from ./test-patches.js so
 * archived musical examples are not part of its eager import graph.
 */
export { FACTORY_PATCHES, ARCHIVED_DEMO_PATCHES } from './patches/index.js';
export { TEST_PATCHES } from './test-patches.js';

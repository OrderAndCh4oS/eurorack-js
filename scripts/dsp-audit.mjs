#!/usr/bin/env node

import { MODULE_MANIFEST } from '../src/js/rack/module-manifest.js';
import {
    AUDIT_BLOCK_SIZES,
    AUDIT_SAMPLE_RATES,
    auditDefinition,
    summarizeAudit
} from './lib/dsp-audit.js';

function parseArgs(argv) {
    const args = {
        modules: [], sampleRate: 48000, blockSize: 128, blocks: 8,
        json: false, matrix: false, strictVoltage: false
    };
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (value === '--module') args.modules.push(argv[++index]);
        else if (value === '--sample-rate') args.sampleRate = Number(argv[++index]);
        else if (value === '--block-size') args.blockSize = Number(argv[++index]);
        else if (value === '--blocks') args.blocks = Number(argv[++index]);
        else if (value === '--json') args.json = true;
        else if (value === '--matrix') args.matrix = true;
        else if (value === '--strict-voltage') args.strictVoltage = true;
        else throw new Error('Unknown argument: ' + value);
    }
    return args;
}

const args = parseArgs(process.argv.slice(2));
const entries = args.modules.length
    ? MODULE_MANIFEST.filter(entry => args.modules.includes(entry.id))
    : MODULE_MANIFEST;
const missing = args.modules.filter(id => !entries.some(entry => entry.id === id));
if (missing.length) throw new Error('Unknown module IDs: ' + missing.join(', '));

const definitions = await Promise.all(entries.map(async entry => (await entry.load()).default));
const configurations = args.matrix
    ? AUDIT_SAMPLE_RATES.flatMap(sampleRate => AUDIT_BLOCK_SIZES.map(blockSize => ({ sampleRate, blockSize })))
    : [{ sampleRate: args.sampleRate, blockSize: args.blockSize }];
const results = configurations.flatMap(configuration => definitions.map(definition => auditDefinition(definition, {
    ...configuration,
    blocks: args.blocks
})));

if (args.json) {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
} else {
    const summaries = results.map(summarizeAudit);
    console.table(summaries.map(summary => ({
        module: summary.id,
        category: summary.category,
        scenarios: summary.scenarios,
        errors: summary.errors.length,
        finite: summary.finite,
        'voltage flags': summary.voltageViolations.length,
        stable: summary.stableBuffers,
        peak: summary.peak.toFixed(3),
        'max us/block': summary.maxMicrosecondsPerBlock.toFixed(1)
    })));
    const failures = summaries.filter(summary => (
        summary.errors.length || !summary.finite || !summary.stableBuffers ||
        (args.strictVoltage && !summary.voltageCompliant)
    ));
    if (failures.length) {
        process.exitCode = 1;
        console.error('Audit invariant failures: ' + [...new Set(failures.map(result => result.id))].join(', '));
    }
}

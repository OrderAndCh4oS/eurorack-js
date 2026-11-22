export const RACK_HOME = {
    path: '/',
    title: 'Modular Synth Rack',
    description: 'Patch oscillators, filters and effects in your browser. Play with MIDI, then save and share your rack.'
};

// Only these repository documents are published as product documentation.
// Deployment notes and internal planning documents stay in the repository.
export const DOCS_PAGES = [
    { source: 'docs/index.md', path: '/docs', title: 'Documentation', navTitle: 'Start here', group: 'Using Eurorack', description: 'Learn the rack, write patches with JavaScript, and connect a browser agent.' },
    { source: 'docs/midi.md', path: '/docs/midi', title: 'MIDI Input and Output', navTitle: 'MIDI input and output', group: 'Using Eurorack', description: 'Connect MIDI hardware and DAWs, follow an external clock, and record rack notes and stereo audio.' },
    { source: 'docs/patch-workbench-guide.md', path: '/docs/patch-workbench-guide', title: 'Patch Workbench Guide', navTitle: 'Write your first patch', group: 'Using Eurorack', description: 'Build a synth voice with JavaScript, check its wiring, and save your patch.' },
    { source: 'docs/patch-workbench.md', path: '/docs/patch-workbench', title: 'Patch Workbench Reference', navTitle: 'Code reference', group: 'Using Eurorack', description: 'The patch builder API, keyboard shortcuts, completion, and diagnostic commands.' },
    { source: 'docs/synth-voice-demos.md', path: '/docs/synth-voice-demos', title: 'Synth Voice Basics', navTitle: 'Synth voice basics', group: 'Using Eurorack', description: 'Learn oscillator, filter, envelope and modulation routing with patches from the Test patches catalogue.' },
    { source: 'docs/webmcp.md', path: '/docs/webmcp', title: 'WebMCP', navTitle: 'WebMCP', group: 'Agents', description: 'Connect a compatible browser agent to inspect, write, and debug Eurorack patches.' },
    { source: 'docs/architecture.md', path: '/docs/architecture', title: 'Codebase Architecture and Schemas', navTitle: 'Architecture', group: 'Development', description: 'How the rack, audio worklet, module contracts, and patch format fit together.' },
    { source: 'docs/creating-modules.md', path: '/docs/creating-modules', title: 'Creating Modules', navTitle: 'Creating modules', group: 'Development', description: 'Research, implement, and test a module with its own DSP and controls.' }
];

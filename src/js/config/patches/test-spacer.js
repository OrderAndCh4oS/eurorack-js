const panels = [
    ['contour', 7], ['orbit', 8], ['weave', 5],
    ['dunes', 12], ['prism', 6], ['pulse', 9]
];

export default {
    name: 'Test - Spacer Prints',
    factory: true,
    state: {
        version: 3,
        plugins: { core: 1 },
        modules: panels.map(([id], index) => ({ id, type: 'spacer', row: 1, index })),
        params: Object.fromEntries(panels.map(([style, hp]) => [style, { hp, style }])),
        cables: [],
        midiMappings: {}
    }
};

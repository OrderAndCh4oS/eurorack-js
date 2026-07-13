export const moduleAt = (id, type, row, index) => ({ id, type, row, index });

export const cable = (fromModule, fromPort, toModule, toPort) => ({
    fromModule,
    fromPort,
    toModule,
    toPort
});

export const stereo = (fromModule, fromPort, outputModule = 'out') => [
    cable(fromModule, fromPort, outputModule, 'L'),
    cable(fromModule, fromPort, outputModule, 'R')
];

export const sequenceParams = (overrides = {}) => ({
    step1: 0,
    step2: 0.25,
    step3: 0.5,
    step4: 0.25,
    step5: 0.75,
    step6: 0.5,
    step7: 0.25,
    step8: 0.625,
    length: 8,
    range: 1,
    direction: 0,
    gate1: 1,
    gate2: 1,
    gate3: 1,
    gate4: 1,
    gate5: 1,
    gate6: 1,
    gate7: 1,
    gate8: 1,
    ...overrides
});

export function synthVoiceDemo(name, modules, params, cables) {
    return {
        name,
        factory: true,
        state: {
            version: 3,
            plugins: { core: 1 },
            modules,
            params,
            cables,
            midiMappings: {}
        }
    };
}

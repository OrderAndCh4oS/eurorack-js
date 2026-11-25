// Both ends have the same numbered grid and LINK socket position.
export function createOctoPanel(lanePrefix) {
    const send = lanePrefix === 'in';
    const lanes = Array.from({ length: 8 }, (_, i) => {
        const label = String(i + 1);
        const port = lanePrefix + label;
        return { id: port, port, label, signal: 'any' };
    });
    const link = [{ id: 'link', port: 'link', label: 'LINK', signal: 'octo-link' }];
    const inputs = send ? lanes : link;
    const outputs = send ? link : lanes;

    return {
        hp: 6,
        category: 'utility',
        color: 'module-color-one',

        createDSP({ bufferSize = 512 } = {}) {
            const buffers = ports => Object.fromEntries(
                ports.map(({ port }) => [port, new Float32Array(bufferSize)])
            );
            return {
                params: {},
                leds: {},
                inputs: buffers(inputs),
                outputs: buffers(outputs),
                // The compiled graph fills Receive outputs directly from their lane sources.
                process() {},
                reset() {
                    for (const buffer of Object.values(this.inputs)) buffer.fill(0);
                    for (const buffer of Object.values(this.outputs)) buffer.fill(0);
                }
            };
        },

        ui: {
            inputs,
            outputs,
            socketLayout: {
                className: 'octo-sockets',
                columns: [
                    { label: send ? 'Inputs' : 'Outputs', columns: 2, ports: lanes.map(lane => lane.port) },
                    { className: 'octo-link-column', columns: 1, ports: ['link'] }
                ]
            }
        },

        css: `
            :is(.module-type-octo-send, .module-type-octo-receive) .spacer { display: none; }
            .octo-sockets {
                flex-direction: column;
                align-items: center;
                gap: 16px;
                margin-block: auto;
            }
            .octo-sockets .socket-column { gap: 8px; }
            .octo-sockets .socket-column-label { font-size: 8px; }
            .octo-sockets .socket-grid { gap: 10px 14px; }
            .octo-sockets .jack-label { font-size: 9px; }
            .octo-sockets .octo-link-column {
                width: 70px;
                border-top: 1px solid var(--factory-ink, #888);
                padding-top: 12px;
            }
            .octo-link-column .jack { border-radius: 4px; }
        `
    };
}

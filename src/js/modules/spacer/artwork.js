// All coordinates are in print space. Increasing HP reveals more of the print
// at the same line weight and pitch as its neighbouring panels.
const tau = 2 * Math.PI;

function line(ctx, x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
}

function disc(ctx, x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, tau);
    ctx.fillStyle = color;
    ctx.fill();
}

function polygon(ctx, points, color) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.fillStyle = color;
    ctx.fill();
}

function contour(ctx, w, h, { paper, ink, muted, orange }) {
    // Marching squares makes neighbouring elevations bend around the same hills.
    const step = 6;
    const columns = Math.ceil(w / step) + 1;
    const rows = Math.ceil(h / step) + 1;
    const field = new Float32Array(columns * rows);
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            const x = col * step - w / 2 + 38, y = row * step;
            field[row * columns + col] = Math.sin(x / 48 + 0.8 * Math.sin(y / 69)) +
                0.83 * Math.cos(y / 40 + 0.7 * Math.cos(x / 51)) + 0.3 * Math.sin((x + y) / 29);
        }
    }
    for (let level = -16; level <= 16; level++) {
        const elevation = level * 0.135;
        ctx.beginPath();
        for (let row = 0; row < rows - 1; row++) {
            for (let col = 0; col < columns - 1; col++) {
                const i = row * columns + col;
                const a = field[i], b = field[i + 1], c = field[i + columns + 1], d = field[i + columns];
                const x = col * step, y = row * step;
                let intersections = 0;
                const vertex = (vx, vy) => {
                    if (intersections++ % 2 === 0) ctx.moveTo(vx, vy);
                    else ctx.lineTo(vx, vy);
                };
                if ((a < elevation) !== (b < elevation)) vertex(x + step * (elevation - a) / (b - a), y);
                if ((b < elevation) !== (c < elevation)) vertex(x + step, y + step * (elevation - b) / (c - b));
                if ((d < elevation) !== (c < elevation)) vertex(x + step * (elevation - d) / (c - d), y + step);
                if ((a < elevation) !== (d < elevation)) vertex(x, y + step * (elevation - a) / (d - a));
            }
        }
        ctx.strokeStyle = level === 0 ? orange : level % 4 === 0 ? ink : muted;
        ctx.lineWidth = level % 4 === 0 ? 1.65 : 0.95;
        ctx.stroke();
    }
    for (let x = w / 2 % 128; x < w; x += 128) {
        const y = h * 0.39;
        disc(ctx, x, y, 6, paper);
        line(ctx, x - 4, y, x + 4, y, orange, 2);
        line(ctx, x, y - 4, x, y + 4, orange, 2);
    }
}

function orbit(ctx, w, h, { paper, ink, muted, orange }) {
    for (let i = 1; i <= w * h / 450; i++) {
        const x = (i * 77.31) % w, y = ((i * i * 17.27) % h);
        disc(ctx, x, y, i % 6 === 0 ? 1.5 : 0.7, i % 6 === 0 ? orange : muted);
    }
    const pitch = 236;
    for (let cx = (w / 2) % pitch - pitch; cx < w + pitch; cx += pitch) {
        const cy = h * 0.49;
        const track = (rx, ry, t) => [
            cx + rx * Math.cos(t) * 0.76 + ry * Math.sin(t) * 0.65,
            cy - rx * Math.cos(t) * 0.65 + ry * Math.sin(t) * 0.76
        ];
        for (let i = 0; i < 9; i++) {
            const rx = 35 + i * 17, ry = 9 + i * 6.1;
            ctx.beginPath();
            for (let s = 0; s <= 120; s++) {
                const [x, y] = track(rx, ry, tau * s / 120);
                if (s === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = i % 3 === 0 ? ink : muted;
            ctx.lineWidth = i % 3 === 0 ? 1.6 : 0.9;
            ctx.stroke();
            if (i === 2 || i === 6) {
                const [x, y] = track(rx, ry, i === 2 ? 1.27 : 4.45);
                disc(ctx, x, y, 5.5, paper);
                disc(ctx, x, y, 3.6, ink);
            }
        }
        disc(ctx, cx, cy, 16.5, paper);
        disc(ctx, cx, cy, 14, orange);
        disc(ctx, cx - 4.5, cy - 5.5, 2.2, paper);
    }
}

function weave(ctx, w, h, { paper, ink, rule, orange }) {
    const pitch = 56;
    function ribbon(x, y, direction, length, color, thread) {
        const dx = length * direction;
        line(ctx, x - dx, y - length, x + dx, y + length, paper, 20);
        line(ctx, x - dx, y - length, x + dx, y + length, color, 16);
        for (const offset of [-6, -2, 2, 6]) {
            line(ctx, x - dx + offset, y - length, x + dx + offset, y + length, thread, 0.85);
        }
    }
    for (let i = -Math.ceil(h / pitch) - 1; i <= Math.ceil((w + h) / pitch); i++) {
        ribbon(i * pitch, 0, 1, h, ink, rule);
        ribbon(i * pitch, 0, -1, h, orange, paper);
    }
    for (let row = 0; row <= Math.ceil(h * 2 / pitch); row++) {
        for (let col = row % 2; col <= Math.ceil(w * 2 / pitch); col += 2) {
            const over = row % 2 === 0;
            ribbon(col * pitch / 2, row * pitch / 2, over ? 1 : -1, 14,
                over ? ink : orange, over ? rule : paper);
        }
    }
}

function dunes(ctx, w, h, { paper, ink, rule, muted, orange }) {
    const horizon = h * 0.49;
    const sunX = w < 80 ? w * 0.46 : w * 0.61;
    const sunY = horizon - 40;
    disc(ctx, sunX, sunY, 33, orange);
    for (let y = 4; y < 32; y += 5) {
        const halfWidth = Math.sqrt(33 * 33 - y * y);
        line(ctx, sunX - halfWidth, sunY + y, sunX + halfWidth, sunY + y, paper, y / 14);
    }
    function ridge(x, layer) {
        const dx = x - w / 2;
        return horizon + 16 + layer * 28 + 17 * Math.sin(dx / (82 - layer * 6) + layer * 1.6) +
            11 * Math.cos(dx / 43 - layer * 0.8);
    }
    for (const [layer, color] of [rule, muted, ink, muted].entries()) {
        const skyline = [];
        for (let x = 0; x < w + 5; x += 4) skyline.push([x, ridge(x, layer)]);
        polygon(ctx, [...skyline, [w + 5, h], [0, h]], color);
        for (let band = 1; band <= (layer === 3 ? 8 : 3); band++) {
            ctx.beginPath();
            for (const [x, y] of skyline) {
                const depth = y + 3 + band * (4 + layer) + band * 0.9 * Math.sin(x / 71 + layer);
                if (x === 0) ctx.moveTo(x, depth);
                else ctx.lineTo(x, depth);
            }
            ctx.strokeStyle = layer === 3 ? ink : paper;
            ctx.lineWidth = 0.75;
            ctx.stroke();
        }
    }
}

function prism(ctx, w, h, { paper, ink, rule, muted, orange }) {
    const pitch = 116;
    for (let row = -1; row * 88 < h; row++) {
        const y = row * 88 + 13;
        for (let x = w / 2 % pitch - pitch + (row % 2) * 33; x < w; x += pitch) {
            const tip = [x + 60, y + 73];
            polygon(ctx, [[x - 10, y + 7], [x + 39, y - 13], tip], muted);
            polygon(ctx, [[x + 39, y - 13], [x + 90, y + 18], tip], row % 2 ? orange : rule);
            polygon(ctx, [[x + 90, y + 18], [x + 103, y + 39], tip], ink);
            for (let i = 1; i < 9; i++) {
                const t = i / 9;
                line(ctx, x - 10 + 49 * t, y + 7 - 20 * t, tip[0], tip[1], paper, 0.85);
            }
        }
    }
}

function pulse(ctx, w, h, { ink, grid, orange }) {
    for (let x = w / 2 % 24; x < w; x += 24) line(ctx, x, 0, x, h, grid, 0.7);
    for (let y = 0; y <= h; y += 24) line(ctx, 0, y, w, y, grid, 0.7);
    for (let row = 0; row < 39; row++) {
        const baseline = h * 0.19 + row * h * 0.018;
        ctx.beginPath();
        for (let x = -2; x <= w + 3; x += 2) {
            const phase = (x - w / 2) / 37;
            const envelope = (0.5 + 0.5 * Math.cos(phase + row * 0.049)) ** 3;
            const peak = 15 + 33 * (0.5 + 0.5 * Math.cos(phase * 3.3 - row * 0.17)) ** 2;
            const y = baseline - envelope * peak - 2 * Math.sin(phase * 7 + row / 5);
            if (x === -2) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineTo(w + 3, h + 4);
        ctx.lineTo(-2, h + 4);
        // Erase obscured traces to expose the module's own faceplate.
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = row % 11 === 3 ? orange : ink;
        ctx.lineWidth = row % 11 === 3 ? 2 : 1.25;
        ctx.stroke();
    }
}

export const SPACER_PRINTS = {
    contour: { name: 'Contour', draw: contour, color: 'module-color-three' },
    orbit:   { name: 'Orbit',   draw: orbit,   color: 'module-color-one' },
    weave:   { name: 'Weave',   draw: weave,   color: 'module-color-five' },
    dunes:   { name: 'Dunes',   draw: dunes,   color: 'module-color-six' },
    prism:   { name: 'Prism',   draw: prism,   color: 'module-color-four' },
    pulse:   { name: 'Pulse',   draw: pulse,   color: 'module-color-eleven' }
};

export function paintSpacer(canvas, style, width, height, viewHeight = 360) {
    const doc = canvas.ownerDocument;
    const density = Math.min(2, doc.defaultView.devicePixelRatio || 1);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const theme = doc.defaultView.getComputedStyle(doc.body);
    const inks = Object.fromEntries(['paper', 'ink', 'muted', 'rule', 'grid', 'orange'].map(name =>
        [name, theme.getPropertyValue('--factory-' + name).trim()]));
    const scale = canvas.height / viewHeight;
    ctx.scale(scale, scale);
    ctx.translate(0, (viewHeight - 360) / 2);
    SPACER_PRINTS[style].draw(ctx, canvas.width / scale, 360, inks);
}

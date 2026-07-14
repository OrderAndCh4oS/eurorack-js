const KEYWORDS = new Set([
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete',
    'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in',
    'instanceof', 'let', 'new', 'of', 'return', 'static', 'switch', 'throw', 'try',
    'typeof', 'var', 'void', 'while', 'with', 'yield', 'async', 'await'
]);

const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);

function escapeHtml(value) {
    return value.replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
}

function token(type, value) {
    return `<span class="syntax-${type}">${escapeHtml(value)}</span>`;
}

function quotedEnd(source, start, quote) {
    let index = start + 1;
    while (index < source.length) {
        if (source[index] === '\\') {
            index += 2;
            continue;
        }
        index++;
        if (source[index - 1] === quote) break;
    }
    return index;
}

function nextNonSpace(source, start) {
    let index = start;
    while (/\s/.test(source[index] || '')) index++;
    return source[index] || '';
}

function previousNonSpace(source, start) {
    let index = start - 1;
    while (index >= 0 && /\s/.test(source[index])) index--;
    return source[index] || '';
}

export function highlightPatchScript(source) {
    const text = String(source || '');
    let html = '';
    let index = 0;

    while (index < text.length) {
        const character = text[index];

        if (/\s/.test(character)) {
            const start = index++;
            while (index < text.length && /\s/.test(text[index])) index++;
            html += escapeHtml(text.slice(start, index));
            continue;
        }

        if (character === '/' && text[index + 1] === '/') {
            const start = index;
            index = text.indexOf('\n', index + 2);
            if (index === -1) index = text.length;
            html += token('comment', text.slice(start, index));
            continue;
        }

        if (character === '/' && text[index + 1] === '*') {
            const start = index;
            const end = text.indexOf('*/', index + 2);
            index = end === -1 ? text.length : end + 2;
            html += token('comment', text.slice(start, index));
            continue;
        }

        if (character === '"' || character === "'" || character === '`') {
            const end = quotedEnd(text, index, character);
            html += token('string', text.slice(index, end));
            index = end;
            continue;
        }

        const number = text.slice(index).match(/^(?:0[xob][\da-f]+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/i)?.[0];
        if (number) {
            html += token('number', number);
            index += number.length;
            continue;
        }

        const identifier = text.slice(index).match(/^[A-Za-z_$][\w$]*/)?.[0];
        if (identifier) {
            let type = '';
            if (KEYWORDS.has(identifier)) type = 'keyword';
            else if (LITERALS.has(identifier)) type = 'literal';
            else if (previousNonSpace(text, index) === '.') type = 'method';
            else if (nextNonSpace(text, index + identifier.length) === '(') type = 'function';
            else if (nextNonSpace(text, index + identifier.length) === ':') type = 'property';
            html += type ? token(type, identifier) : escapeHtml(identifier);
            index += identifier.length;
            continue;
        }

        html += escapeHtml(character);
        index++;
    }

    return html;
}

import jsTokens from 'js-tokens';

const trivia = new Set(['WhiteSpace', 'LineTerminatorSequence', 'SingleLineComment', 'MultiLineComment']);
const fluent = new Set(['module', 'connect', 'set', 'midi']);

// Recover a standalone patch() chain from older snapshots or pasted source.
// Only cut between complete calls. Parentheses in comments, strings, template
// text and regular expressions are part of their token, not call boundaries.
function splitPatchChain(source) {
    const tokens = [];
    let offset = 0;
    for (const { type, value } of jsTokens(source)) {
        if (!trivia.has(type)) tokens.push({ value, start: offset });
        offset += value.length;
    }
    if (tokens.at(-1)?.value === ';') tokens.pop();
    if (tokens[0]?.value !== 'patch' || tokens[1]?.value !== '(' || tokens[2]?.value !== ')') return null;

    // Keeping the preceding return value also preserves the ordinary JS method
    // receiver if an argument changes the builder. Keep user identifiers free.
    const used = new Set(tokens.map(token => token.value));
    let receiver = '__patchChain';
    for (let suffix = 1; used.has(receiver); suffix++) receiver = `__patchChain${suffix}`;
    const parts = [];
    let start = 0;
    let i = 3;
    while (i < tokens.length) {
        const dot = tokens[i];
        if (dot.value !== '.' || !fluent.has(tokens[i + 1]?.value) || tokens[i + 2]?.value !== '(') return null;
        parts.push(source.slice(start, dot.start), `;${receiver} = ${receiver}`);
        start = dot.start;
        i += 3;
        let depth = 1;
        while (depth && i < tokens.length) {
            const { value } = tokens[i++];
            if (value === '(') depth++;
            if (value === ')') depth--;
        }
        if (depth) return null;
    }
    if (!parts.length) return null;
    return `let ${receiver} = ${parts.join('')}${source.slice(start)}`;
}

export function compilePatchSource(source) {
    const compile = body => new Function('patch', `"use strict";\n${body}\n//# sourceURL=eurorack-patch-script.js`);
    try {
        return compile(source);
    } catch (error) {
        if (!/call stack|stack overflow|too much recursion/i.test(error.message)) throw error;
        const statements = splitPatchChain(source);
        if (statements === null) throw new Error('Patch expression is too deeply nested. Use const rack = patch() and separate rack.module() or rack.connect() calls.', { cause: error });
        return compile(statements);
    }
}

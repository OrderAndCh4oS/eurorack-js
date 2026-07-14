import { describe, expect, it } from 'vitest';
import { highlightPatchScript } from '../../src/js/patch-script/syntax-highlighter.js';

describe('patch script syntax highlighting', () => {
    it('classifies JavaScript and patch-builder tokens', () => {
        const html = highlightPatchScript(`const p = patch()\n  .module('vco', 'osc', { coarse: 0.25 }) // voice`);

        expect(html).toContain('<span class="syntax-keyword">const</span>');
        expect(html).toContain('<span class="syntax-function">patch</span>');
        expect(html).toContain('<span class="syntax-method">module</span>');
        expect(html).toContain('<span class="syntax-string">\'osc\'</span>');
        expect(html).toContain('<span class="syntax-property">coarse</span>');
        expect(html).toContain('<span class="syntax-number">0.25</span>');
        expect(html).toContain('<span class="syntax-comment">// voice</span>');
    });

    it('escapes source rather than treating it as markup', () => {
        const html = highlightPatchScript(`const label = '<img onerror="alert(1)">'`);

        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img');
    });

    it('keeps unterminated strings and comments bounded', () => {
        expect(highlightPatchScript("patch().module('osc")).toContain('syntax-string');
        expect(highlightPatchScript('patch() /* note')).toContain('syntax-comment');
    });
});

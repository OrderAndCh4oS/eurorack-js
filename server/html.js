const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SOCIAL_DESCRIPTION_LIMIT = 200;
const words = new Intl.Segmenter(undefined, { granularity: 'word' });
const singleLine = value => String(value ?? '').replace(/\s+/gu, ' ').trim();

function shorten(text, limit) {
    if (text.length <= limit) return text;
    let summary = '';
    for (const { segment } of words.segment(text)) {
        if (summary.length + segment.length > limit - 1) break;
        summary += segment;
    }
    return `${summary.trimEnd().replace(/[.,;:!?—–-]+$/u, '').trimEnd()}…`;
}

function socialDescription(patch) {
    const author = singleLine(patch.authorName);
    const original = patch.provenance.parentId ? singleLine(patch.provenance.originalCreatorName) : '';
    const credit = shorten(`By ${author}${original ? `. Original by ${original}` : ''}.`, SOCIAL_DESCRIPTION_LIMIT);
    const description = singleLine(patch.description);
    const remaining = SOCIAL_DESCRIPTION_LIMIT - credit.length - 3;
    if (!description || remaining < 2) return credit;
    const summary = shorten(description, remaining);
    return summary === '…' ? credit : `${summary} — ${credit}`;
}

export function patchHead(patch, baseUrl, patchId) {
    const publicPatch = patch?.visibility === 'public' ? patch : null;
    const title = publicPatch ? `${patch.name} · Eurorack` : 'Saved patch · Eurorack';
    const description = publicPatch ? socialDescription(publicPatch) : 'Sign in to view this patch.';
    const canonical = `${baseUrl}/patches/${patchId}`;
    const image = publicPatch?.images?.social ? `${baseUrl}${patch.images.social}` : null;
    const meta = (property, content, name = false) => `<meta ${name ? 'name' : 'property'}="${property}" content="${escape(content)}">`;
    return `<title>${escape(title)}</title>${meta('description', description, true)}
${publicPatch ? `<link rel="canonical" href="${escape(canonical)}">${meta('og:type', 'website')}${meta('og:site_name', 'Eurorack')}${meta('og:title', title)}${meta('og:description', description)}${meta('og:url', canonical)}${meta('twitter:card', image ? 'summary_large_image' : 'summary', true)}${meta('twitter:title', title, true)}${meta('twitter:description', description, true)}${image ? `${meta('og:image', image)}${meta('og:image:width', '1200')}${meta('og:image:height', '630')}${meta('og:image:alt', `Rack for ${patch.name}`)}${meta('twitter:image', image, true)}${meta('twitter:image:alt', `Rack for ${patch.name}`, true)}` : ''}` : meta('robots', 'noindex,nofollow', true)}`;
}

export function patchHtml(patch, baseUrl, patchId) {
    const publicPatch = patch?.visibility === 'public' ? patch : null;
    const canonical = `${baseUrl}/patches/${patchId}`;
    const copiedFrom = publicPatch?.provenance.parentCreatorName && patch.provenance.parentCreatorName !== patch.provenance.originalCreatorName ? ` · Copied from ${escape(patch.provenance.parentCreatorName)}` : '';
    const attribution = publicPatch?.provenance.parentId ? `<p>Original by ${escape(patch.provenance.originalCreatorName)}${copiedFrom}${patch.provenance.parentAvailable ? ` · <a href="/patches/${patch.provenance.parentId}">Source patch</a>` : ''}</p>` : '';
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${patchHead(patch, baseUrl, patchId)}
<style>:root{color-scheme:light;--paper:#f0eee2;--ink:#0b0b09;--accent:#ff4a0a}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}header,main,footer{padding:20px;max-width:1280px;margin:auto}header{display:flex;justify-content:space-between;border-bottom:2px solid var(--ink)}a{color:inherit;text-underline-offset:3px}h1{font-size:clamp(24px,4vw,48px);line-height:1.1;font-weight:600}p{max-width:80ch;white-space:pre-line}.rack-preview{width:100%;max-height:65vh;object-fit:contain;border:2px solid var(--ink);background:#151612}.patch-actions{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0}.patch-actions a,button{font:inherit;border:1px solid var(--ink);padding:10px 14px;color:var(--ink);background:var(--paper);cursor:pointer;text-decoration:none}.patch-actions a:first-child{background:var(--accent)}button:disabled{opacity:.6;cursor:wait}button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}footer{border-top:1px solid var(--ink);font-size:12px}#patch-status{min-height:1.5em}</style>
<script type="module" src="/js/patches/patch-detail.js"></script></head>
<body data-patch-id="${escape(patchId)}"><header><a href="/">EURORACK</a><a href="/patches">PUBLIC PATCHES</a></header>
<main id="patch-detail"><p>SAVED PATCH</p><h1>${publicPatch ? escape(patch.name) : 'Saved patch'}</h1>
${publicPatch ? `<p>By ${escape(patch.authorName)}</p>${attribution}<p>${escape(patch.description)}</p>${patch.images ? `<img class="rack-preview" src="${escape(patch.images.full)}" alt="Rack for ${escape(patch.name)}">` : ''}` : '<p>Patch unavailable. Sign in if it belongs to you.</p>'}
<div class="patch-actions"><a href="/patches/${escape(patchId)}?view=rack">Open in rack</a><button type="button" data-action="sign-in">Sign in</button>${publicPatch ? `<button type="button" data-action="like" aria-pressed="false">Thumbs up · ${patch.likeCount}</button><button type="button" data-action="copy">Save a copy</button><button type="button" data-action="share">Copy URL</button><a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(canonical)}&text=${encodeURIComponent(patch.name)}" target="_blank" rel="noopener noreferrer">Share on X</a><a href="https://bsky.app/intent/compose?text=${encodeURIComponent(`${patch.name} ${canonical}`)}" target="_blank" rel="noopener noreferrer">Share on Bluesky</a>` : ''}</div>
<p id="patch-status" role="status" aria-live="polite"></p></main><footer><nav aria-label="Legal"><a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy</a> · <a href="/terms-of-service" target="_blank" rel="noopener noreferrer">Terms</a></nav></footer></body></html>`;
}

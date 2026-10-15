// Regenerates the FAQPage "mainEntity" inside each page's JSON-LD from the visible
// <details class="faq-item"> markup, so the schema always matches what's on the page
// (a Google rich-result requirement). Run after editing any FAQ:
//
//   node tools/sync-faq-schema.mjs
//
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const pages = ['index.html', 'sell-your-route/index.html'];

const decode = (s) => s
  .replace(/<[^>]+>/g, '')
  .replace(/&rsquo;|&#8217;/g, '’')
  .replace(/&ldquo;|&rdquo;/g, '"')
  .replace(/&mdash;/g, '—')
  .replace(/&amp;/g, '&')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

for (const rel of pages) {
  const file = path.join(root, rel);
  let html = fs.readFileSync(file, 'utf8');

  const items = [...html.matchAll(/<details class="faq-item">\s*<summary>([\s\S]*?)<\/summary>\s*<div class="faq-body">([\s\S]*?)<\/div>\s*<\/details>/g)]
    .map((m) => ({ '@type': 'Question', name: decode(m[1]), acceptedAnswer: { '@type': 'Answer', text: decode(m[2]) } }));

  if (!items.length) { console.log(`${rel}: no FAQ items found, skipped`); continue; }

  const ldRe = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
  const m = html.match(ldRe);
  if (!m) { console.error(`${rel}: no JSON-LD block`); process.exitCode = 1; continue; }

  const indentMatch = m[2].match(/\n(\s*)\{/);
  const baseIndent = indentMatch ? indentMatch[1] : '';
  const json = JSON.parse(m[2]);
  const nodes = json['@graph'] || [json];
  const faq = nodes.find((n) => n['@type'] === 'FAQPage');
  if (!faq) { console.error(`${rel}: no FAQPage node`); process.exitCode = 1; continue; }

  faq.mainEntity = items;
  const pretty = JSON.stringify(json, null, 2).split('\n').map((l, i) => (i === 0 ? baseIndent + l : baseIndent + l)).join('\n');
  html = html.replace(ldRe, `$1\n${pretty}\n${baseIndent}$3`);
  fs.writeFileSync(file, html);
  console.log(`${rel}: synced ${items.length} FAQ entries into FAQPage schema`);
}

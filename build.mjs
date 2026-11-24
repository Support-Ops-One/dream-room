import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const source = new URL('sessions/', root);
const output = new URL('_site/', root);
const brand = 'WPG AI Incubator – Dream Room';
const dateFormat = new Intl.DateTimeFormat('en-CA', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});
const escape = (text) => text.replace(/[&<>"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
})[character]);
const dateLabel = (date) => dateFormat.format(new Date(date + 'T00:00:00Z'));
const time = (date) => `<time datetime="${date}">${dateLabel(date)}</time>`;
const icon = (drawing) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${drawing}</svg>`;
const copyIcon = icon('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 4H6a2 2 0 0 0-2 2v10"/>');
const checkIcon = icon('<path d="m5 12 4 4L19 6"/>');
const previousIcon = icon('<path d="m11 6-6 6 6 6m-6-6h14"/>');
const nextIcon = icon('<path d="m13 6 6 6-6 6m6-6H5"/>');

function parseSession(date, markdown) {
  const parsedDate = new Date(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsedDate)
      || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid session date in ${date}.md`);
  }

  const prompts = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) {
      index++;
      continue;
    }
    const heading = /^## Prompt ([1-9]\d*) — (\S.*)$/.exec(lines[index++]);
    const number = prompts.length + 1;
    if (!heading || Number(heading[1]) !== number) {
      throw new Error(`${date}.md must have a heading "## Prompt ${number} — Title"`);
    }
    while (index < lines.length && !lines[index].trim()) index++;
    const fence = /^(`{3,})text$/.exec(lines[index++] ?? '')?.[1];
    if (!fence) throw new Error(`${date}.md Prompt ${number} needs a fenced text block`);
    const start = index;
    while (index < lines.length && lines[index] !== fence) index++;
    const body = lines.slice(start, index++).join('\n');
    if (index > lines.length || !body.trim()) {
      throw new Error(`${date}.md Prompt ${number} needs a nonempty, closed text block`);
    }
    prompts.push({ number, body });
  }
  if (!prompts.length) throw new Error(`${date}.md contains no prompts`);
  return { date, prompts };
}

function renderPage({ title, prefix, body, session = false }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f8fafc">
  <title>${escape(title)} | ${brand}</title>
  <link rel="stylesheet" href="${prefix}assets/style.css">
  ${session ? `<script src="${prefix}assets/prompts.js" defer></script>` : ''}
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="masthead">
    <div class="frame brand">${brand}</div>
  </header>
  <main class="frame" id="main" tabindex="-1">${body}
  </main>
</body>
</html>\n`;
}

function renderArchive(sessions) {
  const cards = sessions.map(({ date, prompts }) => `
        <li><a class="session-link" href="./${date}/">
          ${time(date)}
          <span class="session-detail">${prompts.length} ${prompts.length === 1 ? 'prompt' : 'prompts'}</span>
        </a></li>`).join('');
  return renderPage({ title: 'Session archive', prefix: '', body: `
    <h1>Session archive</h1>
    ${cards ? `<ul class="sessions" role="list">${cards}
    </ul>` : '<p>No sessions yet.</p>'}` });
}

function renderSession({ date, prompts }) {
  const tabs = prompts.map(({ number }) => `
        <a href="#prompt-${number}" id="tab-${number}">Prompt ${number}</a>`).join('');
  const panels = prompts.map(({ number, body }) => `
        <section class="prompt" id="prompt-${number}" aria-labelledby="label-${number}">
          <h2 class="sr-only" id="label-${number}">Prompt ${number} of ${prompts.length}</h2>
          <div class="prompt-tools" hidden>
            <button class="copy" type="button">
              <span class="copy-idle">${copyIcon} Copy</span>
              <span class="copy-done" hidden>${checkIcon} Copied</span>
            </button>
          </div>
          <div class="manual-copy" hidden>
            <p id="copy-help-${number}">Couldn’t copy automatically. Select the text below and use your device’s copy command.</p>
            <textarea readonly rows="5" aria-label="Prompt text for manual copying" aria-describedby="copy-help-${number}"></textarea>
          </div>
          <div class="prompt-text">${renderPromptText(body)}</div>
          <template class="prompt-source">${escape(body)}</template>
        </section>`).join('');
  return renderPage({ title: dateLabel(date), prefix: '../', session: true, body: `
    <a class="back" href="../">All sessions</a>
    <div class="session-layout">
      <div class="session-navigation">
        <h1 id="session-date">${time(date)}</h1>
        <div class="tabs">${tabs}
        </div>
      </div>
      <div class="documents">
        ${prompts.length > 1 ? `<nav class="pagination" aria-label="Prompt pages" hidden>
          <button type="button" data-step="-1" aria-label="Previous prompt">${previousIcon}</button>
          <span class="progress"></span>
          <button type="button" data-step="1" aria-label="Next prompt">${nextIcon}</button>
        </nav>` : ''}
        ${panels}
        ${prompts.length > 1 ? `<div class="after-prompt" hidden>
          <button type="button" data-step="1">Next prompt ${nextIcon}</button>
        </div>` : ''}
      </div>
    </div>
    <span class="sr-only" role="status" id="copy-status"></span>
    <span class="sr-only" role="status" id="prompt-status"></span>` });
}

function renderPromptText(body) {
  const paragraphs = body.split(/\n[ \t]*\n/).filter((block) => block.length);
  const html = [];
  let items = [];
  const flushItems = () => {
    if (items.length === 1) html.push(`<p>${escape(items[0].line)}</p>`);
    if (items.length > 1) {
      const list = items.map(({ number, text, gap }) =>
        `<li value="${number}"${gap ? ' class="paragraph-gap"' : ''}>${escape(text)}</li>`).join('');
      html.push(`<ol start="${items[0].number}">${list}</ol>`);
    }
    items = [];
  };
  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n');
    const numbered = lines.map((line) => /^(0|[1-9]\d{0,7})\. (\S.*)$/.exec(line));
    if (numbered.every(Boolean)) {
      const hasGap = items.length > 0;
      numbered.forEach(([line, number, text], index) => {
        items.push({ line, number, text, gap: hasGap && index === 0 });
      });
    } else {
      flushItems();
      html.push(`<p>${escape(paragraph)}</p>`);
    }
  }
  flushItems();
  return html.join('');
}

const files = (await readdir(source)).filter((name) => name.endsWith('.md')).sort().reverse();
const sessions = await Promise.all(files.map(async (name) =>
  parseSession(name.slice(0, -3), await readFile(new URL(encodeURIComponent(name), source), 'utf8'))));

await rm(output, { recursive: true, force: true });
await mkdir(output);
await cp(new URL('assets/', root), new URL('assets/', output), { recursive: true });
await writeFile(new URL('index.html', output), renderArchive(sessions));
for (const session of sessions) {
  const directory = new URL(session.date + '/', output);
  await mkdir(directory);
  await writeFile(new URL('index.html', directory), renderSession(session));
}
console.log(`Built ${sessions.length} session(s) in _site/`);

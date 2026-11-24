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
    prompts.push({ number, title: heading[2], body });
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
  <meta name="theme-color" content="#0c1121">
  <title>${escape(title)} | ${brand}</title>
  <link rel="stylesheet" href="${prefix}assets/style.css">
  ${session ? `<script src="${prefix}assets/prompts.js" defer></script>` : ''}
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="masthead">
    <div class="frame bar">
      <a class="brand" href="${prefix || './'}" aria-label="${brand}">
        <span class="mark" aria-hidden="true">✦</span>
        <span>WPG AI Incubator <span class="brand-divider">–</span> Dream Room</span>
      </a>
      ${session ? '<button class="copy" type="button" hidden>Copy prompt</button><span class="sr-only" role="status" id="copy-status"></span>' : ''}
    </div>
  </header>
  <main class="frame" id="main">${body}
  </main>
</body>
</html>\n`;
}

function renderArchive(sessions) {
  const cards = sessions.map(({ date, prompts }) => `
        <li><a class="session-link" href="./${date}/">
          ${time(date)}
          <span class="session-detail">${escape(prompts[0].title)} · ${prompts.length} ${prompts.length === 1 ? 'prompt' : 'prompts'}</span>
        </a></li>`).join('');
  return renderPage({ title: 'Session archive', prefix: '', body: `
    <section class="intro">
      <h1>Session archive</h1>
      <p>Open a session to find and copy its prompts.</p>
    </section>
    ${cards ? `<ul class="sessions">${cards}
    </ul>` : '<p>No sessions yet.</p>'}` });
}

function renderSession({ date, prompts }) {
  const tabs = prompts.map(({ number }) => `
        <a href="#prompt-${number}" id="tab-${number}">Prompt ${number}</a>`).join('');
  const panels = prompts.map(({ number, title, body }) => `
      <section class="prompt" id="prompt-${number}">
        <h2>${escape(title)}</h2>
        <div class="prompt-text">${escape(body)}</div>
      </section>`).join('');
  return renderPage({ title: dateLabel(date), prefix: '../', session: true, body: `
    <section class="intro">
      <a class="back" href="../">All sessions</a>
      <h1>${time(date)}</h1>
    </section>
    <div class="prompt-library">
      <nav class="tabs" aria-label="Session prompts">${tabs}
      </nav>${panels}
      <p class="copy-error" hidden>Copy failed. The prompt text is selected for manual copying.</p>
    </div>` });
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

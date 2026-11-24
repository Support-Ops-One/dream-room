# WPG AI Incubator – Dream Room

A static archive of dated sessions and copyable prompts at https://support-ops-one.github.io/dream-room/.

## Add or update a session

1. In `sessions/`, create a file named `YYYY-MM-DD.md` using the session date. To add a prompt to an existing session, open that date's file.
2. Use the format below. Start at Prompt 1 and append additional prompts in order. Put each prompt in its own fenced `text` block and preserve the original wording, punctuation, and line breaks. Use a longer backtick fence if the prompt itself contains a matching fence.
3. Run `node build.mjs` with Node.js 24 to validate the files. Push to `main` or merge a pull request into `main`. GitHub Actions builds and publishes the dated pages and updates the archive automatically.

~~~~markdown
## Prompt 1 — Short descriptive title

```text
Paste the complete prompt here.
```

## Prompt 2 — Another descriptive title

```text
Paste the next complete prompt here.
```
~~~~

Use `/dream-room/YYYY-MM-DD/` for a session QR code. Append `#prompt-2` to link directly to Prompt 2, and use the corresponding number for other prompts. Keep published filenames and prompt numbers stable so existing links continue to work. The date is the session label. Changes publish when they land on `main`.

## Write accessible prompts

- Write in plain text. Use blank lines between paragraphs, and start each step of a numbered list on its own line with a number, a period and a space.
- State instructions in words. Give text equivalents for visual references and avoid instructions that depend on colour, position or an emoji alone.
- Spell out unfamiliar abbreviations on first use. Give links descriptive context so a reader can tell where they lead.
- Keep the Markdown heading title as a short note for editors. Participants navigate by prompt number. Put any essential context inside the prompt itself.
- Preserve wording and formatting when a prompt is supplied verbatim. The Copy control reads the original text block.

## Instructions to give an LLM

> Edit only the session Markdown file for the date I give you. Use the format above and keep my prompt text verbatim. For an existing session, append at the next available prompt number and preserve the existing entries. Run `node build.mjs`, then report the file path and the dated page and prompt links. Follow the repository's normal review and merge process.

## Preview and deploy

- Local preview: run `node build.mjs` and serve `_site/` over localhost, for example with `python3 -m http.server 8000 --directory _site`. Open `http://localhost:8000/` to try the date links and clipboard.
- First deployment: a repository admin selects **GitHub Actions** in **Settings → Pages → Build and deployment → Source**, then runs **Publish Dream Room** from the **Actions** tab. Later pushes to `main` trigger it automatically. Use the URL shown in the deployment to verify that the archive and dated page open without signing in.
- If Pages is unavailable for a private repository, check the organization's GitHub plan and Pages policy. A public repository supports free Pages hosting. Configure publication only in the dedicated project repository.

## Accessibility checks

Run `npm ci`, `npx playwright install chromium`, and `npm test` with Node.js 24. The publishing workflow runs the same regression checks before deployment. The checks build the production pages, run axe against the archive and sessions, and exercise both navigation layouts and the clipboard in an isolated browser. Multi-prompt fixtures are generated in a temporary directory and never included in the published build.

For interface changes, also review the [WCAG 2.2 criteria](https://www.w3.org/TR/WCAG22/) and [WAI evaluation guidance](https://www.w3.org/WAI/test-evaluate/). Check the site with a screen reader, keyboard and touch, and at enlarged text and zoom levels. Automated checks cover part of the evaluation.

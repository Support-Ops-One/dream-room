# WPG AI Incubator – Dream Room

A static archive of dated sessions and copyable prompts. The GitHub Pages project URL is expected to be https://support-ops-one.github.io/dream-room/ once Pages is enabled.

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

## Instructions to give an LLM

> Edit only the session Markdown file for the date I give you. Use the format above and keep my prompt text verbatim. For an existing session, append at the next available prompt number and preserve the existing entries. Run `node build.mjs`, then report the file path and the dated page and prompt links. Follow the repository's normal review and merge process.

## Preview and deploy

- Local preview: run `node build.mjs` and serve `_site/` over localhost, for example with `python3 -m http.server 8000 --directory _site`. Open `http://localhost:8000/` to try the date links and clipboard.
- First deployment: a repository admin selects **GitHub Actions** in **Settings → Pages → Build and deployment → Source**, then runs **Publish Dream Room** from the **Actions** tab. Later pushes to `main` trigger it automatically. Use the URL shown in the deployment to verify that the archive and dated page open without signing in.
- If Pages is unavailable for a private repository, check the organization's GitHub plan and Pages policy. A public repository supports free Pages hosting. Configure publication only in the dedicated project repository.

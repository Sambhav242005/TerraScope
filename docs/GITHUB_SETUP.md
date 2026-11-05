# GitHub preparation

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


The initial publication was authorized on 5 November 2026 for https://github.com/Sambhav242005/TerraScope. The commands below document the initial setup; check the existing remote before repeating them.

Included: application source, bundled public data, tests, package lock, scripts and project documentation. Excluded: dependencies, builds, local recordings/downloads, scratch work, environment secrets and caches. Ignored files remain on disk. Some evidence-building scripts expect downloads under `artifacts/`; obtain those inputs separately when regenerating evidence. Bundled application data remains in `public/data/`.

From a fresh clone:

```sh
npm ci
npm test
npm run build
npm run dev
```

Optional public configuration is documented in `.env.example`. No AI provider is currently connected. Browser workspace saves are local to each visitor.

To publish, create an empty GitHub repository, then run from this folder:

```sh
git add .
git diff --cached --stat
git commit -m "Initial TerraScope prototype"
git branch -M main
git remote add origin https://github.com/Sambhav242005/TerraScope.git
git push -u origin main
```

Review staged files before committing. No project license has been selected; bundled third-party data retains its provider terms and attribution (see DATA.md). Hosting or publishing does not establish scientific validity.

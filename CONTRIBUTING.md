# Contributing to `@geosuite/sitemap-builder`

Thanks for taking the time to contribute! This is a small, deliberately
boring tool: it crawls and writes XML. We want to keep it that way —
zero runtime dependencies, no third-party HTTP libraries, no JavaScript
rendering. The bar for accepting new behaviour is "does this stay true to
the boring core?".

## Setup

```bash
git clone https://github.com/geosuite/sitemap-builder.git
cd sitemap-builder
# no install step — the project has no runtime dependencies.
node bin/cli.js https://example.com
```

Requires Node 20+ (we also run CI against Node 22).

## Tests

```bash
npm test       # node --test test/*.js
npm run lint   # node --check on every source file
```

Tests are pure-function: no network calls, no large HTML fixtures. If a
new test needs HTML, paste a tiny inline string into the test file. If
you really need a network test, put it under `test/integration/` (we
will add the directory the first time it's needed) and skip it in CI.

## Pull requests

Open an issue first for non-trivial changes — the [feature request
template](.github/ISSUE_TEMPLATE/feature_request.md) walks you through
the questions that make a PR easier to review.

A PR should:

- Stay zero-runtime-dependency at the deterministic core. Optional
  features (e.g. an LLM-powered `--ai` mode) live behind explicit
  opt-in flags and document their dependency / privacy story.
- Keep the CLI surface tight. New flags need a one-line `--help`
  description.
- Preserve back-compatibility of the default output. The CLI's default
  invocation is what most users automate against.
- Update [CHANGELOG.md](CHANGELOG.md) under the `Unreleased` heading
  (we cut versions on tagged releases).

## License

By contributing, you agree your changes are licensed under the [MIT
license](LICENSE).

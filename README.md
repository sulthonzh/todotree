# todotree

Find TODO, FIXME, HACK, and other comment tags scattered across your codebase.

Because `grep -r TODO src/` is fine, but `todotree` gives you a structured view — organized by file, with tag counts, and multiple output formats.

## Why

Every project accumulates TODOs. Most get forgotten. `todotree` makes them visible so you actually deal with them.

## Install

```bash
npm install -g todotree
```

Or just run it directly:
```bash
npx todotree
```

## Usage

```bash
# Scan current directory
todotree

# Scan a specific directory
todotree src/

# JSON output (great for CI/scripts)
todotree --json

# Markdown output (paste into docs)
todotree --markdown

# Only look for specific tags
todotree --tags TODO,FIXME

# Add directories to ignore
todotree --ignore dist,coverage,vendor
```

## Tags Detected

`TODO`, `FIXME`, `HACK`, `XXX`, `BUG`, `NOTE`, `OPTIMIZE`, `CHANGED`

## Output Formats

### Text (default)

```
Found 3 comments across 2 files:
TODO: 2 | FIXME: 1

  src/auth.js
    TODO  L12: add rate limiting
    TODO  L45: handle token refresh

  src/db.js
    FIXME  L8: connection pool leaks under load
```

### JSON

```json
{
  "total": 3,
  "counts": { "TODO": 2, "FIXME": 1 },
  "files": [
    {
      "file": "src/auth.js",
      "items": [
        { "line": 12, "tag": "TODO", "text": "add rate limiting" }
      ]
    }
  ]
}
```

### Markdown

Generates a GitHub-ready table with tag counts and per-file sections.

## Exit Codes

- `0` — no tags found (clean codebase)
- `1` — tags found (useful for CI: fail if tech debt exists)

## Programmatic API

```javascript
const { scanDir, formatText } = require("todotree");

const results = scanDir("./src");
console.log(formatText(results));
```

## Zero Dependencies

Uses only Node.js built-ins. No frameworks, no runtime deps.

## License

MIT

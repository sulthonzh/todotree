# todotree

Scan your codebase for TODO, FIXME, HACK, and other code comments. See what's lurking in your source.

## Why

Every codebase accumulates TODOs and FIXMEs. Most teams ignore them until something breaks. todotree surfaces them — organized by file, priority, and author — so you can actually deal with them.

## Install

```bash
npm install -g todotree
```

## Usage

```bash
# Scan current directory
todotree .

# Only TODO and FIXME, JSON output
todotree src --tags TODO,FIXME --json

# High priority only (bugs and fixes)
todotree . --min-priority 3

# Generate a markdown report
todotree . --md > TODO.md

# Custom file extensions
todotree . --ext .go,.rs
```

## Output

Default output looks like:

```
Found 12 comments across 4 files

Summary:
  TODO: 7
  FIXME: 3
  HACK: 2

📁 src/api.ts (5)
  L23 [TODO] ██ implement retry logic
  L45 [FIXME] ████ handle null response @john
  L67 [BUG] █████ crash on empty input

📁 src/utils.ts (4)
  L12 [HACK] ███ skip validation for admin
  L89 [TODO] ██ add pagination
```

## Tags & Priority

| Tag | Priority | Meaning |
|-----|----------|---------|
| BUG | 5 | Known bug, fix ASAP |
| FIXME | 4 | Broken, needs fixing |
| HACK | 3 | Ugly workaround |
| XXX | 3 | Questionable code |
| TODO | 2 | Future work |
| OPTIMIZE | 1 | Performance opportunity |
| NOTE | 0 | Informational |

## Options

```
--tags <tags>          Tags to scan (default: all)
--ext <extensions>     File extensions (default: .ts,.js,.py,.go,.rs,...)
--ignore <patterns>    Directories to skip (default: node_modules,.git,...)
--min-priority <n>     Show only priority >= n (0-5)
--json                 JSON output
--md                   Markdown output
--sort <field>         Sort by: file, tag, priority, line
```

## Programmatic API

```typescript
import { scan, formatText, formatJson } from 'todotree';

const result = scan({
  directory: './src',
  tags: ['TODO', 'FIXME'],
  minPriority: 2,
});

console.log(formatText(result));
// or formatJson(result) for machine-readable output
```

Returns an object with:

- `items` — all found comments with file, line, tag, text, author, date, priority
- `summary` — count per tag
- `files` — grouped by file, sorted by count

## License

MIT

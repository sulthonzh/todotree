#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const args = process.argv.slice(2);
function showHelp() {
    console.log(`
todotree — scan code for TODO/FIXME/HACK comments

Usage:
  todotree [directory] [options]

Arguments:
  directory              Directory to scan (default: .)

Options:
  --tags <tags>          Comma-separated tags to scan (default: TODO,FIXME,HACK,XXX,BUG,OPTIMIZE,NOTE)
  --ext <extensions>     Comma-separated file extensions (default: .ts,.tsx,.js,.jsx,.py,...)
  --ignore <patterns>    Comma-separated ignore patterns (default: node_modules,.git,...)
  --min-priority <n>     Minimum priority to show (0-5)
  --json                 Output as JSON
  --md                   Output as Markdown
  --sort <field>         Sort by: file, tag, priority, line (default: file)
  --help                 Show this help

Examples:
  todotree .
  todotree src --tags TODO,FIXME --json
  todotree . --min-priority 3 --sort priority
  todotree . --md > TODO.md
`);
}
function parseArgs(args) {
    const opts = {};
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            showHelp();
            process.exit(0);
        }
        else if (arg === '--tags') {
            opts.tags = args[++i].split(',');
        }
        else if (arg === '--ext') {
            opts.extensions = args[++i].split(',').map(e => e.startsWith('.') ? e : '.' + e);
        }
        else if (arg === '--ignore') {
            opts.ignorePatterns = args[++i].split(',');
        }
        else if (arg === '--min-priority') {
            opts.minPriority = parseInt(args[++i], 10);
        }
        else if (arg === '--json') {
            opts.json = true;
        }
        else if (arg === '--md') {
            opts.md = true;
        }
        else if (arg === '--sort') {
            opts.sort = args[++i];
        }
        else if (!arg.startsWith('-')) {
            opts.directory = arg;
        }
        i++;
    }
    return opts;
}
function main() {
    const opts = parseArgs(args);
    const directory = opts.directory || '.';
    try {
        const result = (0, index_1.scan)({
            directory,
            tags: opts.tags,
            extensions: opts.extensions,
            ignorePatterns: opts.ignorePatterns,
            minPriority: opts.minPriority,
        });
        if (opts.json) {
            console.log((0, index_1.formatJson)(result));
        }
        else if (opts.md) {
            console.log((0, index_1.formatMarkdown)(result));
        }
        else {
            console.log((0, index_1.formatText)(result));
        }
    }
    catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=cli.js.map
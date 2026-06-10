#!/usr/bin/env node
const path = require("path");
const { scanDir, formatText, formatJSON, formatMarkdown, parseArgs, HELP } = require("./index");

const args = parseArgs(process.argv.slice(2));
if (args.help) { console.log(HELP); process.exit(0); }

const dir = path.resolve(args.dir);
const results = scanDir(dir, { ignore: args.ignore });
const fmt = args.format === "json" ? formatJSON : args.format === "markdown" ? formatMarkdown : formatText;
console.log(fmt(results));
const total = results.reduce((s, r) => s + r.items.length, 0);
process.exit(total > 0 ? 1 : 0);

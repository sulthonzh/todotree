const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TAGS = ["TODO", "FIXME", "HACK", "XXX", "BUG", "NOTE", "OPTIMIZE", "CHANGED"];
const TAG_RE = new RegExp("\\b(" + TAGS.join("|") + ")\\b[:\\s]*(.*)", "i");
const DEFAULT_IGNORE = [
  "node_modules", ".git", ".svn", ".hg", "vendor", "dist", "build",
  ".next", ".nuxt", "coverage", "__pycache__", ".cache", ".turbo",
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
];

function shouldIgnore(relPath, ignore) {
  const parts = relPath.split(path.sep);
  return parts.some((p) => ignore.includes(p));
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const textExts = [
    ".js",".mjs",".cjs",".ts",".tsx",".jsx",".vue",".svelte",
    ".py",".rb",".go",".rs",".java",".kt",".swift",".c",".cpp",".h",".hpp",
    ".cs",".scala",".clj",".ex",".exs",".erl",".hs",".ml",".fs",".fsx",
    ".php",".pl",".pm",".r",".R",".m",".mm",
    ".html",".css",".scss",".less",".sass",".styl",
    ".md",".mdx",".txt",".rst",".adoc",".org",
    ".yaml",".yml",".toml",".ini",".cfg",".conf",
    ".json",".jsonc",".json5",
    ".sh",".bash",".zsh",".fish",".ps1",".bat",".cmd",
    ".sql",".graphql",".proto",".dockerfile",
    ".lua",".vim",".el",".tcl",
  ];
  return textExts.includes(ext) || filePath.endsWith("Dockerfile") || filePath.endsWith("Makefile");
}

function extractTags(line) {
  const matches = [];
  const re = new RegExp("\\b(" + TAGS.join("|") + ")(?:\\([^)]*\\))?[:\\s]*(.*)", "gi");
  let m;
  while ((m = re.exec(line)) !== null) {
    matches.push({ tag: m[1].toUpperCase(), text: m[2].trim() });
  }
  return matches;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const tags = extractTags(lines[i]);
    for (const t of tags) {
        results.push({ line: i + 1, tag: t.tag, text: t.text });
    }
  }
  return results;
}

function scanDir(dir, options = {}) {
  const ignore = options.ignore ? [...DEFAULT_IGNORE, ...options.ignore] : DEFAULT_IGNORE;
  const cwd = options.cwd || process.cwd();
  const results = [];

  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      const rel = path.relative(cwd, full);
      if (shouldIgnore(rel, ignore)) continue;
      if (entry.isDirectory()) { walk(full); }
      else if (entry.isFile() && isTextFile(full)) {
        const items = scanFile(full);
        if (items.length > 0) {
          results.push({ file: rel || full, items });
        }
      }
    }
  }
  walk(dir);
  return results;
}

function tagCounts(results) {
  const counts = {};
  for (const r of results) {
    for (const item of r.items) {
      counts[item.tag] = (counts[item.tag] || 0) + 1;
    }
  }
  return counts;
}

function formatText(results) {
  if (!results.length) return "No TODO/FIXME/HACK comments found. Clean codebase! ✨";
  const lines = [];
  const counts = tagCounts(results);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  lines.push(`Found ${total} comment${total !== 1 ? "s" : ""} across ${results.length} file${results.length !== 1 ? "s" : ""}:`);
  const tagLine = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}: ${c}`).join(" | ");
  lines.push(tagLine);
  lines.push("");
  for (const r of results) {
    lines.push(`  ${r.file}`);
    for (const item of r.items) {
      const txt = item.text.length > 70 ? item.text.slice(0, 67) + "..." : item.text;
      lines.push(`    ${item.tag}  L${item.line}: ${txt}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function formatJSON(results) {
  const counts = tagCounts(results);
  return JSON.stringify({ total: Object.values(counts).reduce((a, b) => a + b, 0), counts, files: results }, null, 2);
}

function formatMarkdown(results) {
  if (!results.length) return "_No TODO/FIXME/HACK comments found._";
  const lines = [];
  const counts = tagCounts(results);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  lines.push(`# TODO Tree (${total} comments)`);
  lines.push("");
  lines.push("| Tag | Count |");
  lines.push("|-----|-------|");
  for (const [tag, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${tag} | ${count} |`);
  }
  lines.push("");
  for (const r of results) {
    lines.push(`## ${r.file}`);
    lines.push("");
    for (const item of r.items) {
      lines.push(`- **${item.tag}** (L${item.line}): ${item.text}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function parseArgs(argv) {
  const args = { dir: ".", format: "text", tags: null, ignore: [] };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.format = "json";
    else if (a === "--markdown" || a === "--md") args.format = "markdown";
    else if (a === "--tags" && argv[i + 1]) { args.tags = argv[++i].toUpperCase().split(","); }
    else if (a === "--ignore" && argv[i + 1]) { args.ignore = argv[++i].split(","); }
    else if (a === "--help" || a === "-h") { args.help = true; }
    else if (!a.startsWith("-")) { rest.push(a); }
  }
  if (rest.length) args.dir = rest[0];
  return args;
}

const HELP = `todotree — find TODO/FIXME/HACK comments in your codebase

Usage:
  todotree [dir]           Scan directory (default: .)
  todotree --json          JSON output
  todotree --markdown      Markdown output
  todotree --tags TODO,FIXME   Only look for specific tags
  todotree --ignore dist,coverage  Add directories to ignore

Tags detected: ${TAGS.join(", ")}`;

module.exports = { scanDir, scanFile, extractTags, tagCounts, formatText, formatJSON, formatMarkdown, parseArgs, HELP, TAGS, isTextFile };

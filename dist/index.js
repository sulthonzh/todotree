"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scan = scan;
exports.formatText = formatText;
exports.formatJson = formatJson;
exports.formatMarkdown = formatMarkdown;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const DEFAULT_IGNORE = [
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    'coverage', '.cache', 'vendor', '__pycache__', '.venv',
    '.tox', 'target', 'bin', 'obj', '.idea', '.vscode',
];
const DEFAULT_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.go', '.rs',
    '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.swift',
    '.kt', '.scala', '.sh', '.bash', '.zsh', '.vue', '.svelte',
];
const TAG_REGEX = /\b(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|NOTE)\b/g;
const PRIORITY_MAP = {
    BUG: 5,
    FIXME: 4,
    HACK: 3,
    XXX: 3,
    TODO: 2,
    OPTIMIZE: 1,
    NOTE: 0,
};
function shouldIgnore(filePath, ignorePatterns) {
    const parts = filePath.split(path.sep);
    return parts.some(p => ignorePatterns.includes(p));
}
function hasValidExtension(filePath, extensions) {
    if (extensions.length === 0)
        return true;
    const ext = path.extname(filePath);
    return extensions.includes(ext);
}
function extractAuthor(text) {
    // Match patterns like @username, (name), <email>
    const authorMatch = text.match(/(?:@(\w+)|\(([^)]+)\)|<([^>]+)>)/);
    if (authorMatch) {
        return authorMatch[1] || authorMatch[2] || authorMatch[3];
    }
    return undefined;
}
function extractDate(text) {
    // Match ISO date, or common date formats
    const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    return dateMatch ? dateMatch[1] : undefined;
}
function parseLine(line, lineNumber, filePath) {
    TAG_REGEX.lastIndex = 0;
    const match = TAG_REGEX.exec(line);
    if (!match)
        return null;
    const tag = match[1];
    const column = match.index + 1;
    // Extract text after the tag
    const afterTag = line.substring(match.index + match[0].length).trim();
    // Remove leading separators
    const text = afterTag.replace(/^[:\-\s]+/, '').trim();
    const author = extractAuthor(text);
    const date = extractDate(text);
    const priority = PRIORITY_MAP[tag] ?? 0;
    // Get context — the line without leading whitespace and comment markers
    const context = line.trim().replace(/^(\/\/|#|\/\*|\*|<!--)\s*/, '').trim();
    return {
        file: filePath,
        line: lineNumber,
        column,
        tag,
        text,
        author,
        date,
        priority,
        context,
    };
}
function scanFile(filePath, tags) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const tagSet = new Set(tags);
    const items = [];
    for (let i = 0; i < lines.length; i++) {
        const item = parseLine(lines[i], i + 1, filePath);
        if (item && tagSet.has(item.tag)) {
            items.push(item);
        }
    }
    return items;
}
function walkDir(dir, extensions, ignorePatterns) {
    const files = [];
    function walk(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                if (!shouldIgnore(fullPath, ignorePatterns)) {
                    walk(fullPath);
                }
            }
            else if (entry.isFile()) {
                if (hasValidExtension(fullPath, extensions)) {
                    files.push(fullPath);
                }
            }
        }
    }
    walk(dir);
    return files;
}
function scan(options) {
    const { directory, tags = ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG', 'OPTIMIZE', 'NOTE'], extensions = DEFAULT_EXTENSIONS, ignorePatterns = DEFAULT_IGNORE, minPriority = 0, } = options;
    const absDir = path.resolve(directory);
    const files = walkDir(absDir, extensions, ignorePatterns);
    let allItems = [];
    for (const file of files) {
        const items = scanFile(file, tags);
        allItems = allItems.concat(items);
    }
    // Make file paths relative
    allItems = allItems.map(item => ({
        ...item,
        file: path.relative(absDir, item.file),
    }));
    // Filter by minimum priority
    if (minPriority > 0) {
        allItems = allItems.filter(item => (item.priority ?? 0) >= minPriority);
    }
    // Build summary
    const summary = {};
    for (const item of allItems) {
        summary[item.tag] = (summary[item.tag] || 0) + 1;
    }
    // Build file summary
    const fileMap = new Map();
    for (const item of allItems) {
        if (!fileMap.has(item.file)) {
            fileMap.set(item.file, []);
        }
        fileMap.get(item.file).push(item);
    }
    const fileSummaries = Array.from(fileMap.entries())
        .map(([file, items]) => ({ file, count: items.length, items }))
        .sort((a, b) => b.count - a.count);
    return { items: allItems, summary, files: fileSummaries };
}
function formatText(result) {
    const lines = [];
    const { items, summary, files } = result;
    if (items.length === 0) {
        return 'No TODO/FIXME/HACK comments found. Clean codebase! ✨';
    }
    lines.push(`Found ${items.length} comment${items.length === 1 ? '' : 's'} across ${files.length} file${files.length === 1 ? '' : 's'}\n`);
    // Summary
    const tagEntries = Object.entries(summary).sort((a, b) => b[1] - a[1]);
    lines.push('Summary:');
    for (const [tag, count] of tagEntries) {
        lines.push(`  ${tag}: ${count}`);
    }
    lines.push('');
    // By file
    for (const fileSummary of files) {
        lines.push(`📁 ${fileSummary.file} (${fileSummary.count})`);
        for (const item of fileSummary.items) {
            const priorityBar = '█'.repeat(Math.min(item.priority ?? 0, 5));
            const authorStr = item.author ? ` @${item.author}` : '';
            lines.push(`  L${item.line} [${item.tag}]${priorityBar ? ' ' + priorityBar : ''} ${item.text.substring(0, 80)}${item.text.length > 80 ? '...' : ''}${authorStr}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function formatJson(result) {
    return JSON.stringify(result, null, 2);
}
function formatMarkdown(result) {
    const lines = [];
    const { items, summary, files } = result;
    lines.push(`# TodoTree Report`);
    lines.push('');
    lines.push(`**${items.length} comments** across **${files.length} files**`);
    lines.push('');
    // Summary table
    lines.push('| Tag | Count |');
    lines.push('|-----|-------|');
    for (const [tag, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
        lines.push(`| ${tag} | ${count} |`);
    }
    lines.push('');
    // By file
    for (const fileSummary of files) {
        lines.push(`## \`${fileSummary.file}\` (${fileSummary.count})`);
        lines.push('');
        lines.push('| Line | Tag | Priority | Text | Author |');
        lines.push('|------|-----|----------|------|--------|');
        for (const item of fileSummary.items) {
            const text = item.text.replace(/\|/g, '\\|').substring(0, 60);
            lines.push(`| ${item.line} | ${item.tag} | ${item.priority ?? 0} | ${text} | ${item.author || '-'} |`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=index.js.map
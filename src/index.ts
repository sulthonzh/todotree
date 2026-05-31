import * as path from 'path';
import * as fs from 'fs';

export type TagType = 'TODO' | 'FIXME' | 'HACK' | 'XXX' | 'BUG' | 'OPTIMIZE' | 'NOTE';

export interface TodoItem {
  file: string;
  line: number;
  column: number;
  tag: TagType;
  text: string;
  author?: string;
  date?: string;
  priority?: number;
  context?: string;
  age?: number;
}

export interface ScanOptions {
  directory: string;
  tags?: TagType[];
  extensions?: string[];
  ignorePatterns?: string[];
  gitBlame?: boolean;
  minPriority?: number;
}

export interface ScanResult {
  items: TodoItem[];
  summary: TagSummary;
  files: FileSummary[];
}

export interface TagSummary {
  [tag: string]: number;
}

export interface FileSummary {
  file: string;
  count: number;
  items: TodoItem[];
}

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

const PRIORITY_MAP: Record<string, number> = {
  BUG: 5,
  FIXME: 4,
  HACK: 3,
  XXX: 3,
  TODO: 2,
  OPTIMIZE: 1,
  NOTE: 0,
};

function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
  const parts = filePath.split(path.sep);
  return parts.some(p => ignorePatterns.includes(p));
}

function hasValidExtension(filePath: string, extensions: string[]): boolean {
  if (extensions.length === 0) return true;
  const ext = path.extname(filePath);
  return extensions.includes(ext);
}

function extractAuthor(text: string): string | undefined {
  // Match patterns like @username, (name), <email>
  const authorMatch = text.match(/(?:@(\w+)|\(([^)]+)\)|<([^>]+)>)/);
  if (authorMatch) {
    return authorMatch[1] || authorMatch[2] || authorMatch[3];
  }
  return undefined;
}

function extractDate(text: string): string | undefined {
  // Match ISO date, or common date formats
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  return dateMatch ? dateMatch[1] : undefined;
}

function parseLine(line: string, lineNumber: number, filePath: string): TodoItem | null {
  TAG_REGEX.lastIndex = 0;
  const match = TAG_REGEX.exec(line);
  if (!match) return null;

  const tag = match[1] as TagType;
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

function scanFile(filePath: string, tags: TagType[]): TodoItem[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const tagSet = new Set(tags);
  const items: TodoItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const item = parseLine(lines[i], i + 1, filePath);
    if (item && tagSet.has(item.tag)) {
      items.push(item);
    }
  }

  return items;
}

function walkDir(dir: string, extensions: string[], ignorePatterns: string[]): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!shouldIgnore(fullPath, ignorePatterns)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (hasValidExtension(fullPath, extensions)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

export function scan(options: ScanOptions): ScanResult {
  const {
    directory,
    tags = ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG', 'OPTIMIZE', 'NOTE'],
    extensions = DEFAULT_EXTENSIONS,
    ignorePatterns = DEFAULT_IGNORE,
    minPriority = 0,
  } = options;

  const absDir = path.resolve(directory);
  const files = walkDir(absDir, extensions, ignorePatterns);

  let allItems: TodoItem[] = [];
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
  const summary: TagSummary = {};
  for (const item of allItems) {
    summary[item.tag] = (summary[item.tag] || 0) + 1;
  }

  // Build file summary
  const fileMap = new Map<string, TodoItem[]>();
  for (const item of allItems) {
    if (!fileMap.has(item.file)) {
      fileMap.set(item.file, []);
    }
    fileMap.get(item.file)!.push(item);
  }

  const fileSummaries: FileSummary[] = Array.from(fileMap.entries())
    .map(([file, items]) => ({ file, count: items.length, items }))
    .sort((a, b) => b.count - a.count);

  return { items: allItems, summary, files: fileSummaries };
}

export function formatText(result: ScanResult): string {
  const lines: string[] = [];
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

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatMarkdown(result: ScanResult): string {
  const lines: string[] = [];
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

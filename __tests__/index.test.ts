import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scan, formatText, formatJson, formatMarkdown, TagType, TodoItem } from '../src/index';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todotree-test-'));
}

function writeFiles(dir: string, files: Record<string, string>) {
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

describe('scan', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('finds TODO comments', () => {
    writeFiles(tempDir, {
      'app.ts': '// TODO: fix this later\nconst x = 1;',
    });
    const result = scan({ directory: tempDir });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].tag).toBe('TODO');
    expect(result.items[0].text).toBe('fix this later');
    expect(result.items[0].line).toBe(1);
  });

  test('finds FIXME comments', () => {
    writeFiles(tempDir, {
      'bug.js': '// FIXME: this is broken\nfunction foo() {}',
    });
    const result = scan({ directory: tempDir });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].tag).toBe('FIXME');
  });

  test('finds HACK comments', () => {
    writeFiles(tempDir, {
      'hack.ts': '// HACK: temporary workaround',
    });
    const result = scan({ directory: tempDir });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].tag).toBe('HACK');
  });

  test('finds multiple tags in one file', () => {
    writeFiles(tempDir, {
      'mixed.ts': '// TODO: something\n// FIXME: broken\n// HACK: ugly',
    });
    const result = scan({ directory: tempDir });
    expect(result.items).toHaveLength(3);
  });

  test('finds comments across multiple files', () => {
    writeFiles(tempDir, {
      'a.ts': '// TODO: in a',
      'b.ts': '// FIXME: in b',
      'c.py': '# TODO: in c',
    });
    const result = scan({ directory: tempDir });
    expect(result.items).toHaveLength(3);
  });

  test('filters by specific tags', () => {
    writeFiles(tempDir, {
      'app.ts': '// TODO: keep\n// FIXME: skip\n// HACK: skip',
    });
    const result = scan({ directory: tempDir, tags: ['TODO'] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].tag).toBe('TODO');
  });

  test('respects extension filter', () => {
    writeFiles(tempDir, {
      'app.ts': '// TODO: ts file',
      'app.py': '# TODO: py file',
    });
    const result = scan({ directory: tempDir, extensions: ['.ts'] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].file).toMatch(/app\.ts/);
  });

  test('ignores node_modules and .git', () => {
    writeFiles(tempDir, {
      'src/app.ts': '// TODO: keep this',
      'node_modules/pkg/index.ts': '// TODO: ignore this',
      '.git/config.ts': '// TODO: ignore this too',
    });
    const result = scan({ directory: tempDir });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].text).toBe('keep this');
  });

  test('custom ignore patterns', () => {
    writeFiles(tempDir, {
      'src/app.ts': '// TODO: keep',
      'vendor/lib.ts': '// TODO: ignore',
    });
    const result = scan({ directory: tempDir, ignorePatterns: ['node_modules', '.git', 'vendor'] });
    expect(result.items).toHaveLength(1);
  });

  test('extracts author with @mention', () => {
    writeFiles(tempDir, {
      'app.ts': '// TODO(@john): fix this',
    });
    const result = scan({ directory: tempDir });
    expect(result.items[0].author).toBe('@john');
  });

  test('extracts author in parentheses', () => {
    writeFiles(tempDir, {
      'app.ts': '// TODO(John Doe): fix this',
    });
    const result = scan({ directory: tempDir });
    expect(result.items[0].author).toBe('John Doe');
  });

  test('extracts date from comment', () => {
    writeFiles(tempDir, {
      'app.ts': '// TODO: fix by 2025-12-31 please',
    });
    const result = scan({ directory: tempDir });
    expect(result.items[0].date).toBe('2025-12-31');
  });

  test('assigns correct priorities', () => {
    writeFiles(tempDir, {
      'app.ts': '// TODO: low\n// FIXME: mid\n// BUG: high',
    });
    const result = scan({ directory: tempDir });
    const todo = result.items.find(i => i.tag === 'TODO');
    const fixme = result.items.find(i => i.tag === 'FIXME');
    const bug = result.items.find(i => i.tag === 'BUG');
    expect(todo!.priority!).toBeLessThan(fixme!.priority!);
    expect(fixme!.priority!).toBeLessThan(bug!.priority!);
  });

  test('min-priority filter', () => {
    writeFiles(tempDir, {
      'app.ts': '// NOTE: p0\n// TODO: p2\n// FIXME: p4\n// BUG: p5',
    });
    const result = scan({ directory: tempDir, minPriority: 3 });
    expect(result.items).toHaveLength(2);
    expect(result.items.every(i => (i.priority ?? 0) >= 3)).toBe(true);
  });

  test('builds correct summary', () => {
    writeFiles(tempDir, {
      'app.ts': '// TODO: a\n// TODO: b\n// FIXME: c',
    });
    const result = scan({ directory: tempDir });
    expect(result.summary['TODO']).toBe(2);
    expect(result.summary['FIXME']).toBe(1);
  });

  test('groups by file', () => {
    writeFiles(tempDir, {
      'a.ts': '// TODO: a1\n// FIXME: a2',
      'b.ts': '// TODO: b1',
    });
    const result = scan({ directory: tempDir });
    expect(result.files).toHaveLength(2);
    expect(result.files[0].count).toBeGreaterThanOrEqual(result.files[1].count);
  });

  test('returns empty results for clean codebase', () => {
    writeFiles(tempDir, {
      'clean.ts': 'const x = 1;\nconsole.log(x);',
    });
    const result = scan({ directory: tempDir });
    expect(result.items).toHaveLength(0);
    expect(Object.keys(result.summary)).toHaveLength(0);
  });

  test('handles Python comments', () => {
    writeFiles(tempDir, {
      'script.py': '# TODO: implement this\n# FIXME: broken logic\npass',
    });
    const result = scan({ directory: tempDir });
    expect(result.items).toHaveLength(2);
  });

  test('handles XXX and OPTIMIZE tags', () => {
    writeFiles(tempDir, {
      'app.ts': '// XXX: questionable\n// OPTIMIZE: slow loop',
    });
    const result = scan({ directory: tempDir });
    expect(result.items).toHaveLength(2);
    expect(result.items.find(i => i.tag === 'XXX')).toBeDefined();
    expect(result.items.find(i => i.tag === 'OPTIMIZE')).toBeDefined();
  });
});

describe('formatText', () => {
  test('shows clean message for empty results', () => {
    const result = formatText({ items: [], summary: {}, files: [] });
    expect(result).toContain('Clean codebase');
  });

  test('includes item count', () => {
    const item: TodoItem = {
      file: 'app.ts', line: 1, column: 1, tag: 'TODO', text: 'test', priority: 2,
    };
    const result = formatText({ items: [item], summary: { TODO: 1 }, files: [{ file: 'app.ts', count: 1, items: [item] }] });
    expect(result).toContain('1 comment');
    expect(result).toContain('TODO');
  });
});

describe('formatJson', () => {
  test('produces valid JSON', () => {
    const item: TodoItem = {
      file: 'app.ts', line: 1, column: 1, tag: 'TODO', text: 'test', priority: 2,
    };
    const result = formatJson({ items: [item], summary: { TODO: 1 }, files: [{ file: 'app.ts', count: 1, items: [item] }] });
    const parsed = JSON.parse(result);
    expect(parsed.items).toHaveLength(1);
  });
});

describe('formatMarkdown', () => {
  test('includes markdown table', () => {
    const item: TodoItem = {
      file: 'app.ts', line: 1, column: 1, tag: 'TODO', text: 'test', priority: 2,
    };
    const result = formatMarkdown({ items: [item], summary: { TODO: 1 }, files: [{ file: 'app.ts', count: 1, items: [item] }] });
    expect(result).toContain('# TodoTree Report');
    expect(result).toContain('| Tag |');
  });
});

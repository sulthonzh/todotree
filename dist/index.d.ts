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
export declare function scan(options: ScanOptions): ScanResult;
export declare function formatText(result: ScanResult): string;
export declare function formatJson(result: ScanResult): string;
export declare function formatMarkdown(result: ScanResult): string;

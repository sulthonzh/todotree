import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractTags, scanFile, parseArgs, tagCounts,
  formatText, formatJSON, formatMarkdown, isTextFile, HELP, TAGS,
} from "../index.js";

describe("extractTags", () => {
  it("finds TODO", () => {
    const r = extractTags("// TODO: fix this");
    assert.equal(r.length, 1);
    assert.equal(r[0].tag, "TODO");
    assert.equal(r[0].text, "fix this");
  });
  it("finds separate tags on different lines", () => {
    const r1 = extractTags("/* FIXME: broken */");
    assert.equal(r1.length, 1);
    assert.equal(r1[0].tag, "FIXME");
    const r2 = extractTags("/* HACK: temp fix */");
    assert.equal(r2.length, 1);
    assert.equal(r2[0].tag, "HACK");
  });
  it("finds tag with author TODO(john)", () => {
    const r = extractTags("// TODO(john): refactor");
    assert.equal(r.length, 1);
    assert.equal(r[0].tag, "TODO");
    assert.equal(r[0].text, "refactor");
  });
  it("returns empty for no tags", () => {
    assert.equal(extractTags("just a regular comment").length, 0);
  });
  it("is case insensitive", () => {
    const r = extractTags("// todo: lowercase");
    assert.equal(r.length, 1);
    assert.equal(r[0].tag, "TODO");
  });
});

describe("isTextFile", () => {
  it("recognizes .js", () => assert.equal(isTextFile("app.js"), true));
  it("recognizes .py", () => assert.equal(isTextFile("main.py"), true));
  it("rejects .png", () => assert.equal(isTextFile("img.png"), false));
  it("recognizes Dockerfile", () => assert.equal(isTextFile("Dockerfile"), true));
});

describe("parseArgs", () => {
  it("defaults", () => {
    const a = parseArgs([]);
    assert.equal(a.dir, ".");
    assert.equal(a.format, "text");
    assert.equal(a.tags, null);
  });
  it("--json", () => assert.equal(parseArgs(["--json"]).format, "json"));
  it("--markdown", () => assert.equal(parseArgs(["--markdown"]).format, "markdown"));
  it("--tags filter", () => {
    const a = parseArgs(["--tags", "TODO,FIXME"]);
    assert.deepEqual(a.tags, ["TODO", "FIXME"]);
  });
  it("--ignore adds dirs", () => {
    const a = parseArgs(["--ignore", "dist,coverage"]);
    assert.deepEqual(a.ignore, ["dist", "coverage"]);
  });
  it("dir from positional", () => assert.equal(parseArgs(["src"]).dir, "src"));
  it("--help flag", () => assert.equal(parseArgs(["--help"]).help, true));
  it("-h flag", () => assert.equal(parseArgs(["-h"]).help, true));
});

describe("tagCounts", () => {
  it("counts tags across files", () => {
    const results = [
      { file: "a.js", items: [{ tag: "TODO", text: "a" }, { tag: "FIXME", text: "b" }] },
      { file: "b.js", items: [{ tag: "TODO", text: "c" }] },
    ];
    const c = tagCounts(results);
    assert.equal(c.TODO, 2);
    assert.equal(c.FIXME, 1);
  });
  it("empty results", () => assert.deepEqual(tagCounts([]), {}));
});

describe("formatText", () => {
  it("shows clean message when empty", () => {
    assert.ok(formatText([]).includes("Clean codebase"));
  });
  it("shows file and tag info", () => {
    const r = [{ file: "app.js", items: [{ line: 10, tag: "TODO", text: "fix later" }] }];
    const out = formatText(r);
    assert.ok(out.includes("app.js"));
    assert.ok(out.includes("TODO"));
    assert.ok(out.includes("fix later"));
  });
  it("truncates long text", () => {
    const long = "x".repeat(80);
    const r = [{ file: "a.js", items: [{ line: 1, tag: "TODO", text: long }] }];
    const out = formatText(r);
    assert.ok(out.includes("..."));
  });
});

describe("formatJSON", () => {
  it("valid JSON output", () => {
    const r = [{ file: "a.js", items: [{ line: 1, tag: "TODO", text: "test" }] }];
    const parsed = JSON.parse(formatJSON(r));
    assert.equal(parsed.total, 1);
    assert.equal(parsed.files.length, 1);
  });
  it("empty results", () => {
    const parsed = JSON.parse(formatJSON([]));
    assert.equal(parsed.total, 0);
  });
});

describe("formatMarkdown", () => {
  it("includes header and table", () => {
    const r = [{ file: "a.js", items: [{ line: 1, tag: "TODO", text: "test" }] }];
    const out = formatMarkdown(r);
    assert.ok(out.includes("# TODO Tree"));
    assert.ok(out.includes("| Tag | Count |"));
  });
  it("empty results", () => {
    assert.ok(formatMarkdown([]).includes("No TODO"));
  });
});

describe("HELP", () => {
  it("includes usage info", () => assert.ok(HELP.includes("Usage")));
  it("lists all tags", () => {
    for (const t of TAGS) assert.ok(HELP.includes(t));
  });
});

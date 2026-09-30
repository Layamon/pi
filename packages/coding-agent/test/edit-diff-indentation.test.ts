import { describe, expect, it } from "vitest";
import { applyEditsToNormalizedContent, repairIndentationMismatch } from "../src/core/tools/edit-diff.ts";

const TABBED = ["int main()", "{", "\tif (x)", "\t{", "\t\treturn call(a, b);", "\t}", "}", ""].join("\n");

function toSpaces(text: string, width: number): string {
	return text.replace(/\t/g, " ".repeat(width));
}

describe("repairIndentationMismatch", () => {
	it("repairs tabs expanded to four spaces and re-indents newText to tabs", () => {
		const oldText = toSpaces("\tif (x)\n\t{\n\t\treturn call(a, b);\n\t}", 4);
		const newText = toSpaces("\tif (x)\n\t{\n\t\treturn call(a, c);\n\t}", 4);

		const repaired = repairIndentationMismatch(TABBED, oldText, newText);

		expect(repaired?.oldText).toBe("\tif (x)\n\t{\n\t\treturn call(a, b);\n\t}");
		expect(repaired?.newText).toBe("\tif (x)\n\t{\n\t\treturn call(a, c);\n\t}");
	});

	it("repairs tabs expanded to two spaces", () => {
		const oldText = toSpaces("\t\treturn call(a, b);", 2);
		const newText = toSpaces("\t\treturn call(a, c);", 2);

		const repaired = repairIndentationMismatch(TABBED, oldText, newText);

		expect(repaired?.oldText).toBe("\t\treturn call(a, b);");
		expect(repaired?.newText).toBe("\t\treturn call(a, c);");
	});

	it("preserves alignment spaces after the indentation", () => {
		const content = "\t\t\t  op_lefttype,\n";
		const oldText = toSpaces("\t\t\t  op_lefttype,", 4);
		const newText = toSpaces("\t\t\t  op_righttype,", 4);

		const repaired = repairIndentationMismatch(content, oldText, newText);

		expect(repaired?.oldText).toBe("\t\t\t  op_lefttype,");
		expect(repaired?.newText).toBe("\t\t\t  op_righttype,");
	});

	it("returns undefined for an ambiguous block", () => {
		const content = "\tfoo();\n\tfoo();\n";
		const oldText = toSpaces("\tfoo();", 4);

		expect(repairIndentationMismatch(content, oldText, toSpaces("\tbar();", 4))).toBeUndefined();
	});

	it("returns undefined for space-indented content", () => {
		const content = "int main()\n{\n    if (x)\n    {\n        return call(a, b);\n    }\n}\n";
		const oldText = toSpaces("\tif (x)\n\t{\n\t\treturn call(a, b);\n\t}", 4);

		expect(repairIndentationMismatch(content, oldText, oldText)).toBeUndefined();
	});
});

describe("applyEditsToNormalizedContent indentation tolerance", () => {
	it("applies an edit whose oldText uses spaces in a tab-indented file", () => {
		const oldText = toSpaces("\t\treturn call(a, b);", 4);
		const newText = toSpaces("\t\treturn call(a, c);", 4);

		const { newContent } = applyEditsToNormalizedContent(TABBED, [{ oldText, newText }], "file.ts");

		expect(newContent).toContain("\t\treturn call(a, c);");
		expect(newContent).not.toContain("    return call(a, c);");
	});

	it("mixes exact and indentation-repaired edits", () => {
		const { newContent } = applyEditsToNormalizedContent(
			TABBED,
			[
				{ oldText: "\tif (x)", newText: "\tif (y)" },
				{ oldText: toSpaces("\t\treturn call(a, b);", 4), newText: toSpaces("\t\treturn call(a, c);", 4) },
			],
			"file.ts",
		);

		expect(newContent).toContain("\tif (y)");
		expect(newContent).toContain("\t\treturn call(a, c);");
		expect(newContent).not.toContain("\tif (x)");
	});

	it("keeps exact matches unchanged", () => {
		const { newContent } = applyEditsToNormalizedContent(
			TABBED,
			[{ oldText: "\t\treturn call(a, b);", newText: "\t\treturn call(a, c);" }],
			"file.ts",
		);

		expect(newContent).toContain("\t\treturn call(a, c);");
	});
});

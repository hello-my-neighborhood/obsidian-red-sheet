import { EditorState, RangeSetBuilder, Extension } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { findItems, ItemMatch, SheetOptions } from "./matcher";

export const ITEM_CLASS = "red-sheet-item";

function inCode(state: EditorState, pos: number): boolean {
	const name = syntaxTree(state).resolveInner(pos, 1).name;
	return /code|math|frontmatter|hmd-codeblock/i.test(name);
}

/** All marked items in the given range, skipping code. */
export function itemsIn(state: EditorState, from: number, to: number, opts: SheetOptions): ItemMatch[] {
	const out: ItemMatch[] = [];
	const startLine = state.doc.lineAt(from).number;
	const endLine = state.doc.lineAt(to).number;
	for (let l = startLine; l <= endLine; l++) {
		const line = state.doc.line(l);
		for (const m of findItems(line.text, line.from, opts)) {
			if (!inCode(state, m.from) && !inCode(state, m.to - 1)) out.push(m);
		}
	}
	return out;
}

/**
 * Live Preview: paints {{text}} (and optionally ==text==) as red "pen" marks and hides
 * the delimiters unless the cursor is on the item.
 */
export function buildEditorExtension(
	getOpts: () => SheetOptions,
	isLivePreview: (state: EditorState) => boolean,
): Extension {
	const hideDelim = Decoration.replace({});
	const mark = Decoration.mark({ class: ITEM_CLASS });

	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = this.build(view);
			}
			update(u: ViewUpdate) {
				if (
					u.docChanged || u.viewportChanged || u.selectionSet ||
					isLivePreview(u.startState) !== isLivePreview(u.state)
				) {
					this.decorations = this.build(u.view);
				}
			}
			build(view: EditorView): DecorationSet {
				const b = new RangeSetBuilder<Decoration>();
				const state = view.state;
				if (!isLivePreview(state)) return b.finish();
				const opts = getOpts();
				const sel = state.selection.ranges;
				for (const { from, to } of view.visibleRanges) {
					for (const m of itemsIn(state, from, to, opts)) {
						const editing = sel.some((r) => r.from <= m.to && r.to >= m.from);
						if (editing) {
							b.add(m.from, m.to, mark);
						} else {
							b.add(m.from, m.from + m.delim, hideDelim);
							b.add(m.from + m.delim, m.to - m.delim, mark);
							b.add(m.to - m.delim, m.to, hideDelim);
						}
					}
				}
				return b.finish();
			}
		},
		{ decorations: (v) => v.decorations },
	);
}

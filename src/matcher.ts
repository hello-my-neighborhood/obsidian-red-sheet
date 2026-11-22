export interface SheetOptions {
	/** Also treat ==highlights== as hidden items. */
	hideHighlights: boolean;
}

export interface ItemMatch {
	/** Start of the whole item, including the opening delimiter. */
	from: number;
	/** End of the whole item, including the closing delimiter. */
	to: number;
	/** Length of the opening/closing delimiter. */
	delim: number;
}

/** Finds red-sheet items ({{text}} and optionally ==text==) in a piece of text. */
export function findItems(text: string, offset: number, opts: SheetOptions): ItemMatch[] {
	const re = opts.hideHighlights
		? /\{\{(?!\{)([^\n]+?)\}\}|==(?!=)([^\n]+?)==/g
		: /\{\{(?!\{)([^\n]+?)\}\}/g;
	const out: ItemMatch[] = [];
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		const inner = m[1] ?? m[2] ?? "";
		if (!inner.trim()) continue;
		out.push({ from: offset + m.index, to: offset + m.index + m[0].length, delim: 2 });
	}
	return out;
}

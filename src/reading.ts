export const ITEM_CLASS = "red-sheet-item";

const SKIP_TAGS = new Set(["CODE", "PRE", "SCRIPT", "STYLE", "TEXTAREA"]);

interface Pos { node: Text; offset: number; }

/**
 * Wraps {{text}} in the rendered (Reading view) DOM with <span class="red-sheet-item">.
 * Works across inline formatting, e.g. {{a **b** c}}.
 */
export function wrapBraceItems(root: HTMLElement): void {
	const doc = root.ownerDocument;
	const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, {
		acceptNode(node: Node) {
			let p = node.parentElement;
			while (p && p !== root) {
				if (SKIP_TAGS.has(p.tagName) || p.classList.contains(ITEM_CLASS)) return 2; // REJECT
				p = p.parentElement;
			}
			return 1; // ACCEPT
		},
	});
	const texts: Text[] = [];
	let n: Node | null;
	while ((n = walker.nextNode())) texts.push(n as Text);
	if (!texts.some((t) => t.data.includes("{{"))) return;

	// Find delimiter tokens in document order.
	const pairs: { open: Pos; close: Pos }[] = [];
	let open: Pos | null = null;
	for (const t of texts) {
		const s = t.data;
		let i = 0;
		while (i < s.length - 1) {
			if (!open && s[i] === "{" && s[i + 1] === "{") {
				open = { node: t, offset: i };
				i += 2;
			} else if (open && s[i] === "}" && s[i + 1] === "}") {
				const sameSpot = open.node === t && open.offset + 2 === i;
				if (!sameSpot) pairs.push({ open, close: { node: t, offset: i } });
				open = null;
				i += 2;
			} else if (open && s[i] === "\n") {
				open = null; // items don't span lines
				i++;
			} else i++;
		}
	}

	// Process in reverse so earlier positions stay valid.
	for (let k = pairs.length - 1; k >= 0; k--) {
		const { open: o, close: c } = pairs[k];
		c.node.deleteData(c.offset, 2);
		const range = doc.createRange();
		range.setStart(o.node, o.offset + 2);
		range.setEnd(c.node, c.offset);
		const span = doc.createElement("span");
		span.className = ITEM_CLASS;
		span.appendChild(range.extractContents());
		range.insertNode(span);
		o.node.deleteData(o.offset, 2);
	}
}

/** Marks rendered ==highlights== (<mark>) as red-sheet items. */
export function markHighlights(root: HTMLElement): void {
	root.querySelectorAll("mark").forEach((m) => m.classList.add(ITEM_CLASS));
}

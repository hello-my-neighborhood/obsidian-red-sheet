import { ITEM_CLASS } from "./reading";

/** Parses "rgb(r, g, b)" / "rgba(...)" into HSL. */
function rgbToHsl(css: string): { h: number; s: number; l: number; a: number } | null {
	const m = css.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/);
	if (!m) return null;
	const r = +m[1] / 255, g = +m[2] / 255, b = +m[3] / 255;
	const a = m[4] === undefined ? 1 : +m[4];
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	if (d === 0) return { h: 0, s: 0, l, a };
	const s = d / (1 - Math.abs(2 * l - 1));
	let h: number;
	if (max === r) h = ((g - b) / d) % 6;
	else if (max === g) h = (b - r) / d + 2;
	else h = (r - g) / d + 4;
	h = (h * 60 + 360) % 360;
	return { h, s, l, a };
}

/** True for red / orange / pink-red text colors, like a red or orange pen. */
export function isRedish(css: string): boolean {
	const c = rgbToHsl(css);
	if (!c || c.a < 0.3) return false;
	return (c.h >= 330 || c.h <= 40) && c.s >= 0.45 && c.l >= 0.25 && c.l <= 0.8;
}

const cache = new Map<string, string | null>();

/** Normalises named/hex colors through the browser, cached per color string. */
function redCache(doc: Document, color: string): string | null {
	const key = color.trim().toLowerCase();
	const hit = cache.get(key);
	if (hit !== undefined) return hit;
	const probe = doc.createElement("span");
	probe.setCssStyles({ color: key });
	doc.body.appendChild(probe);
	const rgb = (doc.defaultView ?? window).getComputedStyle(probe).color;
	const result = isRedish(rgb) ? rgb : null;
	probe.remove();
	cache.set(key, result);
	return result;
}

const CANDIDATES = '[style*="color"], font[color]';

/** Tags elements whose text the user painted red/orange (inline HTML) as items. */
export function tagColoredText(root: ParentNode): void {
	const els: Element[] = [];
	if ((root as Node).instanceOf(Element) && (root as Element).matches(CANDIDATES)) els.push(root as Element);
	root.querySelectorAll(CANDIDATES).forEach((e) => els.push(e));
	for (const el of els) {
		if (el.classList.contains(ITEM_CLASS) || el.closest(".red-sheet-overlay")) continue;
		let color = "";
		if (el.tagName === "FONT") color = el.getAttribute("color") ?? "";
		const styleColor = (el as HTMLElement).style?.color;
		if (styleColor) color = styleColor;
		if (!color) continue;
		const rgb = redCache(el.ownerDocument, color);
		if (rgb) {
			(el as HTMLElement).setCssProps({ "--rs-ink": rgb });
			el.classList.add(ITEM_CLASS, "rs-colored");
		}
	}
}

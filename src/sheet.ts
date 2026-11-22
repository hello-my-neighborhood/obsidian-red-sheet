/** Sheet position, relative to the note area (the "table"). */
export interface Rect { x: number; y: number; w: number; h: number; }

export interface SheetHost {
	getRect(): Rect | null;
	saveRect(r: Rect): void;
}

const MIN_W = 80;
const MIN_H = 40;
const KEEP_VISIBLE = 40; // px of the sheet that must stay on the table
const GRIP = 28; // resize corner size

/**
 * A red plastic sheet lying on the note area, plus a red filter for the whole note area.
 * Both live inside the note's content element and are clipped to it, so the sheet can
 * slide partly off the edges like a sheet on a table. Wherever red covers the note,
 * marked (red) text disappears.
 */
export class SheetController {
	private container: HTMLElement | null = null;
	private tableEl: HTMLElement | null = null;
	private sheetEl: HTMLElement | null = null;
	private filterEl: HTMLElement | null = null;
	private rect: Rect | null = null;
	private ro: ResizeObserver | null = null;
	private dragging = false;

	constructor(private host: SheetHost) {}

	get sheetOn() { return !!this.sheetEl; }
	get filterOn() { return !!this.filterEl; }
	get attachedTo() { return this.container; }

	toggleSheet(container: HTMLElement, on?: boolean) {
		const want = on ?? !(this.sheetOn && this.container === container);
		if (want) {
			this.attach(container);
			if (!this.sheetEl) this.createSheet();
		} else if (this.sheetEl) {
			this.sheetEl.remove();
			this.sheetEl = null;
		}
		this.afterChange();
	}

	toggleFilter(container: HTMLElement, on?: boolean) {
		const want = on ?? !(this.filterOn && this.container === container);
		if (want) {
			this.attach(container);
			if (!this.filterEl) this.filterEl = this.div(this.tableEl!, "red-sheet-filter");
		} else if (this.filterEl) {
			this.filterEl.remove();
			this.filterEl = null;
		}
		this.afterChange();
	}

	/** Put the sheet back in its default spot on the note. */
	resetSheet(container: HTMLElement) {
		this.attach(container);
		this.rect = this.defaultRect();
		this.host.saveRect(this.rect);
		if (!this.sheetEl) this.createSheet();
		this.place();
		this.afterChange();
	}

	/** Drop everything if the note we were lying on went away. */
	checkAlive() {
		if (this.container && !this.container.isConnected) this.detach();
	}

	destroy() {
		this.detach();
	}

	// ---- setup ----

	private attach(container: HTMLElement) {
		if (this.container === container) return;
		const hadSheet = this.sheetOn, hadFilter = this.filterOn;
		this.detach();
		this.container = container;
		container.classList.add("red-sheet-host");
		this.tableEl = this.div(container, "red-sheet-table");
		container.addEventListener("pointerdown", this.onPointerDown, true);
		container.addEventListener("pointermove", this.onHover);
		container.addEventListener("touchstart", this.onTouch, { capture: true, passive: false });
		container.addEventListener("touchmove", this.onTouch, { capture: true, passive: false });
		this.ro = new ResizeObserver(() => { this.clampAndPlace(); });
		this.ro.observe(container);
		if (hadSheet) this.createSheet();
		if (hadFilter) this.filterEl = this.div(this.tableEl, "red-sheet-filter");
	}

	private detach() {
		const c = this.container;
		if (!c) return;
		c.removeEventListener("pointerdown", this.onPointerDown, true);
		c.removeEventListener("pointermove", this.onHover);
		c.removeEventListener("touchstart", this.onTouch, true);
		c.removeEventListener("touchmove", this.onTouch, true);
		this.ro?.disconnect();
		this.ro = null;
		this.tableEl?.remove();
		this.tableEl = this.sheetEl = this.filterEl = null;
		c.classList.remove("red-sheet-host", "red-sheet-active", "rs-over-sheet", "rs-over-grip");
		c.setCssProps({ "--rs-x": "", "--rs-y": "", "--rs-w": "", "--rs-h": "" });
		this.container = null;
	}

	private afterChange() {
		if (!this.sheetOn && !this.filterOn) this.detach();
		else this.sync();
	}

	private div(parent: HTMLElement, cls: string): HTMLElement {
		const d = parent.ownerDocument.createElement("div");
		d.className = cls;
		parent.appendChild(d);
		return d;
	}

	private createSheet() {
		const el = this.div(this.tableEl!, "red-sheet-sheet");
		this.div(el, "rs-grip");
		this.sheetEl = el;
		this.rect = this.clamp(this.rect ?? this.host.getRect() ?? this.defaultRect());
		this.place();
	}

	// ---- dragging (anywhere on the sheet) ----

	private hit(clientX: number, clientY: number): "move" | "resize" | null {
		if (!this.sheetEl || !this.container || !this.rect) return null;
		const cr = this.container.getBoundingClientRect();
		const x = clientX - cr.left, y = clientY - cr.top;
		const r = this.rect;
		if (x < 0 || y < 0 || x > cr.width || y > cr.height) return null;
		if (x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) return null;
		if (x > r.x + r.w - GRIP && y > r.y + r.h - GRIP) return "resize";
		return "move";
	}

	private onHover = (e: PointerEvent) => {
		const c = this.container;
		if (!c || this.dragging) return;
		const onClose = !!(e.target as HTMLElement)?.closest?.(".rs-close");
		const mode = onClose ? null : this.hit(e.clientX, e.clientY);
		c.classList.toggle("rs-over-sheet", mode === "move");
		c.classList.toggle("rs-over-grip", mode === "resize");
	};

	private onTouch = (e: TouchEvent) => {
		const t = e.touches[0];
		if (!t) return;
		if ((e.target as HTMLElement)?.closest?.(".rs-close")) return;
		if (this.dragging || (e.type === "touchstart" && this.hit(t.clientX, t.clientY))) e.preventDefault();
	};

	private onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0 || !this.rect) return;
		if ((e.target as HTMLElement)?.closest?.(".rs-close")) return;
		const mode = this.hit(e.clientX, e.clientY);
		if (!mode) return;
		e.preventDefault();
		e.stopPropagation();
		const c = this.container!;
		const start = { ...this.rect };
		const sx = e.clientX, sy = e.clientY;
		this.dragging = true;
		try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
		this.sheetEl?.classList.add("is-dragging");
		const move = (ev: PointerEvent) => {
			const dx = ev.clientX - sx, dy = ev.clientY - sy;
			this.rect = this.clamp(mode === "move"
				? { ...start, x: start.x + dx, y: start.y + dy }
				: { ...start, w: start.w + dx, h: start.h + dy });
			this.place();
		};
		const up = () => {
			c.removeEventListener("pointermove", move);
			c.removeEventListener("pointerup", up);
			c.removeEventListener("pointercancel", up);
			this.dragging = false;
			this.sheetEl?.classList.remove("is-dragging");
			if (this.rect) this.host.saveRect(this.rect);
		};
		c.addEventListener("pointermove", move);
		c.addEventListener("pointerup", up);
		c.addEventListener("pointercancel", up);
	};

	// ---- geometry ----

	private size() {
		const c = this.container!;
		return { W: c.clientWidth || 600, H: c.clientHeight || 400 };
	}

	private defaultRect(): Rect {
		const { W, H } = this.size();
		// Lying across the lower part of the note, spilling past the edges.
		return { x: -24, y: Math.round(H * 0.45), w: W + 48, h: Math.round(H * 0.8) };
	}

	private clamp(r: Rect): Rect {
		const { W, H } = this.size();
		const w = Math.min(Math.max(MIN_W, r.w), W * 3);
		const h = Math.min(Math.max(MIN_H, r.h), H * 3);
		const x = Math.min(Math.max(r.x, KEEP_VISIBLE - w), W - KEEP_VISIBLE);
		const y = Math.min(Math.max(r.y, KEEP_VISIBLE - h), H - KEEP_VISIBLE);
		return { x, y, w, h };
	}

	private clampAndPlace() {
		if (this.rect && this.sheetEl) this.rect = this.clamp(this.rect);
		this.place();
	}

	private place() {
		if (this.sheetEl && this.rect) {
			this.sheetEl.setCssProps({
				"--rs-sheet-x": this.rect.x + "px",
				"--rs-sheet-y": this.rect.y + "px",
				"--rs-sheet-w": this.rect.w + "px",
				"--rs-sheet-h": this.rect.h + "px",
			});
		}
		this.sync();
	}

	/** Tell the CSS (in screen coordinates) where red covers the note. */
	private sync() {
		const c = this.container;
		if (!c) return;
		const active = this.sheetOn || this.filterOn;
		c.classList.toggle("red-sheet-active", active);
		const cr = c.getBoundingClientRect();
		let x1 = cr.left, y1 = cr.top, x2 = cr.right, y2 = cr.bottom;
		if (!this.filterOn && this.rect) {
			x1 = Math.max(x1, cr.left + this.rect.x);
			y1 = Math.max(y1, cr.top + this.rect.y);
			x2 = Math.min(x2, cr.left + this.rect.x + this.rect.w);
			y2 = Math.min(y2, cr.top + this.rect.y + this.rect.h);
		}
		c.setCssProps({
			"--rs-x": x1 + "px",
			"--rs-y": y1 + "px",
			"--rs-w": Math.max(0, x2 - x1) + "px",
			"--rs-h": Math.max(0, y2 - y1) + "px",
		});
	}

	/** The container can move on screen (sidebars, splits) without resizing. */
	resync() { this.sync(); }
}


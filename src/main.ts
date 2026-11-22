import { App, MarkdownView, Notice, Plugin, setIcon, PluginSettingTab, Setting, editorLivePreviewField } from "obsidian";
import { Extension } from "@codemirror/state";
import { buildEditorExtension } from "./editor";
import { t } from "./i18n";
import { markHighlights, wrapBraceItems } from "./reading";
import { tagColoredText } from "./colored";
import { Rect, SheetController } from "./sheet";

interface RedSheetSettings {
	hideHighlights: boolean;
	detectColoredText: boolean;
	peekOnHover: boolean;
	markColor: string;
	sheetColor: string;
	sheetOpacity: number;
	sheetRect: Rect | null;
}

const DEFAULT_SETTINGS: RedSheetSettings = {
	hideHighlights: false,
	detectColoredText: true,
	peekOnHover: true,
	markColor: "#e03131",
	sheetColor: "#e03131",
	sheetOpacity: 0.55,
	sheetRect: null,
};

export default class RedSheetPlugin extends Plugin {
	settings: RedSheetSettings = { ...DEFAULT_SETTINGS };
	sheet!: SheetController;
	private sheetRibbon: HTMLElement | null = null;
	private filterStatus: HTMLElement | null = null;
	private editorExtensions: Extension[] = [];
	/** Documents of the main window and open popout windows. */
	private docs = new Set<Document>();
	private observer: MutationObserver | null = null;

	async onload() {
		await this.loadSettings();

		this.sheet = new SheetController({
			getRect: () => this.settings.sheetRect,
			saveRect: (r) => {
				this.settings.sheetRect = r;
				void this.saveSettings();
			},
		});

		// Reading view: {{text}}, optionally ==highlights== and red-painted HTML text.
		this.registerMarkdownPostProcessor((el) => {
			wrapBraceItems(el);
			if (this.settings.hideHighlights) markHighlights(el);
			if (this.settings.detectColoredText) tagColoredText(el);
		});

		// Live Preview: {{text}} shown as red pen, braces hidden.
		this.editorExtensions.push(this.makeEditorExtension());
		this.registerEditorExtension(this.editorExtensions);

		// Red-painted HTML text that shows up in the editor (Live Preview renders inline HTML).
		// Watched in the main window and in every popout window.
		this.observer = new MutationObserver((records) => {
			if (!this.settings.detectColoredText) return;
			for (const rec of records) {
				rec.addedNodes.forEach((n) => {
					if (n.instanceOf(Element)) tagColoredText(n);
				});
			}
		});
		this.register(() => this.observer?.disconnect());
		this.app.workspace.onLayoutReady(() => this.addDoc(document));
		this.registerEvent(this.app.workspace.on("window-open", (win) => this.addDoc(win.doc)));
		this.registerEvent(this.app.workspace.on("window-close", (win) => {
			this.removeLook(win.doc);
			this.docs.delete(win.doc);
		}));

		this.sheetRibbon = this.addRibbonIcon("layers", t().ribbonSheet, () => this.toggleSheet());

		// Filter switch in the status bar (bottom right, next to word count).
		this.filterStatus = this.addStatusBarItem();
		this.filterStatus.addClass("mod-clickable", "red-sheet-status");
		this.filterStatus.setAttribute("aria-label", t().filterTooltip);
		this.filterStatus.setAttribute("data-tooltip-position", "top");
		setIcon(this.filterStatus.createSpan({ cls: "red-sheet-status-icon" }), "eye-off");
		this.filterStatus.createSpan({ cls: "red-sheet-status-text", text: t().filterLabel });
		this.filterStatus.onClickEvent(() => this.toggleFilter());

		this.addCommand({ id: "toggle-sheet", name: t().cmdSheet, callback: () => this.toggleSheet() });
		this.addCommand({ id: "toggle-filter", name: t().cmdFilter, callback: () => this.toggleFilter() });
		this.addCommand({
			id: "reset-sheet",
			name: t().cmdReset,
			callback: () => {
				const c = this.noteArea();
				if (c) this.sheet.resetSheet(c);
				this.updateRibbons();
			},
		});

		this.registerDomEvent(window, "resize", () => this.sheet.resync());
		this.registerEvent(this.app.workspace.on("layout-change", () => {
			this.sheet.checkAlive();
			this.sheet.resync();
			this.updateRibbons();
		}));
		this.registerEvent(this.app.workspace.on("resize", () => this.sheet.resync()));
		this.addSettingTab(new RedSheetSettingTab(this.app, this));
		this.applyLook();
	}

	onunload() {
		this.sheet.destroy();
		this.docs.forEach((doc) => this.removeLook(doc));
		this.docs.clear();
	}

	private addDoc(doc: Document) {
		if (this.docs.has(doc)) return;
		this.docs.add(doc);
		this.observer?.observe(doc.body, { childList: true, subtree: true });
		this.applyLookTo(doc);
		if (this.settings.detectColoredText) tagColoredText(doc.body);
	}

	private removeLook(doc: Document) {
		doc.body.removeClass("red-sheet-peek");
		doc.body.setCssProps({ "--red-sheet-mark": "", "--red-sheet-sheet": "", "--red-sheet-opacity": "" });
	}

	async loadSettings() {
		const saved = (await this.loadData()) as Partial<RedSheetSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** The reading area of the active note: the "table" the sheet lies on. */
	private noteArea(): HTMLElement | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			new Notice(t().openNote);
			return null;
		}
		return view.contentEl;
	}

	toggleSheet() {
		const c = this.noteArea();
		if (c) this.sheet.toggleSheet(c);
		this.updateRibbons();
	}

	toggleFilter() {
		const c = this.noteArea();
		if (c) this.sheet.toggleFilter(c);
		this.updateRibbons();
	}

	private updateRibbons() {
		this.sheetRibbon?.toggleClass("is-active", this.sheet.sheetOn);
		this.filterStatus?.toggleClass("is-active", this.sheet.filterOn);
	}

	applyLook() {
		this.docs.forEach((doc) => this.applyLookTo(doc));
	}

	private applyLookTo(doc: Document) {
		doc.body.setCssProps({
			"--red-sheet-mark": this.settings.markColor,
			"--red-sheet-sheet": this.settings.sheetColor,
			"--red-sheet-opacity": String(this.settings.sheetOpacity),
		});
		doc.body.toggleClass("red-sheet-peek", this.settings.peekOnHover);
	}

	private makeEditorExtension(): Extension {
		return buildEditorExtension(
			() => ({ hideHighlights: this.settings.hideHighlights }),
			(state) => state.field(editorLivePreviewField, false) ?? false,
		);
	}

	/** Re-render notes after a change to what counts as marked text. */
	refreshNotes() {
		// Swap in a fresh editor extension so Live Preview re-reads the settings.
		this.editorExtensions.length = 0;
		this.editorExtensions.push(this.makeEditorExtension());
		this.app.workspace.updateOptions();
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) leaf.view.previewMode?.rerender(true);
		});
		this.docs.forEach((doc) => {
			if (this.settings.detectColoredText) tagColoredText(doc.body);
			else doc.querySelectorAll(".rs-colored").forEach((el) => el.classList.remove("red-sheet-item", "rs-colored"));
		});
	}
}

class RedSheetSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: RedSheetPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		const p = this.plugin;
		containerEl.empty();
		const s = t();

		containerEl.createEl("p", { text: s.intro });

		new Setting(containerEl).setName(s.headMarking).setHeading();

		new Setting(containerEl)
			.setName(s.coloredName)
			.setDesc(s.coloredDesc)
			.addToggle((t) => t.setValue(p.settings.detectColoredText).onChange(async (v) => {
				p.settings.detectColoredText = v;
				await p.saveSettings();
				p.refreshNotes();
			}));

		new Setting(containerEl)
			.setName(s.highlightsName)
			.setDesc(s.highlightsDesc)
			.addToggle((t) => t.setValue(p.settings.hideHighlights).onChange(async (v) => {
				p.settings.hideHighlights = v;
				await p.saveSettings();
				p.refreshNotes();
			}));

		new Setting(containerEl)
			.setName(s.penName)
			.setDesc(s.penDesc)
			.addColorPicker((c) => c.setValue(p.settings.markColor).onChange(async (v) => {
				p.settings.markColor = v;
				await p.saveSettings();
				p.applyLook();
			}));

		new Setting(containerEl).setName(s.headSheet).setHeading();

		new Setting(containerEl)
			.setName(s.peekName)
			.setDesc(s.peekDesc)
			.addToggle((t) => t.setValue(p.settings.peekOnHover).onChange(async (v) => {
				p.settings.peekOnHover = v;
				await p.saveSettings();
				p.applyLook();
			}));

		new Setting(containerEl)
			.setName(s.sheetColorName)
			.addColorPicker((c) => c.setValue(p.settings.sheetColor).onChange(async (v) => {
				p.settings.sheetColor = v;
				await p.saveSettings();
				p.applyLook();
			}));

		new Setting(containerEl)
			.setName(s.opacityName)
			.setDesc(s.opacityDesc)
			.addSlider((s) => s.setLimits(0.2, 0.9, 0.05).setValue(p.settings.sheetOpacity).onChange(async (v) => {
				p.settings.sheetOpacity = v;
				await p.saveSettings();
				p.applyLook();
			}));
	}
}

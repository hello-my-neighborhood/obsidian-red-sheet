import { moment } from "obsidian";

const en = {
	ribbonSheet: "Toggle red sheet",
	filterLabel: "Filter",
	filterTooltip: "Toggle red filter",
	cmdSheet: "Toggle red sheet",
	cmdFilter: "Toggle red filter over the note",
	cmdReset: "Move red sheet back onto the note",
	openNote: "Open a note first.",
	intro:
		"Mark what you want to memorize in red: with {{double braces}} or by coloring the text red/orange. " +
		"Then lay the red sheet over the note (drag it anywhere, resize it from the bottom corner) or turn on the red filter. " +
		"Red text disappears wherever the sheet covers it; move the sheet away to check.",
	headMarking: "Marking",
	coloredName: "Detect red-colored text",
	coloredDesc: "Text colored red or orange (for example <span style=\"color:red\"> or <font color=\"red\">) also disappears under the sheet.",
	highlightsName: "Also hide ==highlights==",
	highlightsDesc: "Useful if you already mark answers with highlights.",
	penName: "Pen color",
	penDesc: "Color of text marked with {{braces}} or highlights.",
	headSheet: "Sheet",
	peekName: "Peek on hover",
	peekDesc: "Hovering a mark covered by the sheet reveals it.",
	sheetColorName: "Sheet color",
	opacityName: "Sheet strength",
	opacityDesc: "The stronger, the redder the covered area.",
};

type Strings = typeof en;

const pt: Strings = {
	ribbonSheet: "Folha vermelha: pôr/tirar",
	filterLabel: "Filtro",
	filterTooltip: "Filtro vermelho: ligar/desligar",
	cmdSheet: "Pôr/tirar a folha vermelha",
	cmdFilter: "Ligar/desligar o filtro vermelho (área da nota)",
	cmdReset: "Recolocar a folha sobre a nota",
	openNote: "Abra uma nota primeiro.",
	intro:
		"Marque o que quer memorizar em vermelho: com {{chaves duplas}} ou pintando o texto de vermelho/laranja. " +
		"Depois ponha a folha vermelha sobre a nota (arraste segurando a folha, mude o tamanho pelo canto de baixo) ou ligue o filtro vermelho na área da nota. " +
		"O texto vermelho some onde a folha cobre; tire a folha para conferir.",
	headMarking: "Marcação",
	coloredName: "Reconhecer texto pintado de vermelho",
	coloredDesc: "Texto com cor vermelha ou laranja (por exemplo <span style=\"color:red\"> ou <font color=\"red\">) também some sob a folha.",
	highlightsName: "Esconder também os destaques ==assim==",
	highlightsDesc: "Útil se você já marca as respostas com destaque.",
	penName: "Cor da caneta",
	penDesc: "Cor do texto marcado com {{chaves}} ou destaque.",
	headSheet: "Folha",
	peekName: "Espiar passando o mouse",
	peekDesc: "Com o mouse sobre uma marcação coberta pela folha, o texto aparece.",
	sheetColorName: "Cor da folha",
	opacityName: "Intensidade da folha",
	opacityDesc: "Quanto mais forte, mais vermelha fica a área coberta.",
};

/** UI strings in Obsidian's language: Portuguese when set, English otherwise. */
export function t(): Strings {
	return moment.locale().toLowerCase().startsWith("pt") ? pt : en;
}

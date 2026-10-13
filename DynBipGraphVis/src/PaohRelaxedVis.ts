import * as d3 from 'd3';

import {globals, linkTypes, nodeTypes} from "./globals";
import {renderingParameters} from "./RenderingParameters";
import {getKeyByValueMap, intersect, concatMaps} from "./utils";
import OssatureGraph from "./OssatureGraph";
import PaohRelaxedGraph, {HyperEdge, PersonOccurrenceNode} from "./PaohRelaxedGraph";
import {LayeredGraph, LayeredNode, Link, Path, BipartiteDynGraph, Labelled} from "dynbipgraph";
import GraphRenderer from "./GraphRenderer";
import LabelMapper from "./LabelMapper";
import PathSelectionner, {getPeople, Intersection, Directions, splitIntersections} from "./PathSelectionner";
import {Orientations} from "./LabelMapper";


export default class PaohRelaxedVis extends GraphRenderer {
    // Visualization Variables
    personOccurrenceAsCircle: boolean = true;
    // documentAsLine: boolean = false;
    documentAsLine: boolean = true;
    declare graph: PaohRelaxedGraph;

    updateLayoutCb: Function
    selectionLabelMapper: LabelMapper;
    shownLabelNodes: PersonOccurrenceNode[] = [];
    private opacityScale: d3.ScaleLinear<any, any>;

    timeToPaths: Map<number, Array<any>>;
    pathToIntersect;

    constructor(svg, updateLayoutCb) {
        super(svg);
        this.updateLayoutCb = updateLayoutCb;
    }

    init(bipDynGraph, graph: PaohRelaxedGraph, ossatureGraph) {
        super.init();
        this.bipDynGraph = bipDynGraph;
        this.graph = graph;
        this.ossatureGraph = ossatureGraph;

        this.labelMapper = new LabelMapper(this.graph.getNodesByType(nodeTypes.PERSON_OCCURENCE), 11, this.geometriaEtichetta)
        // this.labelMapper = new LabelMapper(this.nodesToRenderLabel().map(nId => this.graph.getNode(nId)))
        this.labelMapper.run();

        let paths = this.graph.getPaths().map(path => path.toCatmullPath());
        this.pathSelectionner = new PathSelectionner(this.svg, paths, this.intersectedPathsCb, this.getTransform, this.getTimeOfX, this.startPathSelCb, this.endPathSelCb);

        this.calcolaSqualifiche();
        this.calcolaAutogol();
        this.aggiornaLayout();
        // appena disegnato la vista si adatta al contenuto
        requestAnimationFrame(() => this.adattaVista(false));
        this.initEventsPanel();
        this.initFiltriPanel();
        this.initMarcatori();
        this.registraGlobali();
    }

    // eventi di partita: il campo kind dice il tipo (goal, substitution, card, injury)

    // categorie del pannello, in ordine
    EVENT_KINDS = [
        {kind: "goal",         etichetta: "Azioni gol",   colore: "#777777"},
        {kind: "substitution", etichetta: "Sostituzioni", colore: "#2F855A"},
        {kind: "card_yellow",  etichetta: "Cartellini gialli", colore: "#F2C200"},
        {kind: "card_red",     etichetta: "Cartellini rossi",  colore: "#D02020"},
        {kind: "injury",       etichetta: "Infortuni",    colore: "#7048E8"},
    ];

    // cresce a ogni modifica di kindsNascosti, serve a invalidare la cache dei percorsi
    filtroVersione: number = 0;

    kindsNascosti: any = {
        substitution: true,
        card_yellow: true,
        card_red: true,
        injury: true,
    };
    conteggioKind: any = {};
    eventsToggle: any = null;
    eventsPanel: any = null;
    eventDetail: any = null;

    // categoria di un iperarco per il pannello (i cartellini si dividono in gialli e rossi)
    kindOf(d): string {
        if ((d as any).__paohKind !== undefined) return (d as any).__paohKind;
        let risultato = "goal";
        try {
            let doc = this.bipDynGraph.idToNode[d.id];
            if (doc && typeof doc.get === "function") {
                let k = doc.get("kind") || "goal";
                risultato = (k === "card") ? (doc.get("card") === "red" ? "card_red" : "card_yellow") : k;
            }
        } catch (e) {
        }
        (d as any).__paohKind = risultato;
        return risultato;
    }

    // categoria dell'iperarco di un'occorrenza, salvata sul dato perche' non cambia
    kindOfOccurrence(d): string {
        if ((d as any).__paohKind !== undefined) return (d as any).__paohKind;
        let risultato = "goal";
        try {
            let doc = this.bipDynGraph.idToNode[d.get("document")];
            if (doc && typeof doc.get === "function") {
                let k = doc.get("kind") || "goal";
                risultato = (k === "card") ? (doc.get("card") === "red" ? "card_red" : "card_yellow") : k;
            }
        } catch (e) {
        }
        (d as any).__paohKind = risultato;
        return risultato;
    }

    isKindVisible(kind): boolean {
        return !this.kindsNascosti[kind];
    }

    // si disegnano solo gli iperarchi delle categorie visibili (i percorsi restano)
    nodesToRender() {
        let tutti = super.nodesToRender();
        if (!this.filtriAttivi()) return tutti;

        return tutti.filter(n => {
            if (n.type == nodeTypes.HYPEREDGE) return this.docVisibile(n.id, this.kindOf(n));
            if (n.type == nodeTypes.PERSON_OCCURENCE) return this.occorrenzaVisibile(n);
            return true;
        });
    }

    initEventsPanel() {
        if (!this.bipDynGraph) return;

        // il pannello ha senso solo se il dataset contiene eventi
        let presenti = {};
        try {
            Object.keys(this.bipDynGraph.idToNode).forEach(id => {
                let n = this.bipDynGraph.idToNode[id];
                if (n && typeof n.get === "function" && n.get("kind")) {
                    let k = n.get("kind");
                    if (k === "card") k = n.get("card") === "red" ? "card_red" : "card_yellow";
                    presenti[k] = (presenti[k] || 0) + 1;
                }
            });
        } catch (e) {
        }
        this.conteggioKind = presenti;

        // pannello del dataset caricato prima
        d3.selectAll("#paoh-events-panel, #paoh-events-toggle, #events-legend-panel").remove();

        let categorie = this.EVENT_KINDS.filter(c => presenti[c.kind]);
        if (categorie.length < 2) return;   // nessun evento: niente pannello

        // il pulsante va nella barra in alto, dopo quello delle nazionali
        let contenitore = null;
        let teams = document.getElementById("team-legend-panel");
        if (teams && teams.parentNode) {
            let div = document.createElement("div");
            div.id = "events-legend-panel";
            div.className = "widget";
            teams.parentNode.insertBefore(div, teams.nextSibling);
            contenitore = d3.select(div);
        } else {
            contenitore = d3.select("body");
        }

        this.eventsToggle = contenitore
            .append("div")
            .attr("id", "paoh-events-toggle")
            .attr("title", "Isola una categoria di eventi")
            .style("cursor", "pointer")
            .style("user-select", "none")
            .style("white-space", "nowrap")
            .style("padding", "3px 8px")
            .style("border", "1px solid #888")
            .style("border-radius", "4px")
            .style("background", "white")
            .style("display", "inline-block")
            .style("font-size", "14px")
            .text("Events")
            .on("click", (e) => {
                e.stopPropagation();
                let aperto = this.eventsPanel.style("display") !== "none";
                if (aperto) {
                    this.eventsPanel.style("display", "none");
                    return;
                }
                // il pannello si apre sotto al pulsante, attaccato al body
                let n = this.eventsToggle.node();
                let r = n ? n.getBoundingClientRect() : {left: 20, bottom: 60};
                this.eventsPanel
                    .style("display", "block")
                    .style("left", Math.max(8, r.left) + "px")
                    .style("top", (r.bottom + 6) + "px");
            });

        this.eventsPanel = d3.select("body")
            .append("div")
            .attr("id", "paoh-events-panel")
            .style("position", "fixed")
            .style("display", "none")
            .style("z-index", 1500)
            .style("background", "white")
            .style("border", "1px solid #666")
            .style("border-radius", "6px")
            .style("box-shadow", "0 4px 14px rgba(0,0,0,0.3)")
            .style("padding", "10px 14px 12px 14px")
            .style("font-size", "13px")
            .on("click", (e) => e.stopPropagation());

        this.eventsPanel.append("div")
            .style("font-weight", "bold")
            .style("margin-bottom", "2px")
            .text("Events");

        this.eventsPanel.append("div")
            .style("color", "#666")
            .style("font-size", "12px")
            .style("margin-bottom", "8px")
            .text("Mostra soltanto le categorie selezionate.");

        let righe = this.eventsPanel.selectAll("div.event-row")
            .data(categorie)
            .join("div")
            .classed("event-row", true)
            .style("cursor", "pointer")
            .style("padding", "3px 4px")
            .style("border-radius", "3px")
            .style("white-space", "nowrap")
            .on("click", (e, c) => {
                if (this.kindsNascosti[c.kind]) {
                    delete this.kindsNascosti[c.kind];
                } else {
                    this.kindsNascosti[c.kind] = true;
                }
                this.soloSqualifiche = false;
                this.soloAutogol = false;
                this.disattivaMarcatori();
                // applicaFiltri ricalcola il layout compatto e anima il passaggio
                this.applicaFiltri();
            });

        righe.append("span")
            .classed("event-box", true)
            .style("display", "inline-block")
            .style("width", "13px")
            .style("height", "13px")
            .style("border", "1px solid #555")
            .style("border-radius", "2px")
            .style("margin-right", "8px")
            .style("vertical-align", "-2px")
            .style("background", c => c.colore);

        righe.append("span")
            .classed("event-label", true)
            .text(c => `${c.etichetta} (${presenti[c.kind]})`);

        let comandi = this.eventsPanel.append("div")
            .style("margin-top", "8px")
            .style("font-size", "12px");
        comandi.append("span")
            .style("cursor", "pointer")
            .style("color", "#0b7285")
            .style("text-decoration", "underline")
            .text("Mostra tutto")
            .on("click", () => {
                this.kindsNascosti = {};
                this.soloSqualifiche = false;
                this.soloAutogol = false;
                this.disattivaMarcatori();
                this.applicaFiltri();
            });
        comandi.append("span").text("   ");
        comandi.append("span")
            .style("cursor", "pointer")
            .style("color", "#0b7285")
            .style("text-decoration", "underline")
            .text("Solo eventi")
            .on("click", () => {
                this.kindsNascosti = {goal: true};
                this.soloSqualifiche = false;
                this.soloAutogol = false;
                this.disattivaMarcatori();
                this.applicaFiltri();
            });
        comandi.append("span").text("   ");
        comandi.append("span")
            .style("cursor", "pointer")
            .style("color", "#0b7285")
            .style("text-decoration", "underline")
            .text("Solo squalifiche")
            .on("click", () => {
                // restano visibili solo i cartellini che causano una squalifica
                this.kindsNascosti = {goal: true, substitution: true, injury: true};
                this.soloSqualifiche = true;
                this.soloAutogol = false;
                this.disattivaMarcatori();
                this.applicaFiltri();
            });

        if (this.autogolElenco.length) {
            comandi.append("span").text("   ");
            comandi.append("span")
                .style("cursor", "pointer")
                .style("color", "#0b7285")
                .style("text-decoration", "underline")
                .text("Solo autogol")
                .on("click", () => {
                    // restano visibili solo le azioni gol che terminano con un autogol
                    this.kindsNascosti = {substitution: true, card_yellow: true, card_red: true, injury: true};
                    this.soloSqualifiche = false;
                    this.soloAutogol = true;
                    this.disattivaMarcatori();
                    this.applicaFiltri();
                });
        }

        // elenco degli autogol: cliccando una riga si evidenzia chi l'ha commesso
        if (this.autogolElenco.length) {
            this.eventsPanel.append("div")
                .style("font-weight", "bold").style("margin", "10px 0 4px 0")
                .text(`Autogol (${this.autogolElenco.length})`);
            let elencoAg = this.eventsPanel.append("div")
                .style("max-height", "180px").style("overflow-y", "auto")
                .style("font-size", "12px").style("max-width", "400px");
            elencoAg.selectAll("div.autogol-row").data(this.autogolElenco).join("div")
                .classed("autogol-row", true)
                .style("cursor", "pointer").style("padding", "2px 4px").style("border-radius", "3px")
                .attr("title", (a: any) => `${a.fase}, ${a.partita}: autogol di ${a.nome} (${a.squadra}) al ${a.minuto}', gol assegnato a ${a.beneficiaria}`)
                .text((a: any) => `${a.minuto}' ${a.nome} (${a.squadra}) \u2192 gol ${a.beneficiaria} \u00b7 ${a.fase}`)
                .on("mouseover", function () { d3.select(this).style("background", "#e7f5ff"); })
                .on("mouseout", function () { d3.select(this).style("background", "transparent"); })
                .on("click", (e, a: any) => this.selezionaCalciatore(a.pid, a.docId));
        }

        // elenco delle squalifiche: cliccando una riga si evidenzia il calciatore
        if (this.squalificheElenco.length) {
            this.eventsPanel.append("div")
                .style("font-weight", "bold").style("margin", "10px 0 4px 0")
                .text(`Squalifiche (${this.squalificheElenco.length})`);
            let elenco = this.eventsPanel.append("div")
                .style("max-height", "180px").style("overflow-y", "auto")
                .style("font-size", "12px").style("max-width", "400px");
            elenco.selectAll("div.squalifica-row").data(this.squalificheElenco).join("div")
                .classed("squalifica-row", true)
                .style("cursor", "pointer").style("padding", "2px 4px").style("border-radius", "3px")
                .style("color", (q: any) => q.sospesa ? "#888" : "#222")
                .attr("title", (q: any) => this.testoSqualifica(q))
                .text((q: any) => `${q.nome} (${q.squadra}), ${q.causa} \u2192 ` +
                    (q.sospesa ? "squalifica sospesa" : (q.salta ? `salta ${q.salta}` : "nessuna partita successiva")))
                .on("mouseover", function () { d3.select(this).style("background", "#e7f5ff"); })
                .on("mouseout", function () { d3.select(this).style("background", "transparent"); })
                .on("click", (e, q: any) => this.selezionaCalciatore(q.pid));
        }

        this.renderEventsPanel();
        d3.select("body").on("click.paohEvents", () => {
            if (this.eventsPanel) this.eventsPanel.style("display", "none");
            this.hideEventDetail();
        });
    }

    renderEventsPanel() {
        if (!this.eventsPanel) return;
        this.eventsPanel.selectAll("div.event-row")
            .style("opacity", (c: any) => this.isKindVisible(c.kind) ? 1 : 0.4)
            .style("background", (c: any) => this.isKindVisible(c.kind) ? "#e7f5ff" : "transparent");
        this.eventsPanel.selectAll("span.event-label")
            .style("font-weight", (c: any) => this.isKindVisible(c.kind) ? "bold" : "normal")
            .style("text-decoration", (c: any) => this.isKindVisible(c.kind) ? "none" : "line-through");

        let nascosti = Object.keys(this.kindsNascosti).length;
        if (this.eventsToggle) {
            let visibili = this.EVENT_KINDS
                .filter(c => this.conteggioKind[c.kind] && this.isKindVisible(c.kind));
            if (this.soloAutogol) {
                this.eventsToggle.text("Events \u2013 Autogol");
            } else if (this.soloSqualifiche) {
                this.eventsToggle.text("Events \u2013 Squalifiche");
            } else if (!nascosti) {
                this.eventsToggle.text("Events");
            } else if (visibili.length === 1) {
                this.eventsToggle.text(`Events \u2013 ${visibili[0].etichetta}`);
            } else {
                this.eventsToggle.text(`Events \u2013 ${visibili.length} categorie`);
            }
        }
    }

    // squalifiche secondo il regolamento fifa (art. 10): un rosso o due gialli in partite diverse

    FASI = {1: "1ª giornata", 2: "2ª giornata", 3: "3ª giornata", 4: "Sedicesimi",
            5: "Ottavi", 6: "Quarti", 7: "Semifinali", 8: "Finale 3° posto", 9: "Finale"};

    squalifichePerDoc: Map<string, any> = new Map();
    squalificheElenco: any[] = [];

    // passo temporale di un documento, ricavato dall'identificativo (penultimo campo)
    tsDelDoc(docId): number {
        let parti = String(docId).split("_");
        return +parti[parti.length - 2];
    }

    nomeCalciatore(pid): string {
        let n: any = this.bipDynGraph.idToNode[pid];
        if (!n) return String(pid);
        return typeof n.label === "function" ? n.label() : (n.get ? n.get("name") : String(pid));
    }

    calcolaSqualifiche() {
        this.squalifichePerDoc = new Map();
        this.squalificheElenco = [];
        let g: any = this.bipDynGraph;
        let attr = (id, k) => { let n = g.idToNode[id]; return n && typeof n.get === "function" ? n.get(k) : undefined; };
        let partiteSquadra = {};    // squadra -> {ts: partita}
        let squadrePartita = {};    // partita -> Set(squadre)
        let cartellini = {};        // calciatore -> {squadra, perPartita: {partita: [doc]}}

        g.links.forEach(l => {
            let docId = l.getSourceId(), pid = l.getTargetId();
            let kind = attr(docId, "kind");
            if (!kind) return;
            let m = attr(docId, "match"), sq = l.get("team"), ts = this.tsDelDoc(docId);
            (partiteSquadra[sq] = partiteSquadra[sq] || {})[ts] = m;
            (squadrePartita[m] = squadrePartita[m] || new Set()).add(sq);
            if (kind === "card") {
                let c = (cartellini[pid] = cartellini[pid] || {squadra: sq, perPartita: {}});
                (c.perPartita[m] = c.perPartita[m] || []).push(docId);
            }
        });

        let periodo = ts => ts <= 3 ? 0 : (ts <= 6 ? 1 : 2);
        Object.keys(cartellini).forEach(pid => {
            let {squadra, perPartita} = cartellini[pid];
            let seq = Object.keys(partiteSquadra[squadra]).map(Number).sort((a, b) => a - b);
            let gialli = 0, per = -1;
            seq.forEach((ts, i) => {
                if (periodo(ts) !== per) { gialli = 0; per = periodo(ts); }
                let cs = perPartita[partiteSquadra[squadra][ts]] || [];
                let rossi = cs.filter(id => attr(id, "card") === "red");
                let gialliQui = cs.filter(id => attr(id, "card") === "yellow");
                let causa = null, docCausa = null;
                if (rossi.length) {
                    causa = gialliQui.length ? "doppia ammonizione" : "espulsione diretta";
                    docCausa = rossi[0];
                } else if (gialliQui.length) {
                    gialli++;
                    if (gialli === 2) { causa = "somma di ammonizioni"; docCausa = gialliQui[0]; gialli = 0; }
                }
                if (!causa) return;
                let salta = null;
                if (i + 1 < seq.length) {
                    let m2 = partiteSquadra[squadra][seq[i + 1]];
                    let avv = [...(squadrePartita[m2] || [])].filter(s => s !== squadra)[0] || "?";
                    salta = `${this.FASI[seq[i + 1]]} contro ${avv}`;
                }
                let voce = {pid, nome: this.nomeCalciatore(pid), squadra, causa, ts, salta, docId: docCausa,
                            sospesa: !!attr(docCausa, "squalifica_sospesa"), nota: attr(docCausa, "nota_squalifica")};
                this.squalifichePerDoc.set(docCausa, voce);
                this.squalificheElenco.push(voce);
            });
        });
        this.squalificheElenco.sort((a, b) => a.ts - b.ts || a.squadra.localeCompare(b.squadra));
    }

    // autogol: il marcatore e' chi ha deviato il pallone ed e' collegato alla sua nazionale (autogol_team)

    autogolElenco: any[] = [];
    autogolPerDoc: Map<string, any> = new Map();

    calcolaAutogol() {
        this.autogolElenco = [];
        this.autogolPerDoc = new Map();
        let g: any = this.bipDynGraph;
        let attr = (id, k) => { let n = g.idToNode[id]; return n && typeof n.get === "function" ? n.get(k) : undefined; };
        let squadrePartita = {};    // partita -> Set(squadre)
        let marcatore = {};         // documento -> link del marcatore
        g.links.forEach(l => {
            let docId = l.getSourceId();
            let m = attr(docId, "match");
            if (m !== undefined) (squadrePartita[m] = squadrePartita[m] || new Set()).add(l.get("team"));
            if (l.type === "scorer") marcatore[docId] = l;
        });
        let minutoNum = m => { let p = String(m || "").split("+"); return (+p[0] || 0) + (p[1] ? +p[1] / 100 : 0); };
        Object.keys(g.idToNode).forEach(docId => {
            if (!attr(docId, "autogol") || attr(docId, "kind") !== "goal") return;
            let l = marcatore[docId];
            if (!l) return;
            let m = attr(docId, "match"), sq = l.get("team"), ts = this.tsDelDoc(docId);
            let squadre = [...(squadrePartita[m] || [])];
            let beneficiaria = squadre.filter(s => s !== sq)[0] || "?";
            let voce = {docId, pid: l.getTargetId(), nome: this.nomeCalciatore(l.getTargetId()), squadra: sq,
                        beneficiaria, partita: `${beneficiaria} \u2013 ${sq}`, ts, fase: this.FASI[ts] || `slot ${ts}`,
                        minuto: attr(docId, "minute") || "?"};
            this.autogolPerDoc.set(docId, voce);
            this.autogolElenco.push(voce);
        });
        this.autogolElenco.sort((a, b) => a.ts - b.ts || minutoNum(a.minuto) - minutoNum(b.minuto));
    }


    // marcatori e assist: restano solo marcatore e assistman di ogni azione, con le classifiche a destra

    modalitaMarcatori = false;
    rigaClassifica: string = null;
    marcatoriBottone: any = null;
    classifica: any = null;
    schedaClassifica: "marcatori" | "assist" | "coppie" = "marcatori";
    datiClassifica: any = null;

    calcolaClassifiche() {
        let g: any = this.bipDynGraph;
        let attr = (id, k) => { let n = g.idToNode[id]; return n && typeof n.get === "function" ? n.get(k) : undefined; };
        let perDoc = new Map<string, any>();
        // minuto di ingresso dei subentrati, per contare gol e assist dalla panchina
        let minuto = (m) => { let [a, b] = String(m || "0").split("+"); return (+a || 0) + (+b || 0) / 100; };
        let entrata = new Map<string, number>();
        g.links.forEach(l => {
            let docId = l.getSourceId();
            if (attr(docId, "kind") === "substitution" && l.type === "in")
                entrata.set(attr(docId, "match") + "|" + l.getTargetId(), minuto(attr(docId, "minute")));
        });
        let daPanchina = (docId, pid) => {
            let e = entrata.get(attr(docId, "match") + "|" + pid);
            return e !== undefined && minuto(attr(docId, "minute")) >= e;
        };
        g.links.forEach(l => {
            let docId = l.getSourceId();
            if (attr(docId, "kind") !== "goal" || attr(docId, "autogol")) return;
            let v = perDoc.get(docId) || {};
            if (l.type === "scorer") v.scorer = {pid: l.getTargetId(), team: l.get("team")};
            if (l.type === "assist") v.assist = {pid: l.getTargetId(), team: l.get("team")};
            perDoc.set(docId, v);
        });
        let gol = new Map<string, any>(), assist = new Map<string, any>(), coppie = new Map<string, any>();
        let aggiungi = (m, chiave, base, docId, sub = false) => {
            let v = m.get(chiave) || Object.assign({n: 0, sub: 0, docs: []}, base);
            v.n++; if (sub) v.sub++; v.docs.push(docId); m.set(chiave, v);
        };
        perDoc.forEach((v, docId) => {
            if (v.scorer) aggiungi(gol, v.scorer.pid, {pid: v.scorer.pid, team: v.scorer.team}, docId, daPanchina(docId, v.scorer.pid));
            if (v.assist) aggiungi(assist, v.assist.pid, {pid: v.assist.pid, team: v.assist.team}, docId, daPanchina(docId, v.assist.pid));
            if (v.scorer && v.assist && v.scorer.pid !== v.assist.pid)
                aggiungi(coppie, v.assist.pid + ">" + v.scorer.pid, {a: v.assist.pid, s: v.scorer.pid, team: v.scorer.team}, docId);
        });
        let ordina = (m, nome) => [...m.values()]
            .sort((x, y) => y.n - x.n || nome(x).localeCompare(nome(y)))
            .map((v, i, arr) => Object.assign(v, {pos: i > 0 && arr[i - 1].n === v.n ? arr[i - 1].pos : i + 1}));
        this.datiClassifica = {
            marcatori: ordina(gol, v => this.nomeCalciatore(v.pid)),
            assist: ordina(assist, v => this.nomeCalciatore(v.pid)),
            coppie: ordina(coppie, v => this.nomeCalciatore(v.a) + this.nomeCalciatore(v.s)),
        };
    }

    initMarcatori() {
        d3.selectAll("#paoh-marcatori-contenitore, #paoh-classifica").remove();
        this.modalitaMarcatori = false;
        this.calcolaClassifiche();
        if (!this.datiClassifica.marcatori.length) return;   // dataset senza azioni gol
        let prima = document.getElementById("paoh-filtri-contenitore") || document.getElementById("events-legend-panel");
        if (!prima || !prima.parentNode) return;
        let div = document.createElement("div");
        div.id = "paoh-marcatori-contenitore";
        div.className = "widget";
        prima.parentNode.insertBefore(div, prima.nextSibling);
        this.marcatoriBottone = d3.select(div).append("div")
            .attr("title", "Mostra solo marcatori e assist, con le classifiche")
            .style("cursor", "pointer").style("user-select", "none").style("white-space", "nowrap")
            .style("padding", "3px 8px").style("border", "1px solid #888").style("border-radius", "4px")
            .style("background", "white").style("display", "inline-block").style("font-size", "14px")
            .text("Marcatori")
            .on("click", (e) => {
                e.stopPropagation();
                if (this.modalitaMarcatori) {
                    this.disattivaMarcatori();
                } else {
                    this.modalitaMarcatori = true;
                    this.kindsNascosti = {substitution: true, card_yellow: true, card_red: true, injury: true};
                    this.soloSqualifiche = false;
                    this.soloAutogol = false;
                    this.mostraClassifica();
                }
                this.aggiornaBottoneMarcatori();
                this.applicaFiltri();
            });

        d3.select(window).on("keydown.paohAzzera", (e: any) => {
            if (e.key === "Escape") this.azzeraSelezione();
        });

        this.classifica = d3.select("body").append("div")
            .attr("id", "paoh-classifica")
            .style("position", "fixed").style("right", "0").style("top", "0").style("bottom", "0")
            .style("width", "330px").style("z-index", 1450).style("background", "white")
            .style("border-left", "1px solid #888").style("box-shadow", "-4px 0 12px rgba(0,0,0,0.18)")
            .style("display", "none").style("flex-direction", "column").style("font-size", "13px")
            .on("click", (e) => e.stopPropagation())
            .on("wheel", (e) => e.stopPropagation());
    }

    aggiornaBottoneMarcatori() {
        if (!this.marcatoriBottone) return;
        this.marcatoriBottone
            .style("background", this.modalitaMarcatori ? "#e7f5ff" : "white")
            .style("font-weight", this.modalitaMarcatori ? "bold" : "normal")
            .style("border", this.modalitaMarcatori ? "2px solid #0b7285" : "1px solid #888");
    }

    // esce dalla modalita' marcatori senza ridisegnare (lo fa chi chiama)
    disattivaMarcatori() {
        this.modalitaMarcatori = false;
        if (this.classifica) this.classifica.style("display", "none");
        this.aggiornaBottoneMarcatori();
    }

    mostraClassifica() {
        if (!this.classifica) return;
        let C = this.classifica;
        // la tabella parte sotto la barra dei comandi, che resta utilizzabile
        let barra: any = document.getElementById("team-legend-panel");
        barra = barra && barra.parentElement;
        let alto = barra ? Math.max(0, barra.getBoundingClientRect().bottom) : 100;
        C.html("").style("display", "flex").style("top", alto + "px");
        let testa = C.append("div").style("padding", "10px 12px 6px 12px").style("border-bottom", "1px solid #ddd");
        let riga = testa.append("div").style("display", "flex").style("justify-content", "space-between").style("align-items", "center");
        riga.append("div").style("font-weight", "bold").style("font-size", "15px").text("Marcatori e assist");
        riga.append("div").style("cursor", "pointer").style("font-size", "18px").style("padding", "0 4px")
            .attr("title", "Chiudi e torna alla vista normale").text("✕")
            .on("click", () => { this.disattivaMarcatori(); this.applicaFiltri(); });
        testa.append("div").style("color", "#666").style("font-size", "12px").style("margin", "2px 0 4px 0")
            .text("Nel grafico: solo marcatori (stella) e assistman. Autogol esclusi dalle classifiche. " +
                  "Sono compresi i subentrati: \u2191 indica quanti gol/assist sono arrivati entrando dalla panchina.");
        let comandi = testa.append("div").style("font-size", "12px").style("margin", "0 0 8px 0");
        this.link(comandi, "Azzera selezione (Esc)", () => this.azzeraSelezione());
        this.link(comandi, "Vista d'insieme", () => this.adattaVista(true));
        let schede = testa.append("div").style("display", "flex").style("gap", "4px");
        let etichette = {marcatori: "Marcatori", assist: "Assist", coppie: "Coppie assist → gol"};
        Object.keys(etichette).forEach(k => {
            let attiva = this.schedaClassifica === k;
            schede.append("div").style("cursor", "pointer").style("padding", "3px 8px")
                .style("border", "1px solid #888").style("border-radius", "4px 4px 0 0")
                .style("background", attiva ? "#0b7285" : "white").style("color", attiva ? "white" : "#222")
                .style("font-size", "12px").text(etichette[k])
                .on("click", () => { this.schedaClassifica = k as any; this.mostraClassifica(); });
        });

        let corpo = C.append("div").style("overflow-y", "auto").style("flex", "1").style("padding", "4px 6px 10px 6px");
        let tab = corpo.append("table").style("width", "100%").style("border-collapse", "collapse");
        let coppie = this.schedaClassifica === "coppie";
        let intest = tab.append("tr").style("text-align", "left").style("color", "#555").style("font-size", "12px");
        ["#", coppie ? "Assist → Marcatore" : "Calciatore", coppie ? "Gol" : (this.schedaClassifica === "assist" ? "Assist" : "Gol")]
            .forEach((t, i) => intest.append("th").style("padding", "3px 4px").style("border-bottom", "1px solid #ccc")
                .style("text-align", i === 2 ? "right" : "left").text(t));
        let dati = this.datiClassifica[this.schedaClassifica];
        let pallino = (team) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid #555;margin-right:5px;vertical-align:-1px;background:${this.teamColorFor(team)}"></span>`;
        const vis = this;
        let chiave = (v: any) => coppie ? v.a + ">" + v.s : v.pid;
        let righe = tab.selectAll("tr.voce").data(dati).join("tr").classed("voce", true)
            .style("cursor", "pointer")
            .style("background", (v: any) => this.rigaClassifica === chiave(v) ? "#d0ebff" : "transparent")
            .on("mouseover", function () { d3.select(this).style("background", "#e7f5ff"); })
            .on("mouseout", function (e, v: any) { d3.select(this).style("background", vis.rigaClassifica === chiave(v) ? "#d0ebff" : "transparent"); })
            .on("click", (e, v: any) => {
                // secondo clic sulla stessa riga: si torna a vedere tutte le azioni
                if (this.rigaClassifica === chiave(v)) { this.azzeraSelezione(); return; }
                this.rigaClassifica = chiave(v);
                tab.selectAll("tr.voce").style("background", (w: any) => this.rigaClassifica === chiave(w) ? "#d0ebff" : "transparent");
                if (coppie) this.evidenziaCoppia(v); else this.evidenziaMarcatore(v);
            });
        righe.append("td").style("padding", "3px 4px").style("color", "#777").style("width", "26px").text((v: any) => v.pos);
        righe.append("td").style("padding", "3px 4px").html((v: any) => coppie
            ? `${pallino(v.team)}${this.nomeCalciatore(v.a)} → <b>${this.nomeCalciatore(v.s)}</b>`
            : `${pallino(v.team)}${this.nomeCalciatore(v.pid)} <span style="color:#888;font-size:11px">${v.team}</span>` +
              (v.sub ? ` <span title="${v.sub} ${this.schedaClassifica === "assist" ? "assist" : "gol"} da subentrato" style="font-size:10px;color:#0b7285;border:1px solid #0b7285;border-radius:3px;padding:0 3px;margin-left:3px">↑ ${v.sub} da subentrato</span>` : ""));
        righe.append("td").style("padding", "3px 4px").style("text-align", "right").style("font-weight", "bold").text((v: any) => v.n);
    }

    evidenziaMarcatore(v) {
        this.selezionaCalciatore(v.pid, v.docs[0]);
    }

    // evidenzia i due calciatori di una coppia e le azioni gol che hanno in comune
    evidenziaCoppia(v) {
        let ic: any = this.interactionController;
        ic.resetAllSelections(false);
        ic.addShownPerson([v.a, v.s]);
        ic.addShownDocuments(v.docs);
        ic.addHighlightedPersons([v.a, v.s]);
        ic.render();
        requestAnimationFrame(() => {
            let bersaglio = null;
            this.gNodes.selectAll(".nodeGroup").each(function (n: any) {
                if (!bersaglio && n.type == nodeTypes.PERSON_OCCURENCE && n.get("person") == v.s && n.get("document") == v.docs[0]) bersaglio = n;
            });
            if (bersaglio) this.centraSuNodo(bersaglio);
        });
    }

    // testo descrittivo di una squalifica, usato nel riquadro e nell'elenco
    testoSqualifica(sq): string {
        if (sq.sospesa) return `Squalifica per ${sq.causa} sospesa dalla FIFA. ${sq.nota || ""}`.trim();
        if (sq.salta) return `Squalificato per ${sq.causa}: salta ${sq.salta}.`;
        return `Squalificato per ${sq.causa}: nessuna partita successiva nel torneo.`;
    }

    // filtri: fase del torneo, solo squalifiche, ricerca di un calciatore

    fasiNascoste: any = {};
    soloSqualifiche = false;
    soloAutogol = false;

    // un documento e' visibile se passa tutti i filtri attivi
    docVisibile(docId, kind): boolean {
        if (!this.isKindVisible(kind)) return false;
        if (this.fasiNascoste[this.tsDelDoc(docId)]) return false;
        if (this.soloSqualifiche && !this.squalifichePerDoc.has(docId)) return false;
        if (this.soloAutogol && !this.autogolPerDoc.has(docId)) return false;
        return true;
    }

    // un'occorrenza e' visibile se lo e' il suo documento (con marcatori attivo solo marcatore e assist)
    occorrenzaVisibile(n): boolean {
        if (!this.docVisibile(n.get("document"), this.kindOfOccurrence(n))) return false;
        if (!this.modalitaMarcatori) return true;
        return this.getTouchRoles(n).some(r => r === "scorer" || r === "assist");
    }

    filtriAttivi(): boolean {
        return Object.keys(this.kindsNascosti).length > 0
            || Object.keys(this.fasiNascoste).length > 0
            || this.soloSqualifiche
            || this.soloAutogol
            || this.modalitaMarcatori;
    }

    // applica un cambio di filtro: invalida i percorsi e ridisegna
    applicaFiltri() {
        this.filtroVersione++;
        this.renderEventsPanel();
        this.renderFiltriPanel();
        this.transizioneLayout();
    }

    // layout compatto e transizione fra i filtri: uscita, movimento, entrata

    DURATA_USCITA = 220;
    DURATA_MOVIMENTO = 650;
    SOGLIA_ANIMAZIONE_LAYOUT = 9000;
    private timerLayout: any = null;

    // ricalcola il layout per i filtri attuali (senza disegnare)
    aggiornaLayout() {
        if (!this.graph || !(this.graph as any).applicaLayout) return;
        let filtro = this.filtriAttivi()
            ? (docId: string) => this.docVisibile(docId, this.kindOf({id: docId}))
            : null;
        (this.graph as any).applicaLayout(filtro, this.modalitaMarcatori ? (n: any) => this.occorrenzaVisibile(n) : null);
        // etichette calcolate solo sulle occorrenze che si vedono
        let occorrenze = this.graph.getNodesByType(nodeTypes.PERSON_OCCURENCE)
            .filter((n: any) => this.occorrenzaVisibile(n));
        this.labelMapper = new LabelMapper(occorrenze as any, 11, this.geometriaEtichetta);
        this.labelMapper.run();
        if (this.pathSelectionner) (this.pathSelectionner as any).paths = this.graph.getPaths().map(path => path.toCatmullPath());
        this.invalidatePathCache();
    }

    transizioneLayout() {
        const vis = this;
        const OCC = nodeTypes.PERSON_OCCURENCE, HE = nodeTypes.HYPEREDGE;
        if (this.timerLayout) { clearTimeout(this.timerLayout); this.timerLayout = null; }
        this.gNodes.selectAll(".nodeGroup").interrupt().attr("opacity", null).attr("transform", null);
        this.gNodes.selectAll(`.${HE}`).interrupt();
        this.gLinks.interrupt().attr("opacity", null);

        // posizioni prima del cambio
        let vecchie = new Map<string, number[]>();
        this.gNodes.selectAll(".nodeGroup").each((d: any) => {
            if (d.type == OCC) vecchie.set(d.id, [this.personOccurrenceXCenter(d), this.personOccurrenceYCenter(d)]);
            else if (d.type == HE) vecchie.set(d.id, [this.documentXCenter(d), d.bounds[0], d.bounds[1]]);
        });
        let restano = new Set(this.nodesToRender().map((n: any) => n.id));
        let riduciMovimento = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (riduciMovimento || vecchie.size + restano.size > this.SOGLIA_ANIMAZIONE_LAYOUT) {
            this.aggiornaLayout();
            this.render();
            this.adattaVista(false);
            return;
        }

        // 1. uscita
        this.gNodes.selectAll(".nodeGroup").filter((d: any) => !restano.has(d.id))
            .transition().duration(this.DURATA_USCITA).attr("opacity", 0);
        this.gLinks.transition().duration(this.DURATA_USCITA).attr("opacity", 0);

        this.timerLayout = setTimeout(() => {
            this.timerLayout = null;
            this.aggiornaLayout();
            this.render();
            let easing = d3.easeCubicInOut, durata = this.DURATA_MOVIMENTO;

            // 2. movimento dei nodi che restano, 3. comparsa dei nuovi
            this.gNodes.selectAll(".nodeGroup").each(function (d: any) {
                let g = d3.select(this);
                let v = vecchie.get(d.id);
                if (!v) {
                    g.attr("opacity", 0).transition().delay(durata * 0.55).duration(durata * 0.6).attr("opacity", 1);
                    return;
                }
                if (d.type == OCC) {
                    let dx = v[0] - vis.personOccurrenceXCenter(d), dy = v[1] - vis.personOccurrenceYCenter(d);
                    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                        g.attr("transform", `translate(${dx},${dy})`)
                            .transition().duration(durata).ease(easing).attr("transform", "translate(0,0)");
                    }
                } else if (d.type == HE && vis.documentAsLine) {
                    let x = vis.documentXCenter(d);
                    g.selectAll("line")
                        .attr("x1", v[0]).attr("x2", v[0]).attr("y1", v[1]).attr("y2", v[2])
                        .transition().duration(durata).ease(easing)
                        .attr("x1", x).attr("x2", x).attr("y1", d.bounds[0]).attr("y2", d.bounds[1]);
                }
            });
            this.gLinks.attr("opacity", 0).transition().delay(durata * 0.7).duration(durata * 0.6).attr("opacity", 1);
            this.adattaVista(true);
        }, this.DURATA_USCITA + 10);
    }

    // adatta la vista al contenuto visibile (tutta la larghezza, partendo dall'alto)
    adattaVista(animata: boolean, stratificata: boolean = false) {
        stratificata = stratificata || this.modalitaStratificata();
        let el: any = this.svg.node();
        if (!el || !this.zoom) return;
        let xs = [], ys = [];
        this.nodesToRender().forEach((n: any) => {
            if (n.type == nodeTypes.PERSON_OCCURENCE) { xs.push(this.personOccurrenceXCenter(n)); ys.push(this.personOccurrenceYCenter(n)); }
        });
        if (!xs.length) return;
        let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        let r = el.getBoundingClientRect();
        let vx0 = Math.max(r.left, 0), vx1 = Math.min(r.right, window.innerWidth);
        if (this.modalitaMarcatori && this.classifica) vx1 = Math.min(vx1, window.innerWidth - 340);
        let largh = vx1 - vx0;
        if (largh <= 0) return;
        // la fascia con i numeri delle giornate copre la parte alta: il contenuto parte sotto
        let fascia: any = document.getElementById("aggregate-svg");
        let sotto = fascia ? fascia.getBoundingClientRect().bottom : r.top;
        let alto = Math.max(sotto, 0) - r.top + 30;
        // vista d'insieme: tutta la categoria entra nello schermo, ai lati resta spazio per i nomi
        let sinistra = 170, destra = 170;
        let altezzaUtile = Math.max(window.innerHeight - Math.max(sotto, 0) - 40, 100);
        let k = Math.min(1.2,
            (largh - sinistra - destra) / Math.max(x1 - x0, 1),
            altezzaUtile / Math.max(y1 - y0, 1));
        k = Math.max(k, 0.01);
        let tx = (vx0 - r.left) + sinistra + Math.max(0, (largh - sinistra - destra - (x1 - x0) * k) / 2) - x0 * k;
        let ty = alto - y0 * k;
        let t = d3.zoomIdentity.translate(tx, ty).scale(k);
        if (animata) this.svg.transition().duration(this.DURATA_MOVIMENTO).ease(d3.easeCubicInOut).call(this.zoom.transform, t);
        else this.svg.call(this.zoom.transform, t);
    }

    // la tabella dei calciatori si aggiorna solo quando e' visibile
    setInteractionController(controller) {
        super.setInteractionController(controller);
        // una selezione fatta dai pannelli non va annullata all'uscita del mouse
        if (controller && !controller.__paohReset) {
            controller.__paohReset = true;
            let reset = controller.resetAllSelections.bind(controller);
            controller.resetAllSelections = (...a) => { this.statoPrimaHover = null; return reset(...a); };
        }
        let tab: any = controller && controller.personTable;
        if (!tab || tab.__paohRinvio) return;
        tab.__paohRinvio = true;
        let aggiorna = tab.update.bind(tab), mostra = tab.show.bind(tab), ridisegna = tab.render.bind(tab);
        let nascosta = () => tab.container && typeof tab.container.style === "function" && tab.container.style("display") === "none";
        tab.update = () => {
            if (nascosta()) { tab.__daAggiornare = true; return; }
            aggiorna();
        };
        // anche il ridisegno completo si rimanda finche' la tabella e' nascosta
        tab.render = (...args) => {
            if (nascosta() && args.length === 0) { tab.__daRidisegnare = true; return; }
            return ridisegna(...args);
        };
        tab.show = () => {
            mostra();
            if (tab.__daRidisegnare) { tab.__daRidisegnare = false; ridisegna(); }
            if (tab.__daAggiornare) { tab.__daAggiornare = false; aggiorna(); }
        };
    }

    // toglie ogni selezione ed evidenziazione (come un clic sullo sfondo)
    azzeraSelezione() {
        let ic: any = this.interactionController;
        if (!ic) return;
        try { ic.personTable.addPathToPersons(new Map(), new Map()); } catch (e) {}
        ic.pathSelectionMode = false;
        if (this.pathSelectionner) this.pathSelectionner.removePaths();
        this.rigaClassifica = null;
        if (this.classifica) this.classifica.selectAll("tr.voce").style("font-weight", null).style("background", "transparent");
        ic.resetAllSelections(true);
    }

    // evidenzia un calciatore e lo porta al centro della vista
    selezionaCalciatore(pid, docDaCentrare = null) {
        let ic: any = this.interactionController;
        let docIds = [];
        this.bipDynGraph.links.forEach(l => {
            if (l.getTargetId() == pid) docIds.push(l.getSourceId());
        });
        ic.resetAllSelections(false);
        ic.addShownPerson([pid]);
        ic.addShownDocuments(docIds);
        ic.addHighlightedPersons([pid]);
        ic.render();
        requestAnimationFrame(() => {
            let bersaglio = null;
            this.gNodes.selectAll(".nodeGroup").each(function (n: any) {
                if (!bersaglio && n.type == nodeTypes.PERSON_OCCURENCE && n.get("person") == pid
                    && (docDaCentrare === null || n.get("document") == docDaCentrare)) bersaglio = n;
            });
            if (bersaglio) this.centraSuNodo(bersaglio);
        });
    }

    // porta un'occorrenza al centro della vista, con lo zoom di d3
    centraSuNodo(n) {
        let el: any = this.svg.node();
        if (!el || !this.zoom) return;
        let r = el.getBoundingClientRect();
        let x0 = Math.max(r.left, 0), x1 = Math.min(r.right, window.innerWidth);
        let y0 = Math.max(r.top, 0), y1 = Math.min(r.bottom, window.innerHeight);
        let cx = (x0 + x1) / 2 - r.left, cy = (y0 + y1) / 2 - r.top;
        let k = Math.max(this.transform ? this.transform.k : 1, 0.8);
        let x = this.personOccurrenceXCenter(n), y = this.personOccurrenceYCenter(n);
        let t = d3.zoomIdentity.translate(cx - x * k, cy - y * k).scale(k);
        this.svg.transition().duration(700).call(this.zoom.transform, t);
    }

    // crea un pulsante nella barra in alto, dopo l'elemento "dopoId", e il pannello che apre
    creaPulsanteConPannello(idBase, testo, titolo, dopoId) {
        d3.selectAll(`#${idBase}-contenitore, #${idBase}-pannello`).remove();
        let contenitore = d3.select("body");
        let prima = document.getElementById(dopoId);
        if (prima && prima.parentNode) {
            let div = document.createElement("div");
            div.id = idBase + "-contenitore";
            div.className = "widget";
            prima.parentNode.insertBefore(div, prima.nextSibling);
            contenitore = d3.select(div);
        }
        let pannello = d3.select("body").append("div")
            .attr("id", idBase + "-pannello")
            .style("position", "fixed").style("display", "none").style("z-index", 1500)
            .style("background", "white").style("border", "1px solid #666").style("border-radius", "6px")
            .style("box-shadow", "0 4px 14px rgba(0,0,0,0.3)").style("padding", "10px 14px 12px 14px")
            .style("font-size", "13px").style("max-width", "440px")
            .on("click", (e) => e.stopPropagation());
        let bottone = contenitore.append("div")
            .attr("title", titolo)
            .style("cursor", "pointer").style("user-select", "none").style("white-space", "nowrap")
            .style("padding", "3px 8px").style("border", "1px solid #888").style("border-radius", "4px")
            .style("background", "white").style("display", "inline-block").style("font-size", "14px")
            .text(testo)
            .on("click", (e) => {
                e.stopPropagation();
                if (pannello.style("display") !== "none") { pannello.style("display", "none"); return; }
                let r = (bottone.node() as any).getBoundingClientRect();
                pannello.style("display", "block")
                    .style("left", Math.max(8, Math.min(r.left, window.innerWidth - 460)) + "px")
                    .style("top", (r.bottom + 6) + "px");
            });
        d3.select("body").on(`click.${idBase}`, () => pannello.style("display", "none"));
        return {bottone, pannello, idContenitore: idBase + "-contenitore"};
    }

    link(sel, testo, azione) {
        return sel.append("span").style("cursor", "pointer").style("color", "#0b7285")
            .style("text-decoration", "underline").style("margin-right", "10px").text(testo)
            .on("click", azione);
    }

    filtriBottone: any = null;
    filtriPannello: any = null;

    initFiltriPanel() {
        let {bottone, pannello} = this.creaPulsanteConPannello(
            "paoh-filtri", "Filtri", "Filtra per fase del torneo o cerca un calciatore", "events-legend-panel");
        this.filtriBottone = bottone;
        this.filtriPannello = pannello;

        pannello.append("div").style("font-weight", "bold").style("margin-bottom", "6px").text("Fasi del torneo");
        let fasi = Object.keys(this.FASI).map(Number);
        pannello.selectAll("div.fase-row").data(fasi).join("div")
            .classed("fase-row", true)
            .style("cursor", "pointer").style("padding", "2px 4px").style("border-radius", "3px")
            .text(ts => this.FASI[ts])
            .on("click", (e, ts) => {
                if (this.fasiNascoste[ts]) delete this.fasiNascoste[ts]; else this.fasiNascoste[ts] = true;
                this.applicaFiltri();
            });
        let comandi = pannello.append("div").style("margin", "6px 0 10px 0").style("font-size", "12px");
        this.link(comandi, "Tutte", () => { this.fasiNascoste = {}; this.applicaFiltri(); });
        this.link(comandi, "Solo gironi", () => { this.fasiNascoste = {4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1}; this.applicaFiltri(); });
        this.link(comandi, "Solo eliminazione diretta", () => { this.fasiNascoste = {1: 1, 2: 1, 3: 1}; this.applicaFiltri(); });

        // ricerca di un calciatore
        pannello.append("div").style("font-weight", "bold").style("margin-bottom", "6px").text("Cerca un calciatore");
        let calciatori = new Map();
        this.bipDynGraph.links.forEach(l => {
            let pid = l.getTargetId();
            if (!calciatori.has(pid)) calciatori.set(pid, `${this.nomeCalciatore(pid)} (${l.get("team")})`);
        });
        let perEtichetta = new Map();
        calciatori.forEach((etichetta, pid) => perEtichetta.set(etichetta, pid));
        let listaId = "paoh-elenco-calciatori";
        let lista = pannello.append("datalist").attr("id", listaId);
        lista.selectAll("option").data([...perEtichetta.keys()].sort()).join("option").attr("value", d => d);
        let campo = pannello.append("input")
            .attr("list", listaId).attr("placeholder", "Scrivi un nome...")
            .style("width", "100%").style("box-sizing", "border-box").style("padding", "4px 6px")
            .style("font-size", "13px");
        campo.on("change", () => {
            let pid = perEtichetta.get((campo.node() as any).value);
            if (pid !== undefined) this.selezionaCalciatore(pid);
        });
        let fondo = pannello.append("div").style("margin-top", "6px").style("font-size", "12px");
        this.link(fondo, "Azzera selezione", () => {
            (campo.node() as any).value = "";
            (this.interactionController as any).resetAllSelections(true);
        });
        this.renderFiltriPanel();
    }

    renderFiltriPanel() {
        if (!this.filtriPannello) return;
        this.filtriPannello.selectAll("div.fase-row")
            .style("opacity", (ts: any) => this.fasiNascoste[ts] ? 0.4 : 1)
            .style("text-decoration", (ts: any) => this.fasiNascoste[ts] ? "line-through" : "none")
            .style("background", (ts: any) => this.fasiNascoste[ts] ? "transparent" : "#e7f5ff");
        let n = Object.keys(this.fasiNascoste).length;
        this.filtriBottone.text(n ? `Filtri \u2013 ${9 - n} fasi` : "Filtri");
    }

    // riquadro con il dettaglio dell'evento

    hideEventDetail() {
        if (this.eventDetail) this.eventDetail.style("display", "none");
    }

    showEventDetail(evento, d) {
        let doc = this.bipDynGraph.idToNode[d.id];
        if (!doc || typeof doc.get !== "function") return;

        let kind = this.kindOf(d);
        if (kind === "goal") return;   // per le azioni resta il pannello esistente

        if (!this.eventDetail) {
            this.eventDetail = d3.select("body")
                .append("div")
                .attr("id", "paoh-event-detail")
                .style("position", "fixed")
                .style("display", "none")
                .style("z-index", 2000)
                .style("max-width", "300px")
                .style("background", "white")
                .style("border", "1px solid #555")
                .style("border-radius", "6px")
                .style("box-shadow", "0 4px 14px rgba(0,0,0,0.3)")
                .style("padding", "9px 12px")
                .style("font-size", "13px")
                .on("click", (e) => e.stopPropagation());
        }

        let titolo = {
            substitution: "Sostituzione",
            card_yellow: "Cartellino giallo",
            card_red: "Cartellino rosso",
            injury: "Infortunio",
        }[kind] || "Evento";

        // calciatori coinvolti, con il rispettivo ruolo
        let righe = [];
        try {
            this.bipDynGraph.getNeighbors(d.id).forEach((nodo, link) => {
                let etichetta = {out: "esce", in: "entra", yellow: "ammonito",
                                 red: "espulso", injury: "infortunato"}[link.type] || link.type;
                righe.push(`${etichetta}: ${nodo.label ? nodo.label() : nodo.id}`);
            });
        } catch (e) {
        }

        let minuto = doc.get("minute");
        let motivo = doc.get("motivo");

        this.eventDetail.html("");
        this.eventDetail.append("div")
            .style("font-weight", "bold")
            .style("margin-bottom", "4px")
            .text(minuto ? `${titolo} — ${minuto}'` : titolo);
        righe.forEach(r => this.eventDetail.append("div").text(r));
        if (motivo) {
            this.eventDetail.append("div")
                .style("margin-top", "5px")
                .style("color", "#444")
                .style("font-style", "italic")
                .text(motivo);
        } else if (kind !== "substitution") {
            this.eventDetail.append("div")
                .style("margin-top", "5px")
                .style("color", "#999")
                .style("font-size", "12px")
                .text("motivo non disponibile");
        }
        let sq = this.squalifichePerDoc.get(d.id);
        if (sq) {
            this.eventDetail.append("div")
                .style("margin-top", "6px")
                .style("font-weight", "bold")
                .style("color", sq.sospesa ? "#888" : "#b02020")
                .text(this.testoSqualifica(sq));
        }

        this.eventDetail
            .style("display", "block")
            .style("left", Math.min(evento.clientX + 12, window.innerWidth - 320) + "px")
            .style("top", Math.min(evento.clientY + 12, window.innerHeight - 140) + "px");
    }

    // colori delle nazionali: colore della maglia (bandiera o seconda maglia per chi gioca in bianco)
    TEAM_COLORS = {
        "Algeria":         "#0A7D42",   // verde
        "Arabia Saudita":  "#0B6B3A",   // verde
        "Argentina":       "#75AADB",   // celeste
        "Australia":       "#FFCD00",   // oro
        "Austria":         "#ED2939",   // rosso
        "Belgio":          "#C8102E",   // rosso
        "Bosnia":          "#1D4F91",   // blu
        "Brasile":         "#F7D117",   // giallo
        "Canada":          "#D80621",   // rosso
        "Capo Verde":      "#003893",   // blu
        "Cechia":          "#D7141A",   // rosso
        "Colombia":        "#FCD116",   // giallo
        "Corea del Sud":   "#CD2E3A",   // rosso
        "Costa d'Avorio":  "#FF8200",   // arancione
        "Croazia":         "#E4181C",   // rosso a scacchi
        "Curacao":         "#002B7F",   // blu
        "DR Congo":        "#1E90FF",   // azzurro
        "Ecuador":         "#FFD100",   // giallo
        "Egitto":          "#CE1126",   // rosso
        "Francia":         "#002654",   // blu
        "Germania":        "#2B2B2B",   // bianconero: nero
        "Ghana":           "#006B3F",   // bianco: verde di bandiera
        "Giappone":        "#1B1464",   // blu notte
        "Giordania":       "#8B1A1A",   // bianco: rosso di bandiera
        "Haiti":           "#00209F",   // blu
        "Inghilterra":     "#CE1124",   // bianco: rosso di san giorgio
        "Iran":            "#239F40",   // verde
        "Iraq":            "#0B7D3E",   // verde
        "Marocco":         "#C1272D",   // rosso
        "Messico":         "#006847",   // verde
        "Norvegia":        "#BA0C2F",   // rosso
        "Nuova Zelanda":   "#4A4A4A",   // bianconero: grigio scuro
        "Olanda":          "#FF6600",   // arancione
        "Panama":          "#DA121A",   // rosso
        "Paraguay":        "#D52B1E",   // rosso
        "Portogallo":      "#7A1F2B",   // rosso scuro
        "Qatar":           "#8A1538",   // bordeaux
        "Scozia":          "#005EB8",   // blu
        "Senegal":         "#00853F",   // verde
        "Spagna":          "#C60B1E",   // rosso
        "Sud Africa":      "#007749",   // verde
        "Svezia":          "#FECC00",   // giallo
        "Svizzera":        "#DA291C",   // rosso
        "Tunisia":         "#E70013",   // rosso
        "Turchia":         "#E30A17",   // rosso
        "Uruguay":         "#4C9BD5",   // celeste
        "USA":             "#0A3161",   // blu
        "Uzbekistan":      "#1EB53A",   // verde
    };

    // sfalsamento fra le copie della pila dei tocchi, in unita' del grafo
    TOUCH_STACK_OFFSET = 1.5;

    // numero dei tocchi accanto alla pila: false = solo la pila, true = anche il numero
    MOSTRA_NUMERO_TOCCHI = false;

    // dimensione del numero rispetto al raggio del nodo
    TOUCH_LABEL_SCALE = 1.4;

    // nero sulle tinte chiare, bianco su quelle scure
    labelColorOn(tinta) {
        let c = d3.color(tinta);
        if (!c) return "#111111";
        let rgb = c.rgb();
        let luminanza = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
        return luminanza > 150 ? "#111111" : "#ffffff";
    }

    // colore di una nazionale (se manca si usa la scala di default)
    teamColorFor = (team) => {
        if (team && this.TEAM_COLORS[team]) {
            return this.TEAM_COLORS[team];
        }
        return this.teamColorScale(team);
    }

    // debug da console: __PAOH_VIS__.dumpTeamColors()
    dumpTeamColors() {
        let teams = this.teamColorScale.domain();

        let righe = teams.map(t => ({
            squadra: t,
            colore: this.teamColorFor(t),
            inTabella: !!this.TEAM_COLORS[t]
        }));
        console.table(righe);

        let mancanti = righe.filter(r => !r.inTabella).map(r => r.squadra);
        if (mancanti.length) {
            console.warn("[PAOH] nazionali senza colore in tabella:", mancanti);
        }

        let perColore = {};
        righe.forEach(r => {
            let k = r.colore.toUpperCase();
            if (!perColore[k]) perColore[k] = [];
            perColore[k].push(r.squadra);
        });
        let condivisi = Object.keys(perColore).filter(k => perColore[k].length > 1);
        if (condivisi.length) {
            console.log("[PAOH] colori condivisi da piu' nazionali:");
            console.table(condivisi.map(k => ({colore: k, squadre: perColore[k].join(", ")})));
        }
        return righe;
    }

    // riferimenti globali usati dalla legenda delle nazionali e per il debug da console
    registraGlobali() {
        (window as any).__PAOH_VIS__ = this;
        (window as any).__PAOH_TEAM_COLOR__ = this.teamColorFor;
    }

    runLabeller() {
        this.labelMapper.run();
    }

    zoomAction(e, d) {
        super.zoomAction(e, d);
        // i tracciati di selezione esistono solo durante una selezione a lazo
        let ps: any = this.pathSelectionner;
        if (ps && ps.allPaths && ps.allPaths.length) ps.renderPaths();


        // qui non si toccano i glifi: li scala gia' lo zoom del gruppo
    }

    // intersectedPathsCb = (personPaths: Array<Array<any>t>, documents) => {
    intersectedPathsCb = (pathToIntersect: any) => {
        this.pathToIntersect = pathToIntersect;

        function intersect(a, b) {
            // For only paths intersects
            // return a.filter(value => b.map(n => n[0]).includes(value[0]));

            // return a.filter(value => b.includes(value));
            return a.filter(value => b.map(n => n[0]).includes(value[0]));
        }

        this.interactionController.resetAllSelections(false);

        let timeToIntersections = {};
        this.timeToPaths = new Map();

        this.pathToIntersect.forEach((intersects, path) => {
            let time = path.getProperty(globals.TIME_KEY)

            if (timeToIntersections[time]) {
                timeToIntersections[time] = intersects.concat(timeToIntersections[time])
            } else {
                timeToIntersections[time] = intersects
            }

            if (this.timeToPaths.get(time)) {
                this.timeToPaths.get(time).push(path);
            } else {
                this.timeToPaths.set(time, [path])
            }
        })

        let allIntersects: Array<Array<any>> = Object.values(timeToIntersections);

        allIntersects = this.duplicateIntersections(allIntersects);

        let allPeopleIntersects = allIntersects.map(timeIntersects => {
            // return timeIntersects.map(int => getPeople(int)).reduce((a, b) => a.concat(b))
            return timeIntersects.map(int => int.getPeople().map(p => [p, int])).reduce((a, b) => a.concat(b))
        })

        if (allPeopleIntersects.length > 0) {
            allPeopleIntersects.reduce((a, b) => intersect(a, b)).forEach(person => {
                let [personId, intersection] = person
                this.interactionController.showOnePerson(personId, false)
                this.activeIntersections.push(intersection);
            })
        }

        this.interactionController.personTable.addPathToPersons(this.pathToIntersect, this.timeToPaths);
        // this.interactionController.render();

        let noDuplicates = []
        this.activeIntersections.forEach(int => {
            if (!noDuplicates.includes(int)) noDuplicates.push(int);
        })
        this.activeIntersections = noDuplicates;

        this.selectionLabelMapper = new LabelMapper(this.activeIntersections, 14);
        this.selectionLabelMapper.run(this.getIntersectionLabel, true);

        this.renderSelectionLabels();
    }

    duplicateIntersections(allIntersects) {
        allIntersects = allIntersects.map(intersections => {
            let [h, v] = splitIntersections(intersections)
            return [h, v]
        })
        allIntersects = allIntersects.flat().filter(d => d.length > 0);
        return allIntersects;
    }

    startPathSelCb = () => {
        this.interactionController.pathSelectionMode = true;
    }

    endPathSelCb = () => {
        this.occlusion.run(this.nodeLabelsSelection(), this.interactionController.isPersonHighlighted, null, this.getIntersectionLabel)
        
        this.interactionController.personTable.addPathToPersons(this.pathToIntersect, this.timeToPaths);

        // Set new columns
        this.interactionController.personTable.render();
        this.interactionController.render();
    }

    // intersectedPathsCb = (paths) => {
    //     this.interactionController.resetAllSelections(false)
    //     paths.forEach(path => {
    //         let personId = path[0];
    //         // this.interactionController.addShownPerson(personId)
    //         this.interactionController.showOnePerson(personId, false)
    //         // this.interactionController.selectOnePerson(personId)
    //     })
    //     this.interactionController.render();
    // }

    backgroundRender(): void {
        let yMax = Math.max(...this.graph.nodes.map(n => n.y).filter(y => y)) + renderingParameters.getPaohPersonOccurrenceWidth()
        this.gBackground
            .selectAll(".backgroundCol")
            .data(this.graph.ranks)
            .join("rect")
            .classed("backgroundCol", true)
            .attr("x", d => this.graph.rankToX(d))
            .attr("y", d => 0)
            .attr("width", d => (this.graph.rankToNColumns(d)) * renderingParameters.COLUMN_WIDTH)
            .attr("height", d => yMax)
            .attr("fill", "rgb(150,150,150,0.2)")
    }

    nodesRender() {
        this.impostaVariabiliZoom();
        // il layout puo' essere cambiato: le etichette vanno ricalcolate
        this.invalidateLabelCache();
        this.calcolaEtichetteSelezione();
        let daDisegnare = this.nodesToRender();
        // con troppi elementi l'evidenziazione e' immediata, senza dissolvenza
        this.animazioneSelezioneAttiva = daDisegnare.length <= this.SOGLIA_ANIMAZIONE;
        this.nodes = this.gNodes
            .selectAll(".nodeGroup")
            .data(daDisegnare, d => d.id)
            .join((enter) => {
                let g = enter.append('g')
                    .classed('nodeGroup', true)
                    .style("opacity", this.renderOssature ? 0.2 : 1)
                    // il listener si aggancia una volta sola, alla creazione
                    .on("mousedown", e => {
                        e.stopPropagation();
                    })

                this.renderPersonOccurence(g);
                this.renderDocuments(g);

                // RENDER LABELS
                this.renderNodeLabel(g.filter(d => d.type == nodeTypes.PERSON_OCCURENCE));

                return g
            }, (update) => {
                // glifi ridisegnati a ogni render con .join()
                this.drawOccurrenceGlyphs(update.filter(d => d.type == nodeTypes.PERSON_OCCURENCE));

                // posizioni scritte direttamente e solo se cambiano
                const vis = this;
                const seCambiato = PaohRelaxedVis.seCambiato;
                update.select(`.${nodeTypes.HYPEREDGE}`).each(function (d) {
                    let el: any = this;
                    if (vis.documentAsLine) {
                        let x = vis.documentXCenter(d);
                        seCambiato(el, "x1", x);
                        seCambiato(el, "x2", x);
                        seCambiato(el, "y1", d.bounds[0]);
                        seCambiato(el, "y2", d.bounds[1]);
                        let disp = vis.iperarcoVuoto(d) ? "none" : "";
                        if (el.style.display !== disp) el.style.display = disp;
                    } else {
                        seCambiato(el, "x", vis.documentX(d));
                        seCambiato(el, "y", vis.documentY(d));
                        seCambiato(el, "width", vis.documentWidth(d));
                        seCambiato(el, "height", vis.documentHeight(d));
                    }
                    let fill = renderingParameters.DOCUMENT_COLOR;
                    if (vis.documentPropertyToRender) {
                        let propertyValue = vis.bipDynGraph.idToNode[d.id].get(vis.documentPropertyToRender.name);
                        fill = vis.documentPropertyToRender.getColorScale()(propertyValue);
                    }
                    seCambiato(el, "fill", fill);
                });
                update.select(".substitution-line").each(function (d) {
                    let el: any = this;
                    let x = vis.documentXCenter(d);
                    seCambiato(el, "x1", x);
                    seCambiato(el, "x2", x);
                    seCambiato(el, "y1", d.bounds[0]);
                    seCambiato(el, "y2", d.bounds[1]);
                });

                // etichette: si scrivono solo i valori che cambiano
                let etichetteVisibili = this.nodesToRenderLabelSet();
                update.select(".person-label").each(function (d) {
                    let el: any = this;
                    seCambiato(el, "x", vis.nodeLabelX(d));
                    seCambiato(el, "y", vis.nodeLabelY(d));
                    let st = el.style;
                    let size = vis.dimensioneEtichetta(d);
                    if (st.fontSize !== size) st.fontSize = size;
                    let peso = vis.interactionController.isPersonHighlighted(d.get("person")) ? "bold" : "normal";
                    if (st.fontWeight !== peso) st.fontWeight = peso;
                    let disp = (vis.renderLabels && etichetteVisibili.has(d.id)) ? "" : "none";
                    if (st.display !== disp) st.display = disp;
                    // il lato (destra/sinistra) puo' cambiare quando cambia il layout
                    let anc = vis.ancoraEtichetta(d);
                    if (st.textAnchor !== anc) st.textAnchor = anc;
                    if (vis.selEtichette.has(d.id) && el.classList.contains("occluded")) el.classList.remove("occluded");
                });
                // .classed("occluded", d => {
                //     if (this.interactionController.isPersonLabelOccluded(d.get("person"))) {
                //         return
                //     }
                // })

                // .attr("font-size", d => this.nodeLabelSize(d))

                // update.selectAll(`.${globals.DOCUMENT}`)
                //     .attr("x", d => this.documentX(d))
                //     .attr("y", d => this.documentY(d))
                //
                // update.selectAll(`.cell`)
                //     .attr("x", d => this.matCellX(d))
                //     .attr("y", d => this.matCellY(d))

                return update;
            }, exit => exit.remove())
            .call(sel => this.animaOpacita(sel,
                d => this.interactionController.computeOpacity(d), "style"))

        if (this.renderOssature) {
            this.gNodes
                .selectAll(".nodeGroupOssature")
                .data(this.ossatureGraph.nodes, function (d) {
                    return d
                })
                .join((enter) => {
                    let g = enter.append('g')
                        .classed('nodeGroupOssature', true)

                    g
                        .filter(d => d.type == globals.PERSON_TIME)
                        .append("circle")
                        .attr("cx", d => d.get("x"))
                        .attr("cy", d => d.get("y"))
                        .attr("r", d => this.getPersonOccurenceWidth() / 4)
                        .attr("stroke", "black")
                        .attr("fill", "white")

                    g
                        .filter(d => d.type == globals.DOCUMENT)
                        .append("rect")
                        .attr("x", d => this.documentX(d))
                        .attr("y", d => this.documentY(d))
                        .attr("width", d => this.documentWidth(d))
                        .attr("height", d => this.documentHeight(d))
                        .attr("stroke", "black")
                        .attr("fill", "white")

                    return g
                })
        }
    }

    renderPersonOccurence(g) {
        let persons: d3.Selection<HTMLElement, PersonOccurrenceNode, any, any> = g.filter(d => d.type == nodeTypes.PERSON_OCCURENCE)

        if (this.personOccurrenceAsCircle) {
            this.drawOccurrenceGlyphs(persons);
        } else {
            persons
                .append("rect")
                .attr("x", d => this.personOccurrenceX(d))
                .attr("y", d => this.personOccurrenceY(d))
                .attr("width", d => this.getPersonOccurenceWidth())
                .attr("height", d => this.getPersonOccurenceHeight())
                .attr("fill", d => {
                    let link = getKeyByValueMap(this.bipDynGraph.getNeighbors(d.get("document")), d.get("person"), (a, b) => a == b.id)
                    let color = this.roleColorScale(link.type);
                    return color;
                })
                .attr("stroke", "black")
                .classed("nodeRect", true)
        }

        persons
            .attr("stroke-width", (d) => {
                return this.interactionController.isPersonHighlighted(d.id) ? 10 : 1
            })
            .classed(nodeTypes.PERSON_OCCURENCE, true)
            .on("mouseover", (e, d) => {
                // nome del calciatore subito accanto al nodo sotto il mouse
                this.mostraEtichettaHover(e, d);
                this.shownLabelNodes.push(d);
                this.invalidateLabelCache();
                // this.interactionController.render();
                // this.runOcclusion()

                if (!this.interactionController.pathSelectionMode) {
                    this.salvaStatoHover();
                    this.interactionController.showOnePerson(d.get("person"));
                }
            })
            .on("mouseout", (e, d) => {
                this.nascondiEtichettaHover();
                if (!this.interactionController.pathSelectionMode) this.ripristinaStatoHover();

                this.shownLabelNodes = this.shownLabelNodes.filter(n => n != d);
                this.invalidateLabelCache();
                // this.togglePersonSelection(d.get("person"));
                // this.resetHighlight();
            })
            .on("click", (e, d) => {
                // clic su un evento: dettaglio; clic su un'azione gol: selezione del calciatore
                if (this.kindOfOccurrence(d) !== "goal") {
                    e.stopPropagation();
                    let doc = this.graph.getNode(d.get("document"));
                    this.showEventDetail(e, doc ? doc : {id: d.get("document")});
                    return;
                }
                // il clic rende la selezione permanente
                this.statoPrimaHover = null;
                this.interactionController.selectOnePerson(d.get("person"));

                this.refresh();
                e.stopPropagation();
            })
            // .on("dblclick", (e, d) => { // TODO: finish
            //     this.interactionController.egoNetwork(d.get("person"));
            //     this.refresh();
            // })
            // FOR FLATTENING OPERATION
            .on("dblclick", (e, d) => {
                let personId = d.get("person")
                this.updateLayoutCb([personId])
            })
    }

    // dimensione dei glifi: il diametro non deve superare COLUMN_WIDTH (DOT_SCALE <= 1)
    DOT_SCALE = 1;

    // quanto la stella del marcatore sporge rispetto al raggio del pallino
    STAR_RADIUS_FACTOR = 1.2;

    // raggio del pallino come appare a schermo
    occurrenceRadius(): number {
        return (renderingParameters.getPaohPersonOccurrenceWidth() / 2) * this.DOT_SCALE;
    }

    // i glifi seguono la scala della vista, cosi' restano dentro la colonna a ogni zoom
    occurrenceTransform = (d) => {
        let x = this.personOccurrenceXCenter(d);
        let y = this.personOccurrenceYCenter(d);
        return `translate(${x}, ${y})`;
    }

    // raggio esterno effettivo del glifo: serve a posizionare l'etichetta
    occurrenceOuterRadius = (d) => {
        let r = this.occurrenceRadius();
        return this.isSpecialRole(d) ? r * this.STAR_RADIUS_FACTOR : r;
    }

    // simbolo di un evento: cartellino, triangolo della sostituzione o croce (null per le azioni gol)
    eventSymbolPath(d): string | null {
        let kind = this.kindOfOccurrence(d);
        let r = this.occurrenceRadius();

        // i simboli non devono superare la larghezza della colonna
        if (kind === "card_yellow" || kind === "card_red") {
            let w = r * 0.70, h = r * 1.05;
            return `M${-w},${-h} L${w},${-h} L${w},${h} L${-w},${h} Z`;
        }
        if (kind === "substitution") {
            let a = r * 0.90;
            // verso il basso chi esce, verso l'alto chi entra
            return this.versoSostituzione(d) === "giu"
                ? `M${-a},${-a * 0.8} L${a},${-a * 0.8} L0,${a} Z`
                : `M${-a},${a * 0.8} L${a},${a * 0.8} L0,${-a} Z`;
        }
        if (kind === "injury") {
            let b = r * 0.42, c = r * 1.15;
            return `M${-b},${-c} L${b},${-c} L${b},${-b} L${c},${-b} L${c},${b} ` +
                   `L${b},${b} L${b},${c} L${-b},${c} L${-b},${b} L${-c},${b} ` +
                   `L${-c},${-b} L${-b},${-b} Z`;
        }
        return null;
    }

    // verso del triangolo dato dal ruolo: giu' per chi esce, su per chi entra
    versoSostituzione(d): string {
        return this.roleOfOccurrence(d) === "out" ? "giu" : "su";
    }

    // ruolo di un'occorrenza nel suo iperarco (out, in, yellow, ...), salvato sul dato
    roleOfOccurrence(d): string {
        if ((d as any).__paohRole !== undefined) return (d as any).__paohRole;
        let risultato = "";
        try {
            let personId = d.get("person");
            let vicini = this.bipDynGraph.getNeighbors(d.get("document"));
            for (let [link, nodo] of vicini.entries()) {
                if (nodo.id == personId) { risultato = link.type; break; }
            }
        } catch (e) {
        }
        (d as any).__paohRole = risultato;
        return risultato;
    }

    // bordo del simbolo: sui cartellini e' il colore della nazionale
    eventStroke = (d) => {
        let kind = this.kindOfOccurrence(d);
        if (kind === "card_yellow" || kind === "card_red") {
            return this.fillPersonNode(d);
        }
        return "black";
    }

    eventStrokeWidth = (d) => {
        let kind = this.kindOfOccurrence(d);
        let base = this.glyphStrokeWidth(d);
        // il bordo colorato del cartellino deve essere ben visibile
        return (kind === "card_yellow" || kind === "card_red") ? base * 3.2 : base;
    }

    // colore di riempimento: i cartellini usano il colore del cartellino
    eventFill = (d) => {
        let kind = this.kindOfOccurrence(d);
        if (kind === "card_yellow") return "#F2C200";
        if (kind === "card_red") return "#D02020";
        return this.fillPersonNode(d);
    }

    // i tracciati delle forme si generano una volta sola e si riusano
    private tracciatiSimboli: Map<string, string> = new Map();

    occurrenceSymbolPath = (d) => {
        let kind = this.kindOfOccurrence(d);
        let r = this.occurrenceRadius();
        let variante = kind === "substitution" ? this.versoSostituzione(d)
            : (kind === "goal" ? (this.isSpecialRole(d) ? "star" : "circle") : "");
        let chiave = `${kind}|${variante}|${r}`;
        let t = this.tracciatiSimboli.get(chiave);
        if (t !== undefined) return t;

        let evento = this.eventSymbolPath(d);
        if (evento) {
            t = evento;
        } else if (variante === "star") {
            // per d3.symbolStar area = 1.1227 * R^2 (R = raggio esterno)
            let R = r * this.STAR_RADIUS_FACTOR;
            t = d3.symbol().type(d3.symbolStar).size(1.1227 * R * R)();
        } else {
            t = d3.symbol().type(d3.symbolCircle).size(Math.PI * r * r)();
        }
        this.tracciatiSimboli.set(chiave, t);
        return t;
    }

    glyphStrokeWidth = (d) => {
        let r = this.occurrenceRadius();
        return this.interactionController.isPersonHighlighted(d.get("person")) ? r * 0.25 : r * 0.1;
    }

    // scrive un attributo solo se il valore e' cambiato
    static seCambiato(el: any, nome: string, valore: any) {
        // si confronta col valore dell'elemento, non con una copia salvata
        let v = String(valore);
        if (el.getAttribute(nome) !== v) el.setAttribute(nome, v);
    }

    // true se l'occorrenza porta il pallino informativo (evento, non gol)
    serveInfo(d): boolean {
        let kind = this.kindOfOccurrence(d);
        if (kind === "goal") return false;
        if (kind === "substitution" && this.roleOfOccurrence(d) !== "out") return false;
        return true;
    }

    // disegna simbolo, pila dei tocchi, numero (se attivo) e pallino degli eventi
    drawOccurrenceGlyphs(persons) {
        const vis = this;
        const SVGNS = "http://www.w3.org/2000/svg";
        let rInfo = this.occurrenceRadius() * 0.45;

        persons.each(function (d) {
            const g: any = this;

            // pulizia dei vecchi elementi, una volta sola
            if (!g.__paohPulito) {
                g.querySelectorAll("circle, .multi-touch-dot").forEach(n => n.remove());
                g.__paohPulito = true;
            }

            // simbolo principale
            let glifo = g.__paohGlifo;
            if (!glifo || glifo.parentNode !== g) {
                glifo = g.querySelector("path.occ-glyph");
                if (!glifo) {
                    glifo = document.createElementNS(SVGNS, "path");
                    glifo.setAttribute("class", "occ-glyph " + nodeTypes.PERSON_OCCURENCE);
                    glifo.setAttribute("stroke-linejoin", "round");
                    g.appendChild(glifo);
                }
                g.__paohGlifo = glifo;
            }
            glifo.__data__ = d;
            PaohRelaxedVis.seCambiato(glifo, "d", vis.occurrenceSymbolPath(d));
            PaohRelaxedVis.seCambiato(glifo, "transform", vis.occurrenceTransform(d));
            PaohRelaxedVis.seCambiato(glifo, "fill", vis.eventFill(d));
            PaohRelaxedVis.seCambiato(glifo, "stroke", vis.eventStroke(d));
            PaohRelaxedVis.seCambiato(glifo, "stroke-width", vis.eventStrokeWidth(d));

            // pallino informativo (solo eventi): al centro per le sostituzioni, in alto a destra per gli altri
            if (vis.serveInfo(d)) {
                let info = g.__paohInfo;
                if (!info || info.parentNode !== g) {
                    info = document.createElementNS(SVGNS, "text");
                    info.setAttribute("class", "event-info");
                    info.setAttribute("text-anchor", "middle");
                    info.setAttribute("dy", "0.36em");
                    info.setAttribute("font-size", String(rInfo * 1.7));
                    info.setAttribute("font-weight", "bold");
                    info.setAttribute("font-family", "Georgia, serif");
                    info.setAttribute("fill", "#333333");
                    info.setAttribute("stroke", "#ffffff");
                    info.setAttribute("stroke-width", String(rInfo * 0.9));
                    info.setAttribute("paint-order", "stroke");
                    info.style.cursor = "pointer";
                    info.textContent = "i";
                    info.addEventListener("click", (e) => {
                        e.stopPropagation();
                        let dd = info.__data__;
                        let doc = vis.graph.getNode(dd.get("document"));
                        vis.showEventDetail(e, doc ? doc : {id: dd.get("document")});
                    });
                    g.appendChild(info);
                    g.__paohInfo = info;
                }
                info.__data__ = d;
                let r = vis.occurrenceRadius();
                let x = vis.personOccurrenceXCenter(d);
                let tr = `translate(${x + r * 0.50}, ${vis.personOccurrenceYCenter(d) - r * 1.15})`;
                if (vis.kindOfOccurrence(d) === "substitution") {
                    let doc: any = vis.graph.getNode(d.get("document"));
                    if (doc && doc.bounds && doc.bounds[1] > doc.bounds[0]) {
                        let meta = (doc.bounds[0] + doc.bounds[1]) / 2
                            + renderingParameters.getPaohPersonOccurrenceWidth() / 2;
                        tr = `translate(${x}, ${meta})`;
                    }
                }
                PaohRelaxedVis.seCambiato(info, "transform", tr);
            }

            // S sui cartellini che causano una squalifica (grigia se sospesa)
            let sq = vis.kindOfOccurrence(d).startsWith("card")
                ? vis.squalifichePerDoc.get(d.get("document")) : null;
            if (sq) {
                let badge = g.__paohSq;
                if (!badge || badge.parentNode !== g) {
                    badge = document.createElementNS(SVGNS, "text");
                    badge.setAttribute("class", "squalifica-badge");
                    badge.setAttribute("text-anchor", "middle");
                    badge.setAttribute("dy", "0.36em");
                    badge.setAttribute("font-size", String(rInfo * 1.7));
                    badge.setAttribute("font-weight", "bold");
                    badge.setAttribute("font-family", "Arial, Helvetica, sans-serif");
                    badge.setAttribute("stroke", "#ffffff");
                    badge.setAttribute("stroke-width", String(rInfo * 0.9));
                    badge.setAttribute("paint-order", "stroke");
                    badge.setAttribute("pointer-events", "none");
                    badge.textContent = "S";
                    let titolo = document.createElementNS(SVGNS, "title");
                    titolo.textContent = vis.testoSqualifica(sq);
                    badge.appendChild(titolo);
                    g.appendChild(badge);
                    g.__paohSq = badge;
                }
                let r = vis.occurrenceRadius();
                PaohRelaxedVis.seCambiato(badge, "fill", sq.sospesa ? "#999999" : "#111111");
                PaohRelaxedVis.seCambiato(badge, "transform",
                    `translate(${vis.personOccurrenceXCenter(d) + r * 0.5}, ${vis.personOccurrenceYCenter(d) + r * 1.25})`);
            }
        });

        // tocchi multipli: pila di simboli sfalsati, uno per tocco
        let off = this.TOUCH_STACK_OFFSET;
        persons.filter(d => this.kindOfOccurrence(d) === "goal" && this.getTouchCount(d) > 1)
            .selectAll("path.touch-stack")
            .data(d => {
                let ruoli = this.getTouchRoles(d);
                let copie = [];
                for (let i = 0; i < ruoli.length - 1; i++) {
                    copie.push({node: d, ruolo: ruoli[i], livello: ruoli.length - 1 - i});
                }
                return copie;
            })
            .join(
                enter => enter.insert("path", ":first-child"),
                update => update,
                exit => exit.remove()
            )
            .classed("touch-stack", true)
            .attr("d", c => this.symbolPathForRole(c.ruolo))
            .attr("transform", c =>
                `translate(${this.personOccurrenceXCenter(c.node) + c.livello * off}, ` +
                `${this.personOccurrenceYCenter(c.node) + c.livello * off})`)
            .attr("fill", c => this.fillPersonNode(c.node))
            .attr("stroke", "black")
            .attr("stroke-linejoin", "round")
            .attr("stroke-width", c => this.glyphStrokeWidth(c.node))
            .attr("pointer-events", "none");

        // numero dei tocchi (opzionale, vedi MOSTRA_NUMERO_TOCCHI)
        if (this.MOSTRA_NUMERO_TOCCHI) {
            this.etichetteTocchiCreate = true;
            let fontSize = this.occurrenceRadius() * this.TOUCH_LABEL_SCALE;
            persons.filter(d => this.isMultiTouch(d))
                .selectAll("text.multi-touch-label")
                .data(d => [d])
                .join("text")
                .classed("multi-touch-label", true)
                .text(d => this.getTouchCount(d))
                .attr("x", d => this.personOccurrenceXCenter(d)
                    + (this.getTouchCount(d) - 1) * this.TOUCH_STACK_OFFSET
                    + this.occurrenceRadius() * 0.9)
                .attr("y", d => this.personOccurrenceYCenter(d)
                    + (this.getTouchCount(d) - 1) * this.TOUCH_STACK_OFFSET
                    + this.occurrenceRadius() * 0.9)
                .attr("dy", "0.36em")
                .attr("text-anchor", "middle")
                .attr("font-size", fontSize)
                .attr("font-weight", "bold")
                .attr("font-family", "Arial, Helvetica, sans-serif")
                .attr("fill", "#111111")
                .attr("stroke", "#ffffff")
                .attr("stroke-width", fontSize * 0.3)
                .attr("paint-order", "stroke")
                .attr("pointer-events", "none");
        } else if (this.etichetteTocchiCreate) {
            // interruttore appena spento: i numeri spariscono
            this.gNodes.selectAll("text.multi-touch-label").remove();
            this.etichetteTocchiCreate = false;
        }
    }

    // true dopo che i numeri dei tocchi sono stati disegnati almeno una volta
    etichetteTocchiCreate = false;

    // numero di tocchi dello stesso giocatore nella stessa azione (>1 = uno-due)
    getTouchCount = (d) => {
        if ((d as any).__paohTouches !== undefined) return (d as any).__paohTouches;
        let n = 1;
        try {
            let personId = d.get("person");
            let neighbors = this.bipDynGraph.getNeighbors(d.get("document"));
            n = 0;
            for (let [link, node] of neighbors.entries()) {
                if (node.id == personId) n++;
            }
        } catch (e) {
            n = 1;
        }
        (d as any).__paohTouches = n;
        return n;
    }

    isMultiTouch = (d) => this.getTouchCount(d) > 1;

    // ordine dei ruoli: pass_5 -> ... -> pass_1 -> assist -> scorer
    static roleOrder(role: string): number {
        if (!role) return 500;
        if (role === "scorer") return 1000;
        if (role === "assist") return 900;
        let m = /^pass_(\d+)$/.exec(role);
        if (m) return 100 - parseInt(m[1], 10);
        return 500;
    }

    // ruoli di un giocatore in un'azione in ordine cronologico (es. pass_1 e poi scorer)
    getTouchRoles = (d): string[] => {
        if ((d as any).__paohTouchRoles !== undefined) return (d as any).__paohTouchRoles;
        let ruoli: string[] = [];
        try {
            let personId = d.get("person");
            let neighbors = this.bipDynGraph.getNeighbors(d.get("document"));
            for (let [link, node] of neighbors.entries()) {
                if (node.id == personId) ruoli.push(link.type);
            }
            ruoli.sort((a, b) => PaohRelaxedVis.roleOrder(a) - PaohRelaxedVis.roleOrder(b));
        } catch (e) {
            ruoli = [];
        }
        (d as any).__paohTouchRoles = ruoli;
        return ruoli;
    }

    // tracciato del simbolo corrispondente a un singolo ruolo
    symbolPathForRole(role: string): string {
        let r = this.occurrenceRadius();
        if (this.specialRoles.includes(role)) {
            let R = r * this.STAR_RADIUS_FACTOR;
            return d3.symbol().type(d3.symbolStar).size(1.1227 * R * R)();
        }
        return d3.symbol().type(d3.symbolCircle).size(Math.PI * r * r)();
    }

    // elenco dei ruoli da disegnare come stella (marcatore)
    specialRoles: string[] = ["scorer"];

    // scorre tutti i link fra azione e persona (nell'uno-due sono piu' di uno)
    isSpecialRole = (d) => {
        // il ruolo di marcatore di un'occorrenza e' fisso: calcolato una volta
        if ((d as any).__paohSpecial !== undefined) return (d as any).__paohSpecial;
        let ris = false;
        try {
            let personId = d.get("person");
            let neighbors = this.bipDynGraph.getNeighbors(d.get("document"));
            for (let [link, node] of neighbors.entries()) {
                if (node.id == personId && this.specialRoles.includes(link.type)) {
                    ris = true;
                    break;
                }
            }
        } catch (e) {
            ris = false;
        }
        (d as any).__paohSpecial = ris;
        return ris;
    }

    // colorazione per attributo del calciatore: scale dedicate per i pulsanti della barra

    FASI_RAGGIUNTE = ["Fase a gironi", "Sedicesimi", "Ottavi", "Quarti", "Quarto posto", "Terzo posto", "Finalista", "Campione"];
    PROPRIETA_NUMERICHE = {gol: "Gol segnati (autogol esclusi)", assist: "Assist", azioni_gol: "Azioni gol a cui ha partecipato", cartellini: "Cartellini ricevuti"};
    COLORE_ZERO = "#e6e6e6";
    legendaProprieta: any = null;

    massimoProprieta(nome): number {
        let p: any = this.bipDynGraph.getProperty ? this.bipDynGraph.getProperty(nome) : null;
        if (p && p.domain && p.domain.length === 2 && !isNaN(p.domain[1])) return +p.domain[1];
        let max = 0;
        Object.values(this.bipDynGraph.idToNode).forEach((n: any) => { let v = n && n.get ? +n.get(nome) : NaN; if (!isNaN(v)) max = Math.max(max, v); });
        return max;
    }

    coloreNumerico(v, max): string {
        if (!v) return this.COLORE_ZERO;
        return d3.interpolateYlOrRd(0.25 + 0.75 * (max > 1 ? (v - 1) / (max - 1) : 1));
    }

    // dalla fase a gironi (chiaro) ai quarti (blu scuro), poi quarto posto, bronzo, argento e oro
    COLORI_FASI = ["#e6e6e6", "#c6dbef", "#6baed6", "#08519c", "#6a51a3", "#cd7f32", "#8c8c8c", "#d4af37"];

    coloreFase(v): string {
        let i = this.FASI_RAGGIUNTE.indexOf(v);
        return i < 0 ? "#DDDDDD" : this.COLORI_FASI[i];
    }

    coloreProprieta(prop, persona): string {
        let nome = prop.name;
        let v = persona && persona.get ? persona.get(nome) : undefined;
        if (nome === "team") return this.teamColorFor(Array.isArray(v) ? v[0] : v);
        if (nome === "fase_raggiunta") return this.coloreFase(v);
        if (nome in this.PROPRIETA_NUMERICHE) return this.coloreNumerico(+v || 0, this.massimoProprieta(nome));
        return prop.getColorScale()(v);
    }

    renderPersonProperty = (property) => {
        this.personPropertyToRender = property;
        this.mostraLegendaProprieta(property);
        this.render();
    }

    unrenderPersonProperty = () => {
        this.personPropertyToRender = null;
        this.mostraLegendaProprieta(null);
        this.render();
    }

    mostraLegendaProprieta(prop) {
        if (!this.legendaProprieta) {
            this.legendaProprieta = d3.select("body").append("div")
                .attr("id", "paoh-legenda-proprieta")
                .style("position", "fixed").style("left", "12px").style("bottom", "12px")
                .style("z-index", 1400).style("background", "white")
                .style("border", "1px solid #666").style("border-radius", "6px")
                .style("box-shadow", "0 3px 10px rgba(0,0,0,0.25)")
                .style("padding", "8px 12px").style("font-size", "12px")
                .style("max-width", "360px").style("display", "none");
        }
        let L = this.legendaProprieta;
        L.html("");
        if (!prop) { L.style("display", "none"); return; }
        let voci: Array<[string, string]> = [];
        let titolo = prop.name, nota = "";
        if (this.modalitaStratificata()) {
            // dataset stratificati: nome dell'attributo, senza le etichette dei mondiali
            if (prop.name === "team") nota = "Stessi colori della legenda Teams.";
        } else if (prop.name === "team") {
            titolo = "Nazionale";
            nota = "Stessi colori della legenda Teams.";
        } else if (prop.name === "fase_raggiunta") {
            titolo = "Fase raggiunta dalla nazionale";
            voci = this.FASI_RAGGIUNTE.map(f => [this.coloreFase(f), f] as [string, string]);
        } else if (prop.name in this.PROPRIETA_NUMERICHE) {
            titolo = this.PROPRIETA_NUMERICHE[prop.name];
            let max = this.massimoProprieta(prop.name);
            let valori = max <= 10 ? d3.range(0, max + 1) : [0, 1, Math.round(max / 4), Math.round(max / 2), Math.round(3 * max / 4), max];
            voci = [...new Set(valori)].map(v => [this.coloreNumerico(v, max), String(v)] as [string, string]);
            nota = "Valori sull'intero torneo.";
        } else if (prop.name === "name") {
            titolo = "Calciatore";
            nota = "Un colore per ogni calciatore (la scala ha 12 colori, che si ripetono).";
        } else if (prop.name === "group") {
            titolo = "Girone";
            let dom = (prop.domain || []).slice().sort();
            voci = dom.map(g => [prop.getColorScale()(g), g] as [string, string]);
        }
        L.append("div").style("font-weight", "bold").style("margin-bottom", "4px").text(titolo);
        let r = L.append("div").style("display", "flex").style("flex-wrap", "wrap").style("gap", "4px 10px");
        voci.forEach(([c, t]) => {
            let it = r.append("div").style("display", "flex").style("align-items", "center");
            it.append("span").style("display", "inline-block").style("width", "12px").style("height", "12px")
                .style("border-radius", "50%").style("border", "1px solid #555").style("margin-right", "4px")
                .style("background", c);
            it.append("span").text(t);
        });
        if (nota) L.append("div").style("color", "#666").style("margin-top", "4px").text(nota);
        L.style("display", "block");
    }

    fillPersonNode = (d) => {
        const renderTeam = true;

        if (this.personPropertyToRender) {
            return this.coloreProprieta(this.personPropertyToRender, this.bipDynGraph.idToNode[d.get("person")]);
        } else {

            if (renderTeam) {
                // render team as color
                // la squadra di un'occorrenza non cambia: si calcola una volta sola
                if ((d as any).__paohTeamColor !== undefined) return (d as any).__paohTeamColor;
                let link = getKeyByValueMap(this.bipDynGraph.getNeighbors(d.get("document")), d.get("person"), (a, b) => a == b.id)

                let color = this.teamColorFor(link.get("team"));
                (d as any).__paohTeamColor = color;
                return color;
            } else {
                let link = getKeyByValueMap(this.bipDynGraph.getNeighbors(d.get("document")), d.get("person"), (a, b) => a == b.id)
                let color = this.roleColorScale(link.type);
                return color;
            }
        }
    }

    personOccurrenceX(d) {
        return d.get("x");
    }

    personOccurrenceXCenter(d) {
        // TODO ; rechange
        // return d.x + renderingParameters.getPaohPersonOccurrenceWidth() / 2;
        return d.x + renderingParameters.getPaohPersonOccurrenceWidth() / 2 + renderingParameters.columnPadding() / 2;
    }

    personOccurrenceY(d) {
        return d.get("y");
    }

    personOccurrenceYCenter(d) {
        // return d.get("y") + renderingParameters.getPaohPersonOccurrenceWidth() / 2;
        return d.y + renderingParameters.getPaohPersonOccurrenceWidth() / 2;
    }

    // showPersonTooltip(personId) {
    //     let personNode = this.bipDynGraph.idToNode[personId];
    //
    //
    //     let props = Object.fromEntries(Object.entries(personNode.attributes).filter(n => n[0] != "affiliation")))
    //
    //     let toShow = {id: personNode.id, ...props};
    //     // let toShow = {id: personNode.id, ...personNode.attributes};
    //     this.nodeInfoPanelManager.render(toShow);
    //     // this.nodeInfoPanelManager.render(personNode.attributes);
    // }

    // iperarco con un solo nodo: la linea verticale non serve
    iperarcoVuoto(d): boolean {
        return !d.bounds || d.bounds[0] === d.bounds[1] || !d.bounds[1];
    }

    renderDocuments(g) {
        let documents: d3.Selection<HTMLElement, HyperEdge, any, any> = g.filter(d => d.type == nodeTypes.HYPEREDGE)
        if (this.documentAsLine) {
            documents
                .append("line")
                .classed(nodeTypes.HYPEREDGE, true)
                .attr("x1", d => this.documentXCenter(d))
                .attr("x2", d => this.documentXCenter(d))
                .attr("y1", d => d.bounds[0])
                .attr("y2", d => d.bounds[1])
                .attr("stroke", d => "#777777")
                // spessore da variabile css: lo zoom aggiorna una sola variabile
                .attr("stroke-width", d => this.hyperedgeStrokeWidth())
                .style("stroke-width", "var(--paoh-he-sw)")
                // un solo nodo: niente linea verticale
                .style("display", d => this.iperarcoVuoto(d) ? "none" : "")
        } else {
            documents
                .append("rect")
                .classed(nodeTypes.HYPEREDGE, true)
                .attr("x", d => this.documentX(d))
                .attr("y", d => this.documentY(d))
                .attr("width", d => this.documentWidth(d))
                .attr("height", d => this.documentHeight(d))
                .attr("fill", d => {
                    if (this.documentPropertyToRender) {
                        let propertyValue = this.bipDynGraph.idToNode[d.id].get(this.documentPropertyToRender.name);
                        return this.documentPropertyToRender.getColorScale()(propertyValue);
                    } else {
                        return renderingParameters.DOCUMENT_COLOR;
                    }
                })
                .attr("stroke", d => "black")
        }

        // sostituzione: linea doppia per distinguerla da un'azione gol con due calciatori
        if (this.documentAsLine) {
            // le due linee sono scostate con un transform che dipende dallo zoom (--paoh-sub-off)
            documents.filter(d => this.kindOf(d) === "substitution")
                .each(function () {
                    let linea = d3.select(this).select("line");
                    if (linea.empty() || !linea.node()) return;
                    let g = d3.select(this);
                    linea.style("transform", "translateX(calc(-1 * var(--paoh-sub-off)))");
                    g.insert("line", ":first-child")
                        .classed("substitution-line", true)
                        .attr("x1", linea.attr("x1")).attr("x2", linea.attr("x2"))
                        .attr("y1", linea.attr("y1")).attr("y2", linea.attr("y2"))
                        .attr("stroke", linea.attr("stroke"))
                        .style("stroke-width", "var(--paoh-he-sw)")
                        .style("transform", "translateX(var(--paoh-sub-off))");
                });
        }

        documents
            .on("mouseover", (e, d) => {
                if (!this.interactionController.pathSelectionMode) {
                    this.showDocumentTooltip(d);
                    this.salvaStatoHover();
                    this.interactionController.showOneDocument(d.id)
                }
            })
            .on("mouseout", (e, d) => {
                if (!this.interactionController.pathSelectionMode) this.ripristinaStatoHover();
            })
            .on("dblclick", (e, d) => {
                let personIds = this.bipDynGraph.getNeighbors(d.id, true).map(n => n.id);
                this.updateLayoutCb(personIds);
            })
            .on("click", (e, d) => {
                e.stopPropagation();
                this.showEventDetail(e, d);
            })
    }

    documentXCenter(d) {
        // return d.get("x") + this.documentWidth(d) / 2;
        // return d.get("x") + renderingParameters.getPaohPersonOccurrenceWidth() / 2;
        return this.personOccurrenceXCenter(d)
    }

    documentX(d) {
        return d.get("x");
    }

    documentY(d) {
        return d.get("y");
    }

    documentWidth(d) {
        return renderingParameters.COLUMN_WIDTH
    }

    documentHeight(d) {
        return d.bounds[1] - d.bounds[0] + renderingParameters.getPaohPersonOccurrenceWidth()
    }

    getOccurenceNodes(nodeId) {
        return this.graph.nodes.filter(node => OssatureGraph.parseUniquePersonNode(node.id)[0] == nodeId);
    }

    cellHeight() {
        return this.getPersonOccurenceHeight();
    }

    cellWidth(nCols) {
        // For width dependant on number of documents per rank
        // return this.graph.rankSize / nCols;

        return this.graph.rankSize / 2
    }

    showDocumentTooltip(d) {
        let documentNode = this.bipDynGraph.idToNode[d.id];
        let toShow = {id: documentNode.id, ...documentNode.attributes}
        this.nodeInfoPanelManager.render(toShow);
    }

    getIntersectionLabel = (intersection: Intersection) => {
        let label = this.bipDynGraph.getNode(intersection.intersected[0]).label();
        return label;
    }

    renderNodeLabel(g) {
        if (!this.renderLabels) {
            return;
        }

        // WARNING: when enter again without data, set this variable to no data
        // this.nodeLabels = g.filter(d => this.nodesToRenderLabel().includes(d.id))
        // g.filter(d => this.nodesToRenderLabel().includes(d.id))
        g
            .append('text')
            .classed("person-label", true)
            .text((d) => {
                return d.label();
            })
            .attr("x", d => {
                let labelX = this.nodeLabelX(d)
                return labelX
            })
            .attr("y", d => this.nodeLabelY(d))
            .style("font-size", d => this.dimensioneEtichetta(d))
            .style("font-weight", d => {
                return this.interactionController.isPersonHighlighted(d.get("person")) ? "bold" : "normal"
            })
            // testo centrato verticalmente sul centro del nodo
            .attr("dominant-baseline", "central")
            .style("pointer-events", "none")
            .style("text-anchor", d => this.ancoraEtichetta(d))
            .style("display", d => this.nodesToRenderLabelSet().has(d.id) ? "" : "none")
        // .on("mouseover", (e, d, i) => {
        //     this.togglePersonSelection(d.get("person"));
        //     this.showPersonTooltip(d.get("person"));
        // })
        // .on("mouseout", (e, d) => {
        //     this.togglePersonSelection(d.get("person"));
        //     this.resetHighlight();
        // })

        if (!this.occlusion.isInit()) {
            this.occlusion.run(this.nodeLabelsSelection(), this.interactionController.isPersonHighlighted, null, this.getIntersectionLabel)
        }
    }

    renderSelectionLabels() {

        // LABELS OF CROSSING PATHS DISABLED
        if (false) {
            this.gNodes
                .selectAll(".selLabel")
                .data(this.activeIntersections.filter(int => !(int.intersected instanceof HyperEdge)), d => d)
                .join("text")
                .classed("selLabel", true)
                .text((d) => {
                    return this.getIntersectionLabel(d);
                })
                .attr("x", d => d.labelX)
                .attr("y", d => d.labelY)
                .style("font-size", d => this.nodeLabelSize(d))
                .style("font-weight", "bold")
                .style("alignment-baseline", "middle")
                .style("pointer-events", "none")
                .style("text-anchor", d => {
                    if (d.position == Orientations.RIGHT) {
                        return "start"
                    } else if (d.position == Orientations.LEFT) {
                        return "end"
                    }
                })
        }

        let hyperedgesIntersections = this.activeIntersections.filter(int => (int.intersected instanceof HyperEdge))
        hyperedgesIntersections.forEach(int => {
            let hyperedge = int.intersected;
            let personOccurrencesNodes = hyperedge.persons;
            this.shownLabelNodes = this.shownLabelNodes.concat(personOccurrencesNodes)
            this.invalidateLabelCache();
        })

        // this.interactionController.render(true);
        // this.runOcclusion();
    }

    runOcclusion() {
        // solo le etichette mostrate e sullo schermo
        let W = window.innerWidth, H = window.innerHeight;
        let visibili = this.nodeLabelsSelection().filter(function () {
            let el: any = this;
            if (el.style && el.style.display === "none") return false;
            let r = el.getBoundingClientRect();
            return r.width > 0 && r.right >= -50 && r.left <= W + 50 && r.bottom >= -50 && r.top <= H + 50;
        });
        this.occlusion.run(visibili, this.interactionController.isPersonHighlighted, this.shownLabelNodes, this.getIntersectionLabel);
        this.liberaEtichetteSelezione();
    }

    // nomi di tutti i nodi selezionati (fino a LIMITE_ETICHETTE_SELEZIONE)
    LIMITE_ETICHETTE_SELEZIONE = 600;
    selEtichette: Map<string, {x: number, y: number, lato: any}> = new Map();
    private firmaSelEtichette = "";

    personeEtichetteSelezione(): Set<string> {
        let ic: any = this.interactionController;
        if (!ic) return new Set();
        return new Set([...(ic.highlightedPersonsIds || []), ...(ic.selectedPersonsIds || [])].map(String));
    }

    calcolaEtichetteSelezione(): boolean {
        let persone = this.personeEtichetteSelezione();
        let k = this.transform ? this.transform.k : 1;
        let occ = persone.size === 0 || !this.renderLabels ? [] :
            this.graph.getNodesByType(nodeTypes.PERSON_OCCURENCE)
                .filter((n: any) => persone.has(String(n.get("person"))) && this.occorrenzaVisibile(n));
        if (occ.length > this.LIMITE_ETICHETTE_SELEZIONE) occ = [];
        let firma = occ.length === 0 ? "" :
            occ.map((n: any) => n.id + ":" + Math.round(n.x) + ":" + Math.round(n.y)).join(",") + "|" + k.toFixed(4);
        if (firma === this.firmaSelEtichette) return false;
        this.firmaSelEtichette = firma;
        this.selEtichette = new Map();
        if (occ.length === 0) return true;
        let px = parseFloat(String(renderingParameters.text_size_highlighted())) || 14;
        // nodi consecutivi dello stesso calciatore nello stesso slot: un solo nome per gruppo
        let gruppi = new Map<string, any[]>();
        occ.forEach((n: any) => {
            let chiave = n.get("person") + "|" + Math.round(n.y) + "|" + this.tsDelDoc(n.get("document"));
            let l = gruppi.get(chiave); if (l) l.push(n); else gruppi.set(chiave, [n]);
        });
        let involucri = [...gruppi.values()].map(nodi => {
            nodi.sort((a, b) => a.x - b.x);
            let primo = nodi[0];
            return {nodi, x: primo.x, y: primo.y,
                    label: () => (typeof primo.label === "function" ? primo.label() : "")};
        });
        let mapper = new LabelMapper(involucri as any, 11, (o: any) => {
            let a = this.geometriaEtichetta(o.nodi[0]), b = this.geometriaEtichetta(o.nodi[o.nodi.length - 1]);
            return {cx: a.cx, cx1: b.cx, cy: a.cy, r: a.r} as any;
        });
        mapper.runSelezione(px / k / 12);
        involucri.forEach((o: any) => {
            let nodo = o.position === Orientations.LEFT ? o.nodi[0] : o.nodi[o.nodi.length - 1];
            this.selEtichette.set(nodo.id, {x: o.labelX, y: o.labelY, lato: o.position});
        });
        return true;
    }

    // toglie la classe "occluded" ai nomi della selezione
    liberaEtichetteSelezione() {
        if (this.selEtichette.size === 0 || !this.svg) return;
        this.svg.selectAll(".person-label.occluded").each(function (d: any) {
            let vis: any = (window as any).__PAOH_VIS__;
            if (d && vis && vis.selEtichette.has(d.id)) (this as any).classList.remove("occluded");
        });
    }

    // dopo uno zoom: ricalcola le posizioni dei nomi della selezione e le applica
    aggiornaEtichetteSelezione() {
        let prima = this.selEtichette;
        if (!this.calcolaEtichetteSelezione() || !this.svg) return;
        this.invalidateLabelCache();
        const vis = this;
        // allo zoom cambia la grandezza del testo, quindi il nome puo' cambiare lato
        this.svg.selectAll(".person-label").each(function (d: any) {
            if (!d) return;
            let el: any = this;
            let sel = vis.selEtichette.get(d.id);
            if (sel) {
                el.setAttribute("x", sel.x);
                el.setAttribute("y", sel.y);
                el.style.textAnchor = vis.ancoraEtichetta(d);
                el.style.display = vis.renderLabels ? "" : "none";
                el.style.fontSize = vis.dimensioneEtichetta(d);
                el.classList.remove("occluded");
            } else if (prima.has(d.id)) {
                el.style.display = "none";
            }
        });
    }

    // zoom: le grandezze che dipendono da k sono variabili css aggiornate a rotella ferma

    private timerDimensioni: any = null;
    private ultimeVariabili: string = "";

    dimensioneEtichetta(d): string {
        let hl = this.interactionController.isPersonHighlighted(d.get("person")) || this.shownLabelNodes.includes(d);
        return hl ? "var(--paoh-fs-hl)" : "var(--paoh-fs)";
    }

    impostaVariabiliZoom() {
        let el: any = this.svg && this.svg.node();
        if (!el) return;
        let k = this.transform ? this.transform.k : 1;
        let arco = k < 1 ? 1 / (k * 2.2) : 1;
        let he = this.hyperedgeStrokeWidth();
        // nessuna scrittura se non e' cambiato nulla
        let firma = k + "|" + he;
        if (firma === this.ultimeVariabili) return;
        this.ultimeVariabili = firma;
        el.style.setProperty("--paoh-fs", `${renderingParameters.TEXT_SIZE / k}px`);
        el.style.setProperty("--paoh-fs-hl", `${renderingParameters.text_size_highlighted() / k}px`);
        el.style.setProperty("--paoh-arc-sw", `${renderingParameters.LINE_STROKE_WIDTH * arco}px`);
        el.style.setProperty("--paoh-arc-sw-hl", `${renderingParameters.line_stroke_width_highlighted() * arco}px`);
        el.style.setProperty("--paoh-he-sw", `${he}px`);
        el.style.setProperty("--paoh-sub-off", `${he * 0.6}px`);
    }

    applicaDimensioniZoom() {
        let k = this.transform.k;
        // poche decine di elementi: si aggiornano subito
        this.xAxisg.selectAll("text").attr("transform", `scale(${1 / k})`);
        this.gNodes.selectAll(".selLabel").style("font-size", d => this.nodeLabelSize(d));
        // tutto il resto a rotella ferma
        if (this.timerDimensioni) clearTimeout(this.timerDimensioni);
        this.timerDimensioni = setTimeout(() => {
            this.timerDimensioni = null;
            this.impostaVariabiliZoom();
            this.aggiornaEtichetteSelezione();
        }, 120);
    }


    nodeLabelsSelection(): d3.Selection<any, any, any, any> {
        let regularLabels = this.svg.selectAll(".person-label");
        let selectionLabels = this.svg.selectAll(".selLabel");

        return d3.selectAll([...regularLabels, ...selectionLabels]);
    }

    // passaggio del mouse: all'uscita si ripristina la selezione salvata all'ingresso
    private statoPrimaHover: any = null;
    private static CAMPI_SELEZIONE = ["selectedPersonsIds", "selectedDocumentsIds", "selectedNodeIds",
        "shownNodeIds", "shownPersonsIds", "shownDocumentsIds",
        "highlightedNodeIds", "highlightedPersonsIds", "highlightedDocumentsIds"];

    salvaStatoHover() {
        if (this.statoPrimaHover) return;      // gia' salvato (passaggio da un nodo all'altro)
        let ic: any = this.interactionController;
        let stato: any = {opacita: Object.assign({}, ic.documentOpacityTable || {})};
        PaohRelaxedVis.CAMPI_SELEZIONE.forEach(c => stato[c] = (ic[c] || []).slice());
        this.statoPrimaHover = stato;
    }

    ripristinaStatoHover() {
        let stato = this.statoPrimaHover;
        if (!stato) return;
        this.statoPrimaHover = null;
        let ic: any = this.interactionController;
        PaohRelaxedVis.CAMPI_SELEZIONE.forEach(c => ic[c] = stato[c].slice());
        ic.documentOpacityTable = Object.assign({}, stato.opacita);
        ic.render();
    }

    // nome al passaggio del mouse, in grassetto a destra del cerchio
    private etichettaHover: any = null;
    private etichettaCoperta: any = null;

    mostraEtichettaHover(e, d) {
        if (!this.gOthers || !d) return;
        this.nascondiEtichettaHover();
        let nodo: any = this.etichettaHover && this.etichettaHover.node();
        if (!nodo || !nodo.isConnected) {
            this.etichettaHover = this.gOthers.append("text")
                .attr("id", "paoh-etichetta-hover")
                .attr("dominant-baseline", "central")
                .style("pointer-events", "none")
                .style("font-weight", "bold")
                .style("font-size", "var(--paoh-fs-hl)")
                .style("fill", "#111")
                .style("stroke", "white")
                .style("stroke-width", "calc(var(--paoh-fs-hl) * 0.3)")
                .style("stroke-linejoin", "round")
                .style("paint-order", "stroke");
        }
        let g = this.geometriaEtichetta(d);
        let nome = typeof d.label === "function" ? d.label() : String(d.get("person"));
        this.etichettaHover
            .text(nome)
            .attr("x", g.cx + g.r * 1.5 + 2)
            .attr("y", g.cy)
            .style("display", null)
            .raise();
        // etichetta gia' presente sullo stesso nodo: nascosta durante il passaggio
        let gruppo = e && e.currentTarget ? e.currentTarget : null;
        let propria = gruppo && gruppo.querySelector ? gruppo.querySelector(".person-label") : null;
        if (propria && propria.style.visibility !== "hidden") {
            propria.style.visibility = "hidden";
            this.etichettaCoperta = propria;
        }
    }

    nascondiEtichettaHover() {
        if (this.etichettaHover) this.etichettaHover.style("display", "none");
        if (this.etichettaCoperta) {
            this.etichettaCoperta.style.visibility = "";
            this.etichettaCoperta = null;
        }
    }

    // centro e raggio del glifo di un'occorrenza, per posizionare le etichette
    geometriaEtichetta = (o: any) => ({
        cx: this.personOccurrenceXCenter(o),
        cy: this.personOccurrenceYCenter(o),
        r: this.occurrenceRadius(),
    });

    // se il LabelMapper non trova posto il nome va a destra del cerchio
    nodeLabelX(d) {
        let sel = this.selEtichette.get(d.id);
        if (sel) return sel.x;
        if (d.labelX !== undefined && d.labelX !== null) return d.labelX;
        let g = this.geometriaEtichetta(d);
        return g.cx + g.r * 1.5 + 2;
    }

    nodeLabelY(d) {
        let sel = this.selEtichette.get(d.id);
        if (sel) return sel.y;
        if (d.labelY !== undefined && d.labelY !== null) return d.labelY;
        return this.personOccurrenceYCenter(d);
    }

    ancoraEtichetta(d): string {
        let sel = this.selEtichette.get(d.id);
        if (sel) return sel.lato === Orientations.LEFT ? "end" : "start";
        return (d.labelX !== undefined && d.labelX !== null && d.position == Orientations.LEFT) ? "end" : "start";
    }

    nodeLabelSize(d) {
        if (d instanceof Intersection || this.interactionController.isPersonHighlighted(d.get("person")) || this.shownLabelNodes.includes(d)) {
            return `${renderingParameters.text_size_highlighted() / this.transform.k}px`
        } else {
            return `${renderingParameters.TEXT_SIZE / this.transform.k}px`
        }
    }

    // nodi che mostrano il nome: primo e ultimo di ogni percorso e giocatori con una sola occorrenza (calcolato una volta per render)
    private cacheLabelSet: Set<string> = null;

    invalidateLabelCache() {
        this.cacheLabelSet = null;
    }

    nodesToRenderLabelSet(): Set<string> {
        if (this.cacheLabelSet) return this.cacheLabelSet;

        // con una selezione attiva si mostrano i nomi di tutti i nodi selezionati
        if (this.selEtichette.size > 0) {
            let r = new Set<string>(this.selEtichette.keys());
            this.shownLabelNodes.forEach(node => r.add(node.id));
            this.cacheLabelSet = r;
            return r;
        }

        // primo e ultimo nodo di ogni percorso con almeno un link
        let nodes: string[] = [];
        let singoli = new Set<string>();
        Object.keys(this.graph.personIdToPath).forEach(pid => {
            let path = this.graph.personIdToPath[pid];
            if (path.links.length > 0) {
                nodes.push(path.links[0].source.id);
                nodes.push(path.links[path.links.length - 1].target.id);
            } else {
                // giocatori con una sola occorrenza: il percorso non ha link (es. molti autogol)
                singoli.add(pid);
            }
        });

        if (singoli.size > 0) {
            this.graph.getNodesByType(nodeTypes.PERSON_OCCURENCE).forEach(n => {
                if (singoli.has(String(n.get("person")))) nodes.push(n.id);
            });
        }

        let risultato = new Set<string>();
        nodes.forEach(nodeId => {
            let node = this.graph.getNode(nodeId) as Labelled;
            if (node && (node as any).labelX && (node as any).labelY) risultato.add(nodeId);
        });

        this.shownLabelNodes.forEach(node => risultato.add(node.id));

        this.cacheLabelSet = risultato;
        return risultato;
    }

    // lasciata per compatibilita'
    nodesToRenderLabel() {
        return Array.from(this.nodesToRenderLabelSet());
    }

    linksRender() {
        // this.personLinesRender();
        this.personPathsRender();
    }

    // punti (x,y) del percorso di un giocatore, solo sulle occorrenze visibili
    puntiVisibiliDelPercorso(path): [number, number][] {
        if (!path.links || path.links.length === 0) return [];
        let nodi = [path.links[0].source];
        path.links.forEach((l) => nodi.push(l.target));
        // i nodi dummy si tengono solo nelle giornate con almeno un'occorrenza visibile
        let visibile = (n) => n.type == nodeTypes.PERSON_OCCURENCE && this.occorrenzaVisibile(n);
        let ranghi = new Set(nodi.filter(visibile).map((n: any) => n.rank));
        let tenuti = nodi.filter((n: any) => visibile(n) || (n.type !== nodeTypes.PERSON_OCCURENCE && ranghi.has(n.rank)));
        let primo = tenuti.findIndex(visibile);
        if (primo < 0) return [];
        let ultimo = tenuti.length - 1;
        while (ultimo > primo && !visibile(tenuti[ultimo])) ultimo--;
        return tenuti.slice(primo, ultimo + 1)
            .map((n) => [this.personOccurrenceXCenter(n), this.personOccurrenceYCenter(n)] as [number, number]);
    }

    // path svg del percorso di un giocatore, con cache legata anche a filtroVersione
    percorsoConCache(path): string {
        if ((path as any).__cachedVersione === this.filtroVersione) {
            return (path as any).__cachedD;
        }
        let punti = this.puntiVisibiliDelPercorso(path);
        let dPath = "";
        if (punti.length >= 2 && this.modalitaStratificata()) {
            // dataset stratificati: retta sulla stessa riga, curva quando si cambia livello
            dPath = `M ${punti[0][0]} ${punti[0][1]} `;
            for (let i = 1; i < punti.length; i++) {
                let [x1, y1] = punti[i - 1], [x2, y2] = punti[i];
                if (Math.abs(y2 - y1) < 1) {
                    dPath += `L ${x2} ${y2} `;
                } else {
                    let mx = x1 + (x2 - x1) * 0.5;
                    dPath += `C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2} `;
                }
            }
        } else if (punti.length >= 2) {
            // stessa y per tutti i punti: segmenti dritti invece della spline
            let generatore = d3.line().curve(d3.curveLinear);
            dPath = generatore(punti) || "";
        }
        (path as any).__cachedD = dPath;
        (path as any).__cachedVersione = this.filtroVersione;
        return dPath;
    }

    // svuota la cache dei percorsi (da console: __PAOH_VIS__.invalidatePathCache())
    invalidatePathCache() {
        Object.values(this.graph.personIdToPath).forEach((path: any) => {
            delete path.__cachedD;
            delete path.__cachedVersione;
        });
    }

    personPathsRender(): void {
        this.crossTimeArcs = this.gLinks
            .selectAll('.arcCrossTime')
            .data(
                Object.entries(this.graph.personIdToPath)
                    .filter((d) => this.puntiVisibiliDelPercorso(d[1]).length >= 2),
                (d) => d[0]
            )
            .join((enter) => {
                return enter.append("path")
                    .attr('d', (d) => this.percorsoConCache(d[1]))
            }, (update) => {
                update.attr('d', (d) => this.percorsoConCache(d[1]))
                return update
            })
            .attr("stroke", "gray")
            .attr("fill", "none")
            .call(sel => this.animaOpacita(sel, (d) => this.pathOpacity(d), "attr")
                // stessa formula usata durante lo zoom (GraphRenderer)
                .style("stroke-width", (d) => this.interactionController.isPersonHighlighted(d[0]) ? "var(--paoh-arc-sw-hl)" : "var(--paoh-arc-sw)"))
            .classed("arcCrossTime", true)
            .classed("link", true)
    }

    getTimeOfX = (x) => {
        // let xT = this.transform.invertX(x)
        let xT = x;
        let time = this.graph.xToTime(xT);
        return time
    }

    pathOpacity = (d) => {
        let personId = d[0];
        let isSelected = this.interactionController.selectedPaths.includes(d[1])
        if (isSelected) return true;

        return this.interactionController.isPersonVisible(personId) ? 0.8 : renderingParameters.UNHIGHLIGHT_OPACITY;
        // return this.interactionController.shownPersonsIds.includes(d[0]) || this.interactionController.shownPersonsIds.length == 0 ? 1 : renderingParameters.UNHIGHLIGHT_OPACITY;
    }

    transition(): d3.Transition<any, any, any, any> {
        return this.svg.transition()
            // .duration(1500);
            .duration(0);
    }

    // durata in ms della dissolvenza quando cambia l'evidenziazione
    DURATA_EVIDENZIAZIONE = 450;

    // oltre questo numero di elementi l'evidenziazione e' immediata, senza dissolvenza
    SOGLIA_ANIMAZIONE = 2500;
    animazioneSelezioneAttiva = true;

    // regola css della dissolvenza, inserita una sola volta nella pagina
    iniettaStileDissolvenza() {
        if (document.getElementById("paoh-dissolvenza")) return;
        let st = document.createElement("style");
        st.id = "paoh-dissolvenza";
        st.textContent = `.paoh-dissolvenza { transition: opacity ${this.DURATA_EVIDENZIAZIONE}ms cubic-bezier(0.215, 0.61, 0.355, 1); }`;
        document.head.appendChild(st);
    }

    // porta l'opacita' di ogni elemento a target(d) con una transizione css
    animaOpacita(sel, target, modo: "style" | "attr") {
        this.iniettaStileDissolvenza();
        sel.interrupt("paohOpacita");
        let anima = this.animazioneSelezioneAttiva;
        sel.each(function (d) {
            let el: any = this;
            let v = +target(d);
            if (isNaN(v)) v = 1;
            let cls = el.classList;
            if (anima) {
                if (!cls.contains("paoh-dissolvenza")) cls.add("paoh-dissolvenza");
            } else if (cls.contains("paoh-dissolvenza")) {
                cls.remove("paoh-dissolvenza");
            }
            let s = String(v);
            if (el.style.opacity !== s) el.style.opacity = s;
        });
        return sel;
    }

    // lasciata per compatibilita': transizione con la stessa durata dell'evidenziazione
    transizioneEvidenziazione(): d3.Transition<any, any, any, any> {
        return this.svg.transition("paohOpacita")
            .duration(this.DURATA_EVIDENZIAZIONE)
            .ease(d3.easeCubicOut);
    }

    createSelectionPath(nodeId) {
        //Get coordinate of nodeId
        let occurrences = this.graph.getPersonOccurrences(nodeId);

        let changingI = 0;
        occurrences.sort((a, b) => a.rank - b.rank)
        let flag = true;
        let prevRank = occurrences.reduce((a, b, i, arr) => {
            if (flag && a.rank != b.rank) {
                changingI = i - 1;
                flag = false;
            }
            return b
        })

        let occ1 = occurrences[changingI];
        let occ2 = occurrences[changingI + 1];

        // Middle of 2 points
        let x = (occ1.x + occ2.x) / 2 + (renderingParameters.getPaohPersonOccurrenceWidth() / 2);
        let y = (occ1.y + occ2.y) / 2 + (renderingParameters.getPaohPersonOccurrenceWidth() / 2);

        this.pathSelectionner.createNewPath({x, y});
        this.pathSelectionner.testAndRenderAll();
    }
}
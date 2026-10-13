import * as d3 from 'd3';

// legenda delle nazionali: pulsante nella barra e pannello con l'elenco (selezione multipla)

// dataset stratificato caricato (classe messa sul body da DynViz)
const stratificato = () => document.body.classList.contains("stratificato");

export default class TeamsLegendPanelManager {
    ROW_HEIGHT = 17;      // altezza di una riga
    COL_WIDTH = 185;      // larghezza di una colonna
    COLUMNS = 4;          // colonne del pannello aperto

    constructor(selection, roleColorScale) {
        this.element = d3.select(selection);
        this.roleColorScale = roleColorScale;
        this.open = false;
        this.domain = [];
        this.selectedTeams = [];
        this.senzaAzioni = {};
        this.initElement();

        window.__TEAMS_LEGEND__ = this;
    }

    // interfaccia

    initElement() {
        this.element.html("");
        d3.selectAll(".teams-legend-panel").remove();

        this.title = this.element
            .append("div")
            .classed("legend-title", true)
            .classed("teams-legend-toggle", true)
            .attr("title", stratificato() ? "Clicca per vedere tutti i gruppi" : "Clicca per vedere tutte le nazionali")
            .style("cursor", "pointer")
            .style("user-select", "none")
            .style("white-space", "nowrap")
            .style("padding", "3px 8px")
            .style("border", "1px solid #888")
            .style("border-radius", "4px")
            .style("background", "white")
            .style("display", "inline-block")
            .style("font-size", "14px")
            .text("Teams")
            .on("click", (e) => {
                e.stopPropagation();
                this.toggle();
            });

        this.panel = d3.select("body")
            .append("div")
            .classed("teams-legend-panel", true)
            .style("position", "fixed")
            .style("display", "none")
            .style("z-index", 1000)
            .style("background", "white")
            .style("border", "1px solid #666")
            .style("border-radius", "6px")
            .style("box-shadow", "0 4px 14px rgba(0,0,0,0.3)")
            .style("padding", "10px 12px 12px 12px")
            .style("overflow", "auto")
            .style("max-height", "80vh")
            .on("click", (e) => e.stopPropagation());

        let head = this.panel.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "12px")
            .style("justify-content", "space-between")
            .style("margin-bottom", "4px");

        this.panelTitle = head.append("span")
            .style("font-weight", "bold")
            .text("Teams");

        this.resetButton = head.append("span")
            .style("cursor", "pointer")
            .style("font-size", "13px")
            .style("text-decoration", "underline")
            .style("color", "#0b7285")
            .style("display", "none")
            .text("Deseleziona tutto")
            .on("click", () => this.clearTeamSelection());

        head.append("span")
            .style("cursor", "pointer")
            .style("padding", "0 4px")
            .style("font-size", "16px")
            .style("line-height", "1")
            .attr("title", "Chiudi")
            .text("\u2715")
            .on("click", () => this.hide());

        this.panel.append("div")
            .style("font-size", "12px")
            .style("color", "#666")
            .style("margin-bottom", "8px")
            .text(stratificato() ? "Clicca uno o più gruppi per evidenziarne le azioni." : "Clicca una o più nazionali per evidenziarne le azioni gol.");

        this.svg = this.panel.append("svg");

        d3.select("body").on("click.teamsLegend", () => this.hide());
        d3.select("body").on("keydown.teamsLegend", (e) => {
            if (e.key === "Escape") this.hide();
        });
    }

    toggle() {
        this.open ? this.hide() : this.show();
    }

    show() {
        this.open = true;
        this.renderPanel();

        let node = this.title.node();
        let r = node ? node.getBoundingClientRect() : {left: 20, bottom: 60};

        this.panel.style("display", "block");
        let width = this.panel.node().getBoundingClientRect().width;
        let left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));

        this.panel
            .style("left", left + "px")
            .style("top", Math.max(8, r.bottom + 6) + "px");

        this.updateTitle();
    }

    hide() {
        this.open = false;
        this.panel.style("display", "none");
        this.updateTitle();
    }

    reset() {
    }

    updateTitle() {
        let base = `Teams (${this.domain.length})`;
        let n = this.selectedTeams.length;
        let sel = "";
        if (n === 1) {
            sel = ` \u2013 ${this.selectedTeams[0]}`;
        } else if (n === 2) {
            sel = ` \u2013 ${this.selectedTeams.join(", ")}`;
        } else if (n > 2) {
            sel = ` \u2013 ${n} squadre`;
        }
        this.title.text(`${base}${sel} ${this.open ? "\u25B4" : "\u25BE"}`);
    }

    // elenco delle nazionali

    // colore della nazionale, lo stesso del grafico
    colorOf = (team) => {
        let f = window.__PAOH_TEAM_COLOR__;
        return f ? f(team) : this.roleColorScale(team);
    }

    // elenco preso dai metadata, cosi' compaiono anche le squadre senza gol
    teamsToShow() {
        let dalDato = this.roleColorScale.domain();
        let vis = this.getVis();
        let meta = vis && vis.bipDynGraph ? vis.bipDynGraph.metadata : null;
        let dichiarate = meta && Array.isArray(meta.teams) ? meta.teams : null;

        this.senzaAzioni = {};
        if (!dichiarate || !dichiarate.length) return dalDato;

        let elenco = dichiarate.slice();
        dalDato.forEach(t => { if (elenco.indexOf(t) < 0) elenco.push(t); });
        elenco.sort((a, b) => a.localeCompare(b));

        elenco.forEach(t => { if (dalDato.indexOf(t) < 0) this.senzaAzioni[t] = true; });
        return elenco;
    }

    isSenzaAzioni(team) {
        return !!this.senzaAzioni[team];
    }

    isSelected(team) {
        return this.selectedTeams.indexOf(team) >= 0;
    }

    render() {
        this.domain = this.teamsToShow();
        if (stratificato()) {
            // pochi gruppi: legenda sempre visibile nella barra, senza menu a tendina
            this.hide();
            this.renderInline();
            return;
        }
        this.title.style("display", "inline-block");
        this.element.selectAll("div.teams-inline").remove();
        this.updateTitle();
        if (this.open) this.renderPanel();
    }

    // legenda in elenco per i dataset stratificati (un colore per livello)
    renderInline() {
        const RIGA = 13;
        this.title.style("display", "none");

        let box = this.element.selectAll("div.teams-inline")
            .data([0])
            .join("div")
            .classed("teams-inline", true)
            .style("line-height", "1");

        box.selectAll("div.teams-inline-title")
            .data([0])
            .join("div")
            .classed("teams-inline-title", true)
            .style("font-size", "13px")
            .text("Teams");

        let svg = box.selectAll("svg")
            .data([0])
            .join("svg")
            .attr("width", 200)
            .attr("height", this.domain.length * RIGA + 2);

        let righe = svg.selectAll("g.team-row")
            .data(this.domain)
            .join("g")
            .classed("team-row", true)
            .attr("transform", (d, i) => `translate(0,${i * RIGA})`)
            .style("cursor", "pointer")
            .on("click", (e, d) => {
                e.stopPropagation();
                this.toggleTeam(d);
            })
            .on("mouseover", (e, d) => this.highlight(e, d))
            .on("mouseout", (e, d) => {
                if (!this.isSelected(d)) this.unHighlight(e, d);
            });

        righe.selectAll("rect.team-swatch")
            .data(d => [d])
            .join("rect")
            .classed("team-swatch", true)
            .attr("width", 18)
            .attr("height", 9)
            .attr("x", 0)
            .attr("y", 2)
            .attr("fill", d => this.colorOf(d))
            .attr("stroke", "black")
            .attr("stroke-width", d => this.isSelected(d) ? 2 : 0);

        righe.selectAll("text.team-name")
            .data(d => [d])
            .join("text")
            .classed("team-name", true)
            .attr("x", 22)
            .attr("y", 11)
            .style("font-size", "12px")
            .style("font-weight", d => this.isSelected(d) ? "bold" : "normal")
            .attr("fill", "black")
            .text(d => d);

        this.rects = svg.selectAll("rect.team-swatch");
        this.texts = svg.selectAll("text.team-name");
    }

    renderPanel() {
        let n = this.domain.length;
        let cols = Math.max(1, Math.min(this.COLUMNS, Math.ceil(n / 8)));
        let rows = Math.max(1, Math.ceil(n / cols));

        let nSel = this.selectedTeams.length;
        this.panelTitle.text(nSel ? `Teams (${n}) \u2013 ${nSel} selezionate` : `Teams (${n})`);
        this.resetButton.style("display", nSel ? "inline" : "none");

        this.svg
            .attr("width", cols * this.COL_WIDTH)
            .attr("height", rows * this.ROW_HEIGHT + 6);

        const colX = (d, i) => Math.floor(i / rows) * this.COL_WIDTH;
        const rowY = (d, i) => (i % rows) * this.ROW_HEIGHT;

        let righe = this.svg
            .selectAll("g.team-row")
            .data(this.domain)
            .join("g")
            .classed("team-row", true)
            .attr("transform", (d, i) => `translate(${colX(d, i)},${rowY(d, i)})`)
            .style("cursor", d => this.isSenzaAzioni(d) ? "default" : "pointer")
            .on("click", (e, d) => {
                e.stopPropagation();
                if (this.isSenzaAzioni(d)) return;
                this.toggleTeam(d);
            })
            .on("mouseover", (e, d) => this.highlight(e, d))
            .on("mouseout", (e, d) => {
                if (!this.isSelected(d)) this.unHighlight(e, d);
            });

        righe.selectAll("rect.team-bg")
            .data(d => [d])
            .join("rect")
            .classed("team-bg", true)
            .attr("x", -3)
            .attr("y", 0)
            .attr("width", this.COL_WIDTH - 6)
            .attr("height", this.ROW_HEIGHT - 2)
            .attr("rx", 3)
            .attr("fill", d => this.isSelected(d) ? "#e7f5ff" : "transparent");

        righe.selectAll("rect.team-swatch")
            .data(d => [d])
            .join("rect")
            .classed("team-swatch", true)
            .attr("width", 20)
            .attr("height", 11)
            .attr("x", 0)
            .attr("y", 2)
            .attr("fill", d => this.colorOf(d))
            .attr("opacity", d => this.isSenzaAzioni(d) ? 0.35 : 1)
            .attr("stroke", "black")
            .attr("stroke-width", d => this.isSelected(d) ? 2 : 0);

        righe.selectAll("text.team-name")
            .data(d => [d])
            .join("text")
            .classed("team-name", true)
            .attr("x", 25)
            .attr("y", 12)
            .style("font-size", "13px")
            .style("font-weight", d => this.isSelected(d) ? "bold" : "normal")
            .style("font-style", d => this.isSenzaAzioni(d) ? "italic" : "normal")
            .attr("fill", d => this.isSenzaAzioni(d) ? "#8a8a8a" : "black")
            .text(d => this.isSenzaAzioni(d) ? d + " (0 azioni)" : d);

        this.rects = this.svg.selectAll("rect.team-swatch");
        this.texts = this.svg.selectAll("text.team-name");
    }

    // selezione delle nazionali

    // la vis e' su window.__PAOH_VIS__
    getVis() {
        return window.__PAOH_VIS__ || null;
    }

    // true se l'id e' di un nodo persona
    isPersonNode(vis, id) {
        let g = vis.bipDynGraph;
        let n = g.idToNode ? g.idToNode[id] : null;
        if (!n) return false;
        return g.personType ? n.type === g.personType : !!(n.get && n.get("name"));
    }

    // calciatori di una nazionale (la squadra si legge dagli archi, non dai nodi)
    personsOfTeam(vis, team) {
        let ids = [];
        let visti = {};

        vis.bipDynGraph.links.forEach(l => {
            if (l.get("team") !== team) return;
            // grafo bipartito: prendo l'estremo che e' una persona
            let estremi = [l.getSourceId(), l.getTargetId()];
            for (let i = 0; i < estremi.length; i++) {
                let id = estremi[i];
                if (!visti[id] && this.isPersonNode(vis, id)) {
                    visti[id] = true;
                    ids.push(id);
                }
            }
        });
        return ids;
    }

    // debug da console, es. __TEAMS_LEGEND__.debugTeam("Francia")
    debugTeam(team) {
        let vis = this.getVis();
        if (!vis) { console.warn("[Teams legend] visualizzazione non pronta"); return; }

        let ids = this.personsOfTeam(vis, team);
        let righe = ids.map(id => {
            let n = vis.bipDynGraph.idToNode[id];
            return {id: id, nome: n && n.name ? n.name : (n && n.get ? n.get("name") : "?")};
        });
        console.table(righe);
        console.log(`[Teams legend] ${team}: ${ids.length} calciatori, ` +
            `${this.documentsOfPersons(vis, ids).length} azioni`);
        return righe;
    }

    // azioni a cui ha partecipato almeno uno dei calciatori indicati
    documentsOfPersons(vis, personIds) {
        let persone = {};
        personIds.forEach(id => { persone[id] = true; });

        let docIds = [];
        let visti = {};
        vis.bipDynGraph.links.forEach(l => {
            let s = l.getSourceId();
            let t = l.getTargetId();
            // il grafo e' bipartito: l'estremo che non e' una persona e' l'azione
            let doc = persone[s] ? t : (persone[t] ? s : null);
            if (doc && !visti[doc]) { visti[doc] = true; docIds.push(doc); }
        });
        return docIds;
    }

    // aggiunge o toglie una nazionale dalla selezione, senza azzerare le altre
    toggleTeam(team) {
        if (this.isSelected(team)) {
            this.selectedTeams = this.selectedTeams.filter(t => t !== team);
        } else {
            this.selectedTeams = this.selectedTeams.concat([team]);
        }
        this.applySelection();
    }

    // applica la selezione: restano opachi solo i calciatori delle nazionali scelte
    applySelection() {
        let vis = this.getVis();
        let ic = vis ? vis.interactionController : null;

        if (!ic || !vis.bipDynGraph) {
            console.warn("[Teams legend] visualizzazione non raggiungibile: " +
                "serve window.__PAOH_VIS__ (impostato da PaohRelaxedVis).");
            return;
        }

        this.updateTitle();
        if (this.open) this.renderPanel();
        if (stratificato()) this.renderInline();

        // nessuna squadra selezionata: si torna alla vista completa
        if (!this.selectedTeams.length) {
            ic.resetAllSelections(true);
            console.log("[Teams legend] selezione azzerata");
            return;
        }

        let personIds = [];
        let visti = {};
        this.selectedTeams.forEach(team => {
            this.personsOfTeam(vis, team).forEach(id => {
                if (!visti[id]) { visti[id] = true; personIds.push(id); }
            });
        });

        let docIds = this.documentsOfPersons(vis, personIds);

        // visibilita' impostata direttamente, senza showOnePerson()
        ic.resetAllSelections(false);
        ic.addShownPerson(personIds);
        ic.addShownDocuments(docIds);
        ic.addHighlightedPersons(personIds);

        ic.render();
        console.log(`[Teams legend] ${this.selectedTeams.join(", ")}: ` +
            `${personIds.length} calciatori, ${docIds.length} azioni`);
    }

    clearTeamSelection() {
        this.selectedTeams = [];
        this.applySelection();
    }

    // evidenziazione al passaggio del mouse

    highlight = (ev, datum) => {
        if (!this.rects) return;
        this.rects.filter((d) => JSON.stringify(d) == JSON.stringify(datum))
            .attr("stroke-width", 3)

        this.texts.filter((d) => JSON.stringify(d) == JSON.stringify(datum))
            .attr("fill", "blue")
    }

    unHighlight = (ev, datum) => {
        if (!this.rects) return;
        this.rects.filter((d) => JSON.stringify(d) == JSON.stringify(datum))
            .attr("stroke-width", 0)

        this.texts.filter((d) => JSON.stringify(d) == JSON.stringify(datum))
            .attr("fill", (d) => this.isSenzaAzioni(d) ? "#8a8a8a" : "black")
    }

    setupClickEvents() {
    }
}

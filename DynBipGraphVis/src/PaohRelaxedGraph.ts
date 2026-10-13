import {LayeredGraph, LayeredNode, Link, Path, BipartiteDynGraph, PersonNode} from "dynbipgraph";
import {globals, linkTypes, nodeTypes} from "./globals";
import {cloneDeep, groupBy} from 'lodash';
import {renderingParameters} from "./RenderingParameters";
import OssatureGraph from "./OssatureGraph.js";


export class PersonOccurrenceNode extends LayeredNode {
    constructor(id, attributes, nodeType, rank, x, y, width, height) {
        super(id, attributes, nodeType, rank, x, y, width, height);
    }

    label(): string {
        return this.get("personName");
    }
}

export class HyperEdge extends LayeredNode {
    persons: LayeredNode[];
    bounds: [number, number];
    columnNumber: number;
    time: string;

    constructor(id, attributes, nodeType, rank, x, y, persons, time) {
        super(id, attributes, nodeType, rank, x, y);
        this.persons = persons;
        this.time = time;
        this.computeBounds();
    }

    computeBounds(): void {
        let ys = this.persons.map(person => person.get("y"));

        let min = Math.min(...ys);
        let max = Math.max(...ys);

        this.bounds = [min, max];
    }

    get(attribute): any {
        if (attribute == "y") return this.bounds[0];
        if (attribute == "columnNumber") return this.columnNumber;
        return super.get(attribute);
    }

    person(pId): LayeredNode {
        return this.persons.filter(p => p.get("person") == pId)[0]
    }

    first(): LayeredNode {
        return this.persons[0];
    }

    last(): LayeredNode {
        return this.persons[this.persons.length - 1];
    }

    upperBound(): number {
        return this.bounds[1];
    }

    lowerBound(): number {
        return this.bounds[0];
    }

    areHyperedgesCrossing(hyperedge: HyperEdge) {
        return !(hyperedge.lowerBound() > this.upperBound() || hyperedge.upperBound() < this.lowerBound());
    }

    static findLowestColumn(hyperedges: HyperEdge[]): HyperEdge {
        return hyperedges.reduce((h1, h2) => {
            return h1.get("columnNumber") > h2.get("columnNumber") ? h2 : h1;
        })
    }

    static findHighestColumn(hyperedges: HyperEdge[]): HyperEdge {
        return hyperedges.reduce((h1, h2) => {
            return h1.get("columnNumber") > h2.get("columnNumber") ? h1 : h2;
        })
    }
}


class Column {
    hyperedges: HyperEdge[] = [];
    bounds: [number, number][] = [];
    bipDynGraph: BipartiteDynGraph;
    number: number;

    constructor(bipDynGraph, number) {
        this.bipDynGraph = bipDynGraph;
        this.number = number;
    }

    addHyperedge(hyperedge: HyperEdge): void {
        this.hyperedges.push(hyperedge);
        this.bounds.push(hyperedge.bounds);
    }

    canHyperedgeFit(hyperedge: HyperEdge): boolean {
        let fit: boolean = true;
        this.hyperedges.forEach(he => {
            if (hyperedge.areHyperedgesCrossing(he)) {
                fit = false;
            }
        })
        return fit;
    }

    padding() {
        return renderingParameters.getPaohPersonOccurrenceWidth() / 2
    }
}

export default class PaohRelaxedGraph extends LayeredGraph {
    ossatureGraph: OssatureGraph;
    bipDynGraph: BipartiteDynGraph;
    rankToColumns: Record<number, Column[]> = {};
    cumulativeColumnsNumber: number;
    personIdToPath: Record<string, Path>
    personToRankToHyperedge: Record<string, Record<number, HyperEdge[]>>;
    public isStratifiedMode: boolean = false;
    public totalLayersCount: number = 0;
    private normalizedYMap: Map<string, number> = new Map();

    constructor(ossatureGraph, bipDynGraph) {
        super(null);
        this.ossatureGraph = ossatureGraph;
        this.bipDynGraph = bipDynGraph;
        this.initGraph();
        this.setup();
    }

    public isStratifiedDataset(): boolean {
        return PaohRelaxedGraph.datasetStratificato(this.bipDynGraph);
    }

    // dataset a livelli: metadata.layout = "stratified" oppure un dataset mitre
    static datasetStratificato(bipDynGraph: any): boolean {
        const metadata = bipDynGraph?.metadata;
        if (metadata?.layout === "stratified") return true;
        if (metadata?.datasetName && String(metadata.datasetName).toLowerCase().includes("mitre")) return true;
        return false;
    }

    public initNormalizedVerticalSpace(): void {
        this.normalizedYMap.clear();

        const metadata = (this.bipDynGraph as any)?.metadata;
        const metaTeams: any = metadata?.teams;

        let categories: string[] = [];

        if (Array.isArray(metaTeams) && metaTeams.length > 0) {
            categories = Array.from(new Set(metaTeams.map(t => String(t))));
        } 
        else if (this.bipDynGraph && (this.bipDynGraph as any).nodes) {
            const entitySet = new Set<string>();
            (this.bipDynGraph as any).nodes.forEach((n: any) => {
                const label = n.get ? n.get("label") : n.label;
                const id = String(n.id || "");
                const isPerson = label === "person" || n.type === "person" || (!id.startsWith("doc_") && !n.ts && !n.timeSlot);
                if (isPerson) {
                    const name = n.get ? (n.get("name") || n.get("group") || id) : (n.name || n.group || id);
                    entitySet.add(String(name));
                }
            });
            categories = Array.from(entitySet);
        }

        if (categories.length === 0) {
            categories = ["Default"];
        }

        categories.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        this.totalLayersCount = categories.length;

        categories.forEach((cat: string, index: number) => {
            const normY = this.totalLayersCount > 1 
                ? index / (this.totalLayersCount - 1) 
                : 0.5;

            this.normalizedYMap.set(cat, normY);
            this.normalizedYMap.set(`L${index + 1}`, normY);
        });
    }

    public getDynamicY(personId: string, personNode?: any): number {
        if (!this.isStratifiedDataset()) {
            if (personNode) {
                const origY = personNode.get ? personNode.get("y") : personNode.y;
                if (origY !== undefined && !isNaN(origY) && origY !== null) {
                    return origY;
                }
            }
        }

        if (this.normalizedYMap.size === 0) {
            this.initNormalizedVerticalSpace();
        }

        const idStr = String(personId || "");
        let rawKey: any = idStr;

        if (personNode) {
            rawKey = personNode.get ? (personNode.get("name") || personNode.get("group") || personNode.get("team")) 
                                    : (personNode.name || personNode.group || personNode.team);
            if (Array.isArray(rawKey)) rawKey = rawKey[0];
        }
        const key = String(rawKey || idStr);

        let normY = this.normalizedYMap.get(key);
        if (normY === undefined) normY = this.normalizedYMap.get(idStr);

        if (normY === undefined) {
            for (const [cat, val] of this.normalizedYMap.entries()) {
                if (key.includes(cat) || cat.includes(key)) {
                    normY = val;
                    break;
                }
            }
        }
        if (normY === undefined) normY = 0;

        const dt = (renderingParameters as any).TEXT_SIZE || 14;
        const dn = renderingParameters.getPaohPersonOccurrenceWidth() || 12;
        const minDeltaY = 2 * Math.max(dt, dn);

        const marginTop = 60;
        const N = Math.max(1, this.totalLayersCount);
        const layerSpacing = Math.max(85, minDeltaY);
        const effectiveHeight = (N - 1) * layerSpacing;

        return marginTop + (normY * effectiveHeight);
    }

    getPersonOccurrences(personId): PersonOccurrenceNode[] {
        let occurrenceNodes = this.getNodesByType(nodeTypes.PERSON_OCCURENCE).filter(n => n.get("person") == personId) as PersonOccurrenceNode[];
        return occurrenceNodes;
    }

    getPaths() {
        return Object.values(this.personIdToPath).filter(d => d.links.length > 0);
    }

    initGraph() {
        this.personToRankToHyperedge = {};
        // ultima colonna usata da ogni partita in ogni time step (l'evento dopo va sempre piu' a destra)
        let ultimaColonnaPartita: Record<string, number> = {};
        for (let documentId of this.documentiInOrdine()) {
            let documentNode = this.ossatureGraph.idToNode[documentId];

            let persons = this.ossatureGraph.getNeighbors(documentId, true);
            let newRank = documentNode.rank / 2;

            let hyperedge: HyperEdge = new HyperEdge(documentNode.id, newRank, null, nodeTypes.HYPEREDGE, null, null, persons, this.bipDynGraph.getNode(documentId).time);
            let partita = PaohRelaxedGraph.ORDINE_CRONOLOGICO ? this.bipDynGraph.getNode(documentId).get("match") : undefined;
            let chiave = partita !== undefined && partita !== null ? `${newRank}|${partita}` : null;
            let colonnaMinima = chiave !== null && chiave in ultimaColonnaPartita ? ultimaColonnaPartita[chiave] + 1 : 0;
            let column = this.computeColumn(hyperedge, newRank, colonnaMinima);
            hyperedge.columnNumber = column.number;
            if (chiave !== null) ultimaColonnaPartita[chiave] = column.number;

            persons.forEach(person => {
                let personId = OssatureGraph.parseUniquePersonNode(person.id)[0];
                if (!this.personToRankToHyperedge[personId]) {
                    this.personToRankToHyperedge[personId] = {[newRank]: [hyperedge]}
                } else if (!this.personToRankToHyperedge[personId][newRank]) {
                    this.personToRankToHyperedge[personId][newRank] = [hyperedge]
                } else {
                    this.personToRankToHyperedge[personId][newRank].push(hyperedge)
                }
            })

            this.addNode(hyperedge);
            this.createOccurencePersonNodes(documentNode, hyperedge, persons, newRank, column.number);
        }

        this.transformHyperedgesPersons();
        this.createPaths();

        this.getNodesByType(nodeTypes.HYPEREDGE).forEach((he: any) => he.computeBounds());
    }

    // layout compatto per i filtri: si ricalcola solo sui documenti visibili

    static PASSO_RIGA_MAX = 28;
    private layoutOriginale: any = null;

    private salvaLayoutOriginale() {
        if (this.layoutOriginale) return;
        let y = new Map<string, number>(), colonne = new Map<string, number>();
        this.nodes.forEach((n: any) => {
            y.set(n.id, n.y);
            if (n.type == nodeTypes.HYPEREDGE) colonne.set(n.id, n.columnNumber);
            else if (n.attributes && n.attributes.columnNumber !== undefined) colonne.set(n.id, n.attributes.columnNumber);
        });
        let rankToColumns = {};
        Object.keys(this.rankToColumns).forEach(r => rankToColumns[r] = this.rankToColumns[r]);
        this.layoutOriginale = {y, colonne, rankToColumns};
    }

    applicaLayout(visibile: ((docId: string) => boolean) | null, occorrenzaVisibile: ((n: any) => boolean) | null = null) {
        this.salvaLayoutOriginale();
        let orig = this.layoutOriginale;
        let iperarchi = this.getNodesByType(nodeTypes.HYPEREDGE) as HyperEdge[];

        // con le linee orizzontali il layout si ricalcola sempre, anche senza filtri
        if (!visibile) visibile = () => true;

        // 1. righe: funzione monotona sulle y originali delle occorrenze visibili
        let visibili = new Set(iperarchi.filter(h => visibile(h.id)).map(h => h.id));
        let occOk = (p: any) => p && (!occorrenzaVisibile || occorrenzaVisibile(p));
        // nei dataset stratificati le y sono gia' fissate per livello: niente compattazione e niente tracce
        if (!this.isStratifiedDataset()) {
            let ys = new Set<number>();
            iperarchi.forEach(h => {
                if (visibili.has(h.id)) h.persons.forEach((p: any) => { if (occOk(p)) ys.add(orig.y.get(p.id)); });
            });
            let righe = [...ys].sort((a, b) => a - b);
            let nuove: number[] = [];
            let passo = PaohRelaxedGraph.PASSO_RIGA_MAX;
            // la prima riga visibile va in cima al grafico
            let cima = Infinity;
            orig.y.forEach((v: number) => { if (v !== null && v !== undefined && v < cima) cima = v; });
            if (!isFinite(cima)) cima = righe.length ? righe[0] : 0;
            righe.forEach((y, i) => nuove.push(i === 0 ? cima : nuove[i - 1] + Math.min(y - righe[i - 1], passo)));
            let mappa = (y: number): number => {
                if (y === null || y === undefined || righe.length === 0) return y;
                if (y <= righe[0]) return nuove[0] - Math.min(righe[0] - y, passo);
                let ultimo = righe.length - 1;
                if (y >= righe[ultimo]) return nuove[ultimo] + Math.min(y - righe[ultimo], passo);
                let lo = 0, hi = ultimo;
                while (hi - lo > 1) { let m = (lo + hi) >> 1; if (righe[m] <= y) lo = m; else hi = m; }
                let t = (y - righe[lo]) / (righe[hi] - righe[lo]);
                return nuove[lo] + t * (nuove[hi] - nuove[lo]);
            };
            this.nodes.forEach((n: any) => {
                if (n.type == nodeTypes.HYPEREDGE) return;
                let y0 = orig.y.get(n.id);
                if (y0 !== null && y0 !== undefined) n.y = mappa(y0);
            });
            // linee orizzontali: una sola y per calciatore in tutto il torneo
            this.assegnaTracceOrizzontali(visibili, occOk, cima);
        }
        iperarchi.forEach(h => {
            h.computeBounds();
            // con il filtro sui ruoli la linea dell'iperarco unisce solo le occorrenze visibili
            if (occorrenzaVisibile && visibili.has(h.id)) {
                let yv = h.persons.filter(occOk).map((p: any) => p.get("y"));
                if (yv.length) h.bounds = [Math.min(...yv), Math.max(...yv)];
            }
        });

        // 2. colonne: stesso algoritmo cronologico, sui soli iperarchi visibili
        let perId = new Map<string, HyperEdge>();
        iperarchi.forEach(h => perId.set(h.id, h));
        this.rankToColumns = {};
        this.ranks.forEach(r => { if (r !== undefined) this.rankToColumns[r] = []; });
        let ultimaColonna: Record<string, number> = {};
        for (let id of this.documentiInOrdine()) {
            let h = perId.get(id);
            if (!h) continue;
            let partita = PaohRelaxedGraph.ORDINE_CRONOLOGICO ? this.bipDynGraph.getNode(id).get("match") : undefined;
            let chiave = partita !== undefined && partita !== null ? `${h.rank}|${partita}` : null;
            if (!visibili.has(id)) {
                // non disegnato: resta accanto all'ultimo evento visibile della sua partita
                h.columnNumber = chiave !== null && chiave in ultimaColonna ? ultimaColonna[chiave] : 0;
                continue;
            }
            let minima = chiave !== null && chiave in ultimaColonna ? ultimaColonna[chiave] + 1 : 0;
            let colonna = this.computeColumn(h, h.rank, minima);
            h.columnNumber = colonna.number;
            if (chiave !== null) ultimaColonna[chiave] = colonna.number;
        }
        iperarchi.forEach(h => h.persons.forEach((p: any) => { if (p) p.attributes.columnNumber = h.columnNumber; }));
        this.getNodesByType("dummy").forEach((n: any) => {
            if (String(n.id).endsWith("_last")) n.attributes.columnNumber = (this.rankToColumns[n.rank] || []).length;
        });
        this.assignRankCoordinates(this.rankGapSize, this.rankSize);
    }

    // linee orizzontali: ogni calciatore ha una sola riga (traccia) per tutto il torneo, assegnata con l'algoritmo left-edge

    // distanza verticale fra due tracce consecutive
    static PASSO_TRACCIA = 26;
    // oltre questa distanza (in tracce) dai compagni si apre una traccia nuova
    static DISTANZA_MAX_TRACCIA = 4;
    // statistiche dell'ultima assegnazione (per il debug)
    statoTracce: any = null;

    private squadraDi(pid: string): string {
        let nodo: any = this.bipDynGraph.getNode(pid);
        let t = nodo && typeof nodo.get === "function" ? nodo.get("team") : null;
        if (Array.isArray(t)) t = t.find(v => v !== null && v !== undefined && v !== "");
        return t ? String(t) : "";
    }

    private assegnaTracceOrizzontali(visibili: Set<string>, occOk: (p: any) => boolean, cima: number) {
        let orig = this.layoutOriginale;
        let perId = new Map<string, HyperEdge>();
        (this.getNodesByType(nodeTypes.HYPEREDGE) as HyperEdge[]).forEach(h => perId.set(h.id, h));

        // 1. intervallo di slot, y media originale e compagni d'azione
        type Info = { pid: string, primo: number, ultimo: number, ySomma: number, n: number, squadra: string, compagni: Set<string> };
        let info = new Map<string, Info>();
        for (let id of this.documentiInOrdine()) {
            let h = perId.get(id);
            if (!h || !visibili.has(id)) continue;
            let ps = h.persons.filter(occOk);
            let pids = ps.map((p: any) => String(p.get("person")));
            ps.forEach((p: any, i) => {
                let pid = pids[i];
                let r = Number(h.rank);
                let x = info.get(pid);
                if (!x) {
                    x = {pid, primo: r, ultimo: r, ySomma: 0, n: 0, squadra: this.squadraDi(pid), compagni: new Set()};
                    info.set(pid, x);
                }
                x.primo = Math.min(x.primo, r);
                x.ultimo = Math.max(x.ultimo, r);
                let y0 = orig.y.get(p.id);
                if (y0 !== null && y0 !== undefined) { x.ySomma += y0; x.n++; }
                pids.forEach(q => { if (q !== pid) x.compagni.add(q); });
            });
        }
        let yMedia = (x: Info) => x.n ? x.ySomma / x.n : 0;

        // ordine delle nazionali: y media dei loro calciatori nel layout rilassato
        let squadre = new Map<string, { s: number, n: number }>();
        info.forEach(x => {
            let s = squadre.get(x.squadra) || {s: 0, n: 0};
            s.s += x.ySomma; s.n += x.n;
            squadre.set(x.squadra, s);
        });
        let ordineSquadra = (sq: string) => { let s = squadre.get(sq); return s && s.n ? s.s / s.n : 0; };

        // 2. ordinamento
        let persone = [...info.values()].sort((a, b) =>
            (a.primo - b.primo) ||
            (ordineSquadra(a.squadra) - ordineSquadra(b.squadra)) ||
            a.squadra.localeCompare(b.squadra) ||
            (yMedia(a) - yMedia(b)) ||
            a.pid.localeCompare(b.pid));

        // 3. assegnazione left-edge
        type Traccia = { fine: number };
        let tracce: Traccia[] = [];
        let tracciaDi = new Map<string, Traccia>();
        let perSquadra = new Map<string, Traccia[]>();
        for (let p of persone) {
            let rif: number[] = [];
            p.compagni.forEach(q => { let t = tracciaDi.get(q); if (t) rif.push(tracce.indexOf(t)); });
            if (!rif.length) (perSquadra.get(p.squadra) || []).forEach(t => rif.push(tracce.indexOf(t)));
            let bersaglio = rif.length ? rif.reduce((a, b) => a + b, 0) / rif.length : null;

            let scelta = -1;
            if (bersaglio !== null) {
                let migliore = -1, dist = Infinity;
                tracce.forEach((t, i) => {
                    if (t.fine < p.primo && Math.abs(i - bersaglio) < dist) { dist = Math.abs(i - bersaglio); migliore = i; }
                });
                if (migliore >= 0 && dist <= PaohRelaxedGraph.DISTANZA_MAX_TRACCIA) scelta = migliore;
            } else {
                // nazionale non ancora vista: prima traccia libera dall'alto
                scelta = tracce.findIndex(t => t.fine < p.primo);
            }
            if (scelta < 0) {
                let pos = bersaglio === null ? tracce.length : Math.min(tracce.length, Math.floor(bersaglio) + 1);
                tracce.splice(pos, 0, {fine: -Infinity});
                scelta = pos;
            }
            let t = tracce[scelta];
            t.fine = p.ultimo;
            tracciaDi.set(p.pid, t);
            if (!perSquadra.has(p.squadra)) perSquadra.set(p.squadra, []);
            perSquadra.get(p.squadra).push(t);
        }

        // 4. y finali: occorrenze (anche quelle non visibili) e nodi dummy
        let yDi = new Map<string, number>();
        tracciaDi.forEach((t, pid) => yDi.set(pid, cima + tracce.indexOf(t) * PaohRelaxedGraph.PASSO_TRACCIA));
        this.getNodesByType(nodeTypes.PERSON_OCCURENCE).forEach((n: any) => {
            let y = yDi.get(String(n.get("person")));
            if (y !== undefined) n.y = y;
        });
        Object.entries(this.personIdToPath || {}).forEach(([pid, path]: [string, any]) => {
            let y = yDi.get(String(pid));
            if (y === undefined || !path || !path.links) return;
            path.links.forEach((l: any) => {
                [l.source, l.target].forEach((n: any) => {
                    let nodo = typeof n === "string" ? this.getNode(n) : n;
                    if (nodo && nodo.type === "dummy") nodo.y = y;
                });
            });
        });

        this.statoTracce = {calciatori: info.size, tracce: tracce.length};
    }

    getWidth() {
        let width = 0;
        for (let rank of this.ranks) {
            let columns = this.rankToColumns[rank];
            let nColumns: number = columns.length;
            width += renderingParameters.COLUMN_WIDTH * nColumns;
        }

        width += (this.ranks.length - 1) * this.rankGapSize;
        return width;
    }

    transformHyperedgesPersons() {
        this.getNodesByType(nodeTypes.HYPEREDGE).forEach(he => {
            he["persons"] = he["persons"].map(personTimeNode => {
                let [personId, time] = OssatureGraph.parseUniquePersonNode(personTimeNode.id);
                let personOccurrenceId = PaohRelaxedGraph.generatePersonOccurenceNodeId(he.id, personId);
                let personOccurrenceNode = this.getNode(personOccurrenceId);
                return personOccurrenceNode;
            })
        })
    }

    // ordine cronologico: nello stesso time step gli eventi di una partita vanno da sinistra a destra per minuto, uno per colonna
    static ORDINE_CRONOLOGICO: boolean = true;

    // "90+4" -> 90.04, "45+2" -> 45.02; senza minuto va in fondo alla partita
    static minutoNumerico(minuto): number {
        if (minuto === undefined || minuto === null || minuto === "") return 1000;
        let parti = String(minuto).trim().split("+");
        let base = parseInt(parti[0], 10);
        if (isNaN(base)) return 1000;
        let recupero = parti.length > 1 ? (parseInt(parti[1], 10) || 0) : 0;
        return base + recupero / 100;
    }

    documentiInOrdine(): string[] {
        let ids: string[] = this.bipDynGraph.documents(true);
        if (!PaohRelaxedGraph.ORDINE_CRONOLOGICO) return ids;

        let info = ids.map((id, i) => {
            let nodo: any = this.bipDynGraph.getNode(id);
            let ossatura: any = this.ossatureGraph.idToNode[id];
            return {
                id, i,
                rank: ossatura ? ossatura.rank : 0,
                partita: nodo ? nodo.get("match") : undefined,
                minuto: PaohRelaxedGraph.minutoNumerico(nodo ? nodo.get("minute") : undefined),
            };
        });
        if (!info.some(d => d.partita !== undefined && d.partita !== null)) return ids;

        // le partite mantengono l'ordine in cui compaiono nel dataset
        let primaComparsa: Record<string, number> = {};
        info.forEach(d => {
            if (d.partita !== undefined && d.partita !== null && !(d.partita in primaComparsa)) primaComparsa[d.partita] = d.i;
        });
        let ordinePartita = d => (d.partita !== undefined && d.partita !== null) ? primaComparsa[d.partita] : d.i;

        info.sort((a, b) =>
            (a.rank - b.rank) ||
            (ordinePartita(a) - ordinePartita(b)) ||
            (a.minuto - b.minuto) ||
            (a.i - b.i));
        return info.map(d => d.id);
    }

    computeColumn(hyperedge, rank, colonnaMinima: number = 0): Column {
        let columns = this.rankToColumns[rank];
        if (!columns) {
            let column = new Column(this.bipDynGraph, 0);
            this.rankToColumns[rank] = [column];
            column.addHyperedge(hyperedge);
            return column;
        }

        for (let i = colonnaMinima; i < columns.length; i++) {
            let column = columns[i];
            if (column.canHyperedgeFit(hyperedge)) {
                column.addHyperedge(hyperedge);
                return column;
            }
        }

        // nessuna colonna libera: se ne aggiungono fino ad arrivare almeno a colonnaMinima
        while (columns.length < colonnaMinima) columns.push(new Column(this.bipDynGraph, columns.length));
        let columnNumber = columns.length;
        let column = new Column(this.bipDynGraph, columnNumber);
        column.addHyperedge(hyperedge);
        columns.push(column);

        return column;
    }

    createOccurencePersonNodes(documentNode, hyperedge, personTimeNodes, rank, columnNumber) {
        personTimeNodes.sort((a, b) => a.get("y") - b.get("y"));

        personTimeNodes.forEach(personTimeNode => {
            let [personId, time] = OssatureGraph.parseUniquePersonNode(personTimeNode.id);
            let id = PaohRelaxedGraph.generatePersonOccurenceNodeId(documentNode.id, personId);
            let personNode = this.bipDynGraph.getNode(personId) as PersonNode;

            let neighbors = this.bipDynGraph.getNeighbors(personNode.id, true) as LayeredNode[];
            let attributes = {
                "person": personId,
                "personName": personNode.name,
                "document": documentNode.id,
                "time": time,
                "label": personNode.get("name"),
                "weight": neighbors.length,
                "columnNumber": columnNumber
            };

            let y: number;
            if (this.isStratifiedDataset()) {
                y = this.getDynamicY(personId, personNode);
            } else {
                y = personTimeNode.get("y");
            }

            let width = renderingParameters.getPaohPersonOccurrenceWidth();
            let personOccurrenceNode = new PersonOccurrenceNode(id, rank, attributes, nodeTypes.PERSON_OCCURENCE, null, y, width, width);
            this.addNode(personOccurrenceNode);
            this.addLink(new Link(hyperedge, personOccurrenceNode));
        });
    }

    // assignRankCoordinates(rankGapSize = renderingParameters.RANK_GAP_SIZE, rankSize = this.rankSize) {
    assignRankCoordinates(rankGapSize, rankSize) {
        this.rankGapSize = rankGapSize;
        this.rankSize = rankSize;


        this.cumulativeColumnsNumber = 0;
        for (let rank of this.ranks) {
            let nodes = this.nodesAtRank(rank);
            if (nodes) { // some ranks are empty
                nodes.forEach(node => {
                    let x = this.rankToX(rank, node.get("columnNumber"));
                    node.x = x
                });
            }

            let columns = this.rankToColumns[rank];
            let nColumns: number = columns.length;
            this.cumulativeColumnsNumber += nColumns;
        }
        this.cumulativeColumnsNumber = 0;
    }

    rankToNPreviousColumns(rank): number {
        let rankSum = 0;
        for (let i = 0; i <= this.ranks.length; i++) {
            if (this.ranks[i] == rank) break;
            if (this.rankToColumns[i]) {
                rankSum += this.rankToColumns[i].length;
            }
        }
        return rankSum;
    }

    rankToX(rank, columnNumber=0): number {
        let cumulativeColNumber: number = this.cumulativeColumnsNumber ? this.cumulativeColumnsNumber : this.rankToNPreviousColumns(rank);
        // let cumulativeColNumber: number = this.rankToNPreviousColumns(rank);
        let x = (cumulativeColNumber + columnNumber) * renderingParameters.COLUMN_WIDTH + rank * (this.rankGapSize);
        // let x = (this.cumulativeColumnsNumber + columnNumber) * renderingParameters.COLUMN_WIDTH + rank * (this.rankGapSize) + (2 * rank + 1) * this.rankSize / 2;
        return x;
    }

    rankToNColumns(rank) {
        return this.rankToColumns[rank].length;
    }

    createPathsOnOccurences(): void {
        this.personIdToPath = {};
        this.bipDynGraph.persons(true).forEach(personId => this.personIdToPath[personId] = new Path(this));

        for (let [personId, rankToHyperedges] of Object.entries(this.personToRankToHyperedge)) {
            let lastNode: LayeredNode;
            let j = -1;
            let rankAndHyperedges = Object.entries(rankToHyperedges);

            // stessa riga delle occorrenze del calciatore (serve il nodo per trovare il livello)
            let fixedY = this.isStratifiedDataset() ? this.getDynamicY(personId, this.bipDynGraph.getNode(personId)) : 0;

            for (let [r, hyperedges] of rankAndHyperedges) {
                let rank: number = Number(r);
                j++;
                let currentHyperedge: HyperEdge = hyperedges[0];

                let currentPersonOccurrence: LayeredNode;
                let iStart: number;
                if (currentHyperedge.columnNumber != 0 && j != 0) {
                    let dummyY = this.isStratifiedDataset() ? fixedY : currentHyperedge.person(personId).get("y");
                    currentPersonOccurrence = new LayeredNode(`${personId}_${rank}_0`, rank, {"columnNumber": 0}, "dummy", null, dummyY);
                    this.addNode(currentPersonOccurrence);
                    iStart = 0;
                } else {
                    currentPersonOccurrence = currentHyperedge.person(personId);
                    iStart = 1;
                }

                if (lastNode) {
                    let link = new Link(lastNode.id, currentPersonOccurrence.id, linkTypes.PERSON_SAME_RANK, null, null);
                    this.addLink(link);
                    this.personIdToPath[personId].addLink(link);
                } else {
                    lastNode = currentPersonOccurrence;
                }

                let nColumns: number = this.rankToColumns[rank].length;
                for (let i = iStart; i <= hyperedges.length; i++) {
                    if (i == hyperedges.length) {
                        if (lastNode.get("columnNumber") != nColumns && j < rankAndHyperedges.length - 1) {
                            let dummyY = this.isStratifiedDataset() ? fixedY : currentHyperedge.person(personId).get("y");
                            currentPersonOccurrence = new LayeredNode(`${personId}_${rank}_last`, rank, {"columnNumber": nColumns}, "dummy", null, dummyY);
                            this.addNode(currentPersonOccurrence);
                        } else {
                            break;
                        }
                    } else {
                        currentHyperedge = hyperedges[i];
                        currentPersonOccurrence = currentHyperedge.person(personId);
                    }

                    let link = new Link(lastNode.id, currentPersonOccurrence.id, linkTypes.PERSON_SAME_RANK, null, null);
                    this.addLink(link);
                    this.personIdToPath[personId].addLink(link);
                    lastNode = currentPersonOccurrence;
                }
            }
        }
    }

    // TODO: currently broken
    createPathsWithRowFilling(): void {
        this.personIdToPath = {};
        this.bipDynGraph.persons(true).forEach(personId => this.personIdToPath[personId] = new Path(this));

        for (let [personId, rankToHyperedges] of Object.entries(this.personToRankToHyperedge)) {
            let lastNode: LayeredNode;
            for (let [rank, hyperedges] of Object.entries(rankToHyperedges)) {
                let xStart = this.rankToX(rank, 0)
                let dummyNodeStart = new LayeredNode(`${personId}_${rank}_0`, rank, {"columnNumber": 0}, "dummy", xStart, hyperedges[0].person(personId).get("y"));

                let xEnd = this.rankToX(rank, this.rankToNColumns(rank))
                let dummyNodeEnd = new LayeredNode(`${personId}_${rank}_1`, rank, {"columnNumber": this.rankToNColumns(rank)}, "dummy", xEnd, hyperedges[0].person(personId).get("y"));
                this.addNode(dummyNodeStart);
                this.addNode(dummyNodeEnd);

                if (lastNode) {
                    let linkBetweenRanks = new Link(lastNode.id, dummyNodeStart.id, linkTypes.CROSS_RANK, null, null);
                    this.addLink(linkBetweenRanks);
                    this.personIdToPath[personId].addLink(linkBetweenRanks);
                }

                let rankLink = new Link(dummyNodeStart.id, dummyNodeEnd.id, linkTypes.CROSS_RANK, null, null);
                this.addLink(rankLink);

                this.personIdToPath[personId].addLink(rankLink);
                lastNode = dummyNodeEnd
            }
        }
    }

    createPaths(): void {
        this.createPathsOnOccurences();
        // this.createPathsWithRowFilling();
    }

    xToTime(x) {
        let i = 0;
        for (let time of this.bipDynGraph.times.slice(0, -1)) {
            let xTime = this.timeToPosition(time);
            let xTime2 = this.timeToPosition(this.bipDynGraph.times[i + 1]);
            if (x > xTime && x < xTime2) return time;
            i++
        }
        return null;
    }

    timeToRank(time: number) {
        // time = Number(time);
        return this.ranks[this.bipDynGraph.times.indexOf(time)];
    }

    timeToPosition(time) {
        let rank = this.timeToRank(time);
        return this.rankToX(rank);
    }

    static generatePersonOccurenceNodeId(documentId, personId) {
        return `${personId}_${documentId}`;
    }

    generatePersonUniqueNode(personId, time) {
        return `${personId}_${time}_unique`;
    }
}
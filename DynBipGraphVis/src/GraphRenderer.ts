import * as d3 from 'd3';

import {globals, linkTypes, nodeTypes} from "./globals";
import {renderingParameters} from "./RenderingParameters";
import NodeInfoPanelManager from "./Panels/NodeInfoPanelManager";
import RoleLegendPanelManager from "./Panels/RoleLegendPanelManager";
import {Occlusion} from "./Occlusion";
import {LayeredGraph, LayeredNode, Link, Path, BipartiteDynGraph} from "dynbipgraph";
import InteractionController from "./InteractionController";
import AggregateVis from "./AggregateVis";
import LabelMapper from "./LabelMapper";
import PathSelectionner, {Intersection} from "./PathSelectionner";

export default abstract class GraphRenderer {
    svg: d3.Selection<any, any, any, any>;
    width: number;
    height: number;

    // DATA
    bipDynGraph: BipartiteDynGraph;
    graph: LayeredGraph;
    ossatureGraph: LayeredGraph;

    // D3 SELECTIONS
    gLinks: d3.Selection<any, any, any, any>;
    gNodes: d3.Selection<any, any, any, any>;
    gBackground: d3.Selection<any, any, any, any>;
    gOthers: d3.Selection<any, any, any, any>;

    nodes: d3.Selection<any, any, any, any>;
    links: d3.Selection<any, any, any, any>;
    nodeLabels: d3.Selection<any, any, any, any>;
    xAxisg: d3.Selection<any, any, any, any>;


    // UTILS
    zoom: d3.ZoomBehavior<any, any>
    transform: d3.ZoomTransform = {x: 0, y: 0, k: 1};
    occlusion: Occlusion;
    labelMapper: LabelMapper;
    selectedPersonsIds: Array<string> = [];

    // VIS VARIABLES
    renderLabels: boolean = true;
    // renderLabels: boolean = false;
    renderOssature: boolean = false;
    // this.renderOssature = true;
    documentPropertyToRender = null;
    personPropertyToRender: string | null = null;


    interactionController: InteractionController;
    aggregateVis: AggregateVis;

    private roleColorScale: d3.ScaleOrdinal<string, string>;
    private teamColorScale: d3.ScaleOrdinal<string, string>;

    private nodeInfoPanelManager: NodeInfoPanelManager;
    private roleLegendPanelManager: RoleLegendPanelManager;
    pathSelectionner: PathSelectionner;
    activeIntersections: Intersection[] = [];

    constructor(svg) {
        this.svg = svg

        let el = this.svg.node();
        this.width = el.getBoundingClientRect().width;
        this.height = el.getBoundingClientRect().height;

        // this.
        this.gBackground = this.svg.append("g");
        this.gLinks = this.svg.append("g")
            .attr("class", "links");
        this.gNodes = this.svg.append("g")
            .attr("class", "nodes")
        this.gOthers = this.svg.append("g").attr("id", "others")

        this.xAxisg = this.svg.append("g");

        this.transform = d3.zoomIdentity;
        this.occlusion = new Occlusion();
    }

    setInteractionController(controller) {
        this.interactionController = controller;
    }

    getTransform = () => {
        return this.transform;
    }

    init() {
        //


    }

    setup() {
        this.setupZoom();

        this.roleColorScale = d3.scaleOrdinal(d3.schemeCategory10);

        // TODO: duplication with what is in widegt manager
        let teams = this.bipDynGraph.links.map(l => l.get("team"))
        teams = [...new Set(teams)]

        // Only use original selected teams
        if (this.bipDynGraph.metadata.teams) {
            teams = teams.filter(t => this.bipDynGraph.metadata.teams.includes(t))
            teams.sort();
        }

        // 48 colori distinti, uno per nazionale
        const colors = [
            "#030395",
            "#602276",
            "#762D22",
            "#1F1FF9",
            "#953403",
            "#BB1A25",
            "#337622",
            "#1A70BB",
            "#6B7622",
            "#13856E",
            "#F91F67",
            "#1F84F9",
            "#6E9503",
            "#F91FF9",
            "#30A65F",
            "#E27B36",
            "#EA70E2",
            "#EAA170",
            "#56D005",
            "#80DAB6",
            "#EAD270",
            "#B9EA70",
            "#5FFA74",
            "#B0F91F",
            "#133185",
            "#762254",
            "#224F76",
            "#95038B",
            "#0549D0",
            "#BB1A65",
            "#955B03",
            "#A21FF9",
            "#038195",
            "#039503",
            "#9D5FFA",
            "#F91FA2",
            "#F9591F",
            "#A480DA",
            "#EA7078",
            "#DA80B6",
            "#80A4DA",
            "#BBBB1A",
            "#F9B01F",
            "#1FDCF9",
            "#1FF91F",
            "#1FF9B0",
            "#1FF9EA",
            "#F9F91F"
        ]

        // PAOHVIS COLOR SCALE
        this.teamColorScale = d3.scaleOrdinal()
            .domain(teams)
            .range(colors)
            .unknown("#DDDDDD");


        // USE THIS FOR MORE CONTRAST COLOR SCALE
        // this.teamColorScale.range(d3.schemeCategory10) // disattivato: solo 10 colori
        // i dataset stratificati hanno pochi livelli: bastano i 10 colori di d3
        if (this.modalitaStratificata()) this.teamColorScale.range(d3.schemeCategory10);

        // this.teamColorScale = d3.scaleOrdinal(d3.schemeCategory10)
        // this.teamColorScale = d3.scaleOrdinal(d3.schemePastel1)
        //     .domain(teams)
        //     .unknown("grey");


        this.nodeInfoPanelManager = new NodeInfoPanelManager("#inside-panel");
        // this.roleLegendPanelManager = new RoleLegendPanelManager("#role-legend-panel", this.roleColorScale);

        this.svg.on("click", (e) => {
            if (this.pathSelectionner.mouseUpClicked) {
                this.pathSelectionner.mouseUpClicked = false;
            } else {
                this.interactionController.personTable.addPathToPersons(new Map(), new Map());
                this.interactionController.pathSelectionMode = false;
                this.pathSelectionner.removePaths();

                this.interactionController.resetAllSelections(true);

                if (this.renderSelectionLabels) this.renderSelectionLabels();
            }
        })
        // if (this.renderOssature) {
        //     this.gNodes.style("opacity", 0.2)
        //     this.gLinks.style("opacity", 0.2)
        // }
    }

    // true con i dataset a livelli (vedi PaohRelaxedGraph.isStratifiedDataset)
    modalitaStratificata(): boolean {
        let g: any = this.graph;
        return !!(g && g.isStratifiedDataset && g.isStratifiedDataset());
    }

    setupZoom() {
        let self = this;
        this.zoom = d3.zoom()
            .on("zoom", this.interactionController.zoomAction)
            .filter((e) => { 
                if (e.type === 'mousedown') {
                    if (e.which == 2) return true;
                } else if (e.type == "wheel") {
                    return true
                }
                return false;
            });

        this.svg
            .call(this.zoom)
            .on("dblclick.zoom", null);

        // dataset stratificati: vista d'insieme, tutta la linea temporale entra nello schermo
        // (ripetuta una volta dopo, se nel frattempo il layout non era ancora pronto e l'utente non ha mosso la vista)
        let applicata: any = null;
        const vistaStratificata = () => {
            if (!self.graph || !self.modalitaStratificata()) return;
            if (applicata && self.transform && (self.transform.k !== applicata.k || self.transform.x !== applicata.x || self.transform.y !== applicata.y)) return;
            if ((self as any).adattaVista) (self as any).adattaVista(false, true);
            applicata = self.transform;
        };
        setTimeout(vistaStratificata, 400);
        setTimeout(vistaStratificata, 1500);
    }

    // zoom e spostamento

    // attesa in ms dopo l'ultimo zoom prima di riposizionare le etichette
    RITARDO_OCCLUSIONE = 150;

    private zoomFotogrammaInAttesa = false;
    private ultimoKApplicato: number = NaN;
    private timerOcclusione: any = null;

    zoomAction(e, d) {
        // la trasformazione si salva sempre (la usano getTransform e pathSelectionner)
        this.transform = e.transform;

        if (this.zoomFotogrammaInAttesa) return;
        this.zoomFotogrammaInAttesa = true;
        requestAnimationFrame(() => {
            this.zoomFotogrammaInAttesa = false;
            this.applicaZoom();
        });
    }

    // applica la trasformazione corrente, al massimo una volta per frame
    applicaZoom() {
        let t = this.transform;

        // spostamento e zoom dei gruppi
        this.gBackground.attr("transform", t);
        this.gNodes.attr("transform", t);
        this.gLinks.attr("transform", t);
        this.gOthers.attr("transform", t);
        this.xAxisg.attr("transform", t);

        // da qui in poi dipende solo dal fattore di zoom k
        if (t.k !== this.ultimoKApplicato) {
            this.ultimoKApplicato = t.k;
            this.applicaDimensioniZoom();
        }

        // etichette: riposizionate solo a zoom fermo
        if (this.interactionController.forceShownLabels.length == 0 && !this.modalitaStratificata()) {
            if (this.timerOcclusione) clearTimeout(this.timerOcclusione);
            this.timerOcclusione = setTimeout(() => {
                this.timerOcclusione = null;
                (this as any).runOcclusion();
            }, this.RITARDO_OCCLUSIONE);
        }
    }

    // dimensioni che compensano lo zoom (testi di grandezza costante)
    applicaDimensioniZoom() {
        let k = this.transform.k;

        // le etichette degli assi e dei nodi mantengono la stessa grandezza a schermo
        this.xAxisg.selectAll("text").attr("transform", `scale(${1 / k})`);

        (this as any).nodeLabelsSelection()
            .style("font-size", `${renderingParameters.TEXT_SIZE / k}px`);

        this.gNodes.selectAll(".selLabel")
            .style("font-size", d => (this as any).nodeLabelSize(d));

        this.gLinks.selectAll(`.arcCrossTime`)
            .attr("stroke-width", d => this.arcStrokeWidth(d));

        // anche la seconda linea delle sostituzioni
        this.gNodes.selectAll(`.${nodeTypes.HYPEREDGE}, .substitution-line`)
            .attr("stroke-width", d => this.hyperedgeStrokeWidth());
    }

    // spessore del percorso di un calciatore allo zoom corrente (usato anche da PaohRelaxedVis)
    arcStrokeWidth(d) {
        let k = this.transform.k;
        let base = this.interactionController.isPersonHighlighted(d[0])
            ? renderingParameters.line_stroke_width_highlighted()
            : renderingParameters.LINE_STROKE_WIDTH;
        return k < 1 ? base / (k * 2.2) : base;
    }

    // spessore della linea di un iperarco allo zoom corrente
    hyperedgeStrokeWidth() {
        return renderingParameters.getPaohDocumentLineWidth() / (this.transform.k * 1.3);
    }

    nodesToRender() {
        return this.graph.nodes.filter(node => !node.disabled);
    }

    render() {
        this.ultimoKApplicato = NaN;
        this.backgroundRender();
        this.nodesRender();
        this.linksRender();

        // this.roleLegendPanelManager.render();
    }

    abstract nodesRender(): void

    abstract linksRender(): void

    abstract backgroundRender(): void

    renderPersonProperty = (property) => {
        this.personPropertyToRender = property;
        this.render();
    }

    unrenderPersonProperty = () => {
        this.personPropertyToRender = null;
        this.render();
    }

    renderDocumentProperty = (property) => {
        this.documentPropertyToRender = property;
        this.render();
    }

    unrenderDocumentProperty = () => {
        this.documentPropertyToRender = null;
        this.render();
    }

    refresh() {
        if (this.occlusion.isInit() && !this.modalitaStratificata()) this.occlusion.run();
    }

    getHeight() {
        // console.log(this.gNodes.node().getBoundingClientRect());
        return this.gNodes.node().getBoundingClientRect().height
    }

    getWidth() {
        return this.gNodes.node().getBoundingClientRect().width
    }
}
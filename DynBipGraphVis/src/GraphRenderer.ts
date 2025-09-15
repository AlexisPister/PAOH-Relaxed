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

        // Colorrs from PAOHVis
        const colors = [
            "#b3cde3",
            "#fbb4ae",
    "#ccebc5",
    "#decbe4",
    "#fed9a6",
    "#ffffcc",
    "#8DD3C7",
            "#fddaec",
            "#FDB462",
            "#BEBADA"
]

        // PAOHVIS COLOR SCALE
        this.teamColorScale = d3.scaleOrdinal()
            .domain(teams)
            .range(colors)
            .unknown("#DDDDDD");


        // USE THIS FOR MORE CONTRAST COLOR SCALE
        this.teamColorScale.range(d3.schemeCategory10)

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

    setupZoom() {
        this.zoom = d3.zoom()
            // .scaleExtent([0.02, 6])
            // .on("zoom", this.zoomAction)
            .on("zoom", this.interactionController.zoomAction)
            .filter((e) => { // allows mousedown event and thus the panning only with wheel. wheel event is for zoom
                if (e.type === 'mousedown') {
                    if (e.which == 2) {
                        return true;
                    }
                } else if (e.type == "wheel") {
                    return true
                }
                return false;
            })


        this.svg
            .call(this.zoom)
            .on("dblclick.zoom", null)
            // .on("mousedown.zoom", null)
            // .on("touchstart.zoom", null)
            // .on("touchmove.zoom", null)
            // .on("touchend.zoom", null);
    }

    zoomAction(e, d) {
        this.transform = e.transform;

        this.gBackground.attr("transform", e.transform);
        this.gNodes.attr("transform", e.transform);
        this.gLinks.attr("transform", e.transform);
        this.gOthers.attr("transform", e.transform);

        this.xAxisg.attr("transform", e.transform);
        this.xAxisg.selectAll("text").attr("transform", `scale(${1 / this.transform.k})`) // axis label must always have the same size, even after zoom action

        // this.gLinks.selectAll(".link")
        //     .attr("stroke-width", this.linksStrokeWidth());

        // if (this.nodeLabels) {
        //     // TODO CHANGE
        //     this.nodeLabels
        //         .style("font-size", `${16 / this.transform.k}px`)
        //     // .attr("x", this.nodeLabelX(d))
        //     // .attr("y", this.nodeLabelY(d))
        //
        //     this.occlusion.run(this.nodeLabels);
        // }

        this.nodeLabelsSelection()
            .style("font-size", `${renderingParameters.TEXT_SIZE / this.transform.k}px`)

        this.gNodes.selectAll(".selLabel")
            .style("font-size", d => {
                return this.nodeLabelSize(d);
            })


        // ZOOM ACTION ON SIZES
        // const fZoom = (k) =>  Math.(Math.log10(this.transform.k) + 1)



        // this.gNodes.selectAll(`.${nodeTypes.HYPEREDGE}`)
        //         .attr("stroke-width", d => renderingParameters.getPaohDocumentLineWidth() / this.transform.k)
        //


        // console.log(this.transform.k)
        if (this.transform.k < 1) {
            this.gNodes.selectAll(`.${nodeTypes.PERSON_OCCURENCE}`)
                .attr("r", d => renderingParameters.getPaohPersonOccurrenceWidth() / (3 * this.transform.k))
                // .attr("stroke-width", d => 2)
                .attr("stroke-width", d => (this.interactionController.isPersonHighlighted(d.get("person")) ? 5 : 1) / (5 * this.transform.k))



            this.gLinks.selectAll(`.arcCrossTime`)
                .attr("stroke-width", (d) => {
                    if (this.interactionController.isPersonHighlighted(d[0])) {
                        return renderingParameters.line_stroke_width_highlighted() / (this.transform.k * 2.2)
                    } else {
                        return renderingParameters.LINE_STROKE_WIDTH / (this.transform.k * 2.2)
                    }
                })
        } else {
            this.gNodes.selectAll(`.${nodeTypes.PERSON_OCCURENCE}`)
                .attr("r", d => renderingParameters.getPaohPersonOccurrenceWidth())

            this.gLinks.selectAll(`.arcCrossTime`)
                .attr("stroke-width", (d) => {
                    if (this.interactionController.isPersonHighlighted(d[0])) {
                        return renderingParameters.line_stroke_width_highlighted()
                    } else {
                        return renderingParameters.LINE_STROKE_WIDTH
                    }
                })
        }
        this.gNodes.selectAll(`.${nodeTypes.HYPEREDGE}`)
                .attr("stroke-width", d => renderingParameters.getPaohDocumentLineWidth() / (this.transform.k * 1.3))


        if (this.interactionController.forceShownLabels.length == 0) {
            this.runOcclusion();
        }
    }

    nodesToRender() {
        return this.graph.nodes.filter(node => !node.disabled);
    }

    render() {
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
        this.occlusion.run();
    }

    getHeight() {
        // console.log(this.gNodes.node().getBoundingClientRect());
        return this.gNodes.node().getBoundingClientRect().height
    }

    getWidth() {
        return this.gNodes.node().getBoundingClientRect().width
    }
}
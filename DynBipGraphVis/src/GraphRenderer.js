import * as d3 from 'd3';
import { renderingParameters } from "./RenderingParameters";
import NodeInfoPanelManager from "./Panels/NodeInfoPanelManager";
import RoleLegendPanelManager from "./Panels/RoleLegendPanelManager";
import { Occlusion } from "./Occlusion";
export default class GraphRenderer {
    svg;
    width;
    height;
    // DATA
    bipDynGraph;
    graph;
    ossatureGraph;
    // D3 SELECTIONS
    gLinks;
    gNodes;
    nodes;
    links;
    nodeLabels;
    xAxisg;
    // UTILS
    zoom;
    transform = { x: 0, y: 0, k: 1 };
    occlusion;
    selectedPersonsIds = [];
    // VIS VARIABLES
    renderLabels = true;
    // renderLabels: boolean = false;
    renderOssature = false;
    // this.renderOssature = true;
    // this.renderLabels = false;
    documentPropertyToRender = null;
    interactionController;
    aggregateVis;
    constructor(svg) {
        this.svg = svg;
        let el = this.svg.node();
        this.width = el.getBoundingClientRect().width;
        this.height = el.getBoundingClientRect().height;
        this.gLinks = this.svg.append("g")
            .attr("class", "links");
        this.gNodes = this.svg.append("g")
            .attr("class", "nodes");
        this.xAxisg = this.svg.append("g");
        this.transform = d3.zoomIdentity;
        this.occlusion = new Occlusion();
    }
    setInteractionController(controller) {
        this.interactionController = controller;
    }
    setup() {
        this.setupZoom();
        this.roleColorScale = d3.scaleOrdinal(d3.schemeCategory10);
        this.nodeInfoPanelManager = new NodeInfoPanelManager("#inside-panel");
        this.roleLegendPanelManager = new RoleLegendPanelManager("#role-legend-panel", this.roleColorScale);
        // if (this.renderOssature) {
        //     this.gNodes.style("opacity", 0.2)
        //     this.gLinks.style("opacity", 0.2)
        // }
    }
    setupZoom() {
        this.zoom = d3.zoom()
            // .translateExtent([[-3000, -1000000], [1000000, 1000000]])
            // .translateExtent([[-1000000, -1000000], [4000, 1000000]])
            // .scaleExtent([0.02, 6])
            // .on("zoom", this.zoomAction)
            .on("zoom", this.interactionController.zoomAction);
        this.svg
            .call(this.zoom);
    }
    zoomAction = (e, d) => {
        this.transform = e.transform;
        this.gNodes.attr("transform", e.transform);
        this.gLinks.attr("transform", e.transform);
        this.xAxisg.attr("transform", e.transform);
        this.xAxisg.selectAll("text").attr("transform", `scale(${1 / this.transform.k})`); // axis label must always have the same size, even after zoom action
        // this.gLinks.selectAll(".link")
        //     .attr("stroke-width", this.linksStrokeWidth());
        if (this.nodeLabels) {
            // TODO CHANGE
            this.nodeLabels
                .style("font-size", `${16 / this.transform.k}px`);
            // .attr("x", this.nodeLabelX(d))
            // .attr("y", this.nodeLabelY(d))
            this.occlusion.run(this.nodeLabels);
        }
        // this.aggregateVis.zoomAction();
    };
    nodesToRender() {
        return this.graph.nodes.filter(node => !node.disabled);
    }
    render() {
        this.nodesRender();
        this.linksRender();
        // this.roleLegendPanelManager.render();
    }
    resetHighlight = () => {
        this.gNodes
            .selectAll(".nodeGroup")
            .style("opacity", 1);
        this.gLinks.selectAll(".link")
            .style("opacity", 1);
    };
    togglePersonSelection = (personId) => {
        // TODO: for one person now, see later for multi select
        // this.aggregateVis.renderPerson(personId)
        if (this.selectedPersonsIds.includes(personId)) {
            this.selectedPersonsIds = this.selectedPersonsIds.filter(nId => personId != nId);
        }
        else {
            this.selectedPersonsIds.push(personId);
        }
        if (this.selectedPersonsIds.length == 0) {
            this.resetHighlight();
        }
        else {
            this.highlightPersons();
        }
    };
    highlightPersons() {
        this.gNodes
            .selectAll(".nodeGroup")
            // .filter(d => d.type == nodeTypes.PERSON_OCCURENCE || d.type == globals.ROW_MATRICE_NODE)
            .style("opacity", (d) => {
            if (this.selectedPersonsIds.includes(d.get("person"))) {
                return 1;
            }
            else {
                return renderingParameters.UNHIGHLIGHT_OPACITY;
            }
        });
    }
    renderDocumentProperty = (property) => {
        this.documentPropertyToRender = property;
        this.render();
    };
    unrenderDocumentProperty = () => {
        this.documentPropertyToRender = null;
        this.render();
    };
}

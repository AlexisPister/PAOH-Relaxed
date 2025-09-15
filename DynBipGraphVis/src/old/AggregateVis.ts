import * as d3 from 'd3';
import {globals} from "./globals";
import {renderingParameters} from "./RenderingParameters";
import InteractionController from "./InteractionController";
import {LayeredGraph, LayeredNode, Link, Path, BipartiteDynGraph} from "dynbipgraph";


export default class AggregateVis {
    svg: d3.Selection<any, any, any, any>;
    mainG: d3.Selection<any, any, any, any>;

    bipDynGraph: BipartiteDynGraph;
    graph: LayeredGraph;

    interactionController: InteractionController;
    // height: number = 100;
    height: number = 20;
    fontSize: number = 24;


    constructor(svg, bipDynGraph: BipartiteDynGraph, graph: LayeredGraph) {
        this.svg = svg;
        this.bipDynGraph = bipDynGraph;
        this.graph = graph;
        this.init();
    }

    setInteractionController(controller) {
        this.interactionController = controller;
    }

    init() {
        this.mainG = this.svg.append("g")
        this.collaboratorLines = null;

        this.resize();
    }

    resize() {
        this.svg.attr("width", "100vw") //TODO: change
            .attr("height", this.height)
            .style("background-color", "rgb(100, 100, 100, 0.2)")
        // .attr("viewBox", "0,0,150,100")
    }

    setup() {
        this.timeToDocuments = {};
        this.bipDynGraph.times.forEach(ts => {
            let rank = this.graph.timeToRank(ts);
            let x = this.graph.timeToPosition(ts);
            let documentNodes = this.graph.nodesAtRank(rank).filter(node => node.type == globals.DOCUMENT);
            this.timeToDocuments[ts] = documentNodes;
        })

        let maxNumberDocument = Math.max(...Object.values(this.timeToDocuments).map(documents => documents.length))
        this.documentsScale = d3.scaleLinear()
            .domain([0, maxNumberDocument])
            .range([0, this.height - this.height / 8])

        this.heightOfDocument = this.height / maxNumberDocument;
    }

    zoomAction = (e, d) => {
        let transform = e.transform;
        this.mainG.attr("transform", `translate(${transform.x}, 0) scale(${transform.k})`); // works but change the height

        this.mainG
            .selectAll("text")
            .style("font-size", `${this.fontSize / transform.k}px`)
            .attr("y", this.height / transform.k - this.height / 2)

        // this.documents
        //     .selectAll(".histogramBar")
        //     .attr("y", d => this.height / this.interactionController.getTransform().k - this.documentsNHeight(d))
        //     .attr("height", d => this.documentsNHeight(d))

        if (this.collaboratorLines) {
            // this.collaboratorLines
            //     .call(this.mainVis.zoom.scaleBy, 1 / this.interactionController.getTransform.k)

            // this.collaboratorLines
            //     .attr("transform", `translate(${-transform.x} ,0) scale(${1 / transform.k})`)
            //     // .attr("transform", `scale(${1 / transform.k})`)

            let that = this;
            this.collaborationRect
                .attr("y", function (d) {
                    let parentData = that.getParentDatum(d3.select(this))
                    let position = Object.keys(that.collaborators).indexOf(parentData)
                    return that.collaboratorPositionScale(position) / that.transform().k
                })
                .attr("height", d => this.collaborationRectHeight(d))
        }
    }

    // TODO : finish
    render() {
        console.log(1111)
        // this.times = this.mainG
        //     .selectAll(".time", true)
        //     .data(this.bipDynGraph.times)
        //     .join((enter) => {
        //         let g = enter.append('g')
        //
        //         g.append("text")
        //             .text((d) => d)
        //             .attr("x", d => this.graph.timeToPosition(d))
        //             .attr("y", d => 15)
        //
        //         return enter
        //     })

        // this.documents = this.mainG
        this.timeGroups = this.mainG
            .selectAll(".timeGroup")
            .data(this.bipDynGraph.times)
            .join((enter) => {
                let g = enter.append('g')

                g.append("text")
                    .text((d) => d)
                    .attr("x", d => {
                        return this.graph.timeToPosition(d)
                    })
                    .attr("y", d => this.height / 2)
                    .style("font-size", `${this.fontSize}px`)


                g.append("rect")
                    .attr("x", d => this.graph.timeToPosition(d) - this.graph.rankSize / 2)
                    .attr("y", d => this.height - this.documentsNHeight(d))
                    .attr("width", d => this.graph.rankSize)
                    .attr("height", d => this.documentsNHeight(d))
                    .classed("histogramBar", true)

                return g
            }, (update) => {
                // update.selectAll("text")
                //     .attr("x", d => this.graph.timeToPosition(d))
                // // .attr("y", d => 15)
                //
                // update.selectAll("rect")
                //     .attr("x", d => this.graph.timeToPosition(d) - this.graph.rankSize / 2)

                return update
            })
            .classed("timeGroup", true)
            .classed("occluded", false)

        // Person:
        // this.persons = this.mainG
        //     .selectAll(".person", true)
        //     .data(this.bipDynGraph.times)
        //     .join((enter) => {
    }

    renderPerson(personId) {
        this.documents
            .classed("occluded", true)

        // TODO: finish
        this.collaborators = this.bipDynGraph.personCollaboratorsByTime(personId);

        // Order
        this.collaborators = Object.fromEntries(Object.entries(this.collaborators).sort((a, b) => {
            return this.numberOfCollab(b[1]) - this.numberOfCollab(a[1]);
        }))
        // console.log(collaborators);

        this.collaboratorPositionScale = d3.scaleLinear().domain([0, 8]).range([10, this.height]);

        let that = this;
        this.collaboratorLines = this.mainG
            .selectAll(".collab-occurrence")
            .data(Object.keys(this.collaborators))
            .join((enter) => {
                let g = enter.append("g")

                g.append("text")
                    .text(d => d)
                    .attr("x", (d) => {
                        return -this.graph.rankSize
                    })
                    .attr("y", (d, i) => {
                        return this.collaboratorPositionScale(i)
                    })

                return g
            })
            .classed("collab-occurrence", true)

        this.collaborationRect = this.collaboratorLines
            .selectAll(".collab-time")
            .data(d => Object.entries(this.collaborators[d])) // d[0] time d[1] links
            .join("rect")
            .attr("x", function (d) {
                return that.graph.timeToPosition(d[0]) - that.graph.rankSize / 2
            })
            .attr("y", function (d) {
                let parentData = that.getParentDatum(d3.select(this))
                let position = Object.keys(that.collaborators).indexOf(parentData)
                return that.collaboratorPositionScale(position) / that.transform().k
            })
            .attr("width", d => this.graph.rankSize)
            .attr("height", d => this.collaborationRectHeight(d))
            .classed("collab-time", true)
    }

    getParentDatum = (currentSel) => {
        return currentSel.node().parentNode.__data__;
        // return currentSel.node().parentNode.parentNode.__data__;
    }

    numberOfCollab(a) {
        return Object.values(a).reduce((a, b) => a + b.length, 0);
    }

    documentsNHeight(d) {
        return this.documentsScale(this.timeToDocuments[d].length) / this.interactionController.getTransform().k;
    }

    collaborationRectHeight = (d) => {
        return 5 * d[1].length / this.interactionController.getTransform().k
    }
}
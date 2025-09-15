import * as d3 from 'd3';

import {globals} from "./globals";
import RenderingParameters, {renderingParameters} from "./RenderingParameters";
import {getKeyByValueMap} from "./utils";
import NodeInfoPanelManager from "./Panels/NodeInfoPanelManager";
import OssatureGraph from "./OssatureGraph";
import RoleLegendPanelManager from "./Panels/RoleLegendPanelManager";
import PropertyPanelManager from "./Panels/PropertyPanelManager";
import {TemporalMatrixGrouper, MatrixGrouper} from "./MatrixGrouper";
import {Occlusion} from "./Occlusion";


// Paths tests: https://jsfiddle.net/dx0fn82j/13/
// https://codepen.io/fuzzycat444/pen/dyXxKJQ
export default class DynBipGraphVis {
    constructor(svg) {
        this.svg = svg;

        let el = this.svg.node();
        this.width = el.getBoundingClientRect().width;
        this.height = el.getBoundingClientRect().height;

        this.gLinks = this.svg.append("g")
            .attr("class", "links");
        this.gNodes = this.svg.append("g")
            .attr("class", "nodes")

        this.xAxisg = this.svg.append("g");

        this.transform = d3.zoomIdentity;

        this.occlusion = new Occlusion();
    }

    setAggregateVis(aggregateVis) {
        this.aggregateVis = aggregateVis;
    }

    init(bipDynGraph, temporalGraph, ossatureGraph) {
        this.bipDynGraph = bipDynGraph;
        this.graph = temporalGraph;
        this.ossatureGraph = ossatureGraph;
    }

    setup() {
        this.initVariables();
        this.setupZoom();
        this.setupArcScale();
        this.setupArcColorScale();
        this.setupAxis();

        this.roleColorScale = d3.scaleOrdinal(d3.schemeCategory10);

        this.nodeInfoPanelManager = new NodeInfoPanelManager("#inside-panel");
        this.roleLegendPanelManager = new RoleLegendPanelManager("#role-legend-panel", this.roleColorScale);

        // try {
        //     this.matrixGrouper = new TemporalMatrixGrouper(this.graph, this.ossatureGraph, this.bipDynGraph);
        //     let temporalMat = this.matrixGrouper.run(["a22", "a23", "a16", "a26", "a21", "a60", "a73", "a33", "a50", "a53", "a52", "a55"]);
        //     temporalMat.addToGraph(this.graph);
        //     this.render();
        // } catch (e) {
        //     console.log(e);
        // }
    }

    renderDocumentProperty = (property) => {
        this.documentPropertyToRender = property;
        this.render();
    }

    unrenderDocumentProperty = () => {
        this.documentPropertyToRender = null;
        this.render();
    }

    initVariables() {
        this.renderOssature = false;
        // this.renderOssature = true;
        this.renderLabels = true;
        // this.renderLabels = false;
        this.documentPropertyToRender = null;
        this.selectedPersonsIds = [];

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
            .on("zoom", this.zoomAction)

        this.svg
            .call(this.zoom);
    }

    zoomAction = (e, d) => {
        this.transform = e.transform;

        this.gNodes.attr("transform", e.transform);
        this.gLinks.attr("transform", e.transform);

        this.xAxisg.attr("transform", e.transform);
        this.xAxisg.selectAll("text").attr("transform", `scale(${1 / this.transform.k})`) // axis label must always have the same size, even after zoom action

        this.gLinks.selectAll(".link")
            .attr("stroke-width", this.linksStrokeWidth());

        // if (this.nodeLabels) {
        //     this.nodeLabels
        //         .style("font-size", `${14 / this.transform.k}px`)
        //
        //     this.occlusion.run(this.nodeLabels);
        // }

        this.aggregateVis.zoomAction();
    }

    setupAxis() {
        this.dateFormat = d3.timeFormat("%Y");
        // console.log(this.dateFormat(this.bipDynGraph.timeMin), this.dateFormat(this.bipDynGraph.timeMax));

        // this.x = d3.scaleTime()
        this.x = d3.scaleLinear()
            // .domain([this.dateFormat(this.bipDynGraph.timeMin), this.dateFormat(this.bipDynGraph.timeMax)])
            .domain([this.bipDynGraph.timeMin, this.bipDynGraph.timeMax])
            // .range([0, this.width])
            .range([0, this.graph.getTotalSize()])

        this.xAxis = g => g
            // .attr("transform", `translate(0,${this.height - margin.bottom})`)
            .attr("transform", `translate(0,0)`)
            .call(g => g.append("text")
                .attr("text-anchor", "end")
                .attr("font-weight", "bold")
                .text("Year"))
            // .call(d3.axisBottom(this.x))
        // .call(d3.axisBottom(this.x).tickFormat(d3.timeFormat("%Y")).ticks(6))
        .call(d3.axisBottom(this.x).ticks(6))

        // this.xAxisg = this.svg.append("g");
        this.xAxisg.call(this.xAxis);
        if (this.transform) {
            this.xAxisg.attr("transform", this.transform);
        }
    }

    getPersonOccurenceWidth() {
        return this.graph.rankSize;
    }

    getPersonOccurenceHeight() {
        // return this.radius * 2;
        return renderingParameters.RADIUS * 2;
    }

    setupArcScale() {
        // this.arcScale = d3.scaleLinear()
        this.arcScale = d3.scaleLog()
            // this.arcScale = d3.scaleSqrt()
            .domain(this.graph.arcLengthMinMax)
            // .range([renderingParameters.ARC_MIN_LENGTH, this.graph.rankGapSize + this.graph.rankSize]);
            .range([renderingParameters.ARC_MIN_LENGTH, 0.8 * this.graph.rankGapSize]);
        // .range([this.arcMinLength, this.graph.rankGapSize + this.graph.rankSize]);
        // .range([this.arcMinLength, this.graph.rankGapSize + this.graph.rankSize / 2]);
    }

    setupArcColorScale() {
        let max = Math.max(...Object.values(this.bipDynGraph.nodeToDegree));
        this.arcColorScale = d3.scaleSequential(d3.interpolateGreys)
            // this.arcColorScale = d3.scaleSequentialLog(d3.interpolateGreys)
            .domain([-2, max]);
        // .domain([max, 0]);

        this.arcStrokeWidthScale = d3.scaleLinear()
            // this.arcColorScale = d3.scaleSequentialLog(d3.interpolateGreys)
            .domain([1, max])
            .range([1, 5])
    }

    nodesToRender() {
        let nodes;
        if (this.documentPropertyToRender) {
            nodes = this.graph.nodes.filter(n => n.type != globals.PERSON_OCCURENCE_NODE);
        } else {
            nodes = this.graph.nodes;
        }
        return nodes.filter(node => !node.disabled);
    }

    render() {
        this.nodesRender();
        this.linksRender();

        this.roleLegendPanelManager.render();
    }


    nodesRender() {
        // Has to render first for z level
        this.renderTemporalMatrices();

        this.nodes = this.gNodes
            .selectAll(".nodeGroup")
            .data(this.nodesToRender(), function (d) {
                return d
            })
            .join((enter) => {
                let g = enter.append('g')
                    .classed('nodeGroup', true)
                    .style("opacity", this.renderOssature ? 0.2 : 1)

                this.renderPersonOccurence(g);
                this.renderDocuments(g);
                this.renderMatrices(g);

                this.renderNodeLabel(g.filter(d => d.type == globals.PERSON_OCCURENCE_NODE));

                return g
            }, (update) => {
                update.selectAll('.nodeRect')
                    .attr("x", d => this.personOccurrenceX(d))
                    .attr("y", d => this.personOccurrenceY(d))

                update.selectAll(".nodeCircle")
                    .attr("cx", d => d.get("x"))
                    .attr("cy", d => d.get("y"))

                update.selectAll("text")
                    .attr("x", d => d.get("x") - renderingParameters.getPersonOccurenceWidth() / 2)
                    .attr("y", d => d.get("y") + renderingParameters.getPersonOccurenceHeight() / 2)

                update.selectAll(`.${globals.DOCUMENT}`)
                    .attr("x", d => this.documentX(d))
                    .attr("y", d => this.documentY(d))

                update.selectAll(`.cell`)
                    .attr("x", d => this.matCellX(d))
                    .attr("y", d => this.matCellY(d))
            })

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
        g
            .filter(d => {
                return d.type == globals.PERSON_OCCURENCE_NODE
            })
            .append("rect")
            .attr("x", d => this.personOccurrenceX(d))
            .attr("y", d => this.personOccurrenceY(d))
            .attr("width", d => this.getPersonOccurenceWidth())
            .attr("height", d => this.getPersonOccurenceHeight())
            .attr("fill", d => {
                // console.log(d, this.bipDynGraph.getNode(d.get("person")));

                let link = getKeyByValueMap(this.bipDynGraph.getNeighbors(d.get("document")), d.get("person"), (a, b) => a == b.id)
                let color = this.roleColorScale(link.type);
                return color;
            })
            .attr("stroke", "black")
            .classed("nodeRect", true)
            .classed("personOccurrence", true)
            .on("mouseover", (e, d, i) => {
                this.togglePersonSelection(d.get("person"));
                this.showPersonTooltip(d.get("person"));
            })
            .on("mouseout", (e, d) => {
                this.togglePersonSelection(d.get("person"));
                this.resetHighlight();
            })
    }

    personOccurrenceX(d) {
        return d.get("x") - this.getPersonOccurenceWidth() / 2;
    }

    personOccurrenceY(d) {
        return d.get("y") - renderingParameters.RADIUS;
    }

    showPersonTooltip(personId) {
        let personNode = this.bipDynGraph.idToNode[personId];
        let toShow = {id: personNode.id, ...personNode.attributes};
        this.nodeInfoPanelManager.render(toShow);
        // this.nodeInfoPanelManager.render(personNode.attributes);
    }

    renderDocuments(g) {
        g.filter(d => d.type == globals.DOCUMENT)
            .append("rect")
            .classed(globals.DOCUMENT, true)
            .attr("x", d => this.documentX(d))
            .attr("y", d => this.documentY(d))
            .attr("width", d => this.documentWidth(d))
            .attr("height", d => this.documentHeight(d))
            .attr("fill", d => {
                if (this.documentPropertyToRender) {
                    let propertyValue = this.bipDynGraph.idToNode[d.id].get(this.documentPropertyToRender.name);
                    return this.documentPropertyToRender.getColorScale()(propertyValue);
                } else {
                    return "white";
                    // return "none";
                }
            })
            .attr("stroke", d => "black")
            .on("mouseover", (e, d, i) => {
                this.showDocumentTooltip(d);
            })
    }

    documentX(d) {
        return d.get("x") - renderingParameters.getPersonOccurenceWidth() / 2 - renderingParameters.DOCUMENT_PADDING;
    }

    documentY(d) {
        return d.get("y") - d.get(globals.SIZE_KEY) / 2;
    }

    documentWidth(d) {
        return renderingParameters.getPersonOccurenceWidth() + 2 * renderingParameters.DOCUMENT_PADDING;
    }

    documentHeight(d) {
        return d.get(globals.SIZE_KEY);
    }

    renderTemporalMatrices() {
        this.temporalMatrices = this.gNodes.selectAll(".temporalMat")
            .data(this.graph.getNodesByType(globals.TEMPORAL_MATRIX), function (d) {
                return d
            })
            .join("rect")
            .attr("x", d => d.x - d.get("width") / 2 - renderingParameters.TEMPORAL_MATRICE_PADDING)
            .attr("y", d => d.y - d.get("nRows") * this.getPersonOccurenceHeight() / 2 - renderingParameters.TEMPORAL_MATRICE_PADDING)
            .attr("width", d => d.get("width") + 2 * renderingParameters.TEMPORAL_MATRICE_PADDING)
            .attr("height", d => d.get("nRows") * this.getPersonOccurenceHeight() + 2 * renderingParameters.TEMPORAL_MATRICE_PADDING)
            .style("fill", d => d.get("color"))
            .style("opacity", 0.3)
            .classed("temporalMat", true)
    }

    resetHighlight = () => {
        this.gNodes
            .selectAll(".nodeGroup")
            .style("opacity", 1);
        this.gLinks.selectAll(".link")
            .style("opacity", 1);

        this.unhighlightMatrices();
    }

    unhighlightMatrices() {
        this.matCells
            .style("opacity", 1)

        this.matriceColumns
            .style("background-color", `rbg(255, 255, 255, 1)`)

        this.matriceRows
            .style("opacity", 1)
    }

    togglePersonSelection = (personId) => {
        // TODO: for one person now, see later for multi select
        this.aggregateVis.renderPerson(personId)

        if (this.selectedPersonsIds.includes(personId)) {
            this.selectedPersonsIds = this.selectedPersonsIds.filter(nId => personId != nId)
        } else {
            this.selectedPersonsIds.push(personId)
        }

        if (this.selectedPersonsIds.length == 0) {
            this.resetHighlight();
        } else {
            this.highlightPersons();
        }
    }

    highlightPersons = () => {
        this.gNodes
            .selectAll(".nodeGroup")
            .filter(d => d.type == globals.PERSON_OCCURENCE_NODE || d.type == globals.ROW_MATRICE_NODE)
            .style("opacity", (d) => {
                if (this.selectedPersonsIds.includes(d.get("person"))) {
                    return 1;
                } else {
                    return renderingParameters.UNHIGHLIGHT_OPACITY;
                }
            });

        this.matCells
            .style("opacity", (d) => {
                if (this.selectedPersonsIds.includes(d[0][1].id)) {
                    return 1;
                } else {
                    return renderingParameters.UNHIGHLIGHT_OPACITY;
                }
            });

        // background color is not inherited contrary to opacity
        this.matriceColumns
            .style("background-color", `rbg(255, 255, 255, ${renderingParameters.UNHIGHLIGHT_OPACITY})`)

        this.matriceRows
            .style("opacity", (d) => {
                let rowPersonId = OssatureGraph.parseUniquePersonNode(d.id)[0]
                if (this.selectedPersonsIds.includes(rowPersonId)) {
                    return 1;
                } else {
                    return renderingParameters.UNHIGHLIGHT_OPACITY;
                }
            });

        this.sameTimeArcs
            .style("opacity", (d) => {
                if (this.selectedPersonsIds.includes(d.source.get("person"))) {
                    return 1;
                } else {
                    return renderingParameters.UNHIGHLIGHT_OPACITY;
                }
            });

        this.crossTimeArcs
            .style("opacity", (d) => {
                if (this.selectedPersonsIds.includes(d[0])) {
                    return 1;
                } else {
                    return renderingParameters.UNHIGHLIGHT_OPACITY;
                }
            });
    }

    // TODO: render matrices using the dummy nodes created before ?
    renderMatrices(g) {
        this.matrices = g.filter(d => d.type == globals.MATRIX)
            .append("g")
            .classed(globals.MATRIX, d => {
                return true
            })

        // other way to get the parent nodes data
        this.matriceRows = this.matrices
            .selectAll(".matriceRow")
            .data(d => d.rowItems)
            .join((enter) => {
                let g2 = enter.append("g")

                let that = this;
                g2.append("rect")
                    .attr("y", function (d, i) {
                        let mat = that.getParentDatum(d3.select(this))
                        return mat.getPersonY(OssatureGraph.parseUniquePersonNode(d.id)[0], that.getPersonOccurenceHeight());
                    })
                    .attr("x", function (d, i) {
                        let mat = that.getParentDatum(d3.select(this))
                        // let x = mat.get("x") - that.cellWidth(mat.nCols()) * mat.nCols() / 2;
                        let x = mat.get("x") - that.cellWidth(mat.nCols());
                        return x;
                    })
                    .attr("width", function(d, i) {
                        let mat = that.getParentDatum(d3.select(this))
                        return that.cellWidth() * mat.nCols()
                    })
                    .attr("height", d => this.cellHeight())
                    .attr("fill", d => {
                        // return "none";
                        return "white";
                    })
                    .attr("stroke", "black")
                    .attr("stroke-width", "1")

                return g2
            })
            .classed("matriceRow", true)
            .on("mouseover", (e, d, i) => {
                let personId = OssatureGraph.parseUniquePersonNode(d.id)[0];
                this.togglePersonSelection(personId);
                this.showPersonTooltip(personId);
            })
            .on("mouseout", (e, d) => {
                let personId = OssatureGraph.parseUniquePersonNode(d.id)[0];
                this.togglePersonSelection(personId);
                this.resetHighlight();
            })

        this.matriceColumns = this.matrices
            .selectAll(".documentColumn")
            .data(d => d.columnItems.map(x => [x, d]))
            .join((enter) => {
                let g = enter.append("g");

                g.append("rect")
                    .attr("y", d => {
                        return d[1].get("y") - this.cellHeight() * d[1].nRows() / 2;
                    })
                    .attr("x", d => {
                        let position = d[1].columnItemPosition(d[0].id);
                        let x = d[1].get("x") - this.graph.rankSize / 2 + this.cellWidth(d[1].nCols()) * position;
                        return x;
                    })
                    .attr("width", d => this.cellWidth(d[1].nCols()))
                    .attr("height", d => this.cellHeight() * d[1].nRows())
                    .attr("fill", d => {
                        if (this.documentPropertyToRender) {
                            let propertyValue = this.bipDynGraph.idToNode[d[0].id].get(this.documentPropertyToRender.name);
                            return this.documentPropertyToRender.getColorScale()(propertyValue);
                        } else {
                            return "none";
                            // return "white";
                        }
                    })
                    .attr("stroke", "black")
                    .attr("stroke-width", "1")

                return g
            })
            .classed("documentColumn", true)
            .style("pointer-events", "none");

        this.matCells = this.matriceColumns
            .selectAll(".cell")
            .data(d => Array.from(this.bipDynGraph.getNeighbors(d[0].id).entries()).map(x => [x, d[0], d[1]]))
            .join("rect")
            .classed("cell", true)
            .attr("y", d => { // d[0] is [Link, Node], d[1] document node, d[2] is the matrix node
                let yCell = d[2].getPersonY(d[0][1].id, this.getPersonOccurenceHeight());
                return yCell;
            })
            .attr("x", d => {
                let position = d[2].columnItemPosition(d[1].id);
                let x = d[1].get("x") - this.graph.rankSize / 2 + this.cellWidth(d[2].nCols()) * position;
                return x;
            })
            .attr("width", d => this.cellWidth(d[2].nCols()))
            .attr("height", this.cellHeight())
            .style("fill", d => {
                return this.roleColorScale(d[0][0].type);
            })
            .style("pointer-events", "none");
    }

    getParentDatum = (currentSel) => {
        // console.log(g.node().parentNode)
        // return g.node().parentNode.__data__;
        return currentSel.node().parentNode.parentNode.__data__;
    }

    matCellX = (d) => {
        let position = d[2].columnItemPosition(d[1].id);
        let x = d[1].get("x") - this.graph.rankSize / 2 + this.cellWidth(d[2].nCols()) * position;
        return x;
    }

    matCellY = (d) => {
        let yCell = d[2].getPersonY(d[0][1].id, this.getPersonOccurenceHeight());
        return yCell;
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

    renderNodeLabel(g) {
        if (!this.renderLabels) {
            return;
        }

        this.nodeLabels = g.filter(d => this.nodesToRenderLabel().includes(d.id))
            .filter(d => d.get("x") && d.get("y"))
            .append('text')
            .attr('class', 'data-text')
            .text((d) => {
                return this.bipDynGraph.idToNode[d.get("person")].get("name");
            })
            .attr("x", d => d.get("x") - renderingParameters.getPersonOccurenceWidth() / 2)
            .attr("y", d => d.get("y") + renderingParameters.getPersonOccurenceHeight() / 2)
            // .style("fill", "white")
            .style("fill", "black")
            // .style("font-size", "normal")
            // .style("font-size", `${14 / this.transform.k}px`)
            .on("mouseover", (e, d, i) => {
                this.togglePersonSelection(d.get("person"));
                this.showPersonTooltip(d.get("person"));
            })
            .on("mouseout", (e, d) => {
                this.togglePersonSelection(d.get("person"));
                this.resetHighlight();
            })

        if (!this.occlusion.isInit()) {
            this.occlusion.run(this.nodeLabels)
        }
    }

    nodesToRenderLabel() {
        // Return first and last occurence of each path
        return Object.values(this.graph.personToPath).filter(path => path.links.length > 0)
            .map(path => {
                return [path.links[0].source.id, path.links[path.links.length - 1].target.id]
            })
            .reduce((a, b) => a.concat(b));
    }

    linksRender() {
        if (this.renderOssature) {
            // console.log(1, JSON.parse(JSON.stringify(this.ossatureGraph.getLinks(globals.DOCUMENT_MENTION_LINK))));
            this.documentMentionLinks = this.gLinks
                .selectAll(".documentMentionLinks")
                .data(this.ossatureGraph.getLinks(globals.DOCUMENT_MENTION_LINK))
                .join('line')
                // .classed("link", true)
                .classed("documentMentionLinks", true)
                .attr("stroke", "gray")
                .attr("stroke-width", "1")
                .attr("x1", d => {
                    return Math.round(d.source.get("x"))
                })
                .attr("y1", d => {
                    return Math.round(d.source.get("y"))
                })
                .attr("x2", d => d.target.get("x"))
                .attr("y2", d => d.target.get("y"))

            this.personTimeLinks = this.gLinks
                .selectAll(".personTimeLinkz")
                .data(this.ossatureGraph.getLinks(globals.PERSON_TIME_LINK))
                .join('line')
                // .classed("link", true)
                .classed("personTimeLink", true)
                .attr("stroke", "red")
                .attr("stroke-width", "2")
                .attr("x1", d => d.source.get("x"))
                .attr("y1", d => d.source.get("y"))
                .attr("x2", d => d.target.get("x"))
                .attr("y2", d => d.target.get("y"))
        }

        // Arcs
        this.sameTimeArcs = this.gLinks
            .selectAll('.arc')
            .data(this.graph.getLinks(globals.ARC_LINK))
            .join('path')
            .attr('d', (d) => {
                let distance = Math.abs(d.source.get("y") - d.target.get("y"));
                let start = d.source.get("y");
                let end = d.target.get("y");
                return ['M', d.source.get("x") - this.getPersonOccurenceWidth() / 2, start,  // TODO: SHOULD NOT BE THESE VALUES
                    'A',
                    this.arcScale(distance), ',',
                    (start - end) / 2, 0, 0, ',',
                    start < end ? 0 : 1, d.target.get("x") - this.getPersonOccurenceWidth() / 2, ',', end] // We always want the arc on top. So if end is before start, putting 0 here turn the arc upside down.
                    .join(' ');
            })
            .style("fill", "none")
            .attr("stroke-width", d => {

                // Width proportional to degree
                // let personId = d.source.get("person");
                // return this.arcStrokeWidthScale(this.bipDynGraph.nodeToDegree[personId])

                return this.linksStrokeWidth();
                // return 2;
            })
            // .attr("stroke", d => {
            //     let personId = d.source.get("person");
            //     return this.arcColorScale(this.bipDynGraph.nodeToDegree[personId]);
            // })
            // .attr("stroke", d => {
            //     return this.arcColorScale(d.get(globals.PRESENCE_KEY));
            // })
            .attr("stroke", "black")
            .classed("arc", true)
            .classed("link", true)

        this.personLinesRender();

        this.gLinks.selectAll(".link")
        .style("opacity", this.renderOssature ? 0.2 : 1)
    }

    linksStrokeWidth() {
        return 1 / this.transform.k / 1.5;
    }

    personLinesRender() {
        this.crossTimeArcs = this.gLinks
            .selectAll('.arcCrossTime')
            .data(Object.entries(this.graph.personToPath).filter(d => d[1].links.length > 0))
            .join('path')
            .attr('d', (d) => {
                // let dPath = d[1].toCatmullPath()
                let dPath = d[1].toCatmullPathDoublePoints(0.5, this.getPersonOccurenceWidth() / 2)
                return dPath;
            })
            .attr("stroke", "black")
            .attr("stroke-width", () => {
                return this.linksStrokeWidth();
            })
            .attr("fill", "transparent")
            .attr("stroke-dasharray", "10,10")
            .classed("arcCrossTime", true)
            .classed("link", true)


        // this.gLinks
        //     .selectAll('.arcCrossTime')
        //     .data(this.graph.getLinks(globals.CROSSTIME_ARC))
        //     .join('path')
        //     .attr('d',  (d) => {
        //         // console.log(d);
        //         let [person, time] = [d.source.get("person"), d.source.get("time")];
        //         let uniquePersonNodeId = this.getUniquePersonNodeId(person, time);
        //         let uniquePersonNode = this.graph.idToNode[uniquePersonNodeId];
        //
        //         let [y1, y2, y3] = [d.source.get("y"), uniquePersonNode.get("y"), d.target.get("y")].map(n => Math.round(n));
        //         let [x1, x2, x3] = [d.source.get("x"), uniquePersonNode.get("x"), d.target.get("x")].map(n => Math.round(n));
        //
        //         if ((y2 < y1) ^ (y2 < y3)) {
        //             let [xInflexion, yInflexion] = this.computeInflexionPointDifferentSides(x1, x2, x3, y1, y2, y3);
        //             return ['M', x1, y1,
        //                 'Q',
        //                 xInflexion, yInflexion,
        //                 x2, y2,
        //                 "T",
        //             x3, y3] // We always want the arc on top. So if end is before start, putting 0 here turn the arc upside down.
        //             .join(' ');
        //         } else { // same side
        //             let [xInflexion, yInflexion] = this.computeInflexionPointSameSide(x1, x2, x3, y1, y2, y3);
        //             return ['M', x1, y1,
        //                 'Q',
        //                 xInflexion, yInflexion,
        //             x3, y3] // We always want the arc on top. So if end is before start, putting 0 here turn the arc upside down.
        //             .join(' ');
        //         }
        //     })
        //     .style("fill", "none")
        //     .attr("stroke", "red")

        // this.personLinks = this.gLinks
        //     .selectAll(".personLink")
        //     .data(this.graph.getLinks(globals.CROSSTIME_ARC))
        //     .join('line')
        //     .classed("link", true)
        //     .attr("stroke", "red")
        //     .attr("stroke-width", "1")
        //     .attr("x1", d => d.source.get("x"))
        //     .attr("y1", d => d.source.get("y"))
        //     .attr("x2", d => d.target.get("x"))
        //     .attr("y2", d => d.target.get("y"))
    }

    computeInflexionPointDifferentSides(x1, x2, x3, y1, y2, y3) {
        let x = Math.round(x2);
        let y = Math.round(y2);
        return [x, y];
    }

    computeInflexionPointSameSide(x1, x2, x3, y1, y2, y3) {
        let x, y;
        if ((y2 < y1) && (y2 < y3)) {
            x = (x3 - x1) / 2 + x1;
            y = y2 - (Math.min(y1, y3) - y2) - (Math.abs(y2 - y1) / 2);
        } else if ((y2 >= y1) && (y2 >= y3)) {
            x = (x3 - x1) / 2 + x1;
            // x = x2;
            y = y2 + (y2 - Math.max(y1, y3)) + Math.abs(y2 - y1) / 2;
        }

        return [Math.round(x), Math.round(y)];
    }

    parseNodeId(nodeId) {
        let data = nodeId.split("_");
        let [person, document, time] = [data[0], data[1], data[2]];
        return [person, document, time];
    }

    getUniquePersonNodeId(person, time) {
        return `${person}_${time}_unique`;
    }
}
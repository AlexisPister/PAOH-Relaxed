import { globals, linkTypes, nodeTypes } from "./globals";
import { renderingParameters } from "./RenderingParameters";
import { getKeyByValueMap } from "./utils";
import OssatureGraph from "./OssatureGraph";
import GraphRenderer from "./GraphRenderer";
export default class PaohRelaxedVis extends GraphRenderer {
    // Visualization Variables
    personOccurrenceAsCircle = true;
    documentAsLine = false;
    // documentAsLine: boolean = true;
    constructor(svg) {
        super(svg);
    }
    init(bipDynGraph, graph, ossatureGraph) {
        this.bipDynGraph = bipDynGraph;
        this.graph = graph;
        this.ossatureGraph = ossatureGraph;
    }
    nodesRender() {
        this.nodes = this.gNodes
            .selectAll(".nodeGroup")
            .data(this.nodesToRender(), d => d)
            .join((enter) => {
            let g = enter.append('g')
                .classed('nodeGroup', true)
                .style("opacity", this.renderOssature ? 0.2 : 1);
            this.renderPersonOccurence(g);
            this.renderDocuments(g);
            this.renderNodeLabel(g.filter(d => d.type == nodeTypes.PERSON_OCCURENCE));
            return g;
        }, (update) => {
            update.selectAll('.nodeRect')
                .attr("x", d => this.personOccurrenceX(d))
                .attr("y", d => this.personOccurrenceY(d));
            update.selectAll(".nodeCircle")
                .attr("cx", d => d.get("x"))
                .attr("cy", d => d.get("y"));
            update.selectAll("text")
                .attr("x", d => d.get("x") - renderingParameters.getPersonOccurenceWidth() / 2)
                .attr("y", d => d.get("y") + renderingParameters.getPersonOccurenceHeight() / 2);
            update.selectAll(`.${globals.DOCUMENT}`)
                .attr("x", d => this.documentX(d))
                .attr("y", d => this.documentY(d));
            update.selectAll(`.cell`)
                .attr("x", d => this.matCellX(d))
                .attr("y", d => this.matCellY(d));
            return update;
        });
        if (this.renderOssature) {
            this.gNodes
                .selectAll(".nodeGroupOssature")
                .data(this.ossatureGraph.nodes, function (d) {
                return d;
            })
                .join((enter) => {
                let g = enter.append('g')
                    .classed('nodeGroupOssature', true);
                g
                    .filter(d => d.type == globals.PERSON_TIME)
                    .append("circle")
                    .attr("cx", d => d.get("x"))
                    .attr("cy", d => d.get("y"))
                    .attr("r", d => this.getPersonOccurenceWidth() / 4)
                    .attr("stroke", "black")
                    .attr("fill", "white");
                g
                    .filter(d => d.type == globals.DOCUMENT)
                    .append("rect")
                    .attr("x", d => this.documentX(d))
                    .attr("y", d => this.documentY(d))
                    .attr("width", d => this.documentWidth(d))
                    .attr("height", d => this.documentHeight(d))
                    .attr("stroke", "black")
                    .attr("fill", "white");
                return g;
            });
        }
    }
    renderPersonOccurence(g) {
        if (this.personOccurrenceAsCircle) {
            g
                .filter(d => d.type == nodeTypes.PERSON_OCCURENCE)
                .append("circle")
                .attr("cx", d => this.personOccurrenceXCenter(d))
                .attr("cy", d => this.personOccurrenceYCenter(d))
                .attr("r", d => renderingParameters.getPaohPersonOccurrenceWidth() / 2)
                .attr("fill", d => {
                let link = getKeyByValueMap(this.bipDynGraph.getNeighbors(d.get("document")), d.get("person"), (a, b) => a == b.id);
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
            });
        }
        else {
            g
                .filter(d => {
                return d.type == nodeTypes.PERSON_OCCURENCE;
            })
                .append("rect")
                .attr("x", d => this.personOccurrenceX(d))
                .attr("y", d => this.personOccurrenceY(d))
                .attr("width", d => this.getPersonOccurenceWidth())
                .attr("height", d => this.getPersonOccurenceHeight())
                .attr("fill", d => {
                // console.log(d, this.bipDynGraph.getNode(d.get("person")));
                let link = getKeyByValueMap(this.bipDynGraph.getNeighbors(d.get("document")), d.get("person"), (a, b) => a == b.id);
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
            });
        }
    }
    personOccurrenceX(d) {
        return d.get("x");
    }
    personOccurrenceXCenter(d) {
        // console.log(d, d.get("x"), d.x)
        // return d.get("x") + renderingParameters.getPaohPersonOccurrenceWidth() / 2;
        return d.x + renderingParameters.getPaohPersonOccurrenceWidth() / 2;
        // return d.x + renderingParameters.getPaohPersonOccurrenceWidth() / 2;
    }
    personOccurrenceY(d) {
        return d.get("y");
    }
    personOccurrenceYCenter(d) {
        return d.get("y") + renderingParameters.getPaohPersonOccurrenceWidth() / 2;
    }
    showPersonTooltip(personId) {
        let personNode = this.bipDynGraph.idToNode[personId];
        let toShow = { id: personNode.id, ...personNode.attributes };
        this.nodeInfoPanelManager.render(toShow);
        // this.nodeInfoPanelManager.render(personNode.attributes);
    }
    renderDocuments(g) {
        if (this.documentAsLine) {
            g.filter(d => d.type == nodeTypes.HYPEREDGE)
                .append("line")
                .classed(globals.DOCUMENT, true)
                .attr("x1", d => this.documentXCenter(d))
                .attr("x2", d => this.documentXCenter(d))
                .attr("y1", d => d.bounds[0])
                .attr("y2", d => d.bounds[1])
                .attr("stroke", d => "black")
                .attr("stroke-width", d => renderingParameters.getPaohDocumentLineWidth())
                .on("mouseover", (e, d, i) => {
                this.showDocumentTooltip(d);
            });
        }
        else {
            g.filter(d => d.type == nodeTypes.HYPEREDGE)
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
                }
                else {
                    // return "white";
                    // return "none";
                    return "rgb(10, 10, 10, 0.25)";
                }
            })
                .attr("stroke", d => "black")
                .on("mouseover", (e, d, i) => {
                this.showDocumentTooltip(d);
            });
        }
    }
    documentXCenter(d) {
        // return d.get("x") + this.documentWidth(d) / 2;
        return d.get("x") + renderingParameters.getPaohPersonOccurrenceWidth() / 2;
    }
    documentX(d) {
        return d.get("x");
    }
    documentY(d) {
        return d.get("y");
    }
    documentWidth(d) {
        return renderingParameters.COLUMN_WIDTH;
    }
    documentHeight(d) {
        return d.bounds[1] - d.bounds[0] + renderingParameters.getPaohPersonOccurrenceWidth();
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
        return this.graph.rankSize / 2;
    }
    showDocumentTooltip(d) {
        let documentNode = this.bipDynGraph.idToNode[d.id];
        let toShow = { id: documentNode.id, ...documentNode.attributes };
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
            .attr("x", d => this.nodeLabelX(d))
            .attr("y", d => this.nodeLabelY(d))
            // .style("fill", "white")
            .style("fill", "black")
            // .style("font-size", "normal")
            .style("font-size", d => this.nodeLabelSize(d))
            .on("mouseover", (e, d, i) => {
            this.togglePersonSelection(d.get("person"));
            this.showPersonTooltip(d.get("person"));
        })
            .on("mouseout", (e, d) => {
            this.togglePersonSelection(d.get("person"));
            this.resetHighlight();
        });
        if (!this.occlusion.isInit()) {
            this.occlusion.run(this.nodeLabels);
        }
    }
    nodeLabelX(d) {
        return d.get("x") - renderingParameters.getPaohPersonOccurrenceWidth() * 2.5 - this.transform.x;
    }
    nodeLabelY(d) {
        return d.get("y") + renderingParameters.getPersonOccurenceHeight() / 2;
    }
    nodeLabelSize(d) {
        return `${16 / this.transform.k}px`;
    }
    nodesToRenderLabel() {
        // Return first and last occurence of each path
        return Object.values(this.graph.personIdToPath).filter(path => path.links.length > 0)
            .map(path => {
            return [path.links[0].source.id, path.links[path.links.length - 1].target.id];
        })
            .reduce((a, b) => a.concat(b));
        // return this.graph.nodes.map(n => n.id);
    }
    linksRender() {
        // this.personLinesRender();
        this.personPathsRender();
    }
    personLinesRender() {
        this.crossTimeArcs = this.gLinks
            .selectAll('.arcCrossTime')
            .data(this.graph.getLinks(linkTypes.CROSS_RANK))
            .join('line')
            .attr("x1", d => this.personOccurrenceXCenter(d.source))
            .attr("x2", d => this.personOccurrenceXCenter(d.target))
            .attr("y1", d => this.personOccurrenceYCenter(d.source))
            .attr("y2", d => this.personOccurrenceYCenter(d.target))
            .attr("stroke", "black")
            .attr("fill", "transparent")
            // .attr("stroke-dasharray", "10,10")
            .classed("arcCrossTime", true)
            .classed("link", true);
    }
    personPathsRender() {
        this.crossTimeArcs = this.gLinks
            .selectAll('.arcCrossTime')
            .data(Object.entries(this.graph.personIdToPath).filter(d => d[1].links.length > 0))
            .join('path')
            .attr('d', (d) => {
            let offset = renderingParameters.getPaohPersonOccurrenceWidth() / 2;
            let dPath = d[1].toCatmullPath(0.5, offset, offset);
            // console.log(d, d[1].getPoints(offset, offset));
            return dPath;
        })
            .attr("stroke", "black")
            // .attr("stroke", "rgb(60, 60, 60, 1)")
            .attr("stroke", "rgb(60, 60, 60, 0.6)")
            .attr("stroke-width", () => {
            return renderingParameters.LINE_STROKE_WIDTH;
            // return renderingParameters.getPaohPersonOccurrenceWidth()
        })
            .attr("fill", "transparent")
            // .attr("stroke-dasharray", "10,10")
            .classed("arcCrossTime", true)
            .classed("link", true);
    }
    highlightPersons() {
        super.highlightPersons();
        this.crossTimeArcs.style("opacity", (d) => {
            if (this.selectedPersonsIds.includes(d[0])) {
                return 1;
            }
            else {
                return renderingParameters.UNHIGHLIGHT_OPACITY;
            }
        });
    }
}

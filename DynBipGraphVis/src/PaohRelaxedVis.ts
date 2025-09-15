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

        this.labelMapper = new LabelMapper(this.graph.getNodesByType(nodeTypes.PERSON_OCCURENCE))
        // this.labelMapper = new LabelMapper(this.nodesToRenderLabel().map(nId => this.graph.getNode(nId)))
        this.labelMapper.run();

        let paths = this.graph.getPaths().map(path => path.toCatmullPath());
        this.pathSelectionner = new PathSelectionner(this.svg, paths, this.intersectedPathsCb, this.getTransform, this.getTimeOfX, this.startPathSelCb, this.endPathSelCb);
    }

    runLabeller() {
        this.labelMapper.run();
    }

    zoomAction(e, d) {
        super.zoomAction(e, d);
        this.pathSelectionner.renderPaths();
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
        this.nodes = this.gNodes
            .selectAll(".nodeGroup")
            .data(this.nodesToRender(), d => d.id)
            .join((enter) => {
                let g = enter.append('g')
                    .classed('nodeGroup', true)
                    .style("opacity", this.renderOssature ? 0.2 : 1)

                this.renderPersonOccurence(g);
                this.renderDocuments(g);

                // RENDER LABELS
                this.renderNodeLabel(g.filter(d => d.type == nodeTypes.PERSON_OCCURENCE));

                return g
            }, (update) => {
                update.select(`.${nodeTypes.PERSON_OCCURENCE}`)
                    .attr("stroke-width", (d) => {
                        return this.interactionController.isPersonHighlighted(d.get("person")) ? 5 : 1
                    })
                    .call(update => update.transition(this.transition())
                        .attr("cx", d => {
                            return this.personOccurrenceXCenter(d)
                        })
                        .attr("cy", d => this.personOccurrenceYCenter(d))
                        .attr("fill", this.fillPersonNode))

                let documents;
                if (this.documentAsLine) {
                    documents = update.select(`.${nodeTypes.HYPEREDGE}`)
                        .call(update => update.transition(this.transition())
                            .attr("x1", d => this.documentXCenter(d))
                            .attr("x2", d => this.documentXCenter(d))
                            .attr("y1", d => d.bounds[0])
                            .attr("y2", d => d.bounds[1]))
                } else {
                    documents = update.select(`.${nodeTypes.HYPEREDGE}`)
                        .call(update => update.transition(this.transition())
                            .attr("x", d => this.documentX(d))
                            .attr("y", d => this.documentY(d))
                            .attr("width", d => this.documentWidth(d))
                            .attr("height", d => this.documentHeight(d)))
                }
                documents
                    .attr("fill", d => {
                        if (this.documentPropertyToRender) {
                            let propertyValue = this.bipDynGraph.idToNode[d.id].get(this.documentPropertyToRender.name);
                            return this.documentPropertyToRender.getColorScale()(propertyValue);
                        } else {
                            return renderingParameters.DOCUMENT_COLOR;
                        }
                    })

                update.select(".person-label")
                    .attr("x", d => {
                        return this.nodeLabelX(d)
                    })
                    .attr("y", d => this.nodeLabelY(d))
                    .style("font-size", d => this.nodeLabelSize(d))
                    .style("font-weight", d => {
                        return this.interactionController.isPersonHighlighted(d.get("person")) ? "bold" : "normal"
                    })
                    .style("display", d => {
                        if (this.renderLabels && this.nodesToRenderLabel().includes(d.id)) {
                            return ""
                        } else {
                            return "none"
                        }
                    })
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
            .style("opacity", d => this.interactionController.computeOpacity(d))
            .on("mousedown", e => {
                e.stopPropagation();
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
        let persons: d3.Selection<HTMLElement, PersonOccurrenceNode, any, any> = g.filter(d => d.type == nodeTypes.PERSON_OCCURENCE)

        if (this.personOccurrenceAsCircle) {
            persons
                .append("circle")
                .attr("cx", d => this.personOccurrenceXCenter(d) - 1)
                .attr("cy", d => this.personOccurrenceYCenter(d) - 1)
                .attr("r", d => renderingParameters.getPaohPersonOccurrenceWidth() / 2)
                .attr("fill", this.fillPersonNode)
                .attr("stroke", "black")
                .classed(nodeTypes.PERSON_OCCURENCE, true)
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
                this.shownLabelNodes.push(d);
                // this.interactionController.render();
                // this.runOcclusion()

                if (!this.interactionController.pathSelectionMode) this.interactionController.showOnePerson(d.get("person"))
            })
            .on("mouseout", (e, d) => {
                if (!this.interactionController.pathSelectionMode) this.interactionController.cancelShowOnePerson(d.get("person"))

                this.shownLabelNodes = this.shownLabelNodes.filter(n => n != d);
                // this.togglePersonSelection(d.get("person"));
                // this.resetHighlight();
            })
            .on("click", (e, d) => {
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

    fillPersonNode = (d) => {
        const renderTeam = true;

        if (this.personPropertyToRender) {
            let propertyValue = this.bipDynGraph.idToNode[d.get("person")].get(this.personPropertyToRender.name);
            return this.personPropertyToRender.getColorScale()(propertyValue);
        } else {

            if (renderTeam) {
                // render team as color
                let link = getKeyByValueMap(this.bipDynGraph.getNeighbors(d.get("document")), d.get("person"), (a, b) => a == b.id)

                let color = this.teamColorScale(link.get("team"));
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
                // .attr("stroke", d => "black")
                .attr("stroke", d => "#777777")
                .attr("stroke-width", d => renderingParameters.getPaohDocumentLineWidth())
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

        documents
            .on("mouseover", (e, d) => {
                if (!this.interactionController.pathSelectionMode) {
                    this.showDocumentTooltip(d);
                    this.interactionController.showOneDocument(d.id)
                }
            })
            .on("mouseout", (e, d) => {
                if (!this.interactionController.pathSelectionMode) this.interactionController.cancelShowOneDoc(d.id)
            })
            .on("dblclick", (e, d) => {
                let personIds = this.bipDynGraph.getNeighbors(d.id, true).map(n => n.id);
                this.updateLayoutCb(personIds);
            })
            .on("click", (e) => {
                e.stopPropagation()
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
            .style("font-size", d => this.nodeLabelSize(d))
            .style("font-weight", d => {
                return this.interactionController.isPersonHighlighted(d.get("person")) ? "bold" : "normal"
            })
            // .style("alignment-baseline", "hanging")
            .style("alignment-baseline", "middle")
            // .style("pointer-events", "none")
            .style("text-anchor", d => {
                if (d.position == Orientations.RIGHT) {
                    return "start"
                } else if (d.position == Orientations.LEFT) {
                    return "end"
                }
            })
            .style("display", d => this.nodesToRenderLabel().includes(d.id) ? "" : "none")
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
        })

        // this.interactionController.render(true);
        // this.runOcclusion();
    }

    runOcclusion() {
        this.occlusion.run(this.nodeLabelsSelection(), this.interactionController.isPersonHighlighted, this.shownLabelNodes, this.getIntersectionLabel);
    }

    nodeLabelsSelection(): d3.Selection<any, any, any, any> {
        let regularLabels = this.svg.selectAll(".person-label");
        let selectionLabels = this.svg.selectAll(".selLabel");

        return d3.selectAll([...regularLabels, ...selectionLabels]);
    }

    nodeLabelX(d) {
        return d.labelX || d.get("x") - renderingParameters.getPaohPersonOccurrenceWidth() * 2.5 - this.transform.x;
        // return d.get("x") - renderingParameters.getPaohPersonOccurrenceWidth() * 2.5 - this.transform.x;
    }

    nodeLabelY(d) {
        return d.labelY || d.get("y") + renderingParameters.getPersonOccurenceHeight() / 2
        // return d.get("y") + renderingParameters.getPersonOccurenceHeight() / 2
    }

    nodeLabelSize(d) {
        if (d instanceof Intersection || this.interactionController.isPersonHighlighted(d.get("person")) || this.shownLabelNodes.includes(d)) {
            return `${renderingParameters.text_size_highlighted() / this.transform.k}px`
        } else {
            return `${renderingParameters.TEXT_SIZE / this.transform.k}px`
        }
    }

    nodesToRenderLabel() {
        // Return first and last occurence of each path
        let nodes = Object.values(this.graph.personIdToPath).filter(path => path.links.length > 0)
            .map(path => {
                return [path.links[0].source.id, path.links[path.links.length - 1].target.id]
            })
            .reduce((a, b) => a.concat(b));

        let nodesWithLabel = nodes.filter(nodeId => {
            let node = this.graph.getNode(nodeId) as Labelled
            return node.labelX && node.labelY
        })

        this.shownLabelNodes.forEach(node => {
            if (!nodesWithLabel.includes(node.id)) {
                nodesWithLabel.push(node.id)
            }
        })

        return nodesWithLabel
    }

    linksRender() {
        // this.personLinesRender();
        this.personPathsRender();
    }

    personPathsRender(): void {
        this.crossTimeArcs = this.gLinks
            .selectAll('.arcCrossTime')
            .data(Object.entries(this.graph.personIdToPath).filter(d => d[1].links.length > 0), d => d[0])
            .join((enter) => {
                return enter.append("path")
                    .attr('d', (d) => {
                        let offset = renderingParameters.getPaohPersonOccurrenceWidth() / 2
                        let dPath = d[1].toCatmullPath(0.5, offset, offset)

                        // let splitPaths = d[1].toCatmullSplitPath(0.5);

                        return dPath
                    })
            }, (update) => {
                update.call((update) => {
                    return update.transition(this.transition()).attr('d', (d) => {
                        let offset = renderingParameters.getPaohPersonOccurrenceWidth() / 2
                        let dPath = d[1].toCatmullPath(0.5, offset, offset)

                        return dPath
                    })
                })
                return update
            })
            // .attr("stroke", "rgb(60, 60, 60, 1)")
            // .attr("stroke", "rgb(60, 60, 60, 0.6)")
            // .attr("stroke", "black")
            .attr("stroke", "gray")
            .attr("stroke-width", (d) => {
                if (this.interactionController.isPersonHighlighted(d[0])) {
                    return renderingParameters.line_stroke_width_highlighted()
                } else {
                    return renderingParameters.LINE_STROKE_WIDTH
                }
            })
            // .attr("fill", "transparent")
            .attr("fill", "none")
            // .attr("stroke-dasharray", "10,10")
            .attr("opacity", (d) => this.pathOpacity(d))
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
import {LayeredGraph, Link, Path} from "dynbipgraph";
import {globals} from "./globals";
import {groupBy} from "lodash";
import {getFirstIndexOfMinValue} from "./utils";
import * as d3 from "d3";
import {renderingParameters} from "./RenderingParameters";


export default class DocumentCentricHypergraph extends LayeredGraph {
    constructor(ossatureGraph, bipDynGraph) {
        super(null);
        this.ossatureGraph = ossatureGraph;
        this.bipDynGraph = bipDynGraph;
    }

    timeToRank(time) {
        time = Number(time);
        return this.ranks[this.bipDynGraph.times.indexOf(time)];
    }

    timeToPosition(time) {
        let rank = this.timeToRank(time);
        return this.rankToX(rank);
    }

    computeMetrics() {
        super.computeMetrics();
        this.arcLengthMinMax = this.minMaxLinkDistance(globals.ARC_LINK);
    }

    aggregateByRank(k) {
        for (let i = 0; i < this.ranks.length; i += k) {
            let aggregatedNodes = [];
            for (let j = i; i < k; j++) {
                let nodes = this.documentCentricHypergraph.nodesAtRank(j);
                this.changeRank(nodes, i / k);
                aggregatedNodes = aggregatedNodes.concat(nodes);
            }
        }

        this.links = [];
        this.createArcs();
        this.createCrossTimeArcs();
    }

    changeRank(nodes, newRank) {
        nodes = nodes.map(n => n.rank = newRank);
    }

    createArcs() {
        this.links = this.links.filter(l => l.type != globals.ARC_LINK);

        for (let i = 0; i < this.ranks.length; i += 1) {
            let rank = this.ranks[i];
            let nodes = this.nodesAtRank(rank)

            if (nodes && nodes.length > 0) {
                let personOccurenceNodes = nodes.filter(n => n.type == globals.PERSON_OCCURENCE_NODE);
                let personToOccurences = groupBy(personOccurenceNodes, (d) => d.get("person"));

                let matrixNodes = nodes.filter(n => n.type == globals.MATRIX);

                for (let personId of Object.keys(personToOccurences)) {
                    let matrixNodesWithPerson = matrixNodes.filter(mat => mat.hasPerson(personId));
                    let dummyNodes = matrixNodesWithPerson.map(mat => mat.getDummyPersonNode(personId));
                    dummyNodes.forEach(dummyNode => this.addNode(dummyNode));
                    personToOccurences[personId] = personToOccurences[personId].concat(dummyNodes).filter(node => !node.disabled);
                }

                for (let [personId, nodes] of Object.entries(personToOccurences)) {
                    let nOccurences = nodes.length; // Number of documents the person appear in the current time
                    nodes.sort((a, b) => a.get("y") - b.get("y"));
                    for (let i = 0; i < nodes.length - 1; i += 1) {
                        let link = new Link(nodes[i].id, nodes[i + 1].id, globals.ARC_LINK, {"presence": nOccurences});
                        this.addLink(link);
                    }
                }
            }
        }
    }

    createCrossTimeArcs() {
        this.links = this.links.filter(l => l.type != globals.CROSSTIME_ARC);

        this.personToPath = {};
        this.bipDynGraph.persons(true).forEach(personId => this.personToPath[personId] = new Path(this));

        for (let personId of this.bipDynGraph.persons(true)) {
            // TODO: USE RANKS ONLY
            let timeToDocuments = this.bipDynGraph.personDocumentsByTime(personId);
            let i = 0;
            let timeDocumentsTuples = Object.entries(timeToDocuments);
            for (let [time, documents] of timeDocumentsTuples) {

                // inflexion point
                let personLineNodeId = this.generatePersonUniqueNode(personId, time);
                let personLineNode = this.ossatureGraph.idToNode[personLineNodeId];
                let yReference = personLineNode.get("y");

                // if (timeDocumentsTuples[i + 1]) {
                if (timeDocumentsTuples.length > (i + 1)) {
                    let documentsNextTime = timeDocumentsTuples[i + 1][1];

                    let closestPersonOccurrence = this.computeClosestPersonOccurence(documents, yReference, personId, time);
                    let closestPersonOccurrenceT2 = this.computeClosestPersonOccurence(documentsNextTime, yReference, personId, timeDocumentsTuples[i + 1][0]);
                    let link = new Link(closestPersonOccurrence.id, closestPersonOccurrenceT2.id, globals.CROSSTIME_ARC);

                    this.addLink(link);
                    this.personToPath[personId].addLink(link);
                }
                i = i + 1;
            }
        }
    }

    computeClosestPersonOccurence(documents, yReference, personId, time) {
        let rank = this.timeToRank(time);

        let personOccurencesNodes = documents.map(d => d.id)
            .map(documentId => this.idToNode[this.generatePersonOccurenceNodeId(documentId, personId)]).filter(n => n);
        let matriceRowNodes = this.rankToNodes[rank].filter(node => node.type == globals.ROW_MATRICE_NODE).filter(node => node.get("person") == personId);

        let allPersonOccurenceNodes = personOccurencesNodes.concat(matriceRowNodes).filter(node => !node.disabled);

        let personOccurencesY = allPersonOccurenceNodes
            .map(node => node.get("y"))

        let dy = personOccurencesY.map(y => Math.abs(yReference - y));

        let minIndex = getFirstIndexOfMinValue(dy);
        let closestPersonOccurence = allPersonOccurenceNodes[minIndex];

        return closestPersonOccurence;
    }

    clearMatrices() {
        // this.nodes = this.nodes.filter(n => ![globals.MATRIX, globals.ROW_MATRICE_NODE, globals.COLUMNS_MATRICE_NODE].includes(n));
        [globals.MATRIX, globals.ROW_MATRICE_NODE, globals.COLUMNS_MATRICE_NODE].forEach(type => {
            let nodes = this.getNodesByType(type);
            this.removeNodes(nodes.map(n => n.id));
        })
        this.nodes.forEach(n => n.disabled = false)
    }

    overlapRemoval() {
        // Apply 1d Node overlap removal algorithm
        // this.overlapRemovalNodes(nodes,"width")

        this.overlapRemovalD3();
        this.updatePersonOccurrencePosition();
    }

    overlapRemovalD3() {
        this.documentToY = {};
        let documentNodes = this.nodes.filter(node => [globals.DOCUMENT].includes(node.type));
        documentNodes.forEach(documentNode => {
            let y = documentNode.get("y");
            this.documentToY[documentNode.id] = y;
        })

        this.nodes.forEach(n => {
            if (n.get("x")) n["x"] = n.get("x");
            if (n.get("y")) n["y"] = n.get("y");
            // n["x"] = n.get("x");
            // n["y"] = n.get("y");
        })

        this.getNodesByType(globals.PERSON_OCCURENCE_NODE).forEach(n => {
            n["fy"] = n.get("y");
            n["fx"] = n.get("x");
        })

        for (let i = 0; i < this.ranks.length; i += 1) {
            let rank = this.ranks[i];
            let nodes = this.nodesAtRank(rank);
            nodes = nodes.filter(node => [globals.MATRIX, globals.DOCUMENT].includes(node.type));

            nodes.filter(n => n.type == globals.MATRIX).forEach(n => {
                n["fy"] = n.y;
                n["fx"] = n.x;
            })

            this.simulation = d3.forceSimulation(nodes)
                .force("collision", d3.forceCollide().radius((d) => {
                    if (d.type == globals.MATRIX) {
                        return renderingParameters.getPersonOccurenceHeight() * d.nRows() / 2 + renderingParameters.DOCUMENT_GAP / 2
                    } else {
                        return d.get(globals.SIZE_KEY) / 2 + renderingParameters.DOCUMENT_GAP / 2
                    }
                }))
                .force("x", d3.forceX((d) => {
                    return d.get("x");
                }))

            for (let i in d3.range(100)) {
                this.simulation.tick();
            }
        }

        this.nodes.forEach(n => {
            // if (n["x"]) n.set("x", n["x"]);
            if (n["y"]) n.set("y", n["y"]);
            // n.set("x", n["x"]);
            // n.set("y", n["y"]);

            // delete n["x"];
            // delete n["y"];
            delete n["vx"];
            delete n["vy"];
        })
    }

    updatePersonOccurrencePosition() {
        for (let personOcc of this.getNodesByType(globals.PERSON_OCCURENCE_NODE)) {
            let documentId = personOcc.get("document")

            let yDoc = this.getNode(documentId).get("y")
            let yPreviousDoc = this.documentToY[documentId]
            let yDiff = yDoc - yPreviousDoc;

            personOcc.set("y", personOcc.get("y") + yDiff);
        }
    }

    generatePersonOccurenceNodeId(documentId, personId) {
        return `${personId}_${documentId}`;
    }

    generatePersonUniqueNode(personId, time) {
        return `${personId}_${time}_unique`;
    }
}
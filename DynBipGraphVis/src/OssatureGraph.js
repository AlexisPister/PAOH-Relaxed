import * as d3 from 'd3';
import {groupBy, cloneDeep} from "lodash";

import {BipartiteDynGraph, Graph, LayeredGraph, LayeredNode, Link, Path} from 'dynbipgraph';
import {globals} from "./globals";
import {renderingParameters} from "./RenderingParameters";
import {getFirstIndexOfMinValue} from "./utils";
import DocumentCentricHypergraph from "./DocumentCentricHypergraph";
import PaohRelaxedGraph from "./PaohRelaxedGraph";


export default class OssatureGraph extends LayeredGraph {
    constructor(jsonData, bipDynGraph) {
        super(jsonData);
        this.bipDynGraph = bipDynGraph;
        this.personOccurenceHeight = renderingParameters.RADIUS * 2;
    }

    static parseUniquePersonNode(nodeId) {
        let split = nodeId.split("_");
        let [personId, time] = [split[0], split[1]];
        return [personId, time]
    }

    // computeMetrics() {
    //     super.computeMetrics();
    //     this.arcLengthMinMax = this.minMaxLinkDistance(globals.ARC_LINK);
    // }

    getPersonNodes(personId) {
        return this.getNodesByType(globals.PERSON_OCCURENCE_NODE).filter(n => n.get("person") == personId);
    }

    transformToPaohRelaxed() {
        this.documentCentricHypergraph = new PaohRelaxedGraph(this, this.bipDynGraph);
    }

    transformToPersonView() {
        this.documentCentricHypergraph = new DocumentCentricHypergraph(this, this.bipDynGraph);

        this.computeDocumentsSize();
        // this.overlapRemoval();

        this.createPersonOccurenceAndDocumentNodes();
        this.documentCentricHypergraph.overlapRemoval();

        this.documentCentricHypergraph.createArcs();
        this.documentCentricHypergraph.createCrossTimeArcs();
        // this.documentCentricHypergraph.computeMetrics();
        this.documentCentricHypergraph.setup();

        return this.documentCentricHypergraph;
    }

    computeDocumentsSize() {
        for (let i = 0; i < this.ranks.length; i += 2) { // iterate only documents
            let rank = this.ranks[i];
            let nodes = this.nodesAtRank(rank);

            nodes.forEach(node => {
                node.set(globals.SIZE_KEY, renderingParameters.getDocumentHeight(this.degree(node.id)));
            });
        }
    }

    // overlapRemoval() {
    //     // Apply 1d Node overlap removal algorithm
    //     // this.overlapRemovalNodes(nodes,"width")
    //
    //     this.overlapRemovalD3();
    // }
    //
    // overlapRemovalD3() {
    //     this.nodes.forEach(n => {
    //         n["x"] = n.get("x");
    //         n["y"] = n.get("y");
    //     })
    //
    //     for (let i = 0; i < this.ranks.length; i += 2) { // iterate only documents
    //         let rank = this.ranks[i];
    //         let nodes = this.nodesAtRank(rank);
    //
    //         this.simulation = d3.forceSimulation(nodes)
    //             .force("collision", d3.forceCollide().radius((d) => d.get(globals.SIZE_KEY) / 2 + renderingParameters.DOCUMENT_GAP / 2))
    //             .force("x", d3.forceX((d) => {
    //                 return d.get("x");
    //             }))
    //
    //         for (let i in d3.range(100)) {
    //             this.simulation.tick();
    //         }
    //     }
    //
    //     this.nodes.forEach(n => {
    //         n.set("x", n["x"]);
    //         n.set("y", n["y"]);
    //
    //         delete n["x"];
    //         delete n["y"];
    //         delete n["vx"];
    //         delete n["vy"];
    //     })
    // }

    createPersonOccurenceAndDocumentNodes() {
        for (let documentId of this.bipDynGraph.documents(true)) {
            let documentNode = this.idToNode[documentId];
            let newDocumentNode = cloneDeep(documentNode);
            newDocumentNode.rank = newDocumentNode.rank / 2;
            this.documentCentricHypergraph.addNode(newDocumentNode);
            let persons = this.getNeighbors(documentId, true);
            this.createOccurencePersonNodes(documentNode, persons);
        }
    }

    createOccurencePersonNodes(documentNode, personTimeNodes) {
        let nPersons = personTimeNodes.length;
        let [xDoc, yDoc] = [documentNode.get("x"), documentNode.get("y")];

        let rank = documentNode.rank;
        personTimeNodes.sort((a, b) => a.get("y") - b.get("y"));

        let yPersonOccurrence = yDoc - (this.personOccurenceHeight * (nPersons - 1)) / 2
        personTimeNodes.forEach(personTimeNode => {
            let [personId, time] = OssatureGraph.parseUniquePersonNode(personTimeNode.id);
            let id = this.generatePersonOccurenceNodeId(documentNode.id, personId);
            let personNode = this.bipDynGraph.getNode(personId);

            let attributes = {
                "x": xDoc,
                "y": yPersonOccurrence,
                "person": personId,
                "document": documentNode.id,
                "time": time,
                "label": personNode.get("name"),
                "weight": this.bipDynGraph.getNeighbors(personNode.id, true).length
            };

            let personOccurrenceNode = new LayeredNode(id, rank / 2, attributes, globals.PERSON_OCCURENCE_NODE);
            this.documentCentricHypergraph.addNode(personOccurrenceNode);
            yPersonOccurrence += this.personOccurenceHeight;
        })
    }

    yPersonOccurrence(yDoc, nPersons) {
        return yDoc - (this.personOccurenceHeight * (nPersons - 1)) / 2;
    }

    // TODO: put directly person node as Matrice rows in the future probably
    getPersonsOccurrenceFromDocuments(documentList) {
        let allPersonsOrdered = this.getNextNeighborhoodOrdered(documentList);
        let allPersonsOrderedNoDuplicate = [];
        let personIds = [];
        for (let personOccurrence of allPersonsOrdered) {
            let personId = OssatureGraph.parseUniquePersonNode(personOccurrence.id)[0];
            if (!personIds.includes(personId)) {
                allPersonsOrderedNoDuplicate.push(personOccurrence)
                personIds.push(personId);
            }
        }

        return allPersonsOrderedNoDuplicate;
    }

    computeClosestPersonOccurence(documents, yReference, personId) {
        let personOccurencesNodes = documents.map(d => d.id)
            .map(documentId => this.documentCentricHypergraph.idToNode[this.generatePersonOccurenceNodeId(documentId, personId)]);

        let personOccurencesY = personOccurencesNodes
            .map(node => node.get("y"))

        let dy = personOccurencesY.map(y => Math.abs(yReference - y));

        let minIndex = getFirstIndexOfMinValue(dy);
        let closestPersonOccurence = personOccurencesNodes[minIndex];

        return closestPersonOccurence;
    }

    generatePersonOccurenceNodeId(documentId, personId) {
        return `${personId}_${documentId}`;
    }

    generatePersonUniqueNode(personId, time) {
        return `${personId}_${time}_unique`;
    }
}
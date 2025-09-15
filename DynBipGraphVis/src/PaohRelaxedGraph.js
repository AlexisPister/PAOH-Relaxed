import { LayeredGraph, LayeredNode, Link, Path } from "dynbipgraph";
import { linkTypes, nodeTypes } from "./globals";
import { renderingParameters } from "./RenderingParameters";
import OssatureGraph from "./OssatureGraph.js";
class HyperEdge extends LayeredNode {
    persons;
    bounds;
    columnNumber;
    constructor(id, attributes, nodeType, rank, x, y, persons) {
        super(id, attributes, nodeType, rank, x, y);
        this.persons = persons;
        this.computeBounds();
    }
    computeBounds() {
        let ys = this.persons.map(person => person.get("y"));
        let min = Math.min(...ys);
        let max = Math.max(...ys);
        this.bounds = [min, max];
    }
    get(attribute) {
        if (attribute == "y")
            return this.bounds[0];
        if (attribute == "columnNumber")
            return this.columnNumber;
        return super.get(attribute);
    }
    person(pId) {
        return this.persons.filter(p => p.get("person") == pId)[0];
    }
    first() {
        return this.persons[0];
    }
    last() {
        return this.persons[this.persons.length - 1];
    }
    upperBound() {
        return this.bounds[1];
    }
    lowerBound() {
        return this.bounds[0];
    }
    areHyperedgesCrossing(hyperedge) {
        return !(hyperedge.lowerBound() > this.upperBound() || hyperedge.upperBound() < this.lowerBound());
    }
    static findLowestColumn(hyperedges) {
        return hyperedges.reduce((h1, h2) => {
            return h1.get("columnNumber") > h2.get("columnNumber") ? h2 : h1;
        });
    }
    static findHighestColumn(hyperedges) {
        return hyperedges.reduce((h1, h2) => {
            return h1.get("columnNumber") > h2.get("columnNumber") ? h1 : h2;
        });
    }
}
class Column {
    hyperedges = [];
    bounds = [];
    bipDynGraph;
    number;
    constructor(bipDynGraph, number) {
        this.bipDynGraph = bipDynGraph;
        this.number = number;
    }
    addHyperedge(hyperedge) {
        this.hyperedges.push(hyperedge);
        this.bounds.push(hyperedge.bounds);
    }
    canHyperedgeFit(hyperedge) {
        let fit = true;
        this.hyperedges.forEach(he => {
            if (hyperedge.areHyperedgesCrossing(he)) {
                fit = false;
            }
        });
        return fit;
    }
    padding() {
        return renderingParameters.getPaohPersonOccurrenceWidth() / 2;
    }
}
export default class PaohRelaxedGraph extends LayeredGraph {
    ossatureGraph;
    bipDynGraph;
    rankToColumns = {};
    cumulativeColumnsNumber;
    personIdToPath;
    personToRankToHyperedge;
    constructor(ossatureGraph, bipDynGraph) {
        super(null);
        this.ossatureGraph = ossatureGraph;
        this.bipDynGraph = bipDynGraph;
        this.initGraph();
    }
    initGraph() {
        this.personToRankToHyperedge = {};
        for (let documentId of this.bipDynGraph.documents(true)) {
            // let documentNode = this.bipDynGraph.idToNode[documentId];
            let documentNode = this.ossatureGraph.idToNode[documentId];
            let persons = this.ossatureGraph.getNeighbors(documentId, true);
            let newRank = documentNode.rank / 2;
            let hyperedge = new HyperEdge(documentNode.id, null, nodeTypes.HYPEREDGE, newRank, null, null, persons);
            let column = this.computeColumn(hyperedge, newRank);
            hyperedge.columnNumber = column.number;
            persons.forEach(person => {
                let personId = OssatureGraph.parseUniquePersonNode(person.id)[0];
                if (!this.personToRankToHyperedge[personId]) {
                    this.personToRankToHyperedge[personId] = { [newRank]: [hyperedge] };
                }
                else if (!this.personToRankToHyperedge[personId][newRank]) {
                    this.personToRankToHyperedge[personId][newRank] = [hyperedge];
                }
                else {
                    this.personToRankToHyperedge[personId][newRank].push(hyperedge);
                }
            });
            this.addNode(hyperedge);
            this.createOccurencePersonNodes(documentNode, persons, newRank, column.number);
        }
        this.transformHyperedgesPersons();
        this.createPaths();
    }
    transformHyperedgesPersons() {
        this.getNodesByType(nodeTypes.HYPEREDGE).forEach(he => {
            he["persons"] = he["persons"].map(personTimeNode => {
                let [personId, time] = OssatureGraph.parseUniquePersonNode(personTimeNode.id);
                let personOccurrenceId = this.generatePersonOccurenceNodeId(he.id, personId);
                let personOccurrenceNode = this.getNode(personOccurrenceId);
                return personOccurrenceNode;
            });
        });
    }
    computeColumn(hyperedge, rank) {
        let columns = this.rankToColumns[rank];
        if (!columns) {
            let column = new Column(this.bipDynGraph, 0);
            this.rankToColumns[rank] = [column];
            column.addHyperedge(hyperedge);
            return column;
        }
        for (let [i, column] of columns.entries()) {
            if (column.canHyperedgeFit(hyperedge)) {
                column.addHyperedge(hyperedge);
                return column;
            }
        }
        let columnNumber = columns.length + 1;
        let column = new Column(this.bipDynGraph, columnNumber);
        column.addHyperedge(hyperedge);
        columns.push(column);
        return column;
    }
    createOccurencePersonNodes(documentNode, personTimeNodes, rank, columnNumber) {
        personTimeNodes.sort((a, b) => a.get("y") - b.get("y"));
        personTimeNodes.forEach(personTimeNode => {
            let [personId, time] = OssatureGraph.parseUniquePersonNode(personTimeNode.id);
            let id = this.generatePersonOccurenceNodeId(documentNode.id, personId);
            let personNode = this.bipDynGraph.getNode(personId);
            // let xPersonTime = xDoc + columnNumber * RenderingParameters.INTERLAYER_GAP;
            // console.log(columnNumber, rank)
            let attributes = {
                "person": personId,
                "document": documentNode.id,
                "time": time,
                "label": personNode.get("name"),
                "weight": this.bipDynGraph.getNeighbors(personNode.id, true).length,
                "columnNumber": columnNumber
            };
            let y = personTimeNode.get("y");
            // x coordinates will be computed later
            let personOccurrenceNode = new LayeredNode(id, rank, attributes, nodeTypes.PERSON_OCCURENCE, null, y);
            this.addNode(personOccurrenceNode);
        });
    }
    assignRankCoordinates(rankGapSize = this.rankGapSize, rankSize = this.rankSize) {
        this.rankGapSize = rankGapSize;
        this.rankSize = rankSize;
        this.cumulativeColumnsNumber = 0;
        for (let rank of this.ranks) {
            let nodes = this.nodesAtRank(rank);
            if (nodes) { // some ranks are empty
                nodes.forEach(node => {
                    let x = this.rankToX(rank, node.get("columnNumber"));
                    node.x = x;
                });
            }
            let columns = this.rankToColumns[rank];
            let nColumns = columns.length;
            this.cumulativeColumnsNumber += nColumns;
        }
        this.cumulativeColumnsNumber = 0;
    }
    rankToNPreviousColumns(rank) {
        let rankSum = 0;
        for (let i = 0; i <= this.ranks.length; i++) {
            if (this.ranks[i] == rank)
                break;
            if (this.rankToColumns[i]) {
                rankSum += this.rankToColumns[i].length;
            }
        }
        return rankSum;
    }
    // @ts-ignore
    rankToX(rank, columnNumber = 0) {
        let cumulativeColNumber = this.cumulativeColumnsNumber ? this.cumulativeColumnsNumber : this.rankToNPreviousColumns(rank);
        // let cumulativeColNumber: number = this.rankToNPreviousColumns(rank);
        let x = (cumulativeColNumber + columnNumber) * renderingParameters.COLUMN_WIDTH + rank * (this.rankGapSize);
        // let x = (this.cumulativeColumnsNumber + columnNumber) * renderingParameters.COLUMN_WIDTH + rank * (this.rankGapSize) + (2 * rank + 1) * this.rankSize / 2;
        return x;
    }
    rankToNColumns(rank) {
        return this.rankToColumns[rank].length;
    }
    createPathsOnOccurences() {
        this.personIdToPath = {};
        this.bipDynGraph.persons(true).forEach(personId => this.personIdToPath[personId] = new Path(this));
        // console.log(this.rank, this.personToRankToHyperedge)
        for (let [personId, rankToHyperedges] of Object.entries(this.personToRankToHyperedge)) {
            let lastNode;
            let j = -1;
            let rankAndHyperedges = Object.entries(rankToHyperedges);
            for (let [r, hyperedges] of rankAndHyperedges) {
                let rank = Number(r);
                j++;
                let currentHyperedge = hyperedges[0];
                let currentPersonOccurrence;
                let iStart;
                if (currentHyperedge.columnNumber != 0 && j != 0) {
                    // Dummy Node
                    currentPersonOccurrence = new LayeredNode(`${personId}_${rank}_0`, rank, { "columnNumber": 0 }, "dummy", null, currentHyperedge.person(personId).get("y"));
                    this.addNode(currentPersonOccurrence);
                    iStart = 0;
                }
                else {
                    currentPersonOccurrence = currentHyperedge.person(personId);
                    iStart = 1;
                }
                if (lastNode) {
                    let link = new Link(lastNode.id, currentPersonOccurrence.id, linkTypes.PERSON_SAME_RANK, null, null);
                    this.addLink(link);
                    this.personIdToPath[personId].addLink(link);
                }
                else {
                    lastNode = currentPersonOccurrence;
                }
                let nColumns = this.rankToColumns[rank].length;
                for (let i = iStart; i <= hyperedges.length; i++) {
                    if (i == hyperedges.length) {
                        if (lastNode.get("columnNumber") != nColumns && j < rankAndHyperedges.length - 1) {
                            currentPersonOccurrence = new LayeredNode(`${personId}_${rank}_last`, rank, { "columnNumber": nColumns }, "dummy", null, currentHyperedge.person(personId).get("y"));
                            this.addNode(currentPersonOccurrence);
                        }
                        else {
                            break;
                        }
                    }
                    else {
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
    createPathsWithRowFilling() {
        this.personIdToPath = {};
        this.bipDynGraph.persons(true).forEach(personId => this.personIdToPath[personId] = new Path(this));
        for (let [personId, rankToHyperedges] of Object.entries(this.personToRankToHyperedge)) {
            let lastNode;
            for (let [rank, hyperedges] of Object.entries(rankToHyperedges)) {
                let xStart = this.rankToX(rank, 0);
                let dummyNodeStart = new LayeredNode(`${personId}_${rank}_0`, rank, { "columnNumber": 0 }, "dummy", xStart, hyperedges[0].person(personId).get("y"));
                let xEnd = this.rankToX(rank, this.rankToNColumns(rank));
                let dummyNodeEnd = new LayeredNode(`${personId}_${rank}_1`, rank, { "columnNumber": this.rankToNColumns(rank) }, "dummy", xEnd, hyperedges[0].person(personId).get("y"));
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
                lastNode = dummyNodeEnd;
            }
        }
        console.log(this.personIdToPath);
    }
    createPaths() {
        this.createPathsOnOccurences();
        // this.createPathsWithRowFilling();
    }
    timeToRank(time) {
        // time = Number(time);
        return this.ranks[this.bipDynGraph.times.indexOf(time)];
    }
    timeToPosition(time) {
        let rank = this.timeToRank(time);
        return this.rankToX(rank);
    }
    generatePersonOccurenceNodeId(documentId, personId) {
        return `${personId}_${documentId}`;
    }
    generatePersonUniqueNode(personId, time) {
        return `${personId}_${time}_unique`;
    }
}

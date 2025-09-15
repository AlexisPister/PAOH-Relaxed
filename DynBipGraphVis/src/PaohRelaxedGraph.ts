import {LayeredGraph, LayeredNode, Link, Path, BipartiteDynGraph, PersonNode} from "dynbipgraph";
import {globals, linkTypes, nodeTypes} from "./globals";
import {cloneDeep, groupBy} from 'lodash';
import {renderingParameters} from "./RenderingParameters";
import OssatureGraph from "./OssatureGraph.js";


export class PersonOccurrenceNode extends LayeredNode {
    constructor(id, attributes, nodeType, rank, x, y, width, height) {
        super(id, attributes, nodeType, rank, x, y, width, height);
    }

    label(): string {
        return this.get("personName");
    }
}

export class HyperEdge extends LayeredNode {
    persons: LayeredNode[];
    bounds: [number, number];
    columnNumber: number;
    time: string;

    constructor(id, attributes, nodeType, rank, x, y, persons, time) {
        super(id, attributes, nodeType, rank, x, y);
        this.persons = persons;
        this.time = time;
        this.computeBounds();
    }

    computeBounds(): void {
        let ys = this.persons.map(person => person.get("y"));
        let min = Math.min(...ys);
        let max = Math.max(...ys);
        this.bounds = [min, max];
    }

    get(attribute): any {
        if (attribute == "y") return this.bounds[0];
        if (attribute == "columnNumber") return this.columnNumber;
        return super.get(attribute);
    }

    person(pId): LayeredNode {
        return this.persons.filter(p => p.get("person") == pId)[0]
    }

    first(): LayeredNode {
        return this.persons[0];
    }

    last(): LayeredNode {
        return this.persons[this.persons.length - 1];
    }

    upperBound(): number {
        return this.bounds[1]
    }

    lowerBound(): number {
        return this.bounds[0]
    }

    areHyperedgesCrossing(hyperedge: HyperEdge) {
        return !(hyperedge.lowerBound() > this.upperBound() || hyperedge.upperBound() < this.lowerBound());
    }

    static findLowestColumn(hyperedges: HyperEdge[]): HyperEdge {
        return hyperedges.reduce((h1, h2) => {
            return h1.get("columnNumber") > h2.get("columnNumber") ? h2 : h1;
        })
    }

    static findHighestColumn(hyperedges: HyperEdge[]): HyperEdge {
        return hyperedges.reduce((h1, h2) => {
            return h1.get("columnNumber") > h2.get("columnNumber") ? h1 : h2;
        })
    }
}


class Column {
    hyperedges: HyperEdge[] = [];
    bounds: [number, number][] = [];
    bipDynGraph: BipartiteDynGraph;
    number: number;

    constructor(bipDynGraph, number) {
        this.bipDynGraph = bipDynGraph;
        this.number = number;
    }

    addHyperedge(hyperedge: HyperEdge): void {
        this.hyperedges.push(hyperedge);
        this.bounds.push(hyperedge.bounds);
    }

    canHyperedgeFit(hyperedge: HyperEdge): boolean {
        let fit: boolean = true;
        this.hyperedges.forEach(he => {
            if (hyperedge.areHyperedgesCrossing(he)) {
                fit = false;
            }
        })
        return fit;
    }

    padding() {
        return renderingParameters.getPaohPersonOccurrenceWidth() / 2
    }
}

export default class PaohRelaxedGraph extends LayeredGraph {
    ossatureGraph: OssatureGraph;
    bipDynGraph: BipartiteDynGraph;
    rankToColumns: Record<number, Column[]> = {};
    cumulativeColumnsNumber: number;
    personIdToPath: Record<string, Path>
    personToRankToHyperedge: Record<string, Record<number, HyperEdge[]>>;

    constructor(ossatureGraph, bipDynGraph) {
        super(null);
        this.ossatureGraph = ossatureGraph;
        this.bipDynGraph = bipDynGraph;
        this.initGraph();
        this.setup();
    }

    getPersonOccurrences(personId): PersonOccurrenceNode[] {
        let occurrenceNodes = this.getNodesByType(nodeTypes.PERSON_OCCURENCE).filter(n => n.get("person") == personId) as PersonOccurrenceNode[];
        return occurrenceNodes;
    }

    getPaths() {
        return Object.values(this.personIdToPath).filter(d => d.links.length > 0);
    }

    initGraph() {
        this.personToRankToHyperedge = {};
        for (let documentId of this.bipDynGraph.documents(true)) {
            let documentNode = this.ossatureGraph.idToNode[documentId];

            let persons = this.ossatureGraph.getNeighbors(documentId, true);
            let newRank = documentNode.rank / 2;

            let hyperedge: HyperEdge = new HyperEdge(documentNode.id, newRank, null, nodeTypes.HYPEREDGE, null, null, persons, this.bipDynGraph.getNode(documentId).time);
            let column = this.computeColumn(hyperedge, newRank);
            hyperedge.columnNumber = column.number;

            persons.forEach(person => {
                let personId = OssatureGraph.parseUniquePersonNode(person.id)[0];
                if (!this.personToRankToHyperedge[personId]) {
                    this.personToRankToHyperedge[personId] = {[newRank]: [hyperedge]}
                } else if (!this.personToRankToHyperedge[personId][newRank]) {
                    this.personToRankToHyperedge[personId][newRank] = [hyperedge]
                } else {
                    this.personToRankToHyperedge[personId][newRank].push(hyperedge)
                }
            })

            this.addNode(hyperedge);
            this.createOccurencePersonNodes(documentNode, hyperedge, persons, newRank, column.number);
        }

        this.transformHyperedgesPersons();
        this.createPaths();
    }

    getWidth() {
        let width = 0;
        for (let rank of this.ranks) {
            let columns = this.rankToColumns[rank];
            let nColumns: number = columns.length;
            width += renderingParameters.COLUMN_WIDTH * nColumns;
        }

        width += (this.ranks.length - 1) * this.rankGapSize;
        return width;
    }

    transformHyperedgesPersons() {
        this.getNodesByType(nodeTypes.HYPEREDGE).forEach(he => {
            he["persons"] = he["persons"].map(personTimeNode => {
                let [personId, time] = OssatureGraph.parseUniquePersonNode(personTimeNode.id);
                let personOccurrenceId = PaohRelaxedGraph.generatePersonOccurenceNodeId(he.id, personId);
                let personOccurrenceNode = this.getNode(personOccurrenceId);
                return personOccurrenceNode;
            })
        })
    }

    computeColumn(hyperedge, rank): Column {
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

        let columnNumber = columns.length;
        let column = new Column(this.bipDynGraph, columnNumber);
        column.addHyperedge(hyperedge);
        columns.push(column);

        return column;
    }

    createOccurencePersonNodes(documentNode, hyperedge, personTimeNodes, rank, columnNumber) {
        personTimeNodes.sort((a, b) => a.get("y") - b.get("y"));

        personTimeNodes.forEach(personTimeNode => {
            let [personId, time] = OssatureGraph.parseUniquePersonNode(personTimeNode.id);
            let id = PaohRelaxedGraph.generatePersonOccurenceNodeId(documentNode.id, personId);
            let personNode = this.bipDynGraph.getNode(personId) as PersonNode;

            let neighbors = this.bipDynGraph.getNeighbors(personNode.id, true) as LayeredNode[]
            let attributes = {
                "person": personId,
                "personName": personNode.name,
                "document": documentNode.id,
                "time": time,
                "label": personNode.get("name"),
                "weight": neighbors.length,
                "columnNumber": columnNumber
            };

            let y = personTimeNode.get("y")

            // x coordinates will be computed later
            // let personOccurrenceNode = new LayeredNode(id, rank, attributes, nodeTypes.PERSON_OCCURENCE, null, y);
            let width = renderingParameters.getPaohPersonOccurrenceWidth();
            let personOccurrenceNode = new PersonOccurrenceNode(id, rank, attributes, nodeTypes.PERSON_OCCURENCE, null, y, width, width);
            this.addNode(personOccurrenceNode);
            this.addLink(new Link(hyperedge, personOccurrenceNode))
        })
    }

    // assignRankCoordinates(rankGapSize = renderingParameters.RANK_GAP_SIZE, rankSize = this.rankSize) {
    assignRankCoordinates(rankGapSize, rankSize) {
        this.rankGapSize = rankGapSize;
        this.rankSize = rankSize;

        console.log(this.rankGapSize, this.rankSize)

        this.cumulativeColumnsNumber = 0;
        for (let rank of this.ranks) {
            let nodes = this.nodesAtRank(rank);
            if (nodes) { // some ranks are empty
                nodes.forEach(node => {
                    let x = this.rankToX(rank, node.get("columnNumber"));
                    node.x = x
                });
            }

            let columns = this.rankToColumns[rank];
            let nColumns: number = columns.length;
            this.cumulativeColumnsNumber += nColumns;
        }
        this.cumulativeColumnsNumber = 0;
    }

    rankToNPreviousColumns(rank): number {
        let rankSum = 0;
        for (let i = 0; i <= this.ranks.length; i++) {
            if (this.ranks[i] == rank) break;
            if (this.rankToColumns[i]) {
                rankSum += this.rankToColumns[i].length;
            }
        }
        return rankSum;
    }

    rankToX(rank, columnNumber=0): number {
        let cumulativeColNumber: number = this.cumulativeColumnsNumber ? this.cumulativeColumnsNumber : this.rankToNPreviousColumns(rank);
        // let cumulativeColNumber: number = this.rankToNPreviousColumns(rank);
        let x = (cumulativeColNumber + columnNumber) * renderingParameters.COLUMN_WIDTH + rank * (this.rankGapSize);
        // let x = (this.cumulativeColumnsNumber + columnNumber) * renderingParameters.COLUMN_WIDTH + rank * (this.rankGapSize) + (2 * rank + 1) * this.rankSize / 2;
        return x;
    }

    rankToNColumns(rank) {
        return this.rankToColumns[rank].length;
    }

    createPathsOnOccurences(): void {
        this.personIdToPath = {};
        this.bipDynGraph.persons(true).forEach(personId => this.personIdToPath[personId] = new Path(this));

        for (let [personId, rankToHyperedges] of Object.entries(this.personToRankToHyperedge)) {
            let lastNode: LayeredNode;
            let j = -1;
            let rankAndHyperedges = Object.entries(rankToHyperedges);
            for (let [r, hyperedges] of rankAndHyperedges) {
                let rank: number = Number(r);
                j++;
                let currentHyperedge: HyperEdge = hyperedges[0];

                let currentPersonOccurrence: LayeredNode;
                let iStart: number;
                if (currentHyperedge.columnNumber != 0 && j != 0) {
                    // Dummy Node
                    currentPersonOccurrence = new LayeredNode(`${personId}_${rank}_0`, rank, {"columnNumber": 0}, "dummy", null, currentHyperedge.person(personId).get("y"));
                    this.addNode(currentPersonOccurrence);
                    iStart = 0;
                } else {
                    currentPersonOccurrence = currentHyperedge.person(personId);
                    iStart = 1;
                }

                if (lastNode) {
                    let link = new Link(lastNode.id, currentPersonOccurrence.id, linkTypes.PERSON_SAME_RANK, null, null);
                    this.addLink(link);
                    this.personIdToPath[personId].addLink(link);
                } else {
                    lastNode = currentPersonOccurrence;
                }

                let nColumns: number = this.rankToColumns[rank].length;
                for (let i = iStart; i <= hyperedges.length; i++) {
                    if (i == hyperedges.length) {
                        if (lastNode.get("columnNumber") != nColumns && j < rankAndHyperedges.length - 1) {
                            currentPersonOccurrence = new LayeredNode(`${personId}_${rank}_last`, rank, {"columnNumber": nColumns}, "dummy", null, currentHyperedge.person(personId).get("y"));
                            this.addNode(currentPersonOccurrence)
                        } else {
                            break;
                        }
                    } else {
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
    createPathsWithRowFilling(): void {
        this.personIdToPath = {};
        this.bipDynGraph.persons(true).forEach(personId => this.personIdToPath[personId] = new Path(this));

        for (let [personId, rankToHyperedges] of Object.entries(this.personToRankToHyperedge)) {
            let lastNode: LayeredNode;
            for (let [rank, hyperedges] of Object.entries(rankToHyperedges)) {
                let xStart = this.rankToX(rank, 0)
                let dummyNodeStart = new LayeredNode(`${personId}_${rank}_0`, rank, {"columnNumber": 0}, "dummy", xStart, hyperedges[0].person(personId).get("y"));

                let xEnd = this.rankToX(rank, this.rankToNColumns(rank))
                let dummyNodeEnd = new LayeredNode(`${personId}_${rank}_1`, rank, {"columnNumber": this.rankToNColumns(rank)}, "dummy", xEnd, hyperedges[0].person(personId).get("y"));
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
                lastNode = dummyNodeEnd
            }
        }
    }

    createPaths(): void {
        this.createPathsOnOccurences();
        // this.createPathsWithRowFilling();
    }

    xToTime(x) {
        let i = 0;
        for (let time of this.bipDynGraph.times.slice(0, -1)) {
            let xTime = this.timeToPosition(time);
            let xTime2 = this.timeToPosition(this.bipDynGraph.times[i + 1]);
            if (x > xTime && x < xTime2) return time;
            i++
        }
        return null;
    }

    timeToRank(time: number) {
        // time = Number(time);
        return this.ranks[this.bipDynGraph.times.indexOf(time)];
    }

    timeToPosition(time) {
        let rank = this.timeToRank(time);
        return this.rankToX(rank);
    }

    static generatePersonOccurenceNodeId(documentId, personId) {
        return `${personId}_${documentId}`;
    }

    generatePersonUniqueNode(personId, time) {
        return `${personId}_${time}_unique`;
    }
}
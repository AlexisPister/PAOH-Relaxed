import {Node, LayeredNode} from 'dynbipgraph';

import {globals} from "./globals";
import OssatureGraph from "./OssatureGraph";
import {groupBy} from "./utils";
import {renderingParameters} from "./RenderingParameters";


export class TemporalMatrix {
    constructor(id, matrixNodes) {
        this.id = id;
        this.matrixNodes = matrixNodes ? matrixNodes : [];
    }

    addMatrix(matrixNode) {
        this.matrixNodes.push(matrixNode)
    }

    addToGraph(graph) {
        this.matrixNodes.forEach(matrixNode => {
            graph.addNode(matrixNode);
        })
        graph.addNode(this.temporalMatNode);
    }

    setRows(rowsItems) {
        this.matrixNodes.forEach(matrixNode => {
            matrixNode.setRows(rowsItems);
        })
    }

    setTemporalMatNode(temporalMatrixNode) {
        this.temporalMatNode = temporalMatrixNode;
    }

    setup() {
        this.matrixNodes.forEach(matrixNode => {
            matrixNode.setup();
        })
    }

    addDummyNodesToGraph(graph) {
        this.matrixNodes.forEach(matrixNode => {
            matrixNode.rowNodes.forEach(rowNode => {
                graph.addNode(rowNode);
            })
        })
    }
}

// Todo : put original person nodes as rowItems ?
export class MatrixNode extends LayeredNode {
    static idCounter = 0;

    constructor(id, attributes, nodeType, rank) {
        super(id, attributes, nodeType, rank);
        this.matrixId = MatrixNode.matrixId();
    }

    static matrixId() {
        MatrixNode.idCounter += 1;
        return MatrixNode.idCounter.toString();
    }

    nRows() {
        return this.rowItems.length;
    }

    nCols() {
        return this.columnItems.length;
    }

    setRows(rowItems) {
        this.rowItems = rowItems;
    }

    setFilledRows(rowItems) {
        this.filledRowItems = rowItems;
    }

    setColumns(columnItems) {
        this.columnItems = columnItems;
        console.log(this.columnItems)
    }

    setup() {
        this.createDummyRowsNodes();
        this.createDummyColumnsNodes();
    }

    createDummyRowsNodes() {
        this.rowNodes = [];
        let x = this.get("x");
        this.rowItems.forEach(rowItem => {
            let y = this.getY(rowItem, renderingParameters.getPersonOccurenceHeight());
            let personId = OssatureGraph.parseUniquePersonNode(rowItem.id)[0];
            let node = new LayeredNode(`${rowItem.id}-${this.rank}-${this.matrixId}`, this.rank, {
                "x": x,
                "y": y,
                "person": personId
            }, globals.ROW_MATRICE_NODE);
            this.rowNodes.push(node);
        })
    }

    createDummyColumnsNodes() {
        this.columnNodes = [];
        let y = this.get("y");
        this.columnItems.forEach(colItem => {
            let x = this.getX(colItem);
            let node = new LayeredNode(`${colItem.id}-${this.rank}`, this.rank, {
                "x": x,
                "y": y
            }, globals.COLUMNS_MATRICE_NODE);
            this.columnNodes.push(node);
        })
    }

    getRowNodes() {
        return this.rowNodes;
    }

    rowItemPositionClassical(itemId) {
        return this.rowItems.findIndex(el => el == itemId);
        // return this.rowItems.findIndex(el => el.id == itemId);
    }

    rowItemPosition(personId) {
        return this.rowItems.findIndex(el => OssatureGraph.parseUniquePersonNode(el.id)[0] == personId);
        // return this.rowItems.findIndex(el => el.id == itemId);
    }

    columnItemPosition(itemId) {
        return this.columnItems.findIndex(el => el.id == itemId);
        // return this.columnItems.findIndex(el => el.id == itemId);
    }

    updateRowItemCoordinates() {
        this.rowItems.forEach(rowItem => {
            let x = this.getX(rowItem);
            let y = this.getY(rowItem);
            rowItem.set("x", x)
            rowItem.set("y", y)
        })
    }

    getX(columnItem) {
        let xV = this.get("x") - 20 / 2 + 20 / this.nCols() * this.columnItemPosition(columnItem);
        return xV;
    }

    getPersonY(personId, personOccurrenceHeight) {
        let rowItem = this.rowItems.filter(item => OssatureGraph.parseUniquePersonNode(item.id)[0] == personId)[0]
        return this.getY(rowItem, personOccurrenceHeight);
    }

    getY(rowItem, personOccurrenceHeight) {
        let matHeight = this.nRows() * personOccurrenceHeight;
        let yV = this.get("y") - matHeight / 2 + this.rowItemPositionClassical(rowItem) * personOccurrenceHeight;
        return yV;
    }

    hasPerson(personId, filledRow = true) {
        // If filled row, return true if person row is filled at least once
        if (filledRow) {
            return this.filledRowItems.filter(rowItem => OssatureGraph.parseUniquePersonNode(rowItem.id)[0] == personId).length > 0
        } else {
            return this.rowItems.filter(rowItem => OssatureGraph.parseUniquePersonNode(rowItem.id)[0] == personId).length > 0
        }
    }

    // TODO: 2 ways of creating dummy nodes. Should delete one
    getDummyPersonNode(personId) {
        let x = this.get("x");
        let y = this.getPersonY(personId, renderingParameters.getPersonOccurenceHeight());
        let node = new LayeredNode(`${personId}-${this.rank}-${this.matrixId}-mat`, this.rank, {
            "x": x,
            "y": y,
            "person": personId
        }, "dummyMatrixNode");
        return node;
    }
}


export class TemporalMatrixGrouper {
    static idCounter = 0;

    constructor(temporalLayeredGraph, ossatureGraph, bipDynGraph, color) {
        this.temporalLayeredGraph = temporalLayeredGraph;
        this.ossatureGraph = ossatureGraph;
        this.bipDynGraph = bipDynGraph;
        this.color = color;
    }

    static matrixId() {
        TemporalMatrixGrouper.idCounter += 1;
        return `mat-${TemporalMatrixGrouper.idCounter}`
    }

    run(documentIdList, id) {
        this.temporalMatrix = new TemporalMatrix();
        this.documentList = documentIdList.map(nId => this.temporalLayeredGraph.idToNode[nId]);
        this.temporalMatId = id;

        this.computeY();

        // TODO: SET EFFICIENT DOCUMENT ORDER
        let rankToDocuments = groupBy(this.documentList, "rank");

        for (let [rank, documents] of Object.entries(rankToDocuments)) {
            documents.sort((d1, d2) => d1.get("y") - d2.get("y"))
            console.log(1, documents)

            let matrixNode = this.computeMatrix(rank, documents);
            this.temporalMatrix.addMatrix(matrixNode);
        }
        this.setRows();
        this.temporalMatrix.setup();
        this.temporalMatrix.addDummyNodesToGraph(this.temporalLayeredGraph);

        documentIdList.forEach(documentId => {
            let personOccurrences = this.temporalLayeredGraph.getNodesByType(globals.PERSON_OCCURENCE_NODE).filter(node => node.get("document") == documentId);
            // this.temporalLayeredGraph.removeNode(documentId);
            // this.temporalLayeredGraph.removeNodes(personOccurrences.map(n => n.id));

            this.temporalLayeredGraph.disableNode(documentId);
            this.temporalLayeredGraph.disableNodes(personOccurrences.map(n => n.id));
        })

        this.computeXandWidth();
        this.setTemporalMatrixNode();
        return this.temporalMatrix;
    }

    computeMatrix(rank, documents) {
        let matrixNode = new MatrixNode(TemporalMatrixGrouper.matrixId(), {}, globals.MATRIX, Number(rank));

        let rankX = this.temporalLayeredGraph.rankToX(rank);
        matrixNode.set("x", rankX);
        matrixNode.set("y", this.y);

        matrixNode.setColumns(documents);

        let allPersons = [];
        documents.forEach(document => {
            let persons = this.ossatureGraph.getNeighbors(document.id, true);
            allPersons = allPersons.concat(persons);
        })
        matrixNode.setFilledRows(allPersons);

        return matrixNode;
    }

    setRows() {
        // let allPersonsOrdered = this.ossatureGraph.getNextNeighborhoodOrdered(this.documentList);
        let allPersonsOrdered = this.ossatureGraph.getPersonsOccurrenceFromDocuments(this.documentList);
        this.nRows = allPersonsOrdered.length;
        this.temporalMatrix.setRows(allPersonsOrdered);
    }

    setTemporalMatrixNode() {
        let temporalMatNode = new Node(this.temporalMatId, {
            width: this.width,
            nRows: this.nRows,
            color: this.color
        }, globals.TEMPORAL_MATRIX, this.x, this.y);
        this.temporalMatrix.setTemporalMatNode(temporalMatNode);
    }

    computeXandWidth() {
        let matXs = this.temporalMatrix.matrixNodes.map(mat => mat.get("x"))
        let maxX = Math.max(...matXs);
        let minX = Math.min(...matXs);

        this.width = maxX - minX;
        this.x = maxX - this.width / 2;
    }

    computeY() {
        let sumY = this.documentList.map(d => d.get("y")).reduce((a, b) => a + b);
        let meanY = sumY / this.documentList.length;
        this.y = meanY;
    }
}


// export class MatrixGrouper {
//     constructor(temporalLayeredGraph, ossatureGraph) {
//         this.temporalLayeredGraph = temporalLayeredGraph;
//         this.ossatureGraph = ossatureGraph;
//     }
//
//     groupDocuments(documentIdList) {
//         this.matrixNode = new MatrixNode("placeholder", {}, globals.MATRIX);
//
//         this.documentList = documentIdList.map(nId => this.temporalLayeredGraph.idToNode[nId]);
//
//         let N = this.documentList.length;
//         let sumY = this.documentList.map(d => d.get("y")).reduce((a, b) => a + b);
//         let meanY = sumY / N;
//
//         this.matrixNode.set("x", this.documentList[0].get("x"));
//         this.matrixNode.set("y", meanY);
//         this.matrixNode.setColumns(this.documentList);
//
//         this.orderPersons();
//         this.temporalLayeredGraph.addNode(this.matrixNode);
//     }
//
//     orderPersons() {
//         // let allPersonsOrdered = this.temporalLayeredGraph.getNextNeighborhoodOrdered(this.documentList);
//         let allPersonsOrdered = this.ossatureGraph.getNextNeighborhoodOrdered(this.documentList);
//         this.matrixNode.setRows(allPersonsOrdered);
//     }
// }
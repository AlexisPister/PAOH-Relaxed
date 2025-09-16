import Graph from "./Graph";
import _ from "lodash";
import {LayeredNode, Node} from "./Node";
import {flatten2dArray} from "./utils.js";
import {overlapRemoval} from "./algorithms/overlap.js";

export default class LayeredGraph extends Graph {
    constructor(jsonData) {
        super(jsonData);

        this.rankGapSize = null;
        this.rankSize = null;
    }

    init() {
        super.init();
        this.RANK_KEY = "rank";
        this.ranks = [];
        this.rankToNodes = {};
    }

    verifyRanks() {
        let l = this.getNRanks();
        for (let i = 0; i < l - 1; i++) {
            let diff = this.ranks[i + 1] - this.ranks[i];
            if (diff > 1) {
                for (let j = 1; j < diff; j++) {
                    this.ranks.push(this.ranks[i] + j);
                }
            }
        }
        this.ranks.sort((a, b) => a - b);
    }

    getNRanks() {
        return this.ranks.filter(rank => rank != undefined).length;
    }

    getLastRank() {
        return Math.max(...this.ranks);
    }

    getTotalSize() {
        return this.rankGapSize * (this.getNRanks() - 1) + this.rankSize * this.getNRanks();
    }

    addNode(node) {
        this.nodes.push(node);
        this.idToNode[node.id] = node;

        if (this.rankToNodes[node.rank]) {
            this.rankToNodes[node.rank].push(node);
        } else {
            this.rankToNodes[node.rank] = [node];
        }

        this.updateRanks(node.rank);
        this.verifyRanks();
    }

    removeNode(nodeId) {
        let rank = this.idToNode[nodeId].rank;
        super.removeNode(nodeId);
        this.rankToNodes[rank] = this.rankToNodes[rank].filter(node => node.id != nodeId);
    }

    removeNodes(nodeIds) {
        nodeIds.forEach(nodeId => this.removeNode(nodeId));
    }

    updateRanks(rank) {
        if (!this.ranks.includes(rank)) {
            this.ranks.push(rank);
            this.ranks.sort((a, b) => a - b);
        }
    }

    nodesAtRank(rank) {
        return this.rankToNodes[rank];
    }

    // TODO: works for horizontal layout only now
    assignRankCoordinates(rankGapSize = this.rankGapSize, rankSize = this.rankSize) {
        this.rankGapSize = rankGapSize;
        this.rankSize = rankSize;
        for (let rank of this.ranks) {
            let nodes = this.nodesAtRank(rank);
            if (nodes) { // some ranks are empty
                nodes.forEach(node => {
                    let x = this.rankToX(rank);
                    node.set("x", x);
                });
            }
        }
    }

    rankToX(rank) {
        return rank * (this.rankGapSize) + (2 * rank + 1) * this.rankSize / 2;
    }

    overlapRemoval(sizeKey) {
        for (let rank of this.ranks) {
            let nodes = this.nodesAtRank(rank);
            this.overlapRemovalNodes(nodes, "y", sizeKey);
        }
    }

    overlapRemovalNodes(nodes, sizeKey) {
        overlapRemoval(nodes, "y", sizeKey);
    }

    minMaxLinkDistance(linkType = null) {
        let links = linkType ? this.getLinksByType(linkType) : this.links;

        let distances = links.map(link => {
            return Math.sqrt((link.source.get("x") - link.target.get("x")) ** 2 + (link.source.get("y") - link.target.get("y")) ** 2);
        })
        let maxDistance = Math.max(...distances);
        let minDistance = Math.min(...distances);
        return [minDistance, maxDistance];
    }

    getNextNeighborhoodOrdered(nodesList) {
        let allNeighborNodes = flatten2dArray(nodesList.map(n => this.getNeighbors(n.id, true, true)));
        allNeighborNodes = [...new Set(allNeighborNodes)]; // remove duplicates;
        let orderedNodes = this.getOrderedNodes(allNeighborNodes);
        return orderedNodes;
    }

    getOrderedNodes(nodes) {
        // Order by rank then by y position
        nodes.sort((n1, n2) => {
            // if (n1.rank != n2.rank) throw "Nodes to order not in the same rank";
            if (n1.rank != n2.rank) {
                return n1.rank - n2.rank;
            } else {
                return n1.get("y") - n2.get("y");
            }
        })
        return nodes;
    }

    processNodes(nodes) {
        super.processNodes(nodes);
        this.ranks = Object.keys(this.rankToNodes)
        this.ranks.sort((a, b) => a - b);
    }

    processNode(nodeItem) {
        let id = nodeItem.id;
        let entityType = nodeItem[this.nodeTypeKey];
        let rank = nodeItem[this.RANK_KEY];

        let attributes = _.cloneDeep(nodeItem);
        delete attributes["id"];
        delete attributes[this.RANK_KEY];
        delete attributes[this.nodeTypeKey];

        let node = new LayeredNode(id, rank, attributes, entityType);
        this.addNode(node);
    }
}

export default class LayeredGraph extends Graph {
    constructor(jsonData: any);
    rankGapSize: any;
    rankSize: any;
    RANK_KEY: string;
    ranks: any[] | string[];
    rankToNodes: {};
    verifyRanks(): void;
    getNRanks(): number;
    getLastRank(): number;
    getTotalSize(): number;
    addNode(node: any): void;
    removeNode(nodeId: any): void;
    removeNodes(nodeIds: any): void;
    updateRanks(rank: any): void;
    nodesAtRank(rank: any): any;
    assignRankCoordinates(rankGapSize?: any, rankSize?: any): void;
    rankToX(rank: any): number;
    overlapRemoval(sizeKey: any): void;
    overlapRemovalNodes(nodes: any, sizeKey: any): void;
    minMaxLinkDistance(linkType?: any): number[];
    getNextNeighborhoodOrdered(nodesList: any): any;
    getOrderedNodes(nodes: any): any;
    processNodes(nodes: any): void;
    processNode(nodeItem: any): void;
}
import Graph from "./Graph";

import assert from "assert";

import * as fs from 'fs';
import {LayeredGraph, LayeredNode, Node, Link, Graph} from "../src/index";
import {randomIntFromInterval} from "../src/utils.js";
import fpToGraph from "./test-dynHypGraph.spec";


function testGraph() {
    let graph = new Graph(null, null);

    graph.addNode(new Node(1));
    graph.addNode(new Node(2));
    graph.addNode(new Node(3));
    graph.addNode(new Node(4));

    graph.addLink(new Link(1, 2));
    graph.addLink(new Link(2, 3));
    graph.addLink(new Link(1, 3));
    graph.addLink(new Link(3, 4));

    graph.setup();

    return graph;
}


describe('Json to Graph', function() {
    it("Rolla", () => {
        let graph = fpToGraph("data/Rolla_2modes.json");
        // console.log(graph.getNodesByType("PERSON"))

        // console.log(graph.nodeToDegree)
        assert.equal(graph.nodeToDegree["a132"], 4)
    })
})

describe('bfs', function() {
    it("GraphTest", () => {
        let graph = testGraph();

        let link = graph.getLink(1, 2);
        assert.equal(graph.isLinkBridge(link), false);

        let link2 = graph.getLink(3, 4);
        assert.equal(graph.isLinkBridge(link2), true);
    })
})

describe('Json to LayeredGraph', function() {
    it("Rolla", () => {
        // let rawdata = fs.readFileSync("data/Rolla_2modes.json");
        // let jsonData = JSON.parse(rawdata);
        //
        // jsonData["nodes"].forEach(n => {
        //     n["rank"] = 1
        //     // n["rank"] = randomIntFromInterval(1, 3);
        // })
        // let graph = new LayeredGraph(jsonData);

        let graph: LayeredGraph = new LayeredGraph();
        graph.addNode(new LayeredNode(1, 0));
        graph.addNode(new LayeredNode(2, 0));
        graph.addNode(new LayeredNode(3, 1));
        graph.addNode(new LayeredNode(4, 1));
        graph.addNode(new LayeredNode(5, 1));
        graph.addNode(new LayeredNode(6, 2));
        graph.addNode(new LayeredNode(7, 5));

        graph.addLink(new Link(1, 3));
        graph.addLink(new Link(3,6));
        graph.addLink(new Link(5, 7));

        graph.setup();

        assert.deepEqual(graph.ranks, [0,1,2,3,4,5])

        let orderedNeighborhood = graph.getNextNeighborhoodOrdered(graph.nodesAtRank(0));
        // console.log(orderedNeighborhood);
        // console.log(graph.getNodesByType("PERSON"))
    })
})
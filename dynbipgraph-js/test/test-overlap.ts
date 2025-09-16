import assert from "assert";
import Graph from "../src/Graph.js";

import * as fs from 'fs';
import {LayeredGraph, Node} from "../src/index";
import {randomIntFromInterval} from "../src/utils.js";
import {overlapRemoval} from "../src/algorithms/overlap.js";


describe('overlap', function() {
    it("Rolla", () => {
        let nodes_y = [1, 5, 20, 21, 22, 50, 51, 200];
        let width = 5;
        let nodes: Node[] = nodes_y.map((n, i) => new Node(i, {y: n, width:5}));

        overlapRemoval(nodes, "y", "width");
        nodes.forEach((n, i) => {
            if (i < nodes.length - 1) {
                assert.equal(nodes[i + 1].get("y") - n.get("y") > width, true);
            }
        })
        // assert.equal(graph.nodeToDegree["a132"], 4)
    })
})
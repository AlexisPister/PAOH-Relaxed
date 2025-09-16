import assert from "assert";
import Graph from "../src/Graph.js";
import Path from "../src/Path.js";

import * as fs from 'fs';
import {LayeredGraph} from "../src/index";
import {catmullRomFitting} from "../src/catmullBezier.js";
import fpToGraph from "./test-dynHypGraph.spec";


describe('Path', function() {
    it("Rolla", () => {
        let graph = fpToGraph("data/Rolla_2modes.json")
        let path = new Path(graph);

        path.addLink(graph.links[0]);
        path.addLink(graph.links[1]);
        path.addLink(graph.links[2]);
        path.addLink(graph.links[3]);

        let pathNodes = path.getNodes();
        pathNodes.forEach((n, i) => {
            n.set("x", 10 + (i * 10));
            n.set("y", 30 + (i * 20));
        })

        assert.deepEqual(pathNodes[0], graph.links[0].source);
        assert.equal(pathNodes.length, path.links.length + 1);

        let points = path.getPoints();
        let catmull = path.toCatmullPath(0.5);

        let pointsDouble = path.getPointsDouble(10);
        let catmullDouble = path.toCatmullPathDoublePoints(0.5, 10);


        let catmullArray = path.toCatmullSplitPath(0.5);
        console.log(catmull, catmullArray);
    })
})
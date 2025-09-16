import {catmullRomFitting, catmullRomFittingArray} from "./catmullBezier.js";

export default class Path {
    constructor(graph) {
        this.graph = graph;
        this.links = [];
    }

    addLink(link) {
        this.links.push(link);
    }

    addLinks(links) {
        this.links = this.links.concat(links);
    }

    getNodes() {
        let nodes = [this.links[0].source];
        nodes = nodes.concat(...this.links.map(l => l.target));
        return nodes;
    }

    getPoints(xOffset = 0, yOffset = 0) {
        return this.getNodes().map(node => {
            let [x, y] = [node.get("x") + xOffset, node.get("y") + yOffset]
            if (x == null) throw "null x coordinates in path";
            if (y == null) throw "null y coordinates in path";
            return {
                "x": x,
                "y": y
            }
        });
    }

    getPointsDouble(offset) {
        let points = this.getNodes().map(node => {
            return [{
                "x": node.get("x") - offset,
                "y": node.get("y")
            }, {
                "x": node.get("x") + offset,
                "y": node.get("y")
            }]
        });

        points = points.reduce((p1, p2) => p1.concat(p2))
        return points
    }

    toCatmullPath(k = 0.5, xOffset = 0, yOffset = 0) {
        let svgPath = catmullRomFitting(this.getPoints(xOffset, yOffset), k);
        return svgPath;
    }

    toCatmullPathDoublePoints(k = 0.5, offset) {
        let svgPath = catmullRomFitting(this.getPointsDouble(offset), k);
        return svgPath;
    }

    toCatmullSplitPath(k = 0.5, xOffset = 0, yOffset = 0) {
        let svgPaths = catmullRomFittingArray(this.getPoints(xOffset, yOffset), k);
        return svgPaths;

        // let svgPaths = [];
        // this.links.forEach(link => {
        //     let nodes = link.getNodes();
        //     let points = nodes.map(node => {
        //         return {
        //             x: node.get("x") + xOffset,
        //             y: node.get("y") + yOffset
        //         }
        //     })
        //
        //     let svgPath = catmullRomFitting(points, k);
        //     svgPaths.push(svgPath);
        // })
        // return svgPaths;
    }
}
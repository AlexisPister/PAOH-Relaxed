// import {catmullRomFitting, catmullRomFittingArray} from "./catmullBezier.js";
import {CoordinatedObject} from "./CoordinatedObject"
import CloneDeep from "lodash/cloneDeep"

// class PathLink {
//     path: Path
//     source: CoordinatedObject
//     target: CoordinatedObject
//
//     constructor(source: CoordinatedObject, target: CoordinatedObject, path: Path) {
//         this.path = path;
//         this.source = source;
//         this.target = target;
//     }
// }


// class CubicBezierLink extends PathLink {
//     constructor(source: CoordinatedObject, target: CoordinatedObject, path: Path) {
//         super(source, target, path);
//     }
// }

class Point implements CoordinatedObject {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    toString(): string {
        return `${this.x},${this.y}`;
    }
}

class BezierCubicPoint extends Point {
    cp1: Point;
    cp2: Point;

    constructor(x: number, y: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number) {
        super(x, y);
        this.cp1 = new Point(cp1x, cp1y);
        this.cp2 = new Point(cp2x, cp2y);
    }
}

class BezierQuadPoint extends Point {
    constructor(x: number, y: number) {
        super(x, y)
    }
}


export default class Path {
    points: Point[];
    properties: Record<string, any> = {};

    constructor(points: Point[] = []) {
        this.points = points;
    }

    getProperty(name: string): any {
        return this.properties[name];
    }

    setProperty(name: string, value: any) {
        this.properties[name] = value;
    }

    length() {
        return this.points.length;
    }

    // addPoint(node: Point | {x:number, y:number}) {
    addPoint(node: CoordinatedObject) {
        if (node instanceof Point) {
            this.points.push(node)
        } else {
            let point = new Point(node.x, node.y);
            this.points.push(point)
        }
    }

    getPoint() {
        return this.points;
    }

    getNPoint(): number {
        return this.points.length;
    }

    modifyPoint(index: number, newPoint: CoordinatedObject) {
        this.points[index] = this.processPoint(newPoint);
    }

    processPoint(node: CoordinatedObject): Point {
        return (node instanceof Point) ? node : new Point(node.x, node.y);
    }

    startPoint(): CoordinatedObject {
        return this.points[0]
    }

    endPoint(): CoordinatedObject {
        return this.points[1]
    }

    extentPoints(): [CoordinatedObject, CoordinatedObject] {
        return [this.startPoint(), this.endPoint()];
    }

    toSvgPath(): string {
        let pathStr = "";
        this.points.forEach((p, i) => {
            if (i == 0) {
                pathStr += `M ${p.toString()}`
            } else {
                pathStr += ` L ${p.toString()}`
            }
        })
        return pathStr
    }

    translate(x: number, y: number) {
        this.points.forEach(p => {
            p.x += x
            p.y += y
        })
    }

    doubleSegment(i1: number, i2: number) {
        let p1 = this.points[i1];
        let p2 = this.points[i2];

        let p3 = new Point((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);

        // Insert point between p1 and p2
        this.points.splice(i2, 0, p3);
    }

    // Cut at a given point of the path.
    cut(index: number): [Path, Path] {
        let subPath = new Path(CloneDeep(this.points.slice(0, index + 1)))
        let subPath2 = new Path(CloneDeep(this.points.slice(index)))
        return [subPath, subPath2];
    }

    toCatmullPath(alpha = 0.5, xOffset = 0, yOffset = 0) {
        if (alpha == 0 || alpha === undefined) {
            return false;
        }

        let length = this.getNPoint()
        let newPoints = [this.points[0]];
        for (let i = 0; i < length - 1; i++) {
            let p0 = i == 0 ? this.points[0] : this.points[i - 1];
            let p1 = this.points[i];
            let p2 = this.points[i + 1];
            let p3 = i + 2 < length ? this.points[i + 2] : p2;

            let d1 = Math.sqrt(Math.pow(p0.x - p1.x, 2) + Math.pow(p0.y - p1.y, 2));
            let d2 = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
            let d3 = Math.sqrt(Math.pow(p2.x - p3.x, 2) + Math.pow(p2.y - p3.y, 2));

            // Catmull-Rom to Cubic Bezier conversion matrix

            // A = 2d1^2a + 3d1^a * d2^a + d3^2a
            // B = 2d3^2a + 3d3^a * d2^a + d2^2a

            // [   0             1            0          0          ]
            // [   -d2^2a /N     A/N          d1^2a /N   0          ]
            // [   0             d3^2a /M     B/M        -d2^2a /M  ]
            // [   0             0            1          0          ]

            const d3powA = Math.pow(d3, alpha);
            const d3pow2A = Math.pow(d3, 2 * alpha);
            const d2powA = Math.pow(d2, alpha);
            const d2pow2A = Math.pow(d2, 2 * alpha);
            const d1powA = Math.pow(d1, alpha);
            const d1pow2A = Math.pow(d1, 2 * alpha);

            let A = 2 * d1pow2A + 3 * d1powA * d2powA + d2pow2A;
            let B = 2 * d3pow2A + 3 * d3powA * d2powA + d2pow2A;
            let N = 3 * d1powA * (d1powA + d2powA);
            if (N > 0) {
                N = 1 / N;
            }
            let M = 3 * d3powA * (d3powA + d2powA);
            if (M > 0) {
                M = 1 / M;
            }

            let bp1 = {
                x: (-d2pow2A * p0.x + A * p1.x + d1pow2A * p2.x) * N,
                y: (-d2pow2A * p0.y + A * p1.y + d1pow2A * p2.y) * N
            };

            let bp2 = {
                x: (d3pow2A * p1.x + B * p2.x - d2pow2A * p3.x) * M,
                y: (d3pow2A * p1.y + B * p2.y - d2pow2A * p3.y) * M
            };

            if (bp1.x == 0 && bp1.y == 0) {
                bp1 = p1;
            }
            if (bp2.x == 0 && bp2.y == 0) {
                bp2 = p2;
            }
            // let d += 'C' + bp1.x + ',' + bp1.y + ' ' + bp2.x + ',' + bp2.y + ' ' + p2.x + ',' + p2.y + ' ';

            const newPoint = new BezierCubicPoint(p2.x, p2.y, bp1.x, bp1.y, bp2.x,  bp2.y);
            newPoints[i + 1] = newPoint
        }
        this.points = newPoints;
    }

    // getPointsDouble(offset) {
    //     let points = this.getNodes().map(node => {
    //         return [{
    //             "x": node.get("x") - offset,
    //             "y": node.get("y")
    //         }, {
    //             "x": node.get("x") + offset,
    //             "y": node.get("y")
    //         }]
    //     });
    //
    //     points = points.reduce((p1, p2) => p1.concat(p2))
    //     return points
    // }

    // toCatmullPath(k = 0.5, xOffset = 0, yOffset = 0) {
    //     let svgPath = catmullRomFitting(this.getPoints(xOffset, yOffset), k);
    //     return svgPath;
    // }
    //
    // toCatmullPathDoublePoints(k = 0.5, offset) {
    //     let svgPath = catmullRomFitting(this.getPointsDouble(offset), k);
    //     return svgPath;
    // }

    // toCatmullSplitPath(k = 0.5, xOffset = 0, yOffset = 0) {
    //     let svgPaths = catmullRomFittingArray(this.getPoints(xOffset, yOffset), k);
    //     return svgPaths;
    // }
}
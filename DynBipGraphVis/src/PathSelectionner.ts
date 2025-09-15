import * as d3 from 'd3';
// import {intersect} from 'path-intersection';
const intersect = require('path-intersection');

import {globals, nodeTypes} from "./globals";
import {CoordinatedObject, Labelled, Node, Path} from "dynbipgraph";
import {Path as Pathjs} from "paths-js";
import {groupBy} from "lodash";
import {renderingParameters} from "./RenderingParameters";
import {HyperEdge} from "./PaohRelaxedGraph";

export enum Directions {
    HORIZONTAL = "horizontal",
    VERTICAL = "vertical",
}


// export class Intersection implements CoordinatedObject {
// Extends Node class for the occlusion mechanism
export class Intersection extends Node {
    intersected: [string, Path] | HyperEdge;
    selectPath: Pathjs;
    static counter: number = 0;
    labelX: number;
    labelY: number;
    position: Orientations;

    constructor(intersected , selectPath: Pathjs, x, y) {
        super(Intersection.counter, null, null, x, y);
        this.intersected = intersected;
        this.selectPath = selectPath;
        Intersection.counter += 1;
    }

    getPeople() {
        let people
        if (this.intersected instanceof HyperEdge) {
            people = this.intersected.persons.map(n => n.get("person"))
        } else {
            people = [this.intersected[0]]
        }
        return people
    }


    // TODO: Document Case
    label() {
        let label = this.getPeople()
        return label
        // return null
    }
}

export function getPeople(intersect: Intersection) {
    let people
    if (intersect instanceof HyperEdge) {
        people = intersect.persons.map(n => n.get("person"))
    } else {
        people = [intersect[0]]
    }
    return people
}

// Split by directions
export function splitIntersections(intersections: Intersection[]) {
    let hInts = intersections.filter(int => int instanceof HyperEdge)
    let vInts = intersections.filter(int => !(int instanceof HyperEdge))
    return [hInts, vInts];
}

export default class PathSelectionner {
    private svg: d3.Selection<any, any, any, any>;
    private paths: Path[];
    private getTransform;
    // private currentPath: d3.Selection<SVGPathElement, unknown, null, undefined> | null;
    private currentPath: Pathjs;
    private allPaths: Pathjs[] = [];
    private startPoint: CoordinatedObject | null;
    private intersectedPathsCb: Function;
    private getTimeofX: Function;
    private startPathCb: Function;
    private endPathCb: Function;

    private lastTs: number;
    // pathSelection: d3.Selection<SVGPathElement, unknown, null, undefined> | null;
    pathSelection: any;
    private dragHandler: d3.DragBehavior<d3.DraggedElementBaseType, unknown, d3.SubjectPosition | unknown>;
    isDragActive: boolean;
    mouseUpClicked: boolean;
    isDrawing: boolean;
    intersections = new Set();

    handleRadius: number = 5;
    private pathToIntersect: Map<any, any> = new Map();
    private pathToDocIntersect: Map<any, any> = new Map();

    private pathMenuSelection: d3.Selection<SVGGElement | d3.BaseType, Path, d3.BaseType, any>;
    private direction: Directions;

    constructor(svg: d3.Selection<any, any, any, any>, paths: Path[], intersectedPathsCb, transform, getTimeOfX, startPathSb, endPathCb) {
        // this.$svg = $svg;
        this.svg = svg;
        this.paths = paths;
        this.getTransform = transform;
        this.intersectedPathsCb = intersectedPathsCb
        this.getTimeofX = getTimeOfX
        this.startPathCb = startPathSb;
        this.endPathCb = endPathCb;

        this.currentPath = null;
        this.startPoint = null;

        this.svg.on("mousedown", this.handleMouseDown);
        this.svg.on("mousemove", this.handleMouseMove);
        this.svg.on("mouseup", this.handleMouseUp);
        this.setupDrag();

        this.svg.append("g")
            .attr("id", "path-menu")
            .attr("transform", "translate(1600, 100)")
    }

    // Drag event is for moving filter paths
    setupDrag() {
        this.isDragActive = false;
        this.dragHandler = d3.drag()
            .on('start', (e) => {
                this.isDragActive = true;
                d3.select(e.sourceEvent.target).raise()
                    .attr("stroke", "red")
            })
            .on('drag', (event, d) => {
                console.log(d)

                let tx = event.dx;
                let ty = event.dy;

                d.translate(tx, ty);

                this.testIntersection(d);
                // let path = d.toSvgPath();
                // let intersections = this.computeIntersection(path);
                // this.pathToIntersect.set(d, intersections);

                // this.renderIntersections();
                this.renderPaths();
            })
            .on('end', (e) => {
                // e.sourceEvent.stopPropagation()
                d3.select(e.sourceEvent.target)
                    .attr("stroke", "black")
                this.isDragActive = false;
            });
    }

    renderPaths() {
        this.pathSelection = this.svg.select("#others")
            .selectAll(".path")
            .data(this.allPaths, d => d)
            .join((enter) => {
                let g = enter.append("g")

                g.append("path")
                    .classed("crossLine", true)
                    .attr("stroke", d => {
                        // if (d.getProperty(globals.DIRECTION_KEY) == Directions.HORIZONTAL) return renderingParameters.DOCUMENT_COLOR
                        // return "black"
                        return "red"
                    })
                    .attr("stroke-width", 2 / this.getTransform().k)
                    .attr("fill", "none")
                    .attr("d", d => d.toSvgPath())

                // HANDLES
                // g.append("circle")
                //     .attr("cx", d => d.startPoint().x)
                //     .attr("cy", d => d.startPoint().y)
                //     .attr("r", this.handleRadius)
                //     .classed("firstHandle", true)
                g.append("path")
                    .attr("d", (d) => {
                        if (d.getProperty(globals.DIRECTION_KEY) == Directions.VERTICAL) {
                            return d3.symbol(d3.symbolCircle).size(200)()
                        } else if (d.getProperty(globals.DIRECTION_KEY) == Directions.HORIZONTAL) {
                            return d3.symbol(d3.symbolSquare).size(200)()
                        }
                    })
                    .attr("transform", d => `translate(${d.startPoint().x}, ${d.startPoint().y})`)
                    .classed("firstHandle", true)

                // g.append("circle")
                //     // .filter(d => d.getNPoint() > 1)
                //     .attr("cx", d => d.getNPoint() > 1 ? d.endPoint().x : 0)
                //     .attr("cy", d => d.getNPoint() > 1 ? d.endPoint().y : 0)
                //     .attr("r", this.handleRadius)
                //     .classed("secondHandle", true)
                g.append("path")
                    .attr("d", (d) => {
                        if (d.getProperty(globals.DIRECTION_KEY) == Directions.VERTICAL) {
                            return d3.symbol(d3.symbolCircle).size(200)()
                        } else if (d.getProperty(globals.DIRECTION_KEY) == Directions.HORIZONTAL) {
                            return d3.symbol(d3.symbolSquare).size(200)()
                        }
                    })
                    .attr("transform", d => `translate(${d.getNPoint() > 1 ? d.endPoint().x : 0}, ${d.getNPoint() > 1 ? d.endPoint().y : 0})`)
                    .classed("secondHandle", true)

                return g
            }, (update) => {
                update.select(".crossLine")
                    .attr("d", d => d.toSvgPath())
                    .attr("stroke", d => {
                        // if (d.getProperty(globals.DIRECTION_KEY) == Directions.HORIZONTAL) return renderingParameters.DOCUMENT_COLOR
                        // return "black"
                        return "red"
                    })
                    .attr("stroke-width", 2 / this.getTransform().k)

                // update.select(".firstHandle")
                //     .attr("cx", d => d.startPoint().x)
                //     .attr("cy", d => d.startPoint().y)
                update.select(".firstHandle")
                    .attr("d", (d) => {
                        if (d.getProperty(globals.DIRECTION_KEY) == Directions.VERTICAL) {
                            return d3.symbol(d3.symbolCircle).size(200)()
                        } else if (d.getProperty(globals.DIRECTION_KEY) == Directions.HORIZONTAL) {
                            return d3.symbol(d3.symbolSquare).size(200)()
                        }
                    })
                    .attr("transform", d => `translate(${d.startPoint().x}, ${d.startPoint().y})`)

                update.select(".secondHandle")
                    .attr("d", (d) => {
                        if (d.getProperty(globals.DIRECTION_KEY) == Directions.VERTICAL) {
                            return d3.symbol(d3.symbolCircle).size(200)()
                        } else if (d.getProperty(globals.DIRECTION_KEY) == Directions.HORIZONTAL) {
                            return d3.symbol(d3.symbolSquare).size(200)()
                        }
                    })
                    .attr("transform", d => `translate(${d.getNPoint() > 1 ? d.endPoint().x : 0}, ${d.getNPoint() > 1 ? d.endPoint().y : 0})`)
                // .attr("cx", d => d.endPoint().x)
                // .attr("cy", d => d.endPoint().y)

                return update
            })
            .call(this.dragHandler)
            .classed("path", true)
            .on("click", (e) => {
                e.stopPropagation();
            })
            .on("dblclick", (e, d) => {
                e.stopPropagation();
                d.doubleSegment(0, 1);
                let cutPaths = d.cut(1);

                this.allPaths = this.allPaths.filter(v => v != d)
                this.allPaths.push(cutPaths[0]);
                this.allPaths.push(cutPaths[1]);

                this.testAndRenderAll();
                //TODO : intersections
            })

        // this.renderPathMenu();
    }

    testAndRenderAll() {
        this.renderPaths();
        // this.testAllIntersections();
        this.testAllIntersections2();
        this.renderIntersections();
    }

    renderPathMenu() {
        // Sorted paths by time
        let pathsSorted = this.allPaths.sort((a, b) => a.getProperty(globals.TIME_KEY) - b.getProperty(globals.TIME_KEY));
        let timeToPaths = d3.group(pathsSorted, d => d.getProperty(globals.TIME_KEY));

        let xScaleFactor = 50;

        let parentIndex = d3.local()
        // @ts-ignore
        // this.pathMenuSelection = this.svg.select("#path-menu")
        let times = this.svg.select("#path-menu")
            .selectAll(".pathMenuTime")
            .data(Array.from(timeToPaths.keys()), d => d)
            .join((enter) => {
                let g = enter.append("g")

                // g.append("text")
                //     .text(d => d)
                //     .attr("y", (d, i) => i * 30)

                g.append("text")
                    .text(d => d)
                    .attr("x", (d, i) => i * xScaleFactor)
                    .attr("y", (d, i) => 100)

                g.append("line")
                    .text(d => d)
                    .attr("x", (d, i) => i * xScaleFactor)
                    .attr("y", (d, i) => 100)

                return g
            }, (update) => {
                update.select("text")
                    .attr("x", (d, i) => i * xScaleFactor)
                    .attr("y", (d, i) => 100)

                return update
            })
            .each(function (d, i) {
                parentIndex.set(this, i)
            })
            .classed("pathMenuTime", true)

        times
            .selectAll(".path")
            .data(d => Array.from(timeToPaths.get(d)))
            .join("line")
            .attr("x1", function (d, i) {
                const parentData = d3.select(this.parentNode).datum();
                const parentI = parentIndex.get(this.parentNode);
                return parentI * xScaleFactor + i * 10
            })
            .attr("y1", function (d, i) {
                return 15
            })
            .attr("x2", function (d, i) {
                const parentI = parentIndex.get(this.parentNode);
                return parentI * xScaleFactor + i * 10
            })
            .attr("y2", function (d, i) {
                return 75
            })
            .attr("stroke", "black")
            .attr("stroke-width", 3)
            .classed("path", true)
            .on("click", (e, d, i) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.allPaths = this.allPaths.filter(d2 => d2 != d)
                this.renderPaths();
            })
            .on("mousedown", (e) => {
                e.stopPropagation();
            })

        times
            .selectAll(".cross")
            .data(d => Array.from(timeToPaths.get(d)))
            .join("path")
            .attr("d", () => {
                return d3.symbol().type(d3.symbolX).size(70)()
            })
            // .style("fill", function (d) {
            //     return "red"
            // })
            .style("stroke", "red")
            .style("stroke-width", 3)
            .attr("transform", function (d, i) {
                const parentI = parentIndex.get(this.parentNode);
                let x = parentI * xScaleFactor + i * 10
                return `translate(${x + 4}, ${10})`
                // return `translate(${x}, ${10}) rotate(45)`
            })
            .classed("cross", true)
            .on("click", (e, d, i) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.allPaths = this.allPaths.filter(d2 => d2 != d)
                this.renderPaths();
            })
            .on("mousedown", (e) => {
                e.stopPropagation();
            })
    }

    private handleMouseDown = (event: MouseEvent) => {
        // If scroll button
        if (event.which == 2) {
            return false;
        }

        const point: CoordinatedObject = this.getSVGPoint(event);

        // create new path
        this.startNewPath(point);
        this.renderPaths();

        // set start point
        this.startPoint = point;
        this.startPathCb();
    };

    startNewPath(point) {
        let time = this.getTimeofX(point.x);
        this.currentPath = new Pathjs()
        this.currentPath.addPoint(point)
        // Only works for crossing on people paths
        this.currentPath.setProperty(globals.TIME_KEY, time);

        this.allPaths.push(this.currentPath);
    }

    private handleMouseMove = (event: MouseEvent) => {
        if (this.currentPath) {
            this.isDrawing = true;

            const point: CoordinatedObject = this.getSVGPoint(event);

            this.direction = this.findDirection(point);
            this.setPoint(point);
            this.currentPath.setProperty(globals.DIRECTION_KEY, this.direction);

            this.renderPaths();
            this.testIntersection(this.currentPath);
            // const currentPathData = this.currentPath.toSvgPath();
            //
            // // update path
            // // this.currentPath.attr("d", `${this.currentPath.attr("d")} L ${point.x},${point.y}`);
            // // const currentPathData = this.currentPath.node().getAttribute("d");
            //
            // let {x, y, k} = this.getTransform();
            // // const transformedPathData = transformPath(currentPathData, x, y, k)
            // const transformedPathData = currentPathData
            //
            // let intersections = this.computeIntersection(transformedPathData);
            // let docIntersections = this.computeDocIntersection(transformedPathData);
            // this.pathToDocIntersect.set(this.currentPath, docIntersections)
            //
            // // Set time of path from documents
            // if (docIntersections.length > 0) {
            //     this.currentPath.setProperty(globals.TIME_KEY, docIntersections[0].time)
            // }
            //
            // let isNew = this.updateIntersection(this.currentPath, intersections, docIntersections)
            // if (isNew) {
            //     this.renderIntersections();
            // }
        }
    };

    testIntersection(path: Pathjs) {
        const currentPathData = path.toSvgPath();

        // update path
        // this.currentPath.attr("d", `${this.currentPath.attr("d")} L ${point.x},${point.y}`);
        // const currentPathData = this.currentPath.node().getAttribute("d");
        let {x, y, k} = this.getTransform();
        // const transformedPathData = transformPath(currentPathData, x, y, k)
        const transformedPathData = currentPathData

        let intersections = this.computeIntersection(transformedPathData, path);
        let docIntersections = this.computeDocIntersection(transformedPathData, path);
        this.pathToDocIntersect.set(path, docIntersections)

        // Set time of path from documents
        if (docIntersections.length > 0) {
            // path.setProperty(globals.TIME_KEY, docIntersections[0].time)
            path.setProperty(globals.TIME_KEY, docIntersections[0].intersected.time)
        }

        let isNew = this.updateIntersection(path, intersections, docIntersections)

        if (isNew) {
            this.renderIntersections();
        }
    }

    findDirection(secondPoint): Directions {
        let firstPoint = this.currentPath.points[0];
        const xDiff = Math.abs(secondPoint.x - firstPoint.x);
        const yDiff = Math.abs(secondPoint.y - firstPoint.y);
        if (yDiff > xDiff) {
            return Directions.VERTICAL
        } else {
            return Directions.HORIZONTAL
        }
    }

    setPoint(eventPoint: CoordinatedObject) {
        const firstPoint = this.currentPath.points[0];
        if (this.direction == Directions.VERTICAL) {
            eventPoint.x = firstPoint.x
        } else {
            eventPoint.y = firstPoint.y
        }

        if (this.currentPath.points.length == 1) {
            this.currentPath.addPoint(eventPoint);
        } else {
            this.currentPath.modifyPoint(1, eventPoint);
        }
    }

    computeIntersection(pathData, selectionPath: Pathjs): any[] {
        const intersections = [];
        this.svg.selectAll(".arcCrossTime")
            .each((d, i, nodes) => {
                const path = d3.select(nodes[i]);
                let dPath = path.attr("d");

                let isIntersect = intersect(pathData, dPath);
                if (isIntersect.length > 0) {

                    let intersection = new Intersection(d, selectionPath, isIntersect[0].x, isIntersect[0].y)
                    // intersections.push(d)
                    intersections.push(intersection);
                }
            });
        return intersections;
    }

    computeDocIntersection(pathData, selectionPath: Pathjs): any[] {
        const intersections = [];
        this.svg.selectAll(`.${nodeTypes.HYPEREDGE}`)
            .each((d, i, nodes) => {
                const rect = d3.select(nodes[i]);
                const rectBoundingBox = rect.node().getBBox();
                let {x, y, width, height} = rectBoundingBox;

                let rectPath = new Pathjs();
                rectPath.addPoint({x: x, y: y})
                rectPath.addPoint({x: x + width, y: y})
                rectPath.addPoint({x: x + width, y: y + height})
                rectPath.addPoint({x: x, y: y + height})
                rectPath.addPoint({x: x, y: y})

                let isIntersect = intersect(pathData, rectPath.toSvgPath());
                if (isIntersect.length > 0) {
                    // intersections.push(d)

                    let intersection = new Intersection(d, selectionPath, isIntersect[0].x, isIntersect[0].y)
                    intersections.push(intersection)
                }
            });

        return intersections;
    }

    updateIntersection(path, intersections, docIntersections): boolean {
        let previousIntersection = this.pathToIntersect.get(path);
        if (!previousIntersection) previousIntersection = [];

        if (previousIntersection.length === intersections.length + docIntersections.length) {
            return false;
        } else {
            this.pathToIntersect.set(path, intersections.concat(docIntersections));
            return true;
        }

        // let previousIntersection = this.pathToIntersect.get(path);
        // if (!previousIntersection) previousIntersection = [];
        //
        // if (previousIntersection.length === intersections.length) {
        //     return false;
        // } else {
        //     this.pathToIntersect.set(this.currentPath, intersections);
        //     return true;
        // }
    }

    testAllIntersections() {
        this.pathToIntersect.clear();
        this.svg.selectAll(".arcCrossTime")
            .each((d, i, nodes) => {
                const path = d3.select(nodes[i]);
                let dPath = path.attr("d")

                this.allPaths.forEach(drawnPath => {
                    let isIntersect = intersect(drawnPath.toSvgPath(), dPath);
                    if (isIntersect.length > 0) {
                        let ints = this.pathToIntersect.get(drawnPath)

                        if (ints) {
                            ints = ints.push(d)
                            this.pathToIntersect.set(drawnPath, ints)
                        } else {
                            this.pathToIntersect.set(drawnPath, [d])
                        }
                    }
                })
            });
    }

    testAllIntersections2() {
        this.allPaths.forEach(path => {
            this.testIntersection(path)
        })
    }

    renderIntersections() {
        // let timeToIntersections = {}
        // this.pathToIntersect.forEach((intersects, path) => {
        //     let time = path.getProperty(globals.TIME_KEY)
        //     if (timeToIntersections[time]) {
        //         timeToIntersections[time] = intersects.concat(timeToIntersections[time])
        //     } else {
        //         timeToIntersections[time] = intersects
        //     }
        // })
        //
        // let allIntersects = Object.values(timeToIntersections)
        // this.intersectedPathsCb(allIntersects);
        this.intersectedPathsCb(this.pathToIntersect);
        // this.intersectedPathsCb(this.pathToIntersect, Array.from(this.pathToDocIntersect.values()), this.pathToDocIntersect);

        // Work but do not do the union of the paths of the same TS
        // this.intersectedPathsCb(Array.from(this.pathToIntersect.values()));
    }

    private handleMouseUp = (e) => {
        // remove current path
        if (this.currentPath && this.isDrawing) {
            this.mouseUpClicked = true;

            // Does not run the svg click event
            // e.stopPropagation();
            // e.stopPropagation();
            // e.stopImmediatePropagation();
            // e.preventDefault();
        }
        this.currentPath = null;
        this.isDrawing = false;

        this.endPathCb();
    };

    private getSVGPoint(event: MouseEvent): CoordinatedObject {
        const svg: SVGSVGElement = this.svg.node()!;
        const point: DOMPoint = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        // const screenCTM: DOMMatrix = svg.getScreenCTM()!;
        // const svgPoint: DOMPoint = point.matrixTransform(screenCTM.inverse());
        let screenCTM = this.svg.select("#others").node().getScreenCTM()
        const svgPoint: DOMPoint = point.matrixTransform(screenCTM.inverse());

        return {x: svgPoint.x, y: svgPoint.y};
    }

    removePaths() {
        this.allPaths = [];
        this.pathToIntersect = new Map();
        this.pathToDocIntersect = new Map();
        this.renderPaths();
    }

    createNewPath(point: CoordinatedObject) {
        let time = this.getTimeofX(point.x);
        let path = new Pathjs()

        path.addPoint({x: point.x, y: point.y - 10})
        path.addPoint({x: point.x, y: point.y + 10})

        path.setProperty(globals.TIME_KEY, time);
        path.setProperty(globals.DIRECTION_KEY, Directions.VERTICAL);

        this.allPaths.push(path);
    }
}


function transformPath(path: string, x: number, y: number, k: number): string {
    // split the path into individual commands
    const commands = path.split(/(?=[A-Za-z])/);

    // initialize the transformed path string
    let transformedPath = '';

    // loop through each command and transform its arguments
    commands.forEach(command => {
        // const [type, ...args] = command.trim().split(/\s+/);
        const [type, ...args] = command.trim().split(/\s+/);
        const transformedArgs = args.map(arg => {
            let [valueS, nextValueS] = arg.split(",")
            let [value, nextValue] = [parseFloat(valueS), parseFloat(nextValueS)]
            // const value = parseFloat(arg);
            if (isNaN(value)) {
                return arg; // not a number, so don't transform
            } else if (type === 'A' || type === 'a') {
                // handle special case for elliptical arc command
                const [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x2, y2] = args.map(parseFloat);
                const [x1p, y1p] = transformPoint(x, y, k, value, nextValue);
                const [x2p, y2p] = transformPoint(x, y, k, x2, y2);
                return `${x1p.toFixed(2)},${y1p.toFixed(2)} ${rx.toFixed(2)},${ry.toFixed(2)} ${xAxisRotation} ${largeArcFlag} ${sweepFlag} ${x2p.toFixed(2)},${y2p.toFixed(2)}`;
            } else {
                // transform the coordinate using the given x, y, and k values
                const transformedValue = value * k;
                if (type === 'H' || type === 'h') {
                    // horizontal line command
                    return transformedValue.toFixed(2);
                } else if (type === 'V' || type === 'v') {
                    // vertical line command
                    const [prevX, prevY] = getLastCoords(transformedPath);
                    return `${prevX.toFixed(2)},${transformedValue.toFixed(2)}`;
                } else {
                    // regular coordinate command (M, L, C, S, Q, T)
                    const [xNew, yNew] = transformPoint(x, y, k, value, nextValue);
                    return `${xNew.toFixed(2)},${yNew.toFixed(2)}`;
                }
            }
        });
        transformedPath += `${type}${transformedArgs.join(' ')} `;
    });

    return transformedPath.trim();
}

// helper function to transform a single point using the given x, y, and k values
function transformPoint(x: number, y: number, k: number, px: number, py: number): [number, number] {
    // const x2 = x + k * (px - x);
    // const x2 = px * k - x;
    const x2 = (px - x) / k;
    // const y2 = y + k * (py - y);
    // const y2 = py * k - y;
    const y2 = (py - y) / k;

    return [x2, y2];
}

// helper function to get the last set of coordinates in the path
function getLastCoords(path: string): [number, number] {
    const coordsRegex = /(\d+\.?\d*)\s*,\s*(\d+\.?\d*)$/;
    const matches = path.match(coordsRegex);
    if (matches) {
        return [parseFloat(matches[1]), parseFloat(matches[2])];
    } else {
        return [0, 0];
    }
}

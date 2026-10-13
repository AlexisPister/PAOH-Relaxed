import { CoordinatedObject } from "./CoordinatedObject";
declare class Point implements CoordinatedObject {
    x: number;
    y: number;
    constructor(x: number, y: number);
    toString(): string;
}
export default class Path {
    points: Point[];
    properties: Record<string, any>;
    constructor(points?: Point[]);
    getProperty(name: string): any;
    setProperty(name: string, value: any): void;
    length(): number;
    addPoint(node: CoordinatedObject): void;
    getPoint(): Point[];
    getNPoint(): number;
    modifyPoint(index: number, newPoint: CoordinatedObject): void;
    processPoint(node: CoordinatedObject): Point;
    startPoint(): CoordinatedObject;
    endPoint(): CoordinatedObject;
    extentPoints(): [CoordinatedObject, CoordinatedObject];
    toSvgPath(): string;
    translate(x: number, y: number): void;
    doubleSegment(i1: number, i2: number): void;
    cut(index: number): [Path, Path];
    toCatmullPath(alpha?: number, xOffset?: number, yOffset?: number): false | undefined;
}
export {};

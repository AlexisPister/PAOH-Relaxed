export default class Path {
    constructor(graph: any);
    graph: any;
    links: any[];
    addLink(link: any): void;
    addLinks(links: any): void;
    getNodes(): any[];
    getPoints(xOffset?: number, yOffset?: number): {
        x: any;
        y: any;
    }[];
    getPointsDouble(offset: any): {
        x: any;
        y: any;
    }[][];
    toCatmullPath(k?: number, xOffset?: number, yOffset?: number): string;
    toCatmullPathDoublePoints(k: number, offset: any): string;
    toCatmullSplitPath(k?: number, xOffset?: number, yOffset?: number): false | string[];
}

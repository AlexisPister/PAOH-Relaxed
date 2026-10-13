interface CoordinatedObject {
    x: number;
    y: number;
    width?: number;
    height?: number;
}
interface Labelled {
    label: () => string;
    labelX?: number;
    labelY?: number;
    position?: Orientations;
}
export declare enum Orientations {
    HORIZONTAL = "horizontal",
    VERTICAL = "vertical"
}
declare class Node implements CoordinatedObject, Labelled {
    id: string;
    type: string;
    attributes: object;
    x: number;
    y: number;
    width: number;
    height: number;
    disabled: boolean;
    intId: number;
    static counter: number;
    constructor(id: any, attributes?: any, nodeType?: any, x?: any, y?: any, width?: any, height?: any);
    label(): string;
    get(attribute: any): any;
    set(attribute: any, value: any): void;
    getIntId(): number;
}
declare class Link {
    _id: string;
    type: string;
    attributes: object;
    source: string | Node;
    target: string | Node;
    constructor(source: any, target: any, linkType?: any, attributes?: any, id?: any);
    id(): string;
    get(attribute: any): any;
    set(attribute: any, value: any): void;
    getSourceId(): string;
    getTargetId(): string;
    getSource(): Node;
    getTarget(): Node;
    getNodes(): Node[];
    isEqual(sourceId: any, targetId: any): boolean;
}
declare class PersonNode extends Node {
    name: string;
    constructor(id: any, attributes: any, nodeType: any, name: any, x: any, y: any);
    nameWithId(): string;
    label(): string;
    static getIdFromNameId(nameWihId: any): any;
}
declare class DocumentNode extends Node {
    time: number;
    constructor(id: any, attributes: any, nodeType: any, time: any, x: any, y: any);
}
declare class LayeredNode extends Node {
    rank: number;
    constructor(id: any, rank: any, attributes?: any, nodeType?: any, x?: any, y?: any, width?: any, height?: any);
}
export { Node, PersonNode, DocumentNode, LayeredNode, Link, CoordinatedObject, Labelled };

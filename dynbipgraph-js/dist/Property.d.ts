export namespace PropertyTypesEnum {
    let NOMIMAL: number;
    let CATEGORICAL: number;
    let NUMERIC: number;
}
export class Property {
    static categoricalThreshold: number;
    static NODETYPE_ALL: string;
    static setCategoricalThreshold(k: any): void;
    constructor(name: any);
    name: any;
    allValues: any[];
    colorScale: any;
    setNodeType(nodeType: any): void;
    nodeType: any;
    addValue(value: any): void;
    update(): void;
    computeDomain(): void;
    domain: any[] | number[];
    determineType(): void;
    type: number;
    getDomainWithoutNull(): any[];
    computeColorScale(): void;
    getColorScale(): any;
}
export class ArrayProperty extends Property {
    addArrayValue(arrayValue: any): void;
}

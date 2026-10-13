import * as d3 from 'd3-scale-chromatic';
import { DocumentNode, Node } from "./Node";
import Graph from "./Graph";
export default class BipartiteDynGraph extends Graph {
    personType: string;
    documentType: string;
    times: number[];
    timeMin: number;
    timeMax: number;
    documentTypeToRoles: Record<string, string[]>;
    timeKey: string;
    nPersons: number;
    nDocuments: number;
    documentTypeKey: string;
    roleColorScale: d3.colorScale;
    roles: Array<any>;
    constructor(jsonData: any);
    persons(onlyId?: boolean): string[] | Node[];
    documents(onlyId?: boolean, withTime?: boolean): string[] | DocumentNode[];
    documentsAtTime(time: any, onlyId: any): string[] | DocumentNode[];
    timeToDocuments(): {
        [k: string]: string[] | DocumentNode[];
    };
    linksByTimes(time: any): any[];
    timeToPersons(): Record<any, any>;
    personsAtTime(time: any): any[];
    personDocumentsByTime(personId: any): {};
    personCollaboratorsByTime(personId: any): {};
    setup(): void;
    computeMetrics(): void;
    computeTimeSpan(): void;
    computeRolesByDocumentType(): void;
    computeRoles(): void;
    rolesColorScale(): d3.colorScale;
    timeToRolesDist(): {};
    nextTime(time: any): number;
    fromJson(jsonData: any): void;
    processNode(nodeItem: any): void;
    toJson(): {
        metadata: object;
        nodes: {
            [x: string]: string;
            id: string;
        }[];
        links: {
            [x: string]: string;
            source: string;
            target: string;
        }[];
    };
    toPaohJson(): {
        metadata: any;
        nodes: {
            [x: string]: string | number;
            id: number;
        }[];
        links: {
            [x: string]: string | number;
            source: string | number;
            target: string | number;
            ts: string;
        }[];
    };
    nodesJson(): {
        [x: string]: string;
        id: string;
    }[];
    paohNodesJson(): {
        [x: string]: string | number;
        id: number;
    }[];
    paohLinksJson(): {
        [x: string]: string | number;
        source: string | number;
        target: string | number;
        ts: string;
    }[];
    linksJson(): {
        [x: string]: string;
        source: string;
        target: string;
    }[];
}

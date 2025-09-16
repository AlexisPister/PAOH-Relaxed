import * as d3 from 'd3-scale-chromatic';
import * as scale from 'd3-scale';

import {DocumentNode, Link, Node, PersonNode} from "./Node";
import Graph from "./Graph";
import {allPairs} from "./utils.js";
import _ from "lodash";
import Doc = Mocha.reporters.Doc;

export default class BipartiteDynGraph extends Graph {
    personType: string;
    documentType: string;

    times: number[];
    timeMin: number;
    timeMax: number;
    documentTypeToRoles: Record<string, string[]>
    timeKey: string;

    nPersons: number;
    nDocuments: number;

    // For Json processing
    documentTypeKey: string
    roleColorScale: d3.colorScale;
    roles: Array<any>;

    constructor(jsonData) {
        super(null, null);

        // Call from this constructor, otherwise the call from the base constructor overwrite the fields
        if (jsonData) {
            this.fromJson(jsonData);
        }
    }

    persons(onlyId = false) {
        if (onlyId) {
            return this.nodes.filter(n => n.type == this.personType).map(n => n.id);
        } else {
            return this.nodes.filter(n => n.type == this.personType);
        }
    }

    documents(onlyId = false, withTime = true) {
        // let documents: Array<DocumentNode> = this.nodes.filter(n => n.type == this.documentType);
        let documents = this.nodes.filter(n => n.type == this.documentType) as Array<DocumentNode>
        if (withTime) documents = documents.filter(n => n.time);
        if (onlyId) return documents.map(n => n.id)

        return documents;
    }

    documentsAtTime(time, onlyId) {
        let documents = this.documents() as DocumentNode[];
        if (onlyId) {
            return documents.filter(d => d.time == time).map(d => d.id);
        } else {
            return documents.filter(d => d.time == time);
        }
    }

    timeToDocuments() {
        return Object.fromEntries(this.times.map(time => [time, this.documentsAtTime(time, false)]))
    }

    linksByTimes(time) {
        let documentIds = this.documentsAtTime(time, true);
        let allLinksTime = [];
        documentIds.forEach(documentId => {
            let links = this.getAdjacentLinks(documentId);
            allLinksTime = allLinksTime.concat(links);
        });

        return allLinksTime;
    }

    timeToPersons(): Record<any, any> {
        return Object.fromEntries(this.times.map(time => [time, this.personsAtTime(time)]));
    }

    personsAtTime(time) {
        let documents = this.documentsAtTime(time, true);
        let allPersons = [];
        for (let document of documents) {
            let persons = this.getArrayNeighbors(document);
            allPersons = allPersons.concat(persons);
        }

        return [...new Set(allPersons)];
    }

    // Return {time: [documents]} for given person id.
    personDocumentsByTime(personId) {
        let timeToDocument = {};
        let documents = this.getNeighbors(personId, true) as DocumentNode[];
        let documentsWithTime = documents.filter(doc => doc.time);

        documentsWithTime.sort((d1, d2) => d1.time - d2.time);

        for (let document of documentsWithTime) {
            let time = document.time;
            if (timeToDocument[time]) {
                timeToDocument[time].push(document);
            } else {
                timeToDocument[time] = [document];
            }
        }
        return timeToDocument;
    }

    personCollaboratorsByTime(personId) {
        let personToCollaboratorsToTime = {};

        let documents = this.getNeighbors(personId, true);

        for (let document of documents) {
            let time = document.time;

            let collaborators = this.getNeighbors(document.id);
            for (const [link, person] of collaborators) {
                if (person.id != personId) {
                    if (personToCollaboratorsToTime[person.id]) {
                        if (personToCollaboratorsToTime[person.id][time]) {
                            personToCollaboratorsToTime[person.id][time].push(link)
                        } else {
                            personToCollaboratorsToTime[person.id][time] = [link]
                        }
                    } else {
                        personToCollaboratorsToTime[person.id] = {[time]: [link]}
                    }
                }
            }
        }

        return personToCollaboratorsToTime;
    }

    setup() {
        super.setup();
        this.computeTimeSpan();
        this.computeRoles();
        if (this.documentTypeKey) {
            this.computeRolesByDocumentType();
        }
    }

    computeMetrics() {
        super.computeMetrics();
        this.nPersons = this.persons().length;
        this.nDocuments = this.documents(true, false).length;
    }

    computeTimeSpan() {
        let allTimes: number[] = this.documents().map(d => d.time);
        let allTimesNoNull = allTimes.filter(time => {
            if (time) {
                return true
            } else {
                return false
            }
        });
        this.times = [...new Set(allTimesNoNull)].sort();
        this.timeMin = Math.min(...this.times);
        this.timeMax = Math.max(...this.times);
    }


    computeRolesByDocumentType() {
        this.documentTypeToRoles = {};

        let documents = this.documents() as DocumentNode[];
        for (let doc of documents) {
            let links = this.getAdjacentLinks(doc.id) as Link[];
            let roles = links.map(l => l.type);
            let docType = doc.get(this.documentTypeKey);
            if (!this.documentTypeToRoles[docType]) {
                this.documentTypeToRoles[docType] = [];
            }
            roles.forEach(role => {
                if (!this.documentTypeToRoles[docType].includes(role)) {
                    this.documentTypeToRoles[docType].push(role);
                }
            })
        }
    }

    computeRoles() {
        this.roles = [];
        let documents = this.documents() as DocumentNode[];
        for (let doc of documents) {
            let links = this.getAdjacentLinks(doc.id) as Link[];
            let roles = links.map(l => l.type);
            roles.forEach(role => {
                if (!this.roles.includes(role)) {
                    this.roles.push(role)
                }
            })
        }
    }

    rolesColorScale() {
        if (!this.roleColorScale) this.roleColorScale = scale.scaleOrdinal().domain(this.roles).range(d3.schemeCategory10)
        return this.roleColorScale
    }

    timeToRolesDist() {
        let timeToRoles = {}
        for (let time of this.times) {
            timeToRoles[time] = {}
            let links = this.linksByTimes(time);
            let roles = links.map(l => l.type);
            roles.forEach(r => {
                if (timeToRoles[time][r]) {
                    timeToRoles[time][r] += 1
                } else {
                    timeToRoles[time][r] = 1
                }
            })
            for (let role of this.roles) {
                if (!timeToRoles[time][role]) timeToRoles[time][role] = 0;
            }
        }
        return timeToRoles
    }

    nextTime(time) {
        if (this.timeMax == time) throw "time is already timeMax"
        return this.times[this.times.indexOf(time) + 1]
    }

    fromJson(jsonData) {
        this.metadata = jsonData["metadata"];
        this.documentType = this.metadata["source_entity_type"];
        this.personType = this.metadata["target_entity_type"];
        this.linkTypeKey = this.metadata["edgeType"];

        if (this.metadata["entityType"]) {
            this.nodeTypeKey = this.metadata["entityType"];
        } else if (this.metadata["entity_type"]) {
            this.nodeTypeKey = this.metadata["entity_type"];
        }

        if (this.metadata["format"] == "2.1.0") {
            this.timeKey = "ts";
        } else if (this.metadata["time_slot"]) {
            this.timeKey = this.metadata["time_slot"];
        } else if (this.metadata["time_key"]) {
            this.timeKey = this.metadata["time_key"];
        }

        this.documentTypeKey = this.metadata["sourceTypeKey"];

        this.processNodes(jsonData["nodes"])
        this.processLinks(jsonData["links"]);

        this.setup();
    }

    processNode(nodeItem) {
        let id = nodeItem.id;
        let entityType = nodeItem[this.nodeTypeKey];
        let x = nodeItem.x;
        let y = nodeItem.y;

        let attributes = _.cloneDeep(nodeItem);
        delete attributes["id"];
        delete attributes[this.nodeTypeKey];
        delete attributes["x"];
        delete attributes["y"];

        let node;
        if (entityType == this.documentType) {
            let time = Number(nodeItem[this.timeKey]);
            node = new DocumentNode(id, attributes, entityType, time, x, y);
        } else if (entityType == this.personType) {
            let name = nodeItem["name"]; // TODO: remove hard encoding
            // delete attributes["name"];
            node = new PersonNode(id, attributes, entityType, name, x, y);
        }

        this.nodes.push(node);
        this.idToNode[id] = node;
    }

    toJson() {
        return {
            "metadata": this.metadata,
            "nodes": this.nodesJson(),
            "links": this.linksJson()
        }
    }

    toPaohJson() {
        let metadata = _.cloneDeep(this.metadata)
        metadata["entity_type"] = metadata["entityType"];
        metadata["format"] = "2.1.0";

        return {
            "metadata": metadata,
            "nodes": this.paohNodesJson(),
            "links": this.paohLinksJson()
        }
    }

    nodesJson() {
        return this.nodes.map(node => {
            // return {id: node.id, "entity_type": node.type, ...node.attributes};
            return {id: node.id, [this.nodeTypeKey]: node.type, ...node.attributes};
        })
    }

    paohNodesJson() {
        return this.nodes.map(node => {
            // if (node.type == this.documentType) {

            // let nodeJson = {id: node.id, [this.nodeTypeKey]: node.type, ...node.attributes};
            let nodeJson = {id: node.getIntId(), [this.nodeTypeKey]: node.type, ...node.attributes};
            if (node instanceof DocumentNode) {
                nodeJson["ts"] = `${node.time}`;
            }
            return nodeJson
        })
    }

    paohLinksJson() {
        return this.links.map(link => {
            // @ts-ignore
            return {
                // @ts-ignore
                source: typeof link.source == "string" ? link.source : link.source.getIntId(),
                // @ts-ignore
                target: typeof link.target == "string" ? link.target : link.target.getIntId(),
                [this.linkTypeKey]: link.type,
                // @ts-ignore
                ts: `${link.source.time}`,
                ...link.attributes
            };
        })
    }

    linksJson() {
        return this.links.map(link => {
            // @ts-ignore
            return {
                source: typeof link.source == "string" ? link.source : link.source.id,
                // @ts-ignore
                target: typeof link.target == "string" ? link.target : link.target.id,
                [this.linkTypeKey]: link.type,
                ...link.attributes
            };
        })
    }
}
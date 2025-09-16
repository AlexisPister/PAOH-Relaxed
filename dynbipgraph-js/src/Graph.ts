import {ArrayProperty, Property} from "./Property.js";
import {Node, Link} from "./Node";

import _, {property} from "lodash";
import {groupBy, mergeMaps, isObject} from "./utils.js";
import * as string_decoder from "string_decoder";

export default class Graph {
    nodes: Node[];
    links: Link[];
    neighbors: Record<string, {in: Map<Link, Node>, out: Map<Link, Node>}>;

    idToNode: Record<string, Node>;
    nodeTypes: string[];
    linkTypes: string[];
    properties: Record<string, Property>;

    nNodes: number;
    nLinks: number;
    nodeToDegree: Record<string, number>;
    nodesIds: string[];
    linksIds: string[];

    // FOR JSON
    metadata: object;
    nodeTypeKey: string;
    linkTypeKey: string;

    constructor(jsonData, referenceGraph) {
        this.init();

        if (jsonData) {
            this.fromJson(jsonData);
        }
        if (referenceGraph) {
            this.properties = referenceGraph.properties;
            this.nodeTypes = referenceGraph.nodeTypes;
            this.linkTypes = referenceGraph.linkTypes;
        }
    }

    getNode(nId) {
        return this.idToNode[nId];
    }

    getNodes(data = true) {
        if (data) {
            return this.nodes;
        } else {
            return this.nodes.map(n => n.id);
        }
    }

    getLink(sourceId, targetId) {
        // let link = this.links.filter(link => link.source.id == sourceId && link.target.id == targetId);
        let link = this.links.filter(link => link.isEqual(sourceId, targetId));
        if (link.length > 0) {
            return link[0];
        } else {
            return null;
        }
    }

    init() {
        this.nodes = [];
        this.links = [];
        this.idToNode = {};
    }

    fromJson(jsonData) {
        if (jsonData["metadata"]) {
            let metadata = jsonData["metadata"];
            this.linkTypeKey = metadata["edgeType"];
            this.nodeTypeKey = metadata["entityType"];
        } else {
            this.linkTypeKey = null;
            this.nodeTypeKey = null;
        }

        this.processNodes(jsonData["nodes"]);
        this.processLinks(jsonData["links"]);

        this.setup();
    }

    processNodes(nodes) {
        for (let nodeItem of nodes) {
            this.processNode(nodeItem)
        }
    }

    processNode(nodeItem) {
        let id = nodeItem.id;
        let entityType = this.nodeTypeKey ? nodeItem[this.nodeTypeKey] : null;
        let x = nodeItem.x;
        let y = nodeItem.y;

        console.log(nodeItem.id)

        let attributes = _.cloneDeep(nodeItem);
        delete attributes["id"];
        delete attributes[this.nodeTypeKey];
        delete attributes["x"];
        delete attributes["y"];

        let node = new Node(id, attributes, entityType, x, y);
        this.addNode(node);
    }

    addNode(node) {
        this.nodes.push(node);
        this.idToNode[node.id] = node;
    }

    processLinks(links) {
        for (let linkItem of links) {
            let source = linkItem.source;
            let target = linkItem.target;
            let id = linkItem.id;
            let linkType = this.linkTypeKey ? linkItem[this.linkTypeKey] : null;

            let attributes = _.cloneDeep(linkItem);
            delete attributes["source"];
            delete attributes["target"];
            delete attributes[this.linkTypeKey];

            let link = new Link(source, target, linkType, attributes, id);
            this.addLink(link);
        }
    }

    public addLink(link) {
        this.links.push(link);
        this.setLinkSourceTargetAsReferences(link);
    }

    setup() {
        // this.setSourceTargetsAsReferences();
        this.computeNeighbors();
        this.findNodeTypes();
        this.findLinkTypes();
        this.computeMetrics();
        this.computePropertiesStats();
    }

    computeMetrics() {
        this.nNodes = this.nodes.length;
        this.nLinks = this.links.length;
        this.computeDegree();
    }

    getNNodes(): number {
        return this.nodes.length;
    }

    getNLinks(): number {
        return this.links.length;
    }

    computeNeighbors() {
        // Node to linkId to Node
        this.neighbors = Object.fromEntries(this.nodes.map(n => [n.id, {
            "in": new Map(),
            "out": new Map()
        }]))

        this.links.forEach(l => {
            this.neighbors[l.getSourceId()].out.set(l, l.getTarget());
            this.neighbors[l.getTargetId()].in.set(l, l.getSource());
        })
    }

    getNeighbors(nId, notLinks = false, directed = false) {
        let linkToNode = directed ? this.neighbors[nId]['out'] : mergeMaps(this.neighbors[nId].in, this.neighbors[nId].out);

        if (notLinks) {
            return Array.from(linkToNode.values());
        } else {
            return linkToNode;
        }
    }

    getArrayNeighbors(nId, directed = false): Node[] {
        return this.getNeighbors(nId, true, directed) as Node[];
    }

    getMapNeighbors(nId, directed = false): Map<Link, Node> {
        return this.getNeighbors(nId, false, directed) as Map<Link, Node>;
    }

    getAdjacentLinks(nId, directed = false) {
        let linkToNode = directed ? this.neighbors[nId]['out'] : mergeMaps(this.neighbors[nId].in, this.neighbors[nId].out);
        return Array.from(linkToNode.keys());
    }

    computePropertiesStats() {
        // Properties is {name : Property Object}
        this.properties = {};
        for (let node of this.nodes) {
            for (let [name, value] of Object.entries(node.attributes)) {
                let property = this.properties[name];
                if (property) {
                    if (property instanceof ArrayProperty) {
                        property.addArrayValue(value);
                    } else {
                        property.addValue(value);
                    }
                } else {
                    let property;
                    if (Array.isArray(value)) {
                        property = new ArrayProperty(name);
                        property.addArrayValue(value);
                    } else {
                        property = new Property(name);
                        property.addValue(value);
                    }
                    this.properties[name] = property;
                }
                let nodeType = node.type;
                this.properties[name].setNodeType(nodeType);
            }
        }

        Object.values(this.properties).forEach(property => {
            property.update();
        })
    }

    getPropertyValueToNodes(property) {
        let propToNode = {};
        this.nodes.forEach(node => {
            let propertyValue = node.get(property);
            if (propertyValue) {
                if (propToNode[propertyValue]) {
                    propToNode[propertyValue].push(node.id);
                } else {
                    propToNode[propertyValue] = [node.id]
                }
            }
        })
        return propToNode;
    }

    addProperty(property) {
        this.properties[property.name] = property;
    }

    propertiesByNodeType() {
        return groupBy(Object.values(this.properties), "nodeType");
    }

    getProperty(name) {
        return this.properties[name];
    }

    getPropertiesByNodeType(nodeType) {
        let nodeTypeToProperties = this.propertiesByNodeType()
        return nodeTypeToProperties[nodeType];
    }

    getAllNodeTypeProperties() {
        let nodeTypeToProperties = this.propertiesByNodeType()
        if (nodeTypeToProperties[Property.NODETYPE_ALL]) {
            return nodeTypeToProperties[Property.NODETYPE_ALL];
        } else {
            return [];
        }
    }

    getPropertyValues(property: string | Property) {
        if (typeof property == "string") {
            property = this.properties[property] as Property
        }
        let typeofProp = property.nodeType
        let nodes = this.nodes.filter(n => n.type == typeofProp);

        // @ts-ignore
        return nodes.map(node => node.get(property.name));
        // return this.nodes.map(node => node.get(property));
    }

    getNodeToPropertyValue(property) {
        return Object.fromEntries(this.nodes.map(node => [node.id, node.get(property)]));
    }

    computeDegree() {
        this.nodeToDegree = {}
        for (let [nId, neighbors] of Object.entries(this.neighbors)) {
            this.nodeToDegree[nId] = neighbors["in"].size + neighbors["out"].size;
        }
    }

    degree(nodeId) {
        return this.nodeToDegree[nodeId];
    }

    entityIds() {
        this.nodesIds = this.nodes.map(n => n.id);
        this.linksIds = this.links.map(l => l.id());
        return this.nodesIds.concat(this.linksIds);
    }

    allNeighbors(nodeIds): Record<symbol, symbol[]> {
        let neighborsToNodes: Record<symbol, symbol[]> = {}
        nodeIds.forEach(nId => {
            this.getArrayNeighbors(nId).forEach(neighbor => {
                let neighborId = neighbor.id;
                if (!neighborsToNodes[neighborId]) {
                    neighborsToNodes[neighborId] = [];
                }
                neighborsToNodes[neighborId].push(nId);
            })
        })
        return neighborsToNodes;
    }

    disableNode(nodeId) {
        let node = this.getNode(nodeId);
        node.disabled = true;
    }

    disableNodes(nodesIds) {
        nodesIds.forEach(nId => this.disableNode(nId));
    }

    removeNode(nodeId) {
        this.nodes = this.nodes.filter(node => node.id != nodeId);
        delete this.idToNode[nodeId];
        this.links = this.links.filter(link => link.source != nodeId && link.target != nodeId)
    }

    removeNodes(nodesIds, onlyRendering = false) {
        this.nodes = this.nodes.filter(node => !nodesIds.includes(node.id));
        nodesIds.forEach(nodeId => {
            delete this.idToNode[nodeId];
        });

        this.links = this.links.filter(link => !nodesIds.includes(link.getSourceId()) && !nodesIds.includes(link.getTargetId()));
    }

    removeLink(linkToRemove) {
        this.links = this.links.filter(link => link != linkToRemove);
    }

    nodesWithProperty(propertyName) {
        return this.nodes.filter(n => n.attributes[propertyName]);
    }

    getNodesByType(nodeType) {
        return this.nodes.filter((n) => n.type == nodeType);
    }

    getLinksByType(linkType) {
        return this.links.filter((l) => l.type == linkType);
    }

    setSourceTargetsAsReferences() {
        this.links.forEach(link => {
            this.setLinkSourceTargetAsReferences(link);
        })
    }

    setLinkSourceTargetAsReferences(link) {
        if (!isObject(link.source) && !isObject(link.target)) {
            link["source"] = this.idToNode[link["source"]];
            link["target"] = this.idToNode[link["target"]];
        }
    }

    findLinkTypes() {
        this.linkTypes = [];
        this.links.forEach((link) => {
            if (!this.linkTypes.includes(link.type)) this.linkTypes.push(link.type);
        })
    }

    findNodeTypes() {
        this.nodeTypes = [];
        this.nodes.forEach((node) => {
            if (!this.nodeTypes.includes(node.type)) this.nodeTypes.push(node.type);
        })
    }

    getLinks(type) {
        if (type) {
            return this.links.filter(l => l.type == type);
        } else {
            return this.links;
        }
    }

    removeNodesCoordinates() {
        this.nodes.forEach(node => {
            delete node["x"];
            delete node["y"];
        })
    }

    isLinkBridge(link) {
        let sourceId = link.source.id;
        this.removeLink(link);
        this.computeNeighbors();

        let visited = this.bfs(sourceId);

        this.addLink(link);
        this.computeNeighbors();

        if (visited.length < this.getNNodes()) {
            return true;
        } else {
            return false;
        }
    }

    bfs(nodeId) {
        let visited = [];
        this.bfsSearch(nodeId, visited);
        return visited
    }

    bfsSearch(nodeId, visited) {
        visited.push(nodeId);
        // let neighbors = this.getNeighbors(nodeId, true, false).map(node => node.id);

        let neighbors = this.getNeighbors(nodeId, true, false) as Node[];
        let neighborsIds = neighbors.map(node => node.id);

        neighborsIds.forEach(newNodeId => {
            if (!visited.includes(newNodeId)) {
                this.bfsSearch(newNodeId, visited);
            }
        })
    }
}


export {Graph};
export var Orientations;
(function (Orientations) {
    Orientations["HORIZONTAL"] = "horizontal";
    Orientations["VERTICAL"] = "vertical";
})(Orientations || (Orientations = {}));
class Node {
    id;
    type;
    attributes;
    x;
    y;
    width;
    height;
    disabled = false;
    intId;
    static counter = 0;
    constructor(id, attributes = null, nodeType = null, x = null, y = null, width = null, height = null) {
        this.id = `${id}`;
        if (attributes) {
            this.attributes = attributes;
        }
        else {
            this.attributes = {};
        }
        this.type = nodeType;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    label() {
        return this.id.toString();
    }
    get(attribute) {
        if (attribute == "x" && this.x != null) {
            return this.x;
        }
        if (attribute == "y" && this.y != null) {
            return this.y;
        }
        return this.attributes[attribute];
    }
    set(attribute, value) {
        if (attribute == "x" && this.x) {
            this.x = value;
        }
        else if (attribute == "y" && this.y) {
            this.y = value;
        }
        else {
            this.attributes[attribute] = value;
        }
    }
    getIntId() {
        if (this.intId)
            return this.intId;
        Node.counter += 1;
        this.intId = Node.counter;
        return this.intId;
    }
}
class Link {
    _id;
    type;
    attributes;
    source;
    target;
    // id is optional
    // Source and target are ids at first, but can be transformed as object potentially after (for example using a d3 layout)
    constructor(source, target, linkType = null, attributes = null, id = null) {
        this.source = source;
        this.target = target;
        this.type = linkType;
        this.attributes = attributes;
        this._id = id;
    }
    id() {
        if (this._id) {
            return this._id;
        }
        else {
            if (typeof this.source == "string" || typeof this.target == "string") {
                return `${this.source.toString()}${this.type}${this.target.toString()}`;
            }
            else {
                // @ts-ignore
                return `${this.source.id.toString()}${this.type}${this.target.id.toString()}`;
            }
        }
    }
    get(attribute) {
        return this.attributes[attribute];
    }
    set(attribute, value) {
        this.attributes[attribute] = value;
    }
    getSourceId() {
        if (this.source instanceof Node) {
            return this.source.id;
        }
        else {
            return this.source;
        }
    }
    getTargetId() {
        if (this.target instanceof Node) {
            return this.target.id;
        }
        else {
            return this.target;
        }
    }
    getSource() {
        if (this.source instanceof Node) {
            return this.source;
        }
        else {
            throw "Only have id";
        }
    }
    getTarget() {
        if (this.target instanceof Node) {
            return this.target;
        }
        else {
            throw "Only have id";
        }
    }
    getNodes() {
        return [this.getSource(), this.getTarget()];
    }
    isEqual(sourceId, targetId) {
        if (this.source instanceof Node && this.target instanceof Node) {
            return this.source.id == sourceId && this.target.id == targetId;
        }
        else {
            return this.source == sourceId && this.target == targetId;
        }
    }
}
class PersonNode extends Node {
    name;
    constructor(id, attributes, nodeType, name, x, y) {
        super(id, attributes, nodeType, x, y);
        this.name = name;
    }
    nameWithId() {
        return `${this.name} (${this.id.toString()})`;
    }
    label() {
        return this.name;
    }
    static getIdFromNameId(nameWihId) {
        let values = nameWihId.split("(");
        let id1 = values[values.length - 1];
        let id2 = id1.split(")")[0];
        return id2;
    }
}
class DocumentNode extends Node {
    time;
    constructor(id, attributes, nodeType, time, x, y) {
        super(id, attributes, nodeType, x, y);
        this.time = time;
    }
}
class LayeredNode extends Node {
    rank;
    constructor(id, rank, attributes = null, nodeType = null, x = null, y = null, width = null, height = null) {
        super(id, attributes, nodeType, x, y, width, height);
        this.rank = rank;
    }
}
export { Node, PersonNode, DocumentNode, LayeredNode, Link };
//# sourceMappingURL=Node.js.map
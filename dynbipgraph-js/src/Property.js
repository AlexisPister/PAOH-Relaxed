import * as d3 from 'd3-scale-chromatic';
import * as scale from 'd3-scale';

export const PropertyTypesEnum = {
    NOMIMAL: 0,
    CATEGORICAL: 1,
    NUMERIC: 2
}

export class Property {
    static categoricalThreshold = 100;
    static NODETYPE_ALL = "All";

    constructor(name) {
        this.name = name;
        this.allValues = [];
        this.colorScale = null;
    }

    static setCategoricalThreshold(k) {
        Property.categoricalThreshold = k;
    }

    setNodeType(nodeType) {
        if (this.nodeType) {
            if (this.nodeType != nodeType) {
                this.nodeType = Property.NODETYPE_ALL;
            }
        } else {
            this.nodeType = nodeType;
        }
    }

    addValue(value) {
        this.allValues.push(value);
    }

    update() {
        this.computeDomain();
        this.determineType();
    }

    computeDomain() {
        this.domain = [... new Set(this.allValues)];
        delete this.allValues;
    }

    determineType() {
        if (isNaN(this.getDomainWithoutNull()[0])) {
            if (this.domain.length > Property.categoricalThreshold) {
                this.type = PropertyTypesEnum.NOMIMAL;
            } else {
                this.type = PropertyTypesEnum.CATEGORICAL;
            }
        } else {
            this.type = PropertyTypesEnum.NUMERIC;
            let noNulls = this.domain.filter(v => v != null);
            let min = Math.min(...noNulls);
            let max = Math.max(...noNulls);
            this.domain = [min, max];
        }
    }

    getDomainWithoutNull() {
        return this.domain.filter(v => v != null);
    }

    computeColorScale() {
        if (this.type == PropertyTypesEnum.NUMERIC) {
            this.colorScale = scale.scaleSequential().domain(this.domain).interpolator(d3.interpolateViridis);
        } else if (this.type == PropertyTypesEnum.NOMIMAL || this.type == PropertyTypesEnum.CATEGORICAL) {
            this.colorScale = scale.scaleOrdinal().domain(this.domain).range(d3.schemeSet3);
        }
    }

    getColorScale() {
        if (this.colorScale) {
            return this.colorScale;
        } else {
            this.computeColorScale();
            return this.colorScale;
        }
    }
}

export class ArrayProperty extends Property {
    constructor(name) {
        super(name);
    }

    addArrayValue(arrayValue) {
        arrayValue.forEach(value => this.addValue(value))
    }
}

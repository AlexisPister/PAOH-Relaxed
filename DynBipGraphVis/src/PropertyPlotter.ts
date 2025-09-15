import {BipartiteDynGraph, Property, PropertyTypesEnum} from "dynbipgraph";
import * as Plot from "@observablehq/plot";

export class PropertyPlotter {
    private property: Property;
    private container: d3.Selection<any, any, any, any>;
    private graph: BipartiteDynGraph;

    constructor(bipdygraph: BipartiteDynGraph, container: d3.Selection<any, any, any, any>) {
        this.graph = bipdygraph
        this.container = container;
    }

    render = (property) => {
        this.container.html("")
        this.property = property;

        let plot;
        if (this.property.type == PropertyTypesEnum.CATEGORICAL) {
            plot = this.renderCategorical();
        }

        this.container.node().append(plot)
    }

    renderCategorical() {
        let data = this.processData();
        // console.log(data)
        return Plot.plot({
            y: {
                grid: true,
                // percent: true
            },
            marks: [
                Plot.ruleY([0]),
                Plot.barY(data, Plot.groupX({y: "count"}, {x: "v", fill: "v"}), )
            ]
        })
    }

    processData() {
        return this.graph.getPropertyValues(this.property).map(d => {
            return {v: d};
        });
    }
}
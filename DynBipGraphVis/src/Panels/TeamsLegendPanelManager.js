import * as d3 from 'd3';

export default class TeamsLegendPanelManager {
    constructor(selection, roleColorScale) {
        this.element = d3.select(selection);
        this.roleColorScale = roleColorScale;
        this.initElement();
    }

    initElement() {
        this.element.html("");

        this.element.append("div")
            .classed("legend-title", true)
            .text("Teams")

        this.svg = this.element
            .append("div")
            .append("svg")
            .attr("width", 180)
            .attr("height", 80)
            // .attr("height", 70)
            .style("padding-top", "5")
    }

    reset() {
        // this.list.empty();
    }

    // addAnyColor() {
    //     this.colorScale.domain([globals.ANY_EDGETYPE, ...this.colorScale.domain()]);
    //     this.colorScale.range([globals.ANY_EDGETYPE_COLOR, ...this.colorScale.range()]);
    // }

    render() {
        this.domain = this.roleColorScale.domain();
        // this.domain = this.domain.filter()

        this.rects = this.svg
            .selectAll("rect")
            .data(this.domain)
            .join("rect")
            .attr("width", 20)
            .attr("height", 10)
            .attr("x", 0)
            // .attr("y", (d,i) => i * 21)
            .attr("y", (d,i) => i * 15)
            .attr("fill", (d,i) => this.roleColorScale(d))
            .attr("stroke", "black")
            .attr("stroke-width", 0)
            .style("cursor", "grab")
            // .on("mouseover", (e, d) => {
            //     this.highlight(e, d)
            // })
            // .on("mouseout", (e, d) => {
            //     if (this.selectedEdgeType != d) this.unHighlight(e, d);
            // })

        this.texts = this.svg
            .selectAll("text")
            .data(this.domain)
            .join("text")
            .attr("x", 22)
            // .attr("y", (d,i) => (i * 21) + 10)
            .attr("y", (d,i) => (i * 15) + 10)
            .style("font-size", 15)
            .style("cursor", "grab")
            .text(d => d)
            .on("mouseover", (e, d) => {
                this.highlight(e, d)
            })
            .on("mouseout", (e, d) => {
                if (this.selectedEdgeType != d) this.unHighlight(e, d);
            })
    }

    highlight = (ev, datum) => {
        this.rects.filter((d) => JSON.stringify(d) == JSON.stringify(datum))
            .style("stroke-width", 3)

        this.texts.filter((d) => JSON.stringify(d) == JSON.stringify(datum))
            .attr("fill", "blue")
    }

    unHighlight = (ev, datum) => {
        this.rects.filter((d) => JSON.stringify(d) == JSON.stringify(datum))
            .style("stroke-width", 0)

        this.texts.filter((d) => JSON.stringify(d) == JSON.stringify(datum))
            .attr("fill", "black")
    }

    setupClickEvents(){
        this.rects.on("click", (e, d) => {
            this.unHighlight(e, this.selectedEdgeType);
            this.highlight(e, d);
            this.selectedEdgeType = d;
            this.selectedEdgeTypeColor = this.colorScale(this.selectedEdgeType);
        })

        this.texts.on("click", (e, d) => {
            this.unHighlight(e, this.selectedEdgeType);
            this.highlight(e, d);
            this.selectedEdgeType = d;
            this.selectedEdgeTypeColor = this.colorScale(this.selectedEdgeType);
        })
    }
}
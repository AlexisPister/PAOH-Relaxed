import * as d3 from 'd3';
import {globals} from "./globals";
import {renderingParameters} from "./RenderingParameters";
import InteractionController from "./InteractionController";
import {LayeredGraph, LayeredNode, Link, Path, BipartiteDynGraph} from "dynbipgraph";

enum NetworkMeasures {
    numberOfNodes,
    numberOfHyperedges,
    rolesDistribution
}

export default class AggregateVis {
    svg: d3.Selection<any, any, any, any>;
    mainG: d3.Selection<any, any, any, any>;

    bipDynGraph: BipartiteDynGraph;
    graph: LayeredGraph;

    interactionController: InteractionController;
    height: number = 100;
    // height: number = 20;
    fontSize: number = 20;
    // fontSize: number = 22;
    private nDocScale: d3.ScaleLinear<number, number, never>;
    private nPersonScale: d3.ScaleLinear<number, number, never>;
    private nOccurrenceScale: d3.ScaleLinear<number, number, never>;
    private histoBarColor = "rgb(108,108,108)"

    transform: d3.ZoomTransform = d3.zoomIdentity;
    private selectMeasureFO: d3.Selection<any, any, any, any>;
    // selectMeasureFOX: number = 200;
    selectMeasureFOX: number = -180;
    private selectedMeasure: NetworkMeasures = NetworkMeasures.numberOfHyperedges;

    constructor(svg, bipDynGraph: BipartiteDynGraph, graph: LayeredGraph) {
        this.svg = svg;
        this.setGraphs(bipDynGraph, graph)
        this.init();
    }

    setGraphs(bipDynGraph: BipartiteDynGraph, layeredGraph: LayeredGraph) {
        this.bipDynGraph = bipDynGraph;
        this.graph = layeredGraph;
    }

    init() {
        this.resize();
        this.mainG = this.svg.append("g")

        this.selectMeasureFO = this.mainG.append("foreignObject")
            .attr("x", this.selectMeasureFOX)
            .attr("y", "50")
            .attr("width", "300")
            .attr("height", "300")
            .style("z-index", 99)

        let selectMenu = `<select name="speed" id="speed">
          <option value=${NetworkMeasures.numberOfHyperedges}>Number of Hyperedges</option>
          <option value=${NetworkMeasures.numberOfNodes}>Number of Nodes</option>
          <option value=${NetworkMeasures.rolesDistribution}>Roles Distribution</option>
        </select>`

        this.$selectMenu = $(selectMenu)
            .change((e, d) => this.changeTimeMeasure(e.currentTarget.value))

        $(this.selectMeasureFO.node()).append(this.$selectMenu);
    }

    changeTimeMeasure(value): void {
        this.selectedMeasure = value;
        this.render();
    }

    resize() {
        this.svg
            .attr("width", "100vw") //TODO: change
            .attr("height", this.height)
            .style("background-color", "rgb(100, 100, 100, 0.2)")
    }

    setInteractionController(controller) {
        this.interactionController = controller;
    }

    setup() {
        let documentsLens = Object.values(this.bipDynGraph.timeToDocuments()).map(docs => docs.length);
        let [min, max] = [Math.min(...documentsLens), Math.max(...documentsLens)]
        this.nDocScale = d3.scaleLinear().domain([0, max]).range([0, this.height / 4])

        let timeToPersons = Object.values(this.bipDynGraph.timeToPersons()).map(docs => docs.length);
        [min, max] = [Math.min(...timeToPersons), Math.max(...timeToPersons)]
        this.nPersonScale = d3.scaleLinear().domain([0, max]).range([0, this.height / 3])

        // Scale for number of occurrences (one person can have several occurrence per time
        let timeTorolesDist = this.bipDynGraph.timeToRolesDist();
        max = Math.max(...Object.values(timeTorolesDist).map(v => Object.values(v).reduce((a, b) => a + b)))
        this.nOccurrenceScale = d3.scaleLinear().domain([0, max]).range([0, this.height / 3])
    }

    zoomAction = (e, d) => {
        this.transform = e.transform;
        this.mainG.attr("transform", `translate(${this.transform.x}, 0) scale(${this.transform.k})`); // works but change the height
        // this.render();

        this.mainG
            .selectAll(".timeLegend")
            .style("font-size", this.textFontSize())
            .attr("y", (this.height - 5) / this.transform.k)

        this.mainG
            .selectAll(".histogramBar")
            .attr("y", d => this.histogramBarY(d))
            .attr("height", d => this.histogramBarHeight(d))

        this.mainG
            .selectAll(".histoValue")
            .attr("y", d => this.yMaxBar())
            .style("font-size", `${(this.fontSize - 2) / this.transform.k}px`)

        this.mainG
            .selectAll(".roleBar")
            .attr("y", d => this.barY(d[0][1]))
            .attr("height", d => this.barY(d[0][0]) - this.barY(d[0][1]))

        this.selectMeasureFO
            .attr("transform", `translate(0, 0) scale(${1 / this.transform.k})`)
            .attr("x", (this.selectMeasureFOX * this.transform.k) - 160)
    }

    textFontSize() {
        return `${this.fontSize / this.transform.k}px`
        // return `${this.fontSize / (this.transform.k * 1.5)}px`
        // return `${this.fontSize}px`
    }

    // TODO : finish
    render() {
        let rolesDist = this.bipDynGraph.timeToRolesDist();
        let rolesDistFlat = []
        for (let [a, b] of Object.entries(rolesDist)) {
            let item = {time: a}

            for (let [role, freq] of Object.entries(b)) {
                item[role] = freq
            }
            rolesDistFlat.push(item)
        }

        let stackData = d3.stack()
            .keys(this.bipDynGraph.roles)
            (rolesDistFlat)

        this.timeGroups = this.mainG
            .selectAll(".timeGroup")
            .data(this.bipDynGraph.times, d => d)
            .join("g")
            .classed("timeGroup", true)

        this.timeGroups
            .selectAll(".timeLegend")
            .data(this.bipDynGraph.times, d => d)
            .join("text")
            .text((d) => d)
            .classed("timeLegend", true)
            .attr("x", d => {
                return this.graph.timeToPosition(d)
            })
            .attr("y", d => (this.height - 5) / this.transform.k)
            // .style("font-size", `${this.fontSize / this.transform.k}px`)
            .style("font-size", this.textFontSize())

        this.timeGroups
            .selectAll(".histogramBar")
            .data(this.bipDynGraph.times, d => d)
            .join("rect")
            .attr("x", d => this.graph.timeToPosition(d))
            .attr("y", d => this.histogramBarY(d))
            .attr("width", d => 100)
            .attr("height", d => this.histogramBarHeight(d))
            .classed("histogramBar", true)
            .style("fill", this.histoBarColor)
            .style("display", () => this.selectedMeasure == NetworkMeasures.rolesDistribution ? "none" : "")

        this.timeGroups
            .selectAll(".histoValue")
            .data(this.bipDynGraph.times, d => d)
            .join("text")
            .text((d) => this.histoText(d))
            .classed("histoValue", true)
            .attr("x", d => this.graph.timeToPosition(d) + 100)
            .attr("y", d => this.yMaxBar())
            .style("font-size", `${(this.fontSize - 2) / this.transform.k}px`)
            .style("fill", this.histoBarColor)
            .style("display", () => this.selectedMeasure == NetworkMeasures.rolesDistribution ? "none" : "")

        // ROLES DIST
        this.timeGroups
            .selectAll(".roleBar")
            .data(d => stackData.map(s => s.filter(t => t.data ? t.data.time == d : false)))
            .join("rect")
            .attr("x", d => {
                // TODO: Handle time better
                return this.graph.timeToPosition(Number(d[0].data.time))
                // return this.graph.timeToPosition(d[0].data.time)
            })
            .attr("y", d => {
                return this.barY(d[0][1])
            })
            .attr("width", 100)
            .attr("height", d => this.barY(d[0][0]) - this.barY(d[0][1]))
            .classed("roleBar", true)
            .style("fill", (d, i) => {
                return this.bipDynGraph.rolesColorScale()(this.bipDynGraph.roles[i])
            })
            .style("display", () => this.selectedMeasure == NetworkMeasures.rolesDistribution ? "" : "none")
    }

    histoText(d) {
        if (this.selectedMeasure == NetworkMeasures.numberOfHyperedges) {
            return this.bipDynGraph.documentsAtTime(d).length
        } else if (this.selectedMeasure == NetworkMeasures.numberOfNodes) {
            return this.bipDynGraph.personsAtTime(d).length
        }
    }

    barY(value) {
        // let y = this.nPersonScale(value) / this.transform.k;
        let y = this.nOccurrenceScale(value) / this.transform.k;
        let yMax = this.yMaxBar();
        return (yMax) - y;
    }

    histogramBarY(time) {
        let barHeight = this.histogramBarHeight(time);
        let yMin = 10 / this.transform.k;
        let yMax = this.yMaxBar();
        return (yMax) - barHeight;
    }

    yMaxBar() {
        return (this.height - 30) / this.transform.k;
    }

    histogramBarHeight(time) {
        if (this.selectedMeasure == NetworkMeasures.numberOfHyperedges) {
            return this.nDocScale(this.bipDynGraph.documentsAtTime(time).length) / this.transform.k;
        } else if (this.selectedMeasure == NetworkMeasures.numberOfNodes) {
            return this.nPersonScale(this.bipDynGraph.personsAtTime(time).length) / this.transform.k;
        }

        return this.nPersonScale(this.bipDynGraph.personsAtTime(time).length) / this.transform.k;
    }
}
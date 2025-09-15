import {globals} from "./globals";
import * as d3 from "d3";

import {BipartiteDynGraph} from "dynbipgraph";
import OssatureGraph from "./OssatureGraph";
import WidgetsManager from "./WidgetsManager";
import DynBipGraphVis from "./DynBipGraphVis";
import {resize, saveSvg} from "./utils";
import {renderingParameters} from "./RenderingParameters";
import AggregateVis from "./AggregateVis.ts";
import PaohRelaxedGraph from "./PaohRelaxedGraph.ts";
import PaohRelaxedVis from "./PaohRelaxedVis.ts";
import InteractionController from "./InteractionController.ts";
import {PersonsTable} from "./ResultTable";
import {PropertyPlotter} from "./PropertyPlotter";

export default class DynViz {
    graphData;
    temporalLayoutData;

    constructor(svgSelectionName) {
        this.svgSelectionName = svgSelectionName;
        this.svg = $(this.svgSelectionName);
    }

    init() {
        resize(this.svg);

        // for scrolling
        this.svg.height(`7000px`)

        // First dataset loaded
        // this.fetchDataset("Piemont");
        // this.fetchDataset("MarieBoucher");
        // this.fetchDataset("Vispubdata");
        this.fetchDataset("Inria");
    }

    fetchDataset = (name) => {

        console.time("benchmark")


        // fetch(globals.route(`getData/${name}`), {method: "GET", credentials: 'include'})
        fetch(globals.route(`getData/${name}`), {credentials: "include"})
            .then(r => r.json())
            .then(data => {
                this.start(data);
            })
    }

    fetchDatasetUpdate = (name) => {
        fetch(globals.route(`getData/${name}`), {credentials: "include"})
        // fetch(globals.route(`getData/${name}`), {credentials: 'same-origin'})
            // fetch(globals.route(`getData/${name}`))
            .then(r => r.json())
            .then(data => {
                this.loadData(data);
                this.update();
            })
    }

    start(data) {
        this.loadData(data);
        this.startVis();
        this.setupPanels();
    }

    loadData(data) {
        [this.graphData, this.temporalLayoutData] = [data[0], data[1]];
        this.graph = new BipartiteDynGraph(this.graphData);
    }

    startVis() {
        this.svg.empty();
        this.propertyPlotter = new PropertyPlotter(this.graph, d3.select("#property-plot"));

        this.ossatureGraph = new OssatureGraph(this.temporalLayoutData, this.graph);
        // PAOH
        this.paohGraph = new PaohRelaxedGraph(this.ossatureGraph, this.graph);

        // dont remember why, but needed

        // 80 for benchmark
        // renderingParameters.RANK_GAP_SIZE = 80;
        renderingParameters.RANK_GAP_SIZE = 200;

        this.paohGraph.assignRankCoordinates(renderingParameters.RANK_GAP_SIZE, renderingParameters.RANK_SIZE);

        this.dynGraphVis = new PaohRelaxedVis(d3.select(this.svgSelectionName), this.updateLayout);
        this.dynGraphVis.init(this.graph, this.paohGraph, this.ossatureGraph);

        console.timeEnd("benchmark")


        this.aggregateVis = new AggregateVis(d3.select("#aggregate-svg"), this.graph, this.paohGraph);

        let properties = this.graph.getAllNodeTypeProperties().concat(this.graph.getPropertiesByNodeType(this.graph.personType))
        this.personTable = new PersonsTable(d3.select("#node-table-container"), properties, "node-table", null, this.graph)
        this.setInteractionController();
        this.personTable.createTable();
        this.personTable.render(this.graph.persons(false), properties);

        this.dynGraphVis.setup();

        // this.dynGraphVis.setAggregateVis(this.aggregateVis);
        this.aggregateVis.setup();
        this.aggregateVis.render();
        // this.personTable.render(this.graph.persons(false));

        this.dynGraphVis.render();

        // this.documentCentricHypergraph = this.ossatureGraph.transformToPersonView();
        // this.documentCentricHypergraph.assignRankCoordinates(renderingParameters.RANK_GAP_SIZE, renderingParameters.RANK_SIZE);

        // this.dynGraphVis = new DynBipGraphVis(d3.select(this.svgSelectionName));
        // this.dynGraphVis.init(this.graph, this.documentCentricHypergraph, this.ossatureGraph);
        // this.dynGraphVis.setup();
        //
        // this.aggregateVis = new AggregateVis(d3.select("#aggregate-svg"), this.graph, this.documentCentricHypergraph, this.dynGraphVis);
        // this.dynGraphVis.setAggregateVis(this.aggregateVis);
        // this.aggregateVis.setup();
        // this.aggregateVis.render();

        // HIDE FOR NOW
        this.personTable.hide();
        this.documentCentricHypergraph = this.paohGraph;
    }

    setInteractionController() {
        this.interactionController = new InteractionController(this.graph, this.paohGraph, this.dynGraphVis, this.aggregateVis, this.personTable);
        this.personTable.setInteractionController(this.interactionController);
        this.aggregateVis.setInteractionController(this.interactionController);
        this.dynGraphVis.setInteractionController(this.interactionController);
    }

    updateTable() {
        // person and ALL types properties
        this.personTable.bipDynGraph = this.graph;
        let properties = this.graph.getAllNodeTypeProperties().concat(this.graph.getPropertiesByNodeType(this.graph.personType))
        this.personTable.render(this.graph.persons(false), properties);
    }

    update() {
        this.ossatureGraph = new OssatureGraph(this.temporalLayoutData, this.graph);

        // PAOH
        this.paohGraph = new PaohRelaxedGraph(this.ossatureGraph, this.graph);
        this.paohGraph.assignRankCoordinates(renderingParameters.RANK_GAP_SIZE, renderingParameters.RANK_SIZE);

        this.dynGraphVis.init(this.graph, this.paohGraph, this.ossatureGraph);
        this.dynGraphVis.setup();

        this.aggregateVis.setGraphs(this.graph, this.paohGraph);
        this.aggregateVis.setup();
        this.updateTable();

        this.setInteractionController()
        this.interactionController.render();

        this.propertyPlotter.graph = this.graph;
        // this.setupPanels()
        this.widgetManager.setGraphs(this.graph, this.paohGraph, this.dynGraphVis)
        this.widgetManager.initGeneralInfo();
        this.widgetManager.initRoleLegend();
        this.widgetManager.initPropertySelect();

        // this.widgetManager.initPropertySelect();
        // this.widgetManager.initDocPropertySelect(this.selectPropertyCb);

        // this.widgetManager.initGapSlider();


        let width = this.dynGraphVis.getWidth();
        let height = this.dynGraphVis.getHeight()

        // TO SET THE SVG TO DIMS OF THE NETWORK (comment if needed)
        // this.svg.width(`${width}px`)
        // this.svg.height(`${height}px`)

        console.log("DIMS ", width, height);

        let widthNoLabels = this.paohGraph.getWidth()
        console.log("WIDTH No Labels", widthNoLabels)

        // Transalte to the right for left labels test
        let translate = "translate(140, 0)";
        this.dynGraphVis.gBackground.attr("transform", translate);
        this.dynGraphVis.gNodes.attr("transform", translate);
        this.dynGraphVis.gLinks.attr("transform", translate);
        this.dynGraphVis.gOthers.attr("transform", translate);
        this.dynGraphVis.xAxisg.attr("transform", translate);

        // TO SAVE THE SVG
        setTimeout(() => {
            saveSvg(this.svg.get()[0]);
        }, 1000)
    }

    selectPropertyCb = (property) => {
        this.dynGraphVis.renderDocumentProperty(property);
        this.propertyPlotter.render(property);
    }

    updateLayout = (personsIds) => {
        fetch(globals.route(`updateLayout`, globals.URL_BACKEND), {
            // credentials: "include", method: "POST", mode: "cors", headers: {
            credentials: "include", method: "POST", headers: {
                'Content-Type': 'application/json'
            }, body: JSON.stringify(personsIds),
        })
            .then(r => {
                return r.json()
            })
            .then(json => {
                this.temporalLayoutData = json
                this.update();
            })
    }

    setupPanels() {
        // this.datasetPanelManager = new DatasetPanelManager("#dataset-selection", this.fetchDataset);
        // this.datasetPanelManager.render();
        // this.personSelectPanelManager = new PersonSelectorPanelManager("#persons-selection", this.graph.persons(), this.dynGraphVis.togglePersonSelection);
        // this.personSelectPanelManager.render();
        // this.propertyPanelManager = new PropertyPanelManager("#document-attributes", this.graph.getPropertiesByNodeType(this.graph.documentType), this.dynGraphVis.renderDocumentProperty, this.dynGraphVis.unrenderDocumentProperty);
        // this.propertyPanelManager.render();
        // this.clusteringManager = new ClusteringManager(this.graph, this.documentCentricHypergraph, this.ossatureGraph, "#clustering-buttons", this.propertyPanelManager, this.dynGraphVis);

        this.widgetManager = new WidgetsManager(this.graph, this.documentCentricHypergraph, this.dynGraphVis, this.interactionController, this.fetchDatasetUpdate);
        this.widgetManager.initDataImport();
        this.widgetManager.initGeneralInfo();
        this.widgetManager.initRoleLegend();

        this.widgetManager.initPropertySelect();
        // this.widgetManager.initDocPropertySelect(this.selectPropertyCb);

        this.widgetManager.initShowMapperCheck();
        this.widgetManager.initShowTableCheck();
        this.widgetManager.initGapSlider();
    }
}
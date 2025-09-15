import {globals} from "../globals";
import {Property} from "dynbipgraph";
import {TemporalMatrixGrouper} from "../MatrixGrouper";

export default class ClusteringManager {
    constructor(bipDynGraph, documentCentricHypergraph, ossatureGraph, selection, propertyPanelManager, graphVis) {
        this.bipDynGraph = bipDynGraph;
        this.documentCentricHypergraph = documentCentricHypergraph;
        this.ossatureGraph = ossatureGraph;
        this.element = $(selection);
        this.propertyPanelManager = propertyPanelManager;
        this.graphVis = graphVis;
        this.render();

        // Min number of community size, if a community has a lower number of nodes, delete it
        this.pruneThreshold = 4;
    }

    reset() {
        this.element.empty();
    }

    render() {
        this.reset();
        this.getClusteringNames();
    }

    getClusteringNames() {
        fetch(globals.route("clusteringNames", globals.URL_CLUSTERING, {
            method: "GET", mode: "cors", headers: {
                'Content-Type': 'application/json'
            }
        }))
            .then(r => {
                return r.json()
            })
            .then(async json => {
                this.renderAlgorithms(json)
            })
            .then((_) => {
                this.renderMatriceOption();
            })
    }

     renderAlgorithms(algorithms) {
        // <label htmlFor="algorithms">Choose Algorithm</label>
        let selectMenu = `<select name="algorithms">`
        for (let algorithm of algorithms) {
            selectMenu += `<option value="${algorithm}">${algorithm}</option>`
        }
        selectMenu += "</select>"

        this.$selMenu = $(selectMenu)
        this.element.append(this.$selMenu);
        this.$selMenu.selectmenu();

        let $button = $(`<button>Run</button>`).button()
            .click(() => {
                let algorithmName = this.$selMenu.val();
                this.runClustering(algorithmName);
            })


        this.element.append($button);
    }

    renderMatriceOption() {
        let $button = $(`<button>Mat</button>`).button()
            .addClass("option-button")
            .click(() => {
                this.documentCentricHypergraph.clearMatrices();
                let clusteringProperty = this.propertyPanelManager.selectedProperty;
                let propertyValueToNodes = this.bipDynGraph.getPropertyValueToNodes(clusteringProperty.name);

                for (let [comId, nodesIds] of Object.entries(propertyValueToNodes)) {
                    let color = clusteringProperty.colorScale(comId);

                    let temporalMatGrouper = new TemporalMatrixGrouper(this.documentCentricHypergraph, this.ossatureGraph, this.bipDynGraph, color);
                    let temporalMat = temporalMatGrouper.run(nodesIds);
                    temporalMat.addToGraph(this.documentCentricHypergraph);
                }

                this.documentCentricHypergraph.overlapRemoval()
                this.documentCentricHypergraph.createArcs();
                this.documentCentricHypergraph.createCrossTimeArcs();

                this.graphVis.render();
            })

        $("#clustering-options").empty().append($button);
    }

    runClustering(algorithmName) {
        // fetch(globals.route(`/clustering/${algorithmName}?projection=False`, globals.URL_CLUSTERING), {
        fetch(globals.route(`clustering/${algorithmName}`, globals.URL_CLUSTERING), {
            method: "POST", mode: "cors", headers: {
                'Content-Type': 'application/json'
            }, body: JSON.stringify(this.bipDynGraph.toJson())
        })
            .then(r => {
                return r.json()
            })
            .then(async json => {
                this.processClustering(algorithmName, json);
            })
    }

    processClustering(name, clusteringResult) {
        clusteringResult = this.filterClustering(clusteringResult);
        this.pruneClustering(clusteringResult);

        let clusteringName = this.clusteringName(name);
        let clustering = new Property(clusteringName);

        for (let [nodeId, com] of Object.entries(clusteringResult)) {
            clustering.addValue(com);
            let node = this.bipDynGraph.idToNode[nodeId];
            node.set(clusteringName, com);
        }

        clustering.update();
        this.bipDynGraph.addProperty(clustering);

        let clusteringButton = this.propertyPanelManager.buttonProp(clustering);
        this.element.append(clusteringButton);
    }

    filterClustering(clusteringResult) {
        // remove persons form clustering result
        let documentNodes = this.bipDynGraph.documents(true);
        return Object.fromEntries(Object.entries(clusteringResult).filter(([nodeId, comId]) => documentNodes.includes(nodeId)))
    }

    pruneClustering(clusteringResult) {
        let comToNodes = {};
        for (let [nodeId, comId] of Object.entries(clusteringResult)) {
            if (comToNodes[comId]) {
                comToNodes[comId].push(nodeId);
            } else {
                comToNodes[comId] = [nodeId];
            }
        }

         for (let [comId, nodesIds] of Object.entries(comToNodes)) {
             if (nodesIds.length < this.pruneThreshold) {
                 nodesIds.forEach(nodeId => delete clusteringResult[nodeId])
             }
         }
    }

    clusteringName(algorithmName) {
        return `_${algorithmName}`;
    }
}
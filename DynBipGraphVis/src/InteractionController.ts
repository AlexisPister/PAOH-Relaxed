import GraphRenderer from "./GraphRenderer";
import AggregateVis from "./AggregateVis";
import PaohRelaxedGraph, {HyperEdge, PersonOccurrenceNode} from "./PaohRelaxedGraph";
import {renderingParameters} from "./RenderingParameters";
import {BipartiteDynGraph, Path} from "dynbipgraph";
import {PersonsTable} from "./ResultTable"
import * as d3 from "d3";
import PaohRelaxedVis from "./PaohRelaxedVis";

export default class InteractionController {
    bipDynGraph: BipartiteDynGraph;
    paohGraph: PaohRelaxedGraph;

    graphRenderer: PaohRelaxedVis;
    aggregateVis: AggregateVis;
    personTable: PersonsTable;


    selectedPersonsIds: symbol[] = [];
    selectedDocumentsIds: symbol[] = [];
    selectedNodeIds: symbol[] = [];
    shownNodeIds: symbol[] = [];
    shownPersonsIds: symbol[] = [];
    shownDocumentsIds: symbol[] = [];
    selectedPaths: Path[] = [];

    highlightedNodeIds: symbol[] = [];
    highlightedPersonsIds: symbol[] = [];
    highlightedDocumentsIds: symbol[] = [];

    documentOpacityTable: Record<symbol, number> = {};

    pathSelectionMode: boolean = false;
    forceShownLabels: symbol[] = [];


    constructor(bipDynGraph, paohGraph, renderer: GraphRenderer, aggregateVis: AggregateVis, table) {
        this.bipDynGraph = bipDynGraph;
        this.paohGraph = paohGraph;
        this.graphRenderer = renderer;
        this.aggregateVis = aggregateVis;
        this.personTable = table;
    }

    async render(ignoreTable: boolean = false) {
        this.graphRenderer.render();
        this.aggregateVis.render();

        // TODO IGNORE WHEN HOVERING NODES, make it async
        if (!ignoreTable) {
            // this.personTable.render();
            this.personTable.update();
        }
    }

    getTransform(): { x: number, y: number, k: number } {
        return this.graphRenderer.transform
    }

    zoomAction = (e, d) => {
        this.graphRenderer.zoomAction(e, d);
        this.aggregateVis.zoomAction(e, d);
    }

    setOnlyLabelsShown(personsIds) {
        // this.forceShownLabels = this.forceShownLabels.concat(personsIds);
        this.forceShownLabels = personsIds;
        this.graphRenderer.occlusion.run(null, null, this.forceShownLabels, this.forceShownLabels.length)

        // this.render();
    }

    isPersonLabelOccluded(personId) {
        if (this.forceShownLabels.length == 0) {
            return false;
        } else if (this.forceShownLabels.includes(personId)) {
            return false;
        } else {
            return true;
        }
    }

    egoNetwork(personId) {
        this.resetAllSelections();
        let docIds = this.bipDynGraph.getArrayNeighbors(personId).map(d => d.id)
        let allPersons = [];
        docIds.forEach(docId => {
            allPersons = allPersons.concat(this.bipDynGraph.getArrayNeighbors(docId).map(p => p.id))
        })
        allPersons = [...new Set(allPersons)];

        allPersons.forEach(pId => {
            let neighborsDocIds = this.bipDynGraph.getArrayNeighbors(pId).map(d => d.id);
            neighborsDocIds.forEach(docId => {
                let personsIds = this.bipDynGraph.getArrayNeighbors(docId).map(d => d.id);
                personsIds = personsIds.filter(pId2 => pId2 != pId)
                for (let coPersonId of personsIds) {
                    if (allPersons.includes(coPersonId)) {
                        // this.interactionController.addShownDocuments([docId]);
                        this.addSelectedDocuments([docId]);
                        let occurrenceId = PaohRelaxedGraph.generatePersonOccurenceNodeId(docId, coPersonId);
                        // this.interactionController.addShownNode([occurrenceId]);
                        this.addSelectedNode([occurrenceId]);
                        this.addSelectedPath([this.paohGraph.personIdToPath[coPersonId]]);
                    }
                }
            })
        })
        this.addSelectedPerson([personId], false);
        this.addHighlightedPersons([personId], true);
    }

    selectOnePerson(personId) {
        this.resetAllSelections();

        let occurrences = this.paohGraph.getPersonOccurrences(personId).map(n => n.id);
        // let docIds = this.bipDynGraph.getArrayNeighbors(personId).map(d => d.id);

        for (let occurrence of occurrences) {
            let neighbors = this.paohGraph.getArrayNeighbors(occurrence).filter(n => n instanceof HyperEdge) as HyperEdge[];
            for (let hyperedge of neighbors) {
                this.addSelectedDocuments([hyperedge.id]);
                this.addSelectedNode(hyperedge.persons.map(p => p.id));
            }
        }
        this.addSelectedPerson([personId]);
        this.addHighlightedPersons([personId]);
        this.render();
    }

    // TODO: set render to false by default
    showOnePerson(personId, render=true) {
        let occurrences = this.paohGraph.getPersonOccurrences(personId).map(n => n.id);
        // let docIds = this.bipDynGraph.getArrayNeighbors(personId).map(d => d.id);

        for (let occurrence of occurrences) {
            let neighbors = this.paohGraph.getArrayNeighbors(occurrence).filter(n => n instanceof HyperEdge) as HyperEdge[];
            for (let hyperedge of neighbors) {
                this.addShownDocuments([hyperedge.id]);
                this.addShownNode(hyperedge.persons.map(p => p.id));
            }
        }
        this.addShownPerson([personId]);
        this.addHighlightedPersons([personId]);
        if (render) this.render();
    }

    cancelSelectOnePerson(personId) {
        this.removeSelectedPerson([personId])
        this.toggleHighlightedPersons([personId])
        this.resetSelectedNodes()
        this.resetSelectedDocuments(true);
    }

    toggleSelectOnePerson(personId) {
        if (this.isPersonHighlighted(personId)) {
            this.cancelSelectOnePerson(personId)
        } else {
            this.selectOnePerson(personId)
        }
    }

    cancelShowOnePerson(personId) {
        this.removeShownPerson([personId])
        this.toggleHighlightedPersons([personId])

        let occurrences = this.paohGraph.getPersonOccurrences(personId).map(n => n.id);
        for (let occurrence of occurrences) {
            let neighbors = this.paohGraph.getArrayNeighbors(occurrence).filter(n => n instanceof HyperEdge) as HyperEdge[];
            for (let hyperedge of neighbors) {
                this.removeShownDocuments([hyperedge.id]);
                this.removeShownNode(hyperedge.persons.map(p => p.id));
            }
        }

        this.render();
        // this.resetShownNodes()
        // this.resetShownDocuments(true);
    }

    showOneDocument(docId) {
        let personIds = this.bipDynGraph.getArrayNeighbors(docId).map(n => n.id);
        this.addShownPerson(personIds);

        let neighborToCoverage: Record<symbol, number> = {}
        for (let [k, v] of Object.entries(this.bipDynGraph.allNeighbors(personIds))) {
            // @ts-ignore
            neighborToCoverage[k] = v.length
        }

        let maxNNumbers: number = Math.max(...Object.values(neighborToCoverage))
        let opacityScale = d3.scaleLinear()
            .domain([1, maxNNumbers])
            .range([0.45, 1])

        for (let [documentId, v] of Object.entries(neighborToCoverage)) {
            this.addShownDocuments([documentId]);
            this.documentOpacityTable[documentId] = opacityScale(v);
        }

        this.documentOpacityTable[docId] = 1;
        this.addShownDocuments([docId], true);
    }

    cancelShowOneDoc(docId) {
        let personIds = this.bipDynGraph.getNeighbors(docId, true).map(n => n.id);
        this.removeShownPerson(personIds);

        let docs = Object.keys(this.bipDynGraph.allNeighbors(personIds))
        // this.removeShownDocuments(docs, true);

        this.resetShownDocuments(true);
    }

    // selectOnePerson(personId) {
    //     let docIds = this.bipDynGraph.getArrayNeighbors(personId).map(d => d.id)
    //
    //     let neighbors = this.graph.getArrayNeighbors(d.id)
    //     let hyperedge = neighbors.filter(n => n instanceof HyperEdge) as HyperEdge[];
    //     let occurrenceNodesIds = hyperedge[0].persons.map(p => p.id)
    //
    //     this.addSelectedNode(occurrenceNodesIds);
    //     this.addSelectedPerson([personId]);
    //     this.addHighlightedPersons([personId]);
    //     this.addSelectedDocuments(docIds, true);
    // }

    toggleShownPersons = (personsId, render = false) => {
        for (let personId of personsId) {
            if (this.shownPersonsIds.includes(personId)) {
                this.shownPersonsIds = this.shownPersonsIds.filter(pId => pId != personId);
            } else {
                this.shownPersonsIds.push(personId);
            }
        }
        if (render) this.render();
    }

    addShownPerson = (personsId, render = false) => {
        for (let personId of personsId) {
            if (!this.shownPersonsIds.includes(personId)) {
                this.shownPersonsIds.push(personId);
            }
        }
        if (render) this.render();
    }

    removeShownPerson = (personsId, render = false) => {
        this.shownPersonsIds = this.shownPersonsIds.filter(pId => !personsId.includes(pId));
        if (render) this.render();
    }

    resetShownPerson(render = false) {
        this.shownPersonsIds = [];
        if (render) this.render();
    }

    addShownNode = (nodeIds, render = false) => {
        for (let nodeId of nodeIds) {
            if (!this.shownNodeIds.includes(nodeId)) {
                this.shownNodeIds.push(nodeId);
            }
        }
        if (render) this.render();
    }

    resetShownNodes(render = false) {
        this.shownNodeIds = [];
        if (render) this.render();
    }

    removeShownNode = (nodeIds, render = false) => {
        this.shownNodeIds = this.shownNodeIds.filter(pId => !nodeIds.includes(pId));
        if (render) this.render();
    }

    toggleShownDocuments = (personsId, render = false) => {
        for (let personId of personsId) {
            if (this.shownDocumentsIds.includes(personId)) {
                this.shownDocumentsIds = this.shownDocumentsIds.filter(pId => pId != personId);
            } else {
                this.shownDocumentsIds.push(personId);
            }
        }
        if (render) this.render();
    }

    addShownDocuments = (personsId, render = false) => {
        for (let personId of personsId) {
            if (!this.shownDocumentsIds.includes(personId)) {
                this.shownDocumentsIds.push(personId);
            }
        }

        if (render) this.render();
    }

    removeShownDocuments = (personsId, render = false) => {
        this.shownDocumentsIds = this.shownDocumentsIds.filter(pId => !personsId.includes(pId));
        if (render) this.render();
    }

    resetShownDocuments(render = false) {
        this.shownDocumentsIds = [];
        this.documentOpacityTable = {};
        if (render) this.render();
    }


    addSelectedPerson = (personsId, render = false) => {
        for (let personId of personsId) {
            if (!this.selectedPersonsIds.includes(personId)) {
                this.selectedPersonsIds.push(personId);
            }
        }
        if (render) this.render();
    }

    removeSelectedPerson = (personsId, render = false) => {
        this.selectedPersonsIds = this.selectedPersonsIds.filter(pId => !personsId.includes(pId));
        if (render) this.render();
    }

    toggleSelectedPersons = (personsId, render = false) => {
        for (let personId of personsId) {
            if (this.selectedPersonsIds.includes(personId)) {
                this.selectedPersonsIds = this.selectedPersonsIds.filter(pId => pId != personId);
            } else {
                this.selectedPersonsIds.push(personId);
            }
        }
        if (render) this.render();
    }

    resetSelectedPerson = (render=false) => {
        this.selectedPersonsIds = [];
        if (render) this.render();
    }

    addSelectedNode = (nodeIds, render = false) => {
        for (let nodeId of nodeIds) {
            if (!this.selectedNodeIds.includes(nodeId)) {
                this.selectedNodeIds.push(nodeId);
            }
        }
        if (render) this.render();
    }

    resetSelectedNodes(render = false) {
        this.selectedNodeIds = [];
        if (render) this.render();
    }

    removeSelectedNode = (nodeIds, render = false) => {
        this.selectedNodeIds = this.selectedNodeIds.filter(pId => !nodeIds.includes(pId));
        if (render) this.render();
    }

    addSelectedDocuments = (personsId, render = false) => {
        for (let personId of personsId) {
            if (!this.selectedDocumentsIds.includes(personId)) {
                this.selectedDocumentsIds.push(personId);
            }
        }

        if (render) this.render();
    }

    removeSelectedDocuments = (personsId, render = false) => {
        this.selectedDocumentsIds = this.selectedDocumentsIds.filter(pId => !personsId.includes(pId));
        if (render) this.render();
    }

    resetSelectedDocuments(render = false) {
        this.selectedDocumentsIds = [];
        this.documentOpacityTable = {};
        if (render) this.render();
    }


    addHighlightedPersons = (personsIds, render = false) => {
        for (let pId of personsIds) {
            if (!this.highlightedPersonsIds.includes(pId)) {
                this.highlightedPersonsIds.push(pId);
            }
        }
        if (render) this.render();
    }

    toggleHighlightedPersons = (personsId, render = false) => {
        for (let personId of personsId) {
            // TODO: change for multi select probably
            if (this.highlightedPersonsIds.includes(personId) && !this.selectedPersonsIds.includes(personId)) {
                this.highlightedPersonsIds = this.highlightedPersonsIds.filter(pId => pId != personId);
            } else {
                this.highlightedPersonsIds.push(personId);
            }
        }
        if (render) this.render();
    }

    resetHighlightedPersons(render = false) {
        this.highlightedPersonsIds = [];
        if (render) this.render();
    }
    addHighlightedDocuments = (docsId, render = false) => {
        for (let docId of docsId) {
            if (!this.highlightedDocumentsIds.includes(docId)) {
                this.highlightedDocumentsIds.push(docId);
            }
        }
        if (render) this.render();
    }

    createSelectionPath(nodeId) {
        this.graphRenderer.createSelectionPath(nodeId);
    }

    resetHighlightedDocuments(render = false) {
        this.highlightedDocumentsIds = [];
        if (render) this.render();
    }
    
    addSelectedPath = (paths: Path[], render = false) => {
        for (let path of paths) {
            if (!this.selectedPaths.includes(path)) {
                this.selectedPaths.push(path);
            }
        }

        if (render) this.render();
    }

    resetSelectedPath(render = false) {
        this.selectedPaths = [];
        if (render) this.render();
    }

    resetAllSelections(render = false) {
        this.graphRenderer.activeIntersections = [];
        this.graphRenderer.shownLabelNodes = [];

        this.resetShownNodes()
        this.resetShownPerson();
        this.resetShownDocuments();
        this.resetSelectedNodes();
        this.resetSelectedDocuments();
        this.resetSelectedPath();
        this.resetHighlightedDocuments()
        this.resetHighlightedPersons()
        this.resetSelectedPerson(false);

        if (render) {
            this.personTable.render();
            this.render();
        }
    }

    log() {
        console.log(this.shownNodeIds, this.shownPersonsIds, this.shownDocumentsIds, this.selectedPersonsIds, this.selectedDocumentsIds, this.selectedPersonsIds);
    }

    computeOpacity = (node) => {
        if (node instanceof PersonOccurrenceNode) {
            if (this.isPersonVisible(node.get("person"))) {
                return 1
            }
        } else if (node instanceof HyperEdge) {
            if (this.isDocumentVisible(node.id)) {
                let opacity = this.documentOpacityTable[node.id] ? this.documentOpacityTable[node.id] : 1
                return opacity
            }
        }

        if (this.shownNodeIds.includes(node.id) || this.selectedNodeIds.includes(node.id)) {
            return 1
        }

        return renderingParameters.UNHIGHLIGHT_OPACITY;
    }

    isPersonSelected = (personId) => {
        return this.selectedPersonsIds.includes(personId);
    }

    isPersonHighlighted = (personId) => {
        return this.highlightedPersonsIds.includes(personId);
    }

    isPersonVisible(personId) {
        return (this.shownPersonsIds.includes(personId) || this.selectedPersonsIds.includes(personId)) || (this.shownPersonsIds.length == 0 && this.selectedPersonsIds.length == 0)
    }

    isDocumentVisible(docId) {
        return (this.shownDocumentsIds.includes(docId) || this.selectedDocumentsIds.includes(docId)) || (this.shownDocumentsIds.length == 0 && this.selectedDocumentsIds.length == 0)
    }
}
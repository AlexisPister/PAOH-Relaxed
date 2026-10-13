import {renderingParameters} from "./RenderingParameters";
import * as d3 from "d3";
import RoleLegendPanelManager from "./Panels/RoleLegendPanelManager";
import PropertyPanelManager from "./Panels/PropertyPanelManager";
import TeamsLegendPanelManager from "./Panels/TeamsLegendPanelManager";

export default class WidgetsManager {
    constructor(dynBipGraph, temporalLayoutGraph, dynGraphVis, interactionController, selectDatasetCb, loadDatasetCb) {
        this.setGraphs(dynBipGraph, temporalLayoutGraph, dynGraphVis);
        this.interactionController = interactionController;
        this.datasetNames = ["Piemont", "MarieBoucher", "Inria", "Aviz", "French_Genealogy", "Thesis", "Buenos_Aires", "Vispubdata", "Generator"]
        this.selectDatasetCb = selectDatasetCb;
        this.loadDatasetCb = loadDatasetCb;
    }

    setGraphs(dynBipGraph, temporalLayoutGraph, dynGraphVis) {
        this.dynBipGraph = dynBipGraph;
        this.temporalLayoutGraph = temporalLayoutGraph;
        this.dynGraphVis = dynGraphVis;
    }

    initDataImport() {
        let selectMenu = `<input name="datasets" placeholder="Select a dataset" onfocus="this.value=''" onchange="this.blur()" list="datasets"><datalist id="datasets">`
        for (let dataset of this.datasetNames) {
            selectMenu += `<option value="${dataset}"></option>`
        }
        selectMenu += "</datalist>"

        this.$selectMenu = $(selectMenu);
        $("#data-import").append(this.$selectMenu);

        this.$selectMenu.on("change", (e) => {
            let name = e.target.value;
            this.selectDatasetCb(name)
        })
    }

    initDataFileImport() {
        // let importDataButton = `
        //  <button id="importBtn">Import File</button>
        // `
        let inputImport = `
        <input type="file" id="fileInput" />
        `

        // this.$importDataButton = $(importDataButton);
        this.$inputImport = $(inputImport);

        // When button is clicked, trigger hidden file input
        // this.$inputImport.on("click", function () {
        //     this.$inputImport.change();
        // });

        // Handle file selection
        this.$inputImport.on("change",  (event) => {
            const file = event.target.files[0];
            if (file) {
                alert(`You selected: ${file.name}`);

                // Example: read file content
                const reader = new FileReader();
                reader.onload =  (e) => {
                    let jsonData = JSON.parse(e.target.result);
                    this.loadDatasetCb(jsonData)
                };
                let dataText = reader.readAsText(file); // Reads as text (use readAsDataURL for images, etc.)

            }
        });

        // $("#data-import").append(this.$importDataButton);
        $("#data-import").append(this.$inputImport);
    }

    initGeneralInfo() {
        $("#n-persons").html(this.dynBipGraph.nPersons)
        $("#n-documents").html(this.dynBipGraph.nDocuments)
    }

    initGapSlider() {
        $("#gap-number").html(renderingParameters.RANK_GAP_SIZE)

        // $("#gap-slider").slider({
        $("#slider").slider({
            range: "min",
            min: renderingParameters.GAP_SIZE_EXTENT[0],
            max: renderingParameters.GAP_SIZE_EXTENT[1],
            value: renderingParameters.RANK_GAP_SIZE,
            animate: "fast",
            // slide: ( event, ui ) => {
            change: (event, ui) => {
                let newRankGapSize = ui.value;
                this.temporalLayoutGraph.assignRankCoordinates(newRankGapSize);

                // le x dei nodi sono cambiate: va svuotata la cache dei percorsi
                if (this.dynGraphVis.invalidatePathCache) {
                    this.dynGraphVis.invalidatePathCache();
                }

                this.dynGraphVis.runLabeller();
                this.dynGraphVis.interactionController.render();

                $("#gap-number").html(newRankGapSize)

                // this.dynGraphVis.setupArcScale();
                // this.dynGraphVis.setupAxis();
                // this.dynGraphVis.render();

                // this.dynGraphVis.aggregateVis.setup();
                // this.dynGraphVis.aggregateVis.render();
            }
        })
    }

    // initRoleLegend() {
    //     this.dynBipGraph.computeRolesByDocumentType()
    //
    //     // TODO: change
    //     let roles;
    //     roles = this.dynBipGraph.documentTypeToRoles[undefined]
    //     if (!roles) {
    //         roles = [null]
    //     }
    //
    //     this.roleColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(roles);
    //     this.roleLegendPanelManager = new RoleLegendPanelManager("#role-legend-panel", this.roleColorScale);
    //     this.roleLegendPanelManager.render();
    // }

    initRoleLegend() {
        this.dynBipGraph.computeRolesByDocumentType();


        // Teams legend (only work for teams attribute now)
        if (true) {
            let teams = this.dynBipGraph.links.map(l => l.get("team"))
            teams = [...new Set(teams)]


            if (this.dynBipGraph.metadata.teams) {
                teams = teams.filter(t => this.dynBipGraph.metadata.teams.includes(t));
                teams.sort();
            }

            // this.teamColorScale = d3.scaleOrdinal(d3.schemeCategory10)
            //     .domain(teams)
            //     .unknown("grey");

            //  for paohvis comparison
            // let colors = [[251, 180, 174], [204, 235, 197], [222, 203, 228], [254, 217, 166], [255, 255, 204], [141, 211, 199], [252, 205, 229], [253, 180, 98], [190, 186, 218], [229, 216, 189], [179, 222, 105], [188, 128, 189], [204, 235, 197], [255, 237, 111], [128, 177, 211], [251, 128, 114], [255, 255, 179], [179, 205, 227]]
            // colors = colors.map(c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`);
            // this.teamColorScale = d3.scaleOrdinal()
            //     .domain(teams)
            //     .range(colors)
            //     .unknown("grey");


        // 48 colori distinti, uno per nazionale
        const colors = [
            "#030395",
            "#602276",
            "#762D22",
            "#1F1FF9",
            "#953403",
            "#BB1A25",
            "#337622",
            "#1A70BB",
            "#6B7622",
            "#13856E",
            "#F91F67",
            "#1F84F9",
            "#6E9503",
            "#F91FF9",
            "#30A65F",
            "#E27B36",
            "#EA70E2",
            "#EAA170",
            "#56D005",
            "#80DAB6",
            "#EAD270",
            "#B9EA70",
            "#5FFA74",
            "#B0F91F",
            "#133185",
            "#762254",
            "#224F76",
            "#95038B",
            "#0549D0",
            "#BB1A65",
            "#955B03",
            "#A21FF9",
            "#038195",
            "#039503",
            "#9D5FFA",
            "#F91FA2",
            "#F9591F",
            "#A480DA",
            "#EA7078",
            "#DA80B6",
            "#80A4DA",
            "#BBBB1A",
            "#F9B01F",
            "#1FDCF9",
            "#1FF91F",
            "#1FF9B0",
            "#1FF9EA",
            "#F9F91F"
        ]

            // this.teamColorScale = d3.scaleOrdinal()
            //     .domain(teams)
            //     .range(colors)
            //     .unknown("grey");

            this.teamColorScale = d3.scaleOrdinal()
                .domain(teams)
                .range(colors)
                .unknown("#DDDDDD");

            // USE THIS FOR MORE CONTRAST COLOR SCALE
            // this.teamColorScale.range(d3.schemeCategory10) // disattivato: solo 10 colori
            // i dataset stratificati hanno pochi livelli: bastano i 10 colori di d3
            if (document.body.classList.contains("stratificato")) this.teamColorScale.range(d3.schemeCategory10);


            this.roleLegendPanelManager = new TeamsLegendPanelManager("#team-legend-panel", this.teamColorScale);

            if (teams[0]) {
                this.roleLegendPanelManager.render();
            }
        }

    }

    initPropertySelect() {
        let properties = this.dynBipGraph.getAllNodeTypeProperties().concat(this.dynBipGraph.getPropertiesByNodeType(this.dynBipGraph.personType))
        this.propertyPanelManager = new PropertyPanelManager("#person-attributes", properties, this.dynGraphVis.renderPersonProperty, this.dynGraphVis.unrenderPersonProperty);
        this.propertyPanelManager.render();
    }

    initDocPropertySelect(propertySelectCb) {
        let properties = this.dynBipGraph.getAllNodeTypeProperties().concat(this.dynBipGraph.getPropertiesByNodeType(this.dynBipGraph.documentType))
        // this.propertyDocPanelManager = new PropertyPanelManager("#documents-attributes", properties, this.dynGraphVis.renderDocumentProperty, this.dynGraphVis.unrenderDocumentProperty);
        this.propertyDocPanelManager = new PropertyPanelManager("#documents-attributes", properties, propertySelectCb, this.dynGraphVis.unrenderDocumentProperty);
        this.propertyDocPanelManager.render();
    }

    initShowMapperCheck() {
        $("#show-labels-box").on("click", (e) => {
            this.dynGraphVis.renderLabels = !this.dynGraphVis.renderLabels
            // this.dynGraphVis.render()
            this.interactionController.render()
        })
    }

    initShowTableCheck() {
        $("#show-table-box").on("click", (e) => {
            // this.interactionController.personTable.hide();
            this.interactionController.personTable.toggleShown();
        })
    }
}
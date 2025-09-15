export default class DatasetPanelManager {
    constructor(selection, selectDatasetCb) {
        this.element = $(selection);
        this.selectDatasetCb = selectDatasetCb;

        this.datasetNames = ["Piemont", "French_Genealogy", "Thesis", "Buenos_Aires"]
    }

    reset() {
        this.element.empty();
    }

    render() {
        this.reset();

        let selectMenu = `<input name="datasets" placeholder="Select a dataset" onfocus="this.value=''" onchange="this.blur()" list="datasets"><datalist id="datasets">`
        for (let dataset of this.datasetNames) {
            selectMenu += `<option value="${dataset}"></option>`
        }
        selectMenu += "</datalist>"

        this.$selectMenu = $(selectMenu);
        this.element.append(this.$selectMenu);

        this.$selectMenu.on("change", (e) => {
            let name = e.target.value;
            this.selectDatasetCb(name)
        })
    }
}
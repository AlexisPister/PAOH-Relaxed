export default class NodeInfoPanelManager {
    constructor(selection) {
        this.element = $(selection);
        this.list = this.element.append("<ul>");
    }

    reset() {
        this.list.empty();
    }

    render(attributes) {
        this.reset();
        for (let [name, value] of Object.entries(attributes)) {
            this.list
                .append(this.attributeToHtml(name, value));
        }
    }

    attributeToHtml(name, value) {
        return `
            <li><span class="list-key">${name}:</span> <span class="list-value">${value}</span></li>
        `
    }

}
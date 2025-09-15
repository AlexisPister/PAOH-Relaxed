export default class PropertyPanelManager {
    constructor(selection, properties, selectPropertyCb, unselectPropertyCb) {
        this.element = $(selection);
        this.properties = properties;
        this.selectPropertyCb = selectPropertyCb;
        this.unselectPropertyCb = unselectPropertyCb;

        this.selectedProperty = null;
    }

    reset() {
        this.element.empty();
    }

    render() {
        this.reset();
        for (let property of this.properties) {
            let button = this.buttonProp(property);
            this.element.append(button);
        }
    }

    buttonProp(property) {
        let $button = $(`<button class="property-button">${property.name}</button>`)

        $button.button()
            .click(() => {
                $(".property-button").removeClass("button-selected");

                this.propertyClick(property, $button);
                this.selectPropertyCb(property);
            })
            .mouseenter(e => {
                this.selectPropertyCb(property)
            })
            .mouseleave(d => {
                if (!this.selectedProperty) {
                    this.unselectPropertyCb()
                }
            });

        return $button;
    }

    propertyClick(property, $button) {
        if (property == this.selectedProperty) {
            this.selectedProperty = null;
            $button.removeClass("button-selected")
        } else {
            this.selectedProperty = property;
            $button.addClass("button-selected")
        }
    }
}
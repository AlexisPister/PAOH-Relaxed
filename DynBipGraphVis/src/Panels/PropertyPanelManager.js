// attributi senza pulsante nel pannello (restano comunque nel dataset)
const PROPRIETA_NASCOSTE = ["girone"];

// etichetta e tooltip dei pulsanti, nell'ordine in cui compaiono nella barra
const ETICHETTE = {
    name:           ["name", "Un colore per ogni calciatore"],
    team:           ["team", "Colora ogni calciatore con il colore della sua nazionale"],
    fase_raggiunta: ["fase raggiunta", "Fin dove e' arrivata la nazionale del calciatore"],
    gol:            ["gol", "Gol segnati nel torneo (autogol esclusi)"],
    assist:         ["assist", "Assist forniti nel torneo"],
    azioni_gol:     ["azioni gol", "Azioni gol a cui il calciatore ha partecipato"],
    cartellini:     ["cartellini", "Cartellini ricevuti nel torneo"],
    group:          ["girone", "Girone della fase a gironi (A-L)"],
};

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
        // pulsanti piu' compatti, su due righe dentro la barra in alto
        this.element.css({"display": "flex", "flex-wrap": "wrap", "align-content": "center",
                          "align-items": "center", "gap": "2px", "min-width": "360px"});
        // etichette e attributi nascosti valgono per il dataset dei mondiali, non per quelli stratificati
        let stratificato = document.body.classList.contains("stratificato");
        let ordine = Object.keys(ETICHETTE);
        let visibili = this.properties.filter(p => stratificato || !PROPRIETA_NASCOSTE.includes(p.name));
        visibili.sort((a, b) => (ordine.indexOf(a.name) + 1 || 99) - (ordine.indexOf(b.name) + 1 || 99));
        for (let property of visibili) {
            let button = this.buttonProp(property);
            this.element.append(button);
        }
    }

    buttonProp(property) {
        let stratificato = document.body.classList.contains("stratificato");
        let [etichetta, spiegazione] = (!stratificato && ETICHETTE[property.name]) || [property.name, ""];
        let $button = $(`<button class="property-button" title="${spiegazione}">${etichetta}</button>`)

        $button.button()
            .css({"font-size": "11px", "padding": "2px 6px", "margin": "0"})
            .click(() => {
                $(".property-button").removeClass("button-selected");

                this.propertyClick(property, $button);
                // secondo clic sullo stesso pulsante: la colorazione si toglie subito
                if (this.selectedProperty) this.selectPropertyCb(property);
                else this.unselectPropertyCb();
            })
            .mouseenter(e => {
                this.selectPropertyCb(property)
            })
            .mouseleave(d => {
                // uscendo da un pulsante si torna alla colorazione selezionata
                if (!this.selectedProperty) {
                    this.unselectPropertyCb()
                } else if (this.selectedProperty !== property) {
                    this.selectPropertyCb(this.selectedProperty)
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

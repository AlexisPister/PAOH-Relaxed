import {PersonNode} from "dynbipgraph";
import "@nobleclem/jquery-multiselect/jquery.multiselect.js";
import "@nobleclem/jquery-multiselect/jquery.multiselect.css";

export default class PersonSelectorPanelManager {
    constructor(selection, persons, togglePersonCb) {
        this.element = $(selection);
        this.persons = persons;
        this.selectPersonCb = togglePersonCb;

        this.selectedProperty = null;
    }

    reset() {
        this.element.empty();
    }

    render() {
        this.reset();

        // let listName = "persons"
        // let selectMenu = `<input name="persons" placeholder="Select a person" onfocus="this.value=''" onchange="this.blur()" list="${listName}"><datalist id="${listName}">`
        // for (let person of this.persons) {
        //     selectMenu += `<option value="${person.nameWithId()}"></option>`
        //     // selectMenu += `<option value="${person.name}">${person.id}</option>`
        // }
        // selectMenu += "</datalist>"
        //
        // this.$selectMenu = $(selectMenu);
        // this.element.append(this.$selectMenu);
        //
        // this.$selectMenu.on("change", (e) => {
        //     let newValue = e.target.value;
        //     let personId = PersonNode.getIdFromNameId(newValue);
        //     this.selectPropertyCb(personId);
        // })

        let selectMenu = `<select multiple="multiple" name="persons">`
        for (let person of this.persons) {
            selectMenu += `<option value="${person.nameWithId()}">${person.nameWithId()}</option>`
        }

        this.$selectMenu = $(selectMenu);
        this.element.append(this.$selectMenu);
        this.$selectMenu.multiselect({
            columns: 1,
            search: true,
            selectAll: true,
            texts: {
                placeholder: 'Select a person',
                // search: 'Search States'
            },
            onOptionClick: ( element, option ) => {
                let person = $(option).val();
                let personId = PersonNode.getIdFromNameId(person);
                this.selectPersonCb(personId);
            }
        });


        // .on("change", (e) => {
        //             let newValue = e.target.value;
        //             if (this.selectedValues[0] == CategoricalConstraintWidget.noNullValue) {
        //                 this.selectedValues = [newValue];
        //             } else if (!this.selectedValues.includes(newValue)) {
        //                 // this.addNewValue(newValue);
        //                 this.selectedValues.push(newValue);
        //             }
        //             this.update();
        //         })
    }
}
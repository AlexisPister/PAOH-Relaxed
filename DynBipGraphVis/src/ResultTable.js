import * as d3 from "d3";
import * as Plot from "@observablehq/plot";
// import * as Plot from "cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm";
// const Plot = require("https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm")

import {PropertyTypesEnum, DocumentNode} from "dynbipgraph";

// Semantic Ui Style is not working
// import 'datatables.net-dt/css/jquery.dataTables.css';
// import 'datatables.net-jqui/css/jquery.dataTables.css';
import 'datatables.net-jqui/css/dataTables.jqueryui.min.css';
// import 'datatables.net-buttons-dt/css/buttons.dataTables.css';

import DataTable from 'datatables.net-jqui';

import {ColumnTypes, globals} from "./globals.ts";
import {getPeople, Directions} from "./PathSelectionner";


export class Table {
    dataTable;

    constructor(container, properties, tableId, rowClickCb, selector) {
        this.container = container;
        this.properties = properties;
        this.tableId = tableId;
        this.rowClickCb = rowClickCb;
        this.selector = selector;

        // this.createTable();
    }

    createTable() {
        this.table = this.container
            .select(`#${this.tableId}`)
            .html("")

        if (this.table._groups[0][0] == undefined) {
            this.table = this.container
                .insert("table")
                .attr("id", this.tableId)
                .classed("display", true)
                .classed("compact", true)
        }
    }

    setInteractionController(interactionController) {
        this.selector = interactionController;
    }

    killTable() {
        this.dataTable.destroy();
        this.table.html("");
    }

    render(data) {
        if (this.dataTable) {
            this.killTable();
            // $(this.tableElementSelector).empty();
        }

        if (data) this.data = this.processData(data);

        this.initDatatable();

        this.initRowSelection();
        this.initColumnSelection();
        this.initScrollEvent();

        if (this.selector) {
            this.selectRowsFromSelector();
        }
    }

    update() {
        if (this.selector) {
            this.selectRowsFromSelector();
            this.orderByLastColumn();
        }
    }

    processData() {
        throw "Abstract Method";
    }

    initDatatable() {
        throw "Abstract Method";
    }

    initRowSelection() {
        $(`#${this.tableId} tbody`).on('click', 'tr', (e) => {
            $(e.currentTarget).toggleClass('selected');

            let tr = $(e.currentTarget).closest('tr');
            let row = this.dataTable.row(tr);

            this.rowClick(row);
        });
    }

    initColumnSelection() {
        // abstract
    }

    initScrollEvent() {
        $(this.dataTable.table().container()).find('.dataTables_scrollBody').on('scroll', () => {
            this.scrollCb();
        });
    }

    scrollCb() {
        //
    }

    getVisibleRows() {
        const tableContainer = $(this.dataTable.table().container());
        const tableBody = tableContainer.find('.dataTables_scrollBody');
        const viewportTop = tableBody.scrollTop();
        const viewportBottom = viewportTop + tableBody.height();

        let dataRowsShown = [];
        this.dataTable.rows().every(function () {
            const rowNode = this.node();
            const rowNodeData = this.data();
            const rowTop = rowNode.offsetTop;
            const rowHeight = rowNode.offsetHeight;

            if (rowTop + rowHeight >= viewportTop && rowTop <= viewportBottom) {
                // console.log($(rowNode).find('td').eq(0).text()); // print the name of the first column in the row
                // rowsShown.push($(rowNode).find('td').eq(0));
                dataRowsShown.push(rowNodeData);
            }
        });
        return dataRowsShown;
    }

    rowClick(row) {
        let nodeId = row.data().id;
        this.rowClickCb(nodeId);
    }

    selectRowsFromSelector() {
        this.dataTable.rows().every((i, d) => {
            let row = this.dataTable.row(i);
            let data = row.data();

            if (this.selector.isPersonHighlighted(data.id)) {
                $(row.node()).addClass('selected');
            } else {
                $(row.node()).removeClass('selected');
            }
        });
    }

    orderByLastColumn() {
        this.dataTable.column("orderCol").cells().invalidate()
        this.dataTable.columns(-1).order('desc').draw();

        // this.dataTable.columns(-1).order('desc')
        // this.dataTable.draw()
    }

    toggleShown() {
        if (this.container.style("display") == "none") {
            this.show();
        } else {
            this.hide();
        }
    }

    hide() {
        this.container.style("display", "none")
    }

    show() {
        this.container.style("display", "")
    }
}


export class EntityTable extends Table {
    constructor(container, properties, tableId, selector) {
        super(container, properties, tableId, null, selector);
    }

    rowClick(row) {
        let nodeId = row.data().id;
        this.selector.toggleSelectedPersons([nodeId]);
        this.orderByLastColumn();
    }

    orderValue = (d) => {
        return this.selector.isPersonHighlighted(d.id);
        // return this.selector.isPersonSelected(d.id);
    }

    getColumnsInput() {
        // TODO: change
        let PROPTOFILTER = ["affiliation", "name", "value", "_agg_value"]

        this.properties.sort((a, b) => {
            if (a.name[0] == "_") return 1;
            return -1
        })

        let columns = this.properties.filter(property => !PROPTOFILTER.includes(property.name)).map(property => {
            if (property.type == PropertyTypesEnum.NUMERIC) {
                return {title: property.name, data: (d) => d.get(property.name) ? d.get(property.name) : ""};
                // return {title: property.name, data: (d) => d.get(property.name) ? processNumber(d.get(property.name)) : ""};
            } else {
                return {title: property.name, data: (d) => d.get(property.name) ? d.get(property.name) : ""};
            }
        })

        let idColumn = {title: "id", data: (d) => d.id};
        columns.unshift(idColumn);
        if (this.properties.filter(p => p.name == "name").length > 0) {
            let nameColumn = {title: "name", data: (d) => d.get("name") ? d.get("name") : ""};
            columns.unshift(nameColumn);
        } else {
            let nameColumn = {title: "name", data: (d) => d.name ? d.name : ""};
            columns.unshift(nameColumn);
        }

        this.addOrderingColumn(columns);
        // if (this.selectionPathToPersons) this.addPathSelectionColumns(columns);
        if (this.selectionPathToPersons) this.addTimeSelColumns(columns);
        return columns;
    }

    addOrderingColumn(columns) {
        // let orderingColumn = {title: "orderCol", data: this.orderValue, visible: true};
        let orderingColumn = {title: "orderCol", data: this.orderValue, visible: false};
        columns.push(orderingColumn);
    }

    addPathToPersons(pathToPerson, timeToPaths) {
        this.selectionPathToPersons = pathToPerson;
        this.timeToPaths = timeToPaths;

        // TODO: this update the table columns
        // this.render();
    }
}


Array.prototype.insert = function (index, ...items) {
    this.splice(index, 0, ...items);
};

export class PersonsTable extends EntityTable {
    constructor(container, properties, tableId, selector, bipDynGraph) {
        super(container, properties, tableId, selector);
        this.bipDynGraph = bipDynGraph;
        this.personToRolePlot = {};
    }

    initDatatable() {
        // let nTimeCols = this.timeToPaths ? this.timeToPaths.size : 0;
        let nTimeCols = this.timeColumns ? this.timeColumns.length : 0;

        let colDefs = []
        let totalWidth = 20;
        for (let i of d3.range(nTimeCols)) {
            colDefs.push({targets: i, width: `${totalWidth / nTimeCols}%`})
        }
        // console.log(colDefs)

        this.dataTable = $(this.table.node()).DataTable({
            autoWidth: true,
            paging: true,
            pageLength: 8,
            // pageLength: 1,
            scrollY: '200px',
            scrollCollapse: true,
            ordering: true,
            info: true,
            dom: 'Bfrtip',
            data: this.data,
            columns: this.getColumnsInput(),
            columnDefs: colDefs
        })
    }

    getColumnsInput() {
        let columns = super.getColumnsInput();

        this.setBackgroundClassColumns(columns);

        let roleColumns = {title: "Roles", data: (d) => this.createRoleColumn(d)};
        columns.insert(-1, roleColumns);
        return columns
    }

    setBackgroundClassColumns(columns) {
        columns.forEach(col => {
            if (!col.className) {
                if (col.title[0] == "_") {
                    col.className = ColumnTypes.COMPUTED_PROPERTY
                } else {
                    col.className = ColumnTypes.PROPERTY
                }
            }
        })
    }

    createRoleColumn = (d) => {
        if (this.personToRolePlot[d.id]) {
            return this.personToRolePlot[d.id]
        } else {
            let roles;
            try {
                let timeToDocs = this.bipDynGraph.getNeighbors(d.id);
                let links = Array.from(timeToDocs.keys())
                roles = links.map(l => l.type)
            } catch (e) {
                roles = []
            }

            // let width = roles.length * 20
            let width = roles.length * 14
            // let width = 200;
            let plots = Plot.plot({
                color: {
                    domain: this.bipDynGraph.rolesColorScale().domain().concat("null"),
                    range: this.bipDynGraph.rolesColorScale().range().concat("#1f77b4")
                },
                aspectRatio: 1,
                width: width,
                height: 30,
                axis: null,
                marginLeft: 7,
                marginRight: 7,
                padding: 0,
                marks: [
                    Plot.dot(roles, Plot.stackX({fill: d => d, r: 5, dx: 0, marginRight:0, marginLeft: 0})),
                    // Plot.rect(roles, Plot.stackX({fill: d => d}))
                ]
            })

            let plotHtml = plots.outerHTML.toString()
            this.personToRolePlot[d.id] = plotHtml
            return plotHtml
        }
    }

    rowClick(row) {
        let nodeId = row.data().id;


        this.selector.createSelectionPath(nodeId);
        // this.selector.toggleSelectOnePerson(nodeId);
        this.orderByLastColumn();
    }

    scrollCb() {
        return;
        let visibleRowsData = this.getVisibleRows();

        this.selector.resetSelectedPerson();
        this.selector.resetSelectedDocuments();
        this.selector.addSelectedPerson(visibleRowsData.map(n => n.id), true);

        for (let occurrence of visibleRowsData) {
            let neighbors = this.selector.bipDynGraph.getArrayNeighbors(occurrence.id).filter(n => n instanceof DocumentNode);
            for (let hyperedge of neighbors) {
                this.selector.addSelectedDocuments([hyperedge.id]);
                // this.addSelectedNode(hyperedge.persons.map(p => p.id));
            }
        }

        this.selector.render()
    }

    initColumnSelection() {
        $(`#${this.tableId} thead`).on('click', 'th', () => {
            // console.log('Column clicked:', $(this).text());

            // Get the rows currently shown
            let rowsShown = this.dataTable.rows({'search': 'applied', 'page': 'current'}).data();
            let personIds = rowsShown.toArray().map(node => node.id);

            this.selector.setOnlyLabelsShown(personIds);
        });
    }

    render(data, properties) {
        if (properties) this.properties = properties
        super.render(data);
    }

    processData(persons) {
        return persons;
    }

    // One column for each path
    addPathSelectionColumns(columns) {
        let i = 0;
        let pathColulmns = [];
        for (let [path, persons] of this.selectionPathToPersons.entries()) {
            // console.log(path, persons)
            const pathSelColValue = (d) => {
                let isPersonIncluded = persons.map(p => p[0]).includes(d.id)
                if (isPersonIncluded) return circle("black");
                return ""
            }

            let pathColumn = {title: `path${i}`, data: pathSelColValue, visible: true};
            pathColulmns.unshift(pathColumn);
            i++;
        }
        for (let col of pathColulmns) {
            columns.unshift(col);
        }
    }

    // One column for each time
    addTimeSelColumns(columns) {
        this.timeColumns = [];

        let i = 0;
        // for (let [time, paths] of Object.entries(this.timeToPaths)) {
        for (let [time, paths] of this.timeToPaths.entries()) {
            for (let direction of Object.values(Directions)) {
                let pathsInDir = paths.filter(p => p.getProperty(globals.DIRECTION_KEY) == direction);
                if (pathsInDir.length == 0) continue;

                const timeSelColValue = (d) => {
                    let circles = "";

                    for (let path of pathsInDir) {
                        let intersects = this.selectionPathToPersons.get(path);
                        if (intersects) {
                            let isPersonIncluded = intersects.map(int => int.getPeople().includes(d.id))
                            if (isPersonIncluded.includes(true)) {
                                if (direction == Directions.HORIZONTAL) {
                                    circles += horizontalLine("black");
                                } else if (direction == Directions.VERTICAL) {
                                    circles += verticalLine("black");
                                }
                            }
                        }
                    }
                    return circles
                }

                let title;
                if (direction == Directions.HORIZONTAL) {
                    title = time.toString();
                } else if (direction == Directions.VERTICAL) {
                    // title = `${time}-${Object.keys(this.timeToPaths)[i + 1]}`
                    title = `${time}-${this.bipDynGraph.nextTime(time)}`
                }
                let timeColumn = {title: title, data: timeSelColValue, className: ColumnTypes.SELECTION,visible: true};
                this.timeColumns.unshift(timeColumn);
            }
            i++;
        }

        for (let col of this.timeColumns) {
            columns.unshift(col);
        }
    }
}

export class DocumentsTable extends EntityTable {
    constructor(container, properties, tableId, rowClickCb) {
        super(container, properties, tableId, rowClickCb);
    }

    processData(documents) {
        return documents
    }
}

function coloredSquare(color, w = 20, h = 20) {
    return `<svg width="${w}" height="${h}" style="vertical-align: middle;">
        <rect x="0" y="0" width="${w}" height="${h}" fill="${color}"></rect>
    </svg>`
}

function circle(color, r = 5,) {
    return `<svg width="${r * 2}" height="${r * 2}" style="vertical-align: middle; margin-right: 1em;">
        <circle cx="${r}" cy="${r}" r="${r}" height=" fill="${color}"></circle>
    </svg>`
}

function verticalLine(color, r = 10,) {
    return `<svg width="${r * 2}" height="${r * 2}" style="vertical-align: middle; margin-right: 2%;">
        <line x1="${r}" y1="0" x2="${r}" y2="${r * 2}" stroke="${color}" stroke-width="4"></line>
    </svg>`
}

function horizontalLine(color, r = 10,) {
    return `<svg width="${r * 2}" height="${r * 2}" style="vertical-align: middle; margin-right: 1em;">
          <line x1="0" y1="${r}" x2="${r * 2}" y2="${r}" stroke="${color}" stroke-width="4"></line>
    </svg>`
}
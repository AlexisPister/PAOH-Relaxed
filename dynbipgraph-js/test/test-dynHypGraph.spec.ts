import assert from "assert";
import BipartiteDynGraph from "../src/bipartiteDynGraph";

import * as fs from 'fs';
import {ArrayProperty} from "../src/Property";

export default function fpToGraph(fp) {
    let rawdata = fs.readFileSync(fp);
    let jsonData = JSON.parse(rawdata.toString());
    let graph = new BipartiteDynGraph(jsonData);
    return graph;
}

describe('Json To DynHypGraph', function() {
    it("Rolla", () => {
        let graph = fpToGraph("data/Rolla_2modes.json");

        assert.equal(graph.timeMin, 1711);
        assert.deepEqual(graph.nodeTypes, ["DOCUMENT", "PERSON"]);

        let neighbors = graph.getNeighbors("a12", true);
        assert.equal(neighbors[0].id, "p21");

        let props = graph.getPropertyValues("type_chantier")
        assert.equal(props[0], "mil");
        assert.equal(props.length, 141);

        let paohJson = graph.toPaohJson();
        // @ts-ignore
        fs.writeFile('Rolla_Paoh.json', JSON.stringify(paohJson), (err) => {
            // console.log("E ", err)
        });
    })

    it("Dufournaud", () => {
        let graph = fpToGraph("data/Dufournaud_geoloc_1940.json");

        console.log(graph.timeMin)
        assert.equal(graph.timeMin, 1702);
        assert.deepEqual(graph.documentTypeToRoles["birth"], ["child", "father", "mother"]);

        // let neighbors = graph.getNeighbors("a12", true);
        // assert.equal(neighbors[0].id, "p21")
    })

    it("VisPubData", () => {
        let graph = fpToGraph("data/vispubdata_PAOH_affiliation_cleaned_june202_filter2.json");

        // assert.equal(graph.timeMin, 1990);
        assert.equal(graph.properties["affiliation"] instanceof ArrayProperty, true)

        // console.log(graph.getNeighbors(10))
        // let neighbors = graph.getNeighbors("a12", true);
        // assert.equal(neighbors[0].id, "p21")
    })

    it("Aviz-Paoh", () => {
        let graph = fpToGraph("data/aviz_ILDA_exSITU-paoh.json");

        // console.log(graph.times, graph.timeMin)
        assert.equal(graph.timeMin, 2008);
        // assert.equal(graph.properties["affiliation"] instanceof ArrayProperty, true)

        // console.log(graph.getNeighbors(10))
        // let neighbors = graph.getNeighbors("a12", true);
        // assert.equal(neighbors[0].id, "p21")
    })

    it("MB", () => {
        let graph = fpToGraph("data/MB_Paohvis_test.json");

        // console.log(graph.nodes)
        // assert.equal(graph.timeMin, 2008);
        // assert.equal(graph.properties["affiliation"] instanceof ArrayProperty, true)

        // console.log(graph.getNeighbors(10))
        // let neighbors = graph.getNeighbors("a12", true);
        // assert.equal(neighbors[0].id, "p21")
    })

    it("Links by Time", () => {
        let graph = fpToGraph("data/Rolla_2modes.json");
        // console.log(graph.neighbors)
        let links = graph.linksByTimes(1713);
        assert.equal(links.map(l => l.source.id)[0], "a32");
    })

    it("colorScaleProperty", () => {
        let graph = fpToGraph("data/Rolla_2modes.json");

        let prop = graph.getProperty("type_travail");
        prop.computeColorScale();
        assert.equal(prop.colorScale("type_travail"), "#d9d9d9");
    })
})

describe('utilities', function()  {
    it("personCollaborators", () => {
        let graph = fpToGraph("data/Rolla_2modes.json");
        let personToCollabs = graph.personCollaboratorsByTime("p275");
    })
})

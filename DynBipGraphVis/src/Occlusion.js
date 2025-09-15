import * as d3 from 'd3';
import {globals} from "./globals";

// Inspired by https://observablehq.com/@cscheid/force-directed-graph-with-occlusion
class Occlusion {
    constructor() {
        this.texts = {};
        this.occlusionTable = {};
        this.margin = 10;
    }

    sort() {
        this.textIds = Object.keys(this.texts).sort((a, b) => d3.descending(this.texts[a].priority, this.texts[b].priority));
    }

    // updatePriority() {
    //     for (let [nId, text] of Object.entries(this.texts)) {
    //         let highlightPriority = this.highlightNodeTable[nId] ? 1000 : 0;
    //         text.priority = this.idToNode[nId].get("_degree") + highlightPriority
    //     }
    //     this.sort();
    // }

    isInit() {
        return this.selection ? true : false;
    }

    run(selection, forcePersonPriorityCb, forceIds, getLabelCb, upperBound=10000) {
        this.selection = selection ? selection : this.selection;
        this.selection.classed("occluded", false);
        this.forcePersonPriorityCb = forcePersonPriorityCb ? forcePersonPriorityCb : this.forcePersonPriorityCb;
        if (!getLabelCb) getLabelCb = () => ""


        let filled = [];
        this.texts = {};

        this.selection
            .each((d, i, e) => {
                const bbox = e[i].getBoundingClientRect();

                let priority = d.get("weight");
                if ((this.forcePersonPriorityCb && this.forcePersonPriorityCb(d.get("person"))) || (forceIds && forceIds.includes(d.get("person")))) {
                    priority = 100000;
                }

                this.texts[d.id] = {
                    label: d.get("label") || getLabelCb(d),
                    priority: priority,
                    node: e[i],
                    x: bbox.x,
                    y: bbox.y,
                    width: bbox.width,
                    height: bbox.height
                };
            })

        this.sort();

        this.textIds.forEach((textId, i) => {
            let text = this.texts[textId];

            // TODO: init all occluded for faster process
            if (filled.length >= upperBound) {
                d3.select(text.node).classed("occluded", true);
                return;
            }

            const isOccluded = filled.some((e) => this.intersect(text, e));
            d3.select(text.node).classed("occluded", isOccluded);
            if (!isOccluded) filled.push(text);
        })
    }

    intersect(a, b) {
        return !(
            a.x + a.width < b.x ||
            b.x + b.width < a.x ||
            a.y + a.height < b.y ||
            b.y + b.height < a.y
        );
    }

    isNodeOccluded(node) {
        return this.occlusionTable[node.id];
    }
}

export {Occlusion};
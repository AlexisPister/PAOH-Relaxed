export default class InteractionController {
    graphRenderer;
    aggregateVis;
    personsSelectedIds = [];
    constructor(renderer, aggregateVis) {
        this.graphRenderer = renderer;
        this.aggregateVis = aggregateVis;
    }
    getTransform() {
        return this.graphRenderer.transform;
    }
    zoomAction = (e, d) => {
        this.graphRenderer.zoomAction(e, d);
        this.aggregateVis.zoomAction(e, d);
    };
}

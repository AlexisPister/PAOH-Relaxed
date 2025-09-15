var nodeTypes;
(function (nodeTypes) {
    nodeTypes[nodeTypes["PERSON_OCCURENCE"] = 0] = "PERSON_OCCURENCE";
    nodeTypes[nodeTypes["HYPEREDGE"] = 1] = "HYPEREDGE";
})(nodeTypes || (nodeTypes = {}));
var linkTypes;
(function (linkTypes) {
    linkTypes[linkTypes["CROSS_RANK"] = 0] = "CROSS_RANK";
    linkTypes[linkTypes["PERSON_SAME_RANK"] = 1] = "PERSON_SAME_RANK";
})(linkTypes || (linkTypes = {}));
class Globals {
    LOCALHOST = true;
    // this.LOCALHOST = false;
    DOCUMENT = "document";
    MATRIX = "matrix";
    TEMPORAL_MATRIX = "temporalMatrix";
    ROW_MATRICE_NODE = "rowMatNode";
    COLUMNS_MATRICE_NODE = "colMatNode";
    PERSON_OCCURENCE_NODE = "PersonOccurrence"; // occurence in a document
    PERSON_TIME = "personTime"; // person in time node
    PERSON_TIME_LINK = "person_time";
    DOCUMENT_MENTION_LINK = "document_mention";
    ARC_LINK = "repetition";
    CROSSTIME_ARC = "repetition_crosstime";
    PRESENCE_KEY = "presence"; // Number of time a person appear in one time
    SIZE_KEY = "size";
    constructor() {
        // this.parseURLParameters();
        this.computeUrls();
        // this.defineRenderingParameters();
    }
    route(routeName, url = this.URL_BACKEND) {
        return url.toString() + "/" + routeName;
    }
    computeUrls() {
        if (this.LOCALHOST) {
            this.URL_BACKEND = new URL("http://127.0.0.1:5005");
            // this.URL_CLUSTERING = new URL("http://127.0.0.1:10085");
            this.URL_CLUSTERING = this.URL_BACKEND;
        }
        else {
            throw "Backend URL Error";
        }
    }
    parseURLParameters() {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        // this.dataset = urlParams.get('dataset');
    }
}
const globals = new Globals();
export { globals, nodeTypes, linkTypes };

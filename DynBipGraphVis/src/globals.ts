// I put string as values so the values can be used as html classes
enum nodeTypes {
    PERSON_OCCURENCE="person_occurrence",
    HYPEREDGE="hyperedge"
}

enum linkTypes {
    CROSS_RANK,
    PERSON_SAME_RANK
}

enum ColumnTypes {
    SELECTION= "selection",
    PROPERTY = "property",
    COMPUTED_PROPERTY = "computerProperty"
}

class Globals {
    LOCALHOST: boolean = true;
    // this.LOCALHOST = false;

    DOCUMENT = "document";
    MATRIX = "matrix";
    TEMPORAL_MATRIX = "temporalMatrix";

    ROW_MATRICE_NODE = "rowMatNode";
    COLUMNS_MATRICE_NODE = "colMatNode";
    PERSON_OCCURENCE_NODE = "PersonOccurrence"; // occurence in a document
    PERSON_TIME = "personTime" // person in time node
    PERSON_TIME_LINK = "person_time";
    DOCUMENT_MENTION_LINK = "document_mention";
    ARC_LINK = "repetition";
    CROSSTIME_ARC = "repetition_crosstime";

    PRESENCE_KEY = "presence"; // Number of time a person appear in one time
    SIZE_KEY = "size";
    TIME_KEY = "time";
    DIRECTION_KEY = "direction";

    // URLS
    URL_BACKEND: URL;
    URL_CLUSTERING: URL;



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
        } else {
            throw "Backend URL Error"
        }
    }

    parseURLParameters() {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        // this.dataset = urlParams.get('dataset');
    }
}

const globals = new Globals();
export {globals, nodeTypes, linkTypes, ColumnTypes};


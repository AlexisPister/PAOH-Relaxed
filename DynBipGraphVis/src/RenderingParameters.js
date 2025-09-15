class RenderingParameters {
    RADIUS = 8;
    RANK_SIZE = 100;
    RANK_GAP_SIZE = 500;
    GAP_SIZE_EXTENT = [80, 2000];
    DOCUMENT_PADDING = 8;
    DOCUMENT_GAP = 10;
    ARC_MIN_LENGTH = 20;
    UNHIGHLIGHT_OPACITY = 0.2;
    TEMPORAL_MATRICE_PADDING = 10;
    // Paoh
    COLUMN_WIDTH = 35;
    PERSON_OCCURRENCE_PADDING = 4;
    // LINE_STROKE_WIDTH: number = 4;
    LINE_STROKE_WIDTH = 6;
    getPaohPersonOccurrenceWidth() {
        return this.COLUMN_WIDTH - this.PERSON_OCCURRENCE_PADDING * 2;
        // return 8
    }
    getPaohDocumentLineWidth() {
        return this.getPaohPersonOccurrenceWidth() / 5;
    }
    getPersonOccurenceWidth() {
        return this.RANK_SIZE;
    }
    getPersonOccurenceHeight() {
        return this.RADIUS * 2;
    }
    getDocumentWidth() {
        return this.getDocumentWidth() + this.DOCUMENT_PADDING * 2;
    }
    getDocumentHeight(degree) {
        return degree * this.getPersonOccurenceHeight() + this.DOCUMENT_PADDING * 2;
    }
}
const renderingParameters = new RenderingParameters();
export { renderingParameters };

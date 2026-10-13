class RenderingParameters {
    RANK_SIZE: number = 20;

    // RANK_GAP_SIZE: number = 80;
    RANK_GAP_SIZE: number = 65;

    GAP_SIZE_EXTENT: [number, number] = [40, 800];
    DOCUMENT_PADDING: number = 8;
    DOCUMENT_GAP: number = 10;
    ARC_MIN_LENGTH: number = 20;
    // UNHIGHLIGHT_OPACITY: number = 0.2;
    UNHIGHLIGHT_OPACITY: number = 0.24;
    TEMPORAL_MATRICE_PADDING: number = 10;

    // Paoh
    // il diametro di un pallino e' COLUMN_WIDTH (vedi occurrenceRadius in PaohRelaxedVis)
    // COLUMN_WIDTH: number = 35;
    // COLUMN_WIDTH: number = 35;
    // COLUMN_WIDTH: number = 10;
    // colonna da 20 e pallino da 16: fra due nodi vicini restano 4 unita' libere
    COLUMN_WIDTH: number = 20;
    PERSON_OCCURRENCE_PADDING: number = 2;
    RADIUS = 2.7

    // PERSON_OCCURRENCE_PADDING: number = 4;
    // LINE_STROKE_WIDTH: number = 6;
    // un po' piu' spesso, in proporzione ai nodi piu' grandi
    LINE_STROKE_WIDTH: number = 3;


    // TEXT_SIZE = 17;
    // VALUE FOR TEASER IMAGE
    TEXT_SIZE = 15;



    DOCUMENT_COLOR = "rgb(10, 10, 10, 0.25)";

    init() {
        // alcuni slot hanno centinaia di colonne e altri una sola: serve piu' distanza fra gli slot (si cambia dallo slider)
        this.RANK_GAP_SIZE = 480;
    }

    // dimensioni dei nodi: quelle di base oppure quelle dei dataset stratificati (colonne e nodi piu' piccoli)
    applicaProfilo(stratificato: boolean) {
        this.COLUMN_WIDTH = stratificato ? 10 : 20;
        this.PERSON_OCCURRENCE_PADDING = stratificato ? 0 : 2;
        this.RADIUS = stratificato ? 1.5 : 2.7;
    }

    line_stroke_width_highlighted() {
        return this.LINE_STROKE_WIDTH * 3;
    }

    text_size_highlighted() {
        return this.TEXT_SIZE + 3;
    }

    getPaohPersonOccurrenceWidth(): number {
        return this.COLUMN_WIDTH - this.PERSON_OCCURRENCE_PADDING * 2;
    }

    getPaohDocumentLineWidth(): number {
        return this.getPaohPersonOccurrenceWidth() / 5;
    }

    getPersonOccurenceWidth(): number {
        return this.RANK_SIZE;
    }

    getPersonOccurenceHeight(): number {
        return this.RADIUS * 2;
    }

    getDocumentWidth(): number {
        return this.getDocumentWidth() + this.DOCUMENT_PADDING * 2;
    }

    getDocumentHeight(degree): number {
        return degree * this.getPersonOccurenceHeight() + this.DOCUMENT_PADDING * 2;
    }

    columnPadding(): number {
        return this.COLUMN_WIDTH - this.getPaohPersonOccurrenceWidth();
    }
}


const renderingParameters = new RenderingParameters();
export {renderingParameters};
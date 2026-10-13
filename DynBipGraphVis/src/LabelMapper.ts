import {CoordinatedObject, Labelled} from "dynbipgraph";
import {getStringSize} from "./utils";

export enum Orientations {
    RIGHT,
    LEFT
}

export default class LabelMapper {
    objects: (CoordinatedObject & Labelled)[];
    objectLabelOffset: number;
    // centro e raggio del glifo: se c'e', l'etichetta va accanto al nodo, centrata in verticale
    geometria: (o: any) => { cx: number, cy: number, r: number };

    constructor(objects: (CoordinatedObject & Labelled)[], objectLabelOffset = 11,
                geometria: (o: any) => { cx: number, cy: number, r: number } = null) {
        this.objects = objects;
        this.objectLabelOffset = objectLabelOffset
        this.geometria = geometria;
    }

    // mette l'etichetta di ogni oggetto a sinistra o a destra evitando sovrapposizioni (con una griglia per andare piu' veloce)
    run(getLabelCb?: Function, log = false) {
        const CELLA = 128;
        const griglia = new Map<string, CoordinatedObject[]>();
        const celle = (r: CoordinatedObject, azione: (k: string) => void) => {
            let x0 = Math.floor(r.x / CELLA), x1 = Math.floor((r.x + (r.width || 0)) / CELLA);
            let y0 = Math.floor(r.y / CELLA), y1 = Math.floor((r.y + (r.height || 0)) / CELLA);
            for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) azione(cx + "," + cy);
        };
        const inserisci = (r: CoordinatedObject) => celle(r, k => {
            let l = griglia.get(k);
            if (l) l.push(r); else griglia.set(k, [r]);
        });
        const interseca = (r: CoordinatedObject): boolean => {
            let trovato = false;
            celle(r, k => {
                if (trovato) return;
                let l = griglia.get(k);
                if (l) for (const r2 of l) { if (this.doObjectsIntersect(r, r2)) { trovato = true; return; } }
            });
            return trovato;
        };
        const dimensioni = {};
        const misura = (testo) => dimensioni[testo] || (dimensioni[testo] = getStringSize(null, testo, 12));

        for (const object of this.objects) {
            delete (object as any).labelX;
            delete (object as any).labelY;
            if (this.geometria) {
                let g = this.geometria(object);
                inserisci({x: g.cx - g.r, y: g.cy - g.r, width: 2 * g.r, height: 2 * g.r});
            } else {
                inserisci({x: object.x, y: object.y, width: object.width || 0, height: object.height || 0});
            }
        }

        for (const object of this.objects) {
            const label = object.label() || (getLabelCb ? getLabelCb(object) : "");
            let {x, y, width, height} = object;
            if (!width) width = 0;
            if (!height) height = 0;
            let [objLeft, objRight, objTop] = [x, x + width, y];
            let [textWidth, textHeight] = misura(label);

            let labelPosOptions = [
                {x: objLeft - this.objectLabelOffset - textWidth, y: objTop - this.objectLabelOffset}, // top left
                {x: objRight + this.objectLabelOffset, y: objTop - this.objectLabelOffset}, // top right
            ];
            let centroY = null;
            if (this.geometria) {
                // etichetta alla stessa altezza del centro del glifo, a sinistra o a destra
                let g = this.geometria(object);
                let gap = g.r * 0.5 + 2;
                centroY = g.cy;
                labelPosOptions = [
                    {x: g.cx - g.r - gap - textWidth, y: g.cy - textHeight / 2}, // sinistra
                    {x: g.cx + g.r + gap, y: g.cy - textHeight / 2},             // destra
                ];
            }

            // vince l'ultima posizione libera (destra se sono libere tutte e due)
            let scelta: CoordinatedObject = null, j = -1;
            labelPosOptions.forEach((pos, i) => {
                let r = {x: pos.x, y: pos.y, width: textWidth, height: textHeight};
                if (!interseca(r)) { scelta = r; j = i; }
            });
            if (scelta) {
                object.labelX = scelta.x;
                object.labelY = centroY !== null ? centroY : scelta.y;
                if (j == 0) {
                    object.position = Orientations.LEFT;
                    object.labelX += textWidth;
                } else {
                    object.position = Orientations.RIGHT;
                }
                inserisci(scelta);
            }
        }
    }

    // posizionamento per una selezione: ogni nodo selezionato ha il suo nome (destra, sinistra, poi sopra o sotto)
    runSelezione(scalaTesto: number) {
        if (!this.geometria) return;
        const CELLA = 64;
        const griglia = new Map<string, any[]>();
        const celle = (r, azione: (k: string) => void) => {
            let x0 = Math.floor(r.x / CELLA), x1 = Math.floor((r.x + r.width) / CELLA);
            let y0 = Math.floor(r.y / CELLA), y1 = Math.floor((r.y + r.height) / CELLA);
            for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) azione(cx + "," + cy);
        };
        const inserisci = (r) => celle(r, k => { let l = griglia.get(k); if (l) l.push(r); else griglia.set(k, [r]); });
        const interseca = (r): boolean => {
            let trovato = false;
            celle(r, k => {
                if (trovato) return;
                let l = griglia.get(k);
                if (l) for (const r2 of l) { if (this.doObjectsIntersect(r, r2)) { trovato = true; return; } }
            });
            return trovato;
        };
        const dimensioni = {};
        const misura = (t) => dimensioni[t] || (dimensioni[t] = getStringSize(null, t, 12));

        // un oggetto puo' essere un gruppo di nodi sulla stessa riga (cx .. cx1)
        for (const o of this.objects) {
            let g: any = this.geometria(o);
            let cx1 = g.cx1 !== undefined ? g.cx1 : g.cx;
            inserisci({x: g.cx - g.r, y: g.cy - g.r, width: cx1 - g.cx + 2 * g.r, height: 2 * g.r});
        }
        for (const o of this.objects) {
            const label = o.label() || "";
            let [w0, h0] = misura(label);
            let w = w0 * scalaTesto * 1.08, h = h0 * scalaTesto;   // +8%: il nome e' in grassetto
            let g: any = this.geometria(o);
            let cx1 = g.cx1 !== undefined ? g.cx1 : g.cx;
            let gap = g.r * 0.5 + 2 * scalaTesto;
            let dx = cx1 + g.r + gap, sx = g.cx - g.r - gap - w, y0 = g.cy - h / 2, sp = h * 0.8;
            let opzioni = [
                {x: dx, y: y0, lato: Orientations.RIGHT}, {x: sx, y: y0, lato: Orientations.LEFT},
                {x: dx, y: y0 - sp, lato: Orientations.RIGHT}, {x: dx, y: y0 + sp, lato: Orientations.RIGHT},
                {x: sx, y: y0 - sp, lato: Orientations.LEFT}, {x: sx, y: y0 + sp, lato: Orientations.LEFT},
            ];
            let scelta = opzioni.find(p => !interseca({x: p.x, y: p.y, width: w, height: h})) || opzioni[0];
            let r = {x: scelta.x, y: scelta.y, width: w, height: h};
            inserisci(r);
            (o as any).labelY = scelta.y + h / 2;
            (o as any).position = scelta.lato;
            (o as any).labelX = scelta.lato === Orientations.LEFT ? scelta.x + w : scelta.x;
        }
    }

    doObjectsIntersect(obj1: CoordinatedObject, obj2: CoordinatedObject): boolean {
        const rect1Right = obj1.x + obj1.width;
        const rect1Bottom = obj1.y + obj1.height;
        const rect2Right = obj2.x + obj2.width;
        const rect2Bottom = obj2.y + obj2.height;

        let aLeftOfB = rect1Right < obj2.x;
        let aRightOfB = obj1.x > rect2Right;
        let aAboveB = rect1Bottom < obj2.y;
        let aBelowB = obj1.y > rect2Bottom;

        return !(aLeftOfB || aRightOfB || aAboveB || aBelowB);
    }

    // Calculate the intersection point between two lines
    calculateLineIntersection(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
        const ua =
            ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
        const x = x1 + ua * (x2 - x1);
        const y = y1 + ua * (y2 - y1);

        return {x, y};
    }
}
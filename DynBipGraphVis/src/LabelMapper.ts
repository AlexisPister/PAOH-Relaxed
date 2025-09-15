import {CoordinatedObject, Labelled} from "dynbipgraph";
import {getStringSize} from "./utils";

export enum Orientations {
    RIGHT,
    LEFT
}

export default class LabelMapper {
    objects: (CoordinatedObject & Labelled)[];
    objectLabelOffset: number;

    constructor(objects: (CoordinatedObject & Labelled)[], objectLabelOffset = 11) {
        this.objects = objects;
        this.objectLabelOffset = objectLabelOffset
    }

    run(getLabelCb: Function, log = false) {
        let i = 0;

        let labelToDimensions = {};

        for (const object of this.objects) {
            const label = object.label() || getLabelCb(object);
            let {x, y, width, height} = object;

            if (!width) width = 0
            if (!height) height = 0

            let [objLeft, objRight, objTop, objBottom] = [x, x + width, y, y + height]

            // let [textWidth, textHeight] = getStringSize("svg", label, 12)
            let [textWidth, textHeight] = getStringSize(null, label, 12)
            // console.log(label, textWidth, textHeight)

            const labelPosOptions = [
                // {x: objRight + this.objectLabelOffset, y: objBottom}, // right
                // {x: objLeft - this.objectLabelOffset, y: objBottom}, // left
                // {x: objLeft, y: objTop - this.objectLabelOffset}, // top
                // {x: objLeft, y: objBottom + this.objectLabelOffset}, // bottom
                // {x: objLeft - this.objectLabelOffset, y: objBottom + this.objectLabelOffset}, // bottom left
                // {x: objRight + this.objectLabelOffset, y: objBottom + this.objectLabelOffset}, // bottom right
                // {x: objLeft - this.objectLabelOffset, y: objTop - this.objectLabelOffset}, // top left
                {x: objLeft - this.objectLabelOffset - textWidth, y: objTop - this.objectLabelOffset}, // top left
                {x: objRight + this.objectLabelOffset, y: objTop - this.objectLabelOffset}, // top right
            ];


            positionLoop:
                for (let j = 0; j < labelPosOptions.length; j++) {
                    let pos = labelPosOptions[j];
                    // let labelObject: CoordinatedObject = {x: pos.x, y: pos.y, width: 40, height: 15};
                    let labelObject: CoordinatedObject = {x: pos.x, y: pos.y, width: textWidth, height: textHeight};

                    // Check if this label position intersects with any other label or object
                    let k = -1
                    for (const object2 of this.objects) {
                        k++;
                        let [intersectLabels, intersectObject] = [false, false];
                        // if (k != i) {
                        intersectObject = this.doObjectsIntersect(labelObject, object2)

                        const label2X = object2.labelX;
                        const label2Y = object2.labelY;
                        let labelObject2 = object2.label();

                        let textWidth2, textHeight2;
                        if (labelToDimensions[labelObject2]) {
                            [textWidth2, textHeight2] = labelToDimensions[labelObject2];
                        } else {
                            // [textWidth2, textHeight2] = getStringSize("svg", labelObject2, 12)
                            [textWidth2, textHeight2] = getStringSize(null, labelObject2, 12)
                            labelToDimensions[labelObject2] = [textWidth2, textHeight2];
                        }
                        // let [textWidth2, textHeight2] = getStringSize("svg", labelObject2, 12)

                        if (label2X && label2Y) {
                            // let labelObject2 = {x: label2X, y: label2Y, width: textWidth, height: textHeight};
                            let labelObject2 = {x: label2X, y: label2Y, width: textWidth2, height: textHeight2};
                            // let labelObject2 = {x: label2X, y: label2Y, width: 40, height: 15};
                            intersectLabels = this.doObjectsIntersect(labelObject, labelObject2);
                        }

                        // if (log) console.log(label, intersectLabels, intersectObject, object2)
                        if (intersectObject || intersectLabels) {
                            continue positionLoop;
                        }
                        // }
                    }

                    // console.log(label, "NO CROSS")
                    // No crossing found
                    object.labelX = labelObject.x;
                    object.labelY = labelObject.y;

                    if (j == 0) {
                        object.position = Orientations.LEFT;
                        object.labelX += textWidth;
                    } else {
                        object.position = Orientations.RIGHT;
                    }
                }
            i++;
        }

        // Iterate through each path
        // for (const path of paths-js) {
        //     const {points} = path;
        //
        //     // Check if the label crosses the path
        //     for (let i = 0; i < points.length - 1; i++) {
        //         const {x: x1, y: y1} = points[i];
        //         const {x: x2, y: y2} = points[i + 1];
        //
        //         // Calculate the intersection point between the path and the label line
        //         const {
        //             x: intX,
        //             y: intY
        //         } = calculateLineIntersection(centerX, centerY, labelObject.labelX!, labelObject.labelY!, x1, y1, x2, y2);
        //
        //         // If the intersection point is within the label or path bounds, move the label to a new position
        //         if (
        //             intX >= Math.min(centerX, labelObject.labelX!) &&
        //             intX <= Math.max(centerX, labelObject.labelX!) &&
        //             intY >= Math.min(centerY, labelObject.labelY!) &&
        //             intY <= Math.max(centerY, labelObject.labelY!) &&
        //             intX >= Math.min(x1, x
        //
        //
        //             // If the intersection point is within the label or path bounds, move the label to a new position
        //             if (
        //                 intX >= Math.min(centerX, labelObject.labelX!) &&
        //                 intX <= Math.max(centerX, labelObject.labelX!) &&
        //                 intY >= Math.min(centerY, labelObject.labelY!) &&
        //                 intY <= Math.max(centerY, labelObject.labelY!) &&
        //                 intX >= Math.min(x1, x2) &&
        //                 intX <= Math.max(x1, x2) &&
        //                 intY >= Math.min(y1, y2) &&
        //                 intY <= Math.max(y1, y2)
        //             ) {
        //                 overlapping = true;
        //
        //                 // Calculate the angle between the path and the label
        //                 const angle = Math.atan2(centerY - labelObject.labelY!, centerX - labelObject.labelX!);
        //
        //                 // Calculate the new label coordinates
        //                 const newLabelX = centerX + (width / 2 + 10) * Math.cos(angle);
        //                 const newLabelY = centerY + (width / 2 + 10) * Math.sin(angle);
        //
        //                 // Update the label object with the new label coordinates
        //                 labelObject.labelX = newLabelX;
        //                 labelObject.labelY = newLabelY;
        //             }
        //     }
        // }
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
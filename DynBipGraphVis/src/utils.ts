import * as d3 from "d3";

// function getStringSize(svg: SVGSVGElement, text: string, fontSize: number): [ width: number; height: number ] {
function getStringSize(svgSelector: string, text: string, fontSize: number): [number,  number] {
    // Create a new SVG text element
    // const svgElement = document.createElementNS('http://www.w3.org/2000/svg', "svg");

    const svgElement = (svgSelector) ? d3.select(svgSelector).node() : d3.create("svg").node();
    // const svgElement = d3.create("svg").node();
    const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    // document.body.append(svgElement);

    if (document.body == null) {
        return [0, 0]
    }

    if (!svgSelector) document.querySelector('body').appendChild(svgElement);

    // Set the font size and text content
    textElement.setAttribute('font-size', `${fontSize}px`);
    textElement.textContent = text;

    // Append the text element to the SVG
    svgElement.appendChild(textElement);

    // Get the bounding box of the text element
    const bbox = textElement.getBBox();

    // Remove the text element from the SVG
    if (!svgSelector) document.body.removeChild(svgElement);
    // document.body.removeChild(textElement);
    // svg.removeChild(textElement);

    // Return the width and height
    return [bbox.width, bbox.height]
}


function groupBy(xs, key) {
    return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
}

function getFirstIndexOfMinValue(array) {
    return array.reduce((r, v, i, a) => v >= a[r] ? r : i, -1);
}

function getKeyByValueMap(map, searchValue, compareFunc) {
    for (let [key, value] of map.entries()) {
        if (compareFunc(searchValue, value))
            return key;
    }
}

// Resize selection to parent container
const resize = (jquerySel) => {
    let width = jquerySel.parent().width();
    let height = jquerySel.parent().height();
    jquerySel.width(width);
    jquerySel.height(height);
}

function concatMaps(map, ...iterables) {
    for (const iterable of iterables) {
        console.log(1)
        for (const item of iterable) {
            map.set(...item);
        }
    }
    return map
}


export function saveSvg(svgEl, name) {
    svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    var svgData = svgEl.outerHTML;
    var preface = '<?xml version="1.0" standalone="no"?>\r\n';
    var svgBlob = new Blob([preface, svgData], {type:"image/svg+xml;charset=utf-8"});
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = name;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}


export {groupBy, getFirstIndexOfMinValue, resize, getKeyByValueMap, getStringSize, concatMaps};
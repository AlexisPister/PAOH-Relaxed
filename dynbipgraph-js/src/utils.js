export function randomIntFromInterval(min, max) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min)
}

export function intersect(a, b) {
  let setB = new Set(b);
  return [...new Set(a)].filter(x => setB.has(x));
}

export function mergeMaps(s, t) {
    let outputMap = new Map();
    s.forEach(function (value, key) {
        outputMap.set(key, value);
    })
    t.forEach(function (value, key) {
        outputMap.set(key, value);
    })
    return outputMap;
}

export function flatten2dArray(array) {
    return [].concat(...array);
}


export function allPairs(array) {
    let result = array.reduce((acc, v, i) =>
            acc.concat(array.slice(i + 1).map(w => [v, w])),
        []);
    return result;
}

export function groupBy(xs, key) {
    return xs.reduce(function (rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
}


export function isObject(yourVariable) {
    if (
        typeof yourVariable === 'object' &&
        !Array.isArray(yourVariable) &&
        yourVariable !== null
    ) {
        return true;
    }
    return false;
}


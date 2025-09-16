

// based on https://hal-lirmm.ccsd.cnrs.fr/lirmm-01542283v2
export function overlapRemoval(nodes, positionKey, sizeKey) {
    nodes.sort((n1, n2) => n1.get(positionKey) - n2.get(positionKey));

    let ys = nodes.map(node => node.get(positionKey));
    let sizes = nodes.map(node => node.get(sizeKey));
    let cumulSize = sizes.reduce((a,b) => a + b);

    let min = Math.min(...ys);
    let max = Math.max(...ys);
    let length = max - min;

    let positionsPrime = ys.map(y => positionPrime(y, min, max, length, cumulSize));

    let newPositions = ys.map((y, i) => {
        let sum = 0;
        for (let j = 0; j <= i; j++) {
            sum += sizes[j];
        }
        return positionsPrime[i] - (sizes[i] / 2) + sum;
    })

    nodes.forEach((n, i) => {
        n.set(positionKey, parseInt(newPositions[i]));
    })
}

function positionPrime(p, pmin, pmax, l, cumulsize) {
    return (p - pmin) / (pmax - pmin) * (l - cumulsize);
}

interface CoordinatedObject {
    x: number;
    y: number;
    width?: number;
    height?: number;
}

interface Point extends CoordinatedObject {
    x: number
    y: number
}

export {CoordinatedObject, Point}
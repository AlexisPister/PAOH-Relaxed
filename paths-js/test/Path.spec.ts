import {assert} from "chai";
import Path from "../src/Path";

describe("Paths", () => {
    it("Simple path", () => {
        const path = new Path();
        path.addPoint({x: 10, y: 20});
        assert.equal(path.toSvgPath(), "M 10,20")

        path.addPoint({x: 20, y: 30});
        assert.equal(path.toSvgPath(), "M 10,20 L 20,30")
    });

    it("double", () => {
        const path = new Path();
        path.addPoint({x: 10, y: 20});
        path.addPoint({x: 20, y: 30});
        path.addPoint({x: 60, y: 90});

        path.doubleSegment(1, 2);

        assert.equal(path.points[2].x, 40);
        assert.equal(path.points[2].y, 60);
    });

    it("Cut", () => {
        const path = new Path();
        path.addPoint({x: 10, y: 20});
        path.addPoint({x: 20, y: 30});
        path.addPoint({x: 60, y: 90});

        let [p1, p2] = path.cut(1);

        assert.equal(p2.points[0].x, 20);
        assert.equal(p2.points.length, p1.points.length);
    });
});
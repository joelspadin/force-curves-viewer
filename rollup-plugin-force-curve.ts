import { extname } from 'path';
import { Plugin } from 'rollup';
import { blur, groups, maxIndex, mean, minIndex, pairs } from 'd3-array';
import { csvParse } from 'd3-dsv';
import toSource from 'tosource';
import 'core-js/actual/array/find-last-index.js';

const HEADER_LINES = 5;

interface Point {
    x: number;
    force: number;
}

export function forceCurvePlugin(): Plugin {
    return {
        name: 'force-curve',

        transform(code, id) {
            if (extname(id) != '.csv') {
                return null;
            }

            const rows = parseCsv(code);
            const [downstroke, upstroke] = partitionStrokes(rows).map(simplifyPoints);

            const module = {
                downstroke,
                upstroke,
                ...getKeyPoints(downstroke),
            };

            return {
                code: `export default ${toSource(module)}`,
                map: { mappings: '' },
            };
        },
    };
}

function parseCsv(code: string): Point[] {
    code = code.split('\n').slice(HEADER_LINES).join('\n');

    const rows = csvParse(code).map<Point>((row) => {
        return {
            x: parseFloat(row.Displacement ?? '0'),
            force: parseFloat(row.Force ?? '0'),
        };
    });

    // Throw out any negative displacements to make the charts look nicer.
    return rows.filter((row) => row.x >= 0);
}

/**
 * Simplify values with the same displacement to just the first and last point
 * in each group.
 */
function simplifyPoints(points: Point[]) {
    return groups(points, (p) => p.x).flatMap(([_, group]) => {
        if (group.length > 2) {
            // TODO: should keep endpoints and min/max of group?
            return [group.at(0)!, group.at(-1)!];
        }
        return group;
    });
}

/**
 * Splits points into [downstroke, upstroke]
 */
function partitionStrokes(points: Point[]): [Point[], Point[]] {
    const index = maxIndex(points, (p) => p.x);
    return [points.slice(0, index), points.slice(index)];
}

/**
 * Estimates the 1st derivative of the points
 */
function getDerivative(points: Point[]): Point[] {
    points = groups(points, (p) => p.x).map(([x, group]) => ({
        x,
        force: mean(group, (p) => p.force) ?? 0,
    }));

    const result = pairs(points, (a, b) => b.force - a.force);
    blur(result, 7);

    return points.map((p, i) => ({
        x: p.x,
        force: result[i],
    }));
}

function findLocalMaxima(points: Point[]) {
    let forces = points.map((p) => p.force);
    blur(forces, 7);

    let max: Point | undefined = undefined;
    let maxima: Point[] = [];

    for (let i = 0; i < forces.length - 1; i++) {
        if (forces[i + 1] > forces[i]) {
            max = points[i + 1];
        } else if (max !== undefined && forces[i + 1] < forces[i]) {
            maxima.push(max);
            max = undefined;
        }
    }

    return maxima;
}

function findLocalMinima(points: Point[]) {
    let forces = points.map((p) => p.force);
    blur(forces, 7);

    let min: Point | undefined = undefined;
    let minima: Point[] = [];

    for (let i = 0; i < forces.length - 1; i++) {
        if (forces[i + 1] < forces[i] && forces[i + 1]) {
            min = points[i + 1];
        } else if (min !== undefined && forces[i + 1] > forces[i]) {
            minima.push(min);
            min = undefined;
        }
    }

    return minima;
}

function findBottomOutDisplacement(derivative2: Point[]) {
    for (let i = derivative2.length - 2; i >= 0; i--) {
        if (derivative2[i].force < derivative2[i + 1].force) {
            return derivative2[i].x;
        }
    }

    return derivative2.at(-1)?.x!;
}

const MAX_TACTILE_DISPLACEMENT = 3;
const ZERO: Point = { x: 0, force: 0 };

function getKeyPoints(downstroke: Point[]) {
    const velocity = getDerivative(downstroke);
    const accel = getDerivative(velocity);

    const bottomOutDisplacement = findBottomOutDisplacement(accel);
    const bottomOut = downstroke.find((p) => p.x >= bottomOutDisplacement) ?? ZERO;

    // Determine the max tactile point to be the largest local maximum before
    // some arbitrary displacement, so we don't select bumps in the bottom out.
    const maxima = findLocalMaxima(downstroke).filter((p) => p.x < MAX_TACTILE_DISPLACEMENT);
    const tactileMax = maxElement(maxima, (p) => p.force) ?? ZERO;

    // Determine the min tactile point to be the smallest local minimum that
    // occurs after the max point.
    const minima = findLocalMinima(downstroke).filter((p) => p.x > (tactileMax?.x ?? 0));
    const tactileMin = minElement(minima, (p) => p.force) ?? ZERO;

    return {
        bottomOut,
        tactileMax,
        tactileMin,
    };
}

function minElement<T>(data: T[], accessor: (datum: T) => number) {
    return data.at(minIndex(data, accessor));
}

function maxElement<T>(data: T[], accessor: (datum: T) => number) {
    return data.at(maxIndex(data, accessor));
}

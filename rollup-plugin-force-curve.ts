import 'core-js/actual/array/find-last-index.js';
import { blur, groups, maxIndex, mean, pairs, range } from 'd3-array';
import { csvParse } from 'd3-dsv';
import { interpolateNumber } from 'd3-interpolate';
import path from 'path';
import { Plugin } from 'rollup';
import simplify from 'simplify-js';
import toSource from 'tosource';

const HEADER_LINES = 5;

type Point = [number, number];

interface ForceCurveMetadata {
    bottomOut: Point;
    tactileMax: Point;
    tactileMin: Point;
    isTactile: boolean;
}

interface ForceCurve {
    downstroke: Point[];
    upstroke: Point[];
}

const forceCurvesPath = path.resolve(__dirname, 'force-curves');

function isRawDataCsv(id: string) {
    return (
        path.extname(id) === '.csv' &&
        !id.includes('HighResolution') &&
        !id.includes('HighResoultion')
    );
}

/**
 * Converts .css files to modules with exports: `{ curve: ForceCurve, metadata: ForceCurveMetadata }`.
 */
export function forceCurvePlugin(): Plugin {
    return {
        name: 'force-curve',

        async load(id) {
            if (!isRawDataCsv(id)) {
                return null;
            }

            const csv = await this.fs.readFile(id, { encoding: 'utf8' });

            const rows = parseCsv(csv);
            const [downstroke, upstroke] = partitionStrokes(rows).map((p) =>
                dedupePoints(simplifyPoints(p)),
            );

            const curve: ForceCurve = { downstroke, upstroke };
            const metadata = getMetadata(downstroke);

            return {
                code: `
                    export const curve = ${toSource(curve)};
                    export const metadata = ${toSource(metadata)};
                `,
                meta: {
                    forceCurveMetadata: metadata,
                },
            };
        },
    };
}

/**
 * Collects all the metadata from .css files imported using forceCurvePlugin() and generates a "force-curve-metadata"
 * module with exports: `{ default: Record<string, ForceCurveMetadata> }`. Each dictionary key is the path to the .csv
 * file relative to the "force-curves" directory.
 */
export function forceCurveMetadataPlugin(): Plugin {
    return {
        name: 'force-curve-metadata',

        resolveId(id) {
            if (id === 'force-curve-metadata') {
                return id;
            }
            return null;
        },

        async load(id) {
            if (id !== 'force-curve-metadata') {
                return null;
            }

            const metadata: Record<string, ForceCurveMetadata> = {};

            for (const moduleId of this.getModuleIds()) {
                if (!isRawDataCsv(moduleId)) {
                    continue;
                }

                const module = await this.load({ id: moduleId });
                const curveMetadata = module.meta.forceCurveMetadata as
                    | ForceCurveMetadata
                    | undefined;

                if (curveMetadata) {
                    const key = path.relative(forceCurvesPath, moduleId).replaceAll(path.sep, '/');
                    metadata[key] = curveMetadata;
                }
            }

            return `export default ${toSource(metadata)};`;
        },
    };
}

function parseCsv(code: string): Point[] {
    code = code.split('\n').slice(HEADER_LINES).join('\n');

    const rows = csvParse(code).map<Point>((row) => {
        return [parseFloat(row.Displacement ?? '0'), parseFloat(row.Force ?? '0')];
    });

    // Throw out any negative displacements to make the charts look nicer.
    return rows.filter((row) => row[0] >= 0);
}

/**
 * Simplify the curve to reduce its size.
 */
function simplifyPoints(points: Point[], tolerance = 0.01): Point[] {
    const xy = points.map((p) => ({ x: p[0], y: p[1] }));

    const simplified = simplify(xy, tolerance, true);

    return simplified.map((p) => [p.x, p.y]);
}

/**
 * Merges points with the same displacement
 */
function dedupePoints(points: Point[]): Point[] {
    return groups(points, (p) => p[0]).map(([x, group]) => [x, mean(group.map((p) => p[1])) ?? 0]);
}

/**
 * Splits points into [downstroke, upstroke]
 */
function partitionStrokes(points: Point[]): [Point[], Point[]] {
    const index = maxIndex(points, (p) => p[0]);
    return [points.slice(0, index), points.slice(index)];
}

/**
 * Estimates the 1st derivative of the points
 */
function getDerivative(points: Point[]): Point[] {
    points = groups(points, (p) => p[0]).map(([x, group]) => [x, mean(group, (p) => p[1]) ?? 0]);

    const result = pairs(points, (a, b) => (b[1] - a[1]) / (b[0] - a[0]));
    blur(result, 0.1);

    return points.map((p, i) => [p[0], result[i]]);
}

function quantize(points: Point[], step = 0.02): Point[] {
    if (points.length < 2) {
        return points;
    }

    const start = points.at(0)?.[0] ?? 0;
    const stop = points.at(-1)?.[0] ?? 0;

    const result: Point[] = [];
    let i = 0;

    for (const x of range(start, stop + step / 2, step)) {
        while (i < points.length - 2 && x > points[i + 1][0]) {
            i++;
        }

        const t = (x - points[i][0]) / (points[i + 1][0] - points[i][0]);
        const force = interpolateNumber(points[i][1], points[i + 1][1])(t);

        result.push([x, force]);
    }

    return result;
}

function findLocalMaxima(points: Point[]) {
    const forces = points.map((p) => p[1]);

    let max: Point | undefined = undefined;
    const maxima: Point[] = [];

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
    const forces = points.map((p) => p[1]);

    let min: Point | undefined = undefined;
    const minima: Point[] = [];

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

const TACTILE_MIN_DISTANCE_FROM_BOTTOM_OUT = 0.5;

const ZERO: Point = [0, 0];

function getMetadata(downstroke: Point[]): ForceCurveMetadata {
    // Further simplify to get more stable derivatives
    const simplified = quantize(simplifyPoints(downstroke, 0.2), 0.01);

    // Bottom out point is where the force accelerates the most at the end of travel.
    const velocity = getDerivative(simplified);
    const accel = simplifyPoints(getDerivative(velocity), 0.1);

    const bottomOutDisplacement = findLocalMaxima(accel).at(-1)?.[0] ?? 0;
    const bottomOut = downstroke.find((p) => p[0] >= bottomOutDisplacement) ?? ZERO;

    // Determine the min and max tactile points to be the two points with the
    // largest difference in force prior to the bottom out.
    const maxima = findLocalMaxima(downstroke).filter(
        (p) => p[0] < bottomOutDisplacement - TACTILE_MIN_DISTANCE_FROM_BOTTOM_OUT,
    );
    const minima = findLocalMinima(downstroke);

    const maximaMinimaPairs = maxima.map((max) => {
        const minimaAfter = minima.filter((p) => p[0] > max[0]);
        const largestDifference = maxElement(minimaAfter, (p) => max[1] - p[1]);

        return [max, largestDifference] as [Point, Point];
    });

    const [tactileMax, tactileMin] = maxElement(
        maximaMinimaPairs,
        (pair) => pair[0][1] - pair[1][1],
    ) ?? [ZERO, ZERO];

    const isTactile = tactileMax[1] - tactileMin[1] >= minTactileForce(bottomOut[1]);

    return {
        bottomOut,
        tactileMax,
        tactileMin,
        isTactile,
    };
}

function maxElement<T>(data: T[], accessor: (datum: T) => number) {
    return data.at(maxIndex(data, accessor));
}

function minTactileForce(bottomOutForce: number) {
    return Math.min(bottomOutForce * 0.2, 5);
}

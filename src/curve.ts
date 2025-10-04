import type { ForceCurveMetadata, Point } from 'force-curve-metadata';
import forceCurveMetadata from 'force-curve-metadata';
import slugify from 'slugify';

export type { ForceCurveMetadata } from 'force-curve-metadata';

export interface CurveFile {
    key: string;
    name: string;
    metadata: ForceCurveMetadata;
}

export interface TaggedPoint {
    x: number;
    force: number;
    name: string;
    upStroke: boolean;
}

export interface ForceCurve {
    points: TaggedPoint[];
    bottomOut: TaggedPoint;
    tactileMax: TaggedPoint;
    tactileMin: TaggedPoint;
    isTactile: boolean;
}

interface ForceCurveModule {
    curve: {
        downstroke: Point[];
        upstroke: Point[];
    };
    metadata: ForceCurveMetadata;
}

const forceCurves = normalizeKeys(
    import.meta.glob<ForceCurveModule>([
        '../force-curves/**/*.csv',
        '!**/*HighResolution*.csv',
        '!**/*HighResoultion*.csv',
    ]),
);

let curveFiles: Record<string, CurveFile> | undefined;

export function getForceCurves(): Record<string, CurveFile> {
    if (!curveFiles) {
        curveFiles = normalizeKeys(
            forceCurveMetadata,
            (entry) =>
                ({
                    key: entry.key,
                    name: entry.name,
                    metadata: entry.data,
                }) as CurveFile,
        );
    }

    return curveFiles;
}

export async function loadForceCurve(curve: CurveFile): Promise<ForceCurve> {
    const curveGetter = forceCurves[curve.key];
    if (!curveGetter) {
        throw new Error(`Invalid curve file ${curve.key}`);
    }

    const data = await curveGetter();

    const name = curve.name;
    const { downstroke, upstroke } = data.curve;
    const { bottomOut, tactileMax, tactileMin, isTactile } = data.metadata;

    return {
        // Place upstroke before downstroke so downstroke renders over upstroke.
        points: [
            ...upstroke.map((p) => tagPoint(p, name, true)),
            ...downstroke.map((p) => tagPoint(p, name)),
        ],
        bottomOut: tagPoint(bottomOut, name),
        tactileMax: tagPoint(tactileMax, name),
        tactileMin: tagPoint(tactileMin, name),
        isTactile,
    };
}

function tagPoint(point: Point, name: string, upStroke = false): TaggedPoint {
    return { x: point[0], force: point[1], name, upStroke };
}

function normalizePath(path: string) {
    const csvReplacements = {
        _: ' ',
        '../force-curves': '',
        'Raw Data CSV.csv': '',
    };

    for (const [text, replacement] of Object.entries(csvReplacements)) {
        path = path.replaceAll(text, replacement);
    }

    return path.trim();
}

function getSwitchName(path: string) {
    path = normalizePath(path);
    return path.split('/').pop() ?? path;
}

slugify.extend({
    '/': '_',
});

interface SwitchEntry<T> {
    key: string;
    name: string;
    data: T;
}

function normalizeKeysImpl<T, T2>(
    switches: Record<string, T>,
    transform: (entry: SwitchEntry<T>) => T2,
): Record<string, T2> {
    const result: Record<string, T2> = {};

    for (const [originalKey, data] of Object.entries(switches)) {
        const path = normalizePath(originalKey);
        const name = getSwitchName(path);

        const key = slugify(name);

        if (result[key]) {
            console.warn('Duplicate switch file:', key);
        } else {
            result[key] = transform({ key, name, data });
        }
    }

    return result;
}

function normalizeKeys<T>(switches: Record<string, T>): Record<string, T>;
function normalizeKeys<T, T2>(
    switches: Record<string, T>,
    transform: (entry: SwitchEntry<T>) => T2,
): Record<string, T2>;
function normalizeKeys<T, T2>(
    switches: Record<string, T>,
    transform?: (entry: SwitchEntry<T>) => T2,
): Record<string, T2> {
    if (transform) {
        return normalizeKeysImpl(switches, transform);
    }

    // @ts-expect-error In this overload, T2 == T
    return normalizeKeysImpl(switches, (entry) => entry.data);
}

import type { ForceCurveMetadata, Point } from 'force-curve-metadata';
import forceCurveMetadata from 'force-curve-metadata';

export type { ForceCurveMetadata } from 'force-curve-metadata';

export interface CurveFile {
    name: string;
    path: string;
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

const forceCurves = import.meta.glob<ForceCurveModule>([
    '../force-curves/**/*.csv',
    '!**/*HighResolution*.csv',
    '!**/*HighResoultion*.csv',
]);

export function getForceCurves(): CurveFile[] {
    return Object.entries(forceCurveMetadata).map(([path, metadata]) => {
        return {
            name: getSwitchName(path),
            path,
            metadata,
        };
    });
}

export async function loadForceCurve(curve: CurveFile): Promise<ForceCurve> {
    const curveGetter = forceCurves['../force-curves/' + curve.path];
    if (!curveGetter) {
        throw new Error(`Invalid curve file ${curve.path}`);
    }

    const data = await curveGetter();

    const name = getSwitchName(curve.path);
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

const CSV_REPLACEMENTS = {
    _: ' ',
    'Raw Data CSV': '',
};

function getSwitchName(path: string) {
    let filename = path.split('/').pop()?.split('.')?.[0] ?? path;

    for (const [text, replacement] of Object.entries(CSV_REPLACEMENTS)) {
        filename = filename.replaceAll(text, replacement);
    }

    return filename.trim();
}

function tagPoint(point: Point, name: string, upStroke = false): TaggedPoint {
    return { x: point[0], force: point[1], name, upStroke };
}

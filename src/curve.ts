export interface Point {
    x: number;
    force: number;
}

export interface CurveMetadata {
    bottomOut: Point;
    tactileMax?: Point;
    tactileMin?: Point;
}

export interface CurveFile {
    name: string;
    path: string;
    metadata: () => Promise<CurveMetadata>;
}

export interface TaggedPoint {
    name: string;
    x: number;
    force: number;
    upStroke: boolean;
}

export interface ForceCurve extends CurveMetadata {
    points: TaggedPoint[];
    bottomOut: TaggedPoint;
    tactileMax: TaggedPoint;
    tactileMin: TaggedPoint;
}

interface ForceCurveModule {
    downstroke: Point[];
    upstroke: Point[];
    bottomOut: Point;
    tactileMax: Point;
    tactileMin: Point;
}

const forceCurves = import.meta.glob<{ default: ForceCurveModule }>('../force-curves/**/*.csv');

export function getForceCurves(): CurveFile[] {
    return Object.keys(forceCurves)
        .filter((path) => !path.includes('HighResolutionRaw'))
        .map((path) => ({
            name: getSwitchName(path),
            path,
            metadata: async () => {
                const data = await forceCurves[path]!();
                const { bottomOut, tactileMax, tactileMin } = data.default;
                return { bottomOut, tactileMax, tactileMin };
            },
        }));
}

export async function loadForceCurve(curve: CurveFile): Promise<ForceCurve> {
    const curveGetter = forceCurves[curve.path];
    if (!curveGetter) {
        throw new Error(`Invalid curve file ${curve.path}`);
    }

    const data = await curveGetter();

    const name = getSwitchName(curve.path);
    const { downstroke, upstroke, bottomOut, tactileMax, tactileMin } = data.default;

    return {
        // Place upstroke before downstroke so downstroke renders over upstroke.
        points: [
            ...upstroke.map((p) => tagPoint(p, name, true)),
            ...downstroke.map((p) => tagPoint(p, name)),
        ],
        bottomOut: tagPoint(bottomOut, name),
        tactileMax: tagPoint(tactileMax, name),
        tactileMin: tagPoint(tactileMin, name),
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
    return { ...point, name, upStroke };
}

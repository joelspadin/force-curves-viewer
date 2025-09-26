declare module 'force-curve-metadata' {
    export type Point = [number, number];

    export interface ForceCurveMetadata {
        bottomOut: Point;
        tactileMax: Point;
        tactileMin: Point;
        isTactile: boolean;
    }

    const metadata: Record<string, ForceCurveMetadata>;

    export default metadata;
}

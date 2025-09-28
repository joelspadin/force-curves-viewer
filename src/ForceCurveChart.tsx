import * as Plot from '@observablehq/plot';
import { Spin, theme } from 'antd';
import React, { useEffect, useRef } from 'react';
import { ForceCurve, TaggedPoint } from './curve';

import './ForceCurveChart.css';

const { useToken } = theme;

type ChartType = ReturnType<typeof Plot.plot>;

export type DisplayMode = 'combined' | 'separate' | 'down' | 'up';

export interface ForceCurveChartMarks {
    bottomOut?: boolean;
    peak?: boolean;
    trough?: boolean;
}

export interface ForceCurveChartProps {
    data: ForceCurve[];
    display?: DisplayMode;
    marks?: ForceCurveChartMarks;
}

export const ForceCurveChartPlaceholder: React.FC = () => {
    return (
        <figure className="chart-container placeholder">
            <Spin />
        </figure>
    );
};

interface LegendEntry {
    name: string;
    downColor?: string;
    upColor?: string;
}

export const ForceCurveChart: React.FC<ForceCurveChartProps> = ({ data, display, marks }) => {
    const { token } = useToken();

    const chartRef = useRef<HTMLDivElement>(null);

    const [chart, legend] = useChart(data, display, marks);

    const legendInside = legend.length <= 4 && display != 'separate';

    useEffect(() => {
        chartRef.current?.append(chart);

        return () => {
            chart.remove();
        };
    }, [chart]);

    return (
        <figure className="chart-container" style={{ color: token.colorText }}>
            <div className="wrap">
                <div className="chart" ref={chartRef}></div>

                <div className={`legend ${legendInside ? 'inside' : ''}`}>
                    {legend.map((item) => (
                        <div key={item.name} className="swatch">
                            <SwatchColor color={item.downColor} title="Downstroke" />
                            <SwatchColor color={item.upColor} title="Upstroke" />
                            <div className="swatch-label">{item.name}</div>
                        </div>
                    ))}
                </div>
            </div>
        </figure>
    );
};

interface SwatchColorProps {
    color: string | undefined;
    title: string;
}

const SwatchColor: React.FC<SwatchColorProps> = ({ color, title }) => {
    if (!color) {
        return null;
    }

    return <div className="swatch-color" title={title} style={{ backgroundColor: color }}></div>;
};

const maxForceMargin = 40;

function useChart(
    curves: ForceCurve[],
    display: DisplayMode = 'combined',
    marks?: ForceCurveChartMarks,
): [ChartType, LegendEntry[]] {
    const { token } = useToken();

    const data = curves.flatMap((c) => c.points);
    const bottom = curves.flatMap((c) => c.bottomOut);
    const peak = curves.filter((c) => c.isTactile).flatMap((c) => c.tactileMax);

    let maxForce = 120;
    for (const point of [...bottom, ...peak]) {
        maxForce = Math.max(maxForce, point.force + maxForceMargin);
    }

    let facet: Plot.PlotFacetOptions | undefined = undefined;
    let filter: Plot.ChannelValue | undefined = undefined;
    let upStrokeFade = 55;
    let showUpStrokeLegend = true;
    let showDownStrokeLegend = true;

    switch (display) {
        case 'separate':
            facet = {
                data,
                x: (p: TaggedPoint) => strokeName(p),
                // TODO: find a way to reverse the X axis for the up stroke
                // Maybe do something like https://observablehq.com/@fil/subplots-1870
            };
            break;

        case 'down':
            filter = (p: TaggedPoint) => !p.upStroke;
            showUpStrokeLegend = false;
            break;

        case 'up':
            filter = (p: TaggedPoint) => p.upStroke;
            upStrokeFade = 0;
            showDownStrokeLegend = false;
            break;
    }

    // Use the same string name for each point instead of making a new copy for
    // each of thousands of points.
    const seriesNames = new Map<string, string>();
    const setSeriesName = (key: string, name: string) => {
        seriesNames.set(key, name);
        return name;
    };
    const getSeriesName = (p: TaggedPoint) => {
        const key = `${p.name},${p.upStroke}`;
        return seriesNames.get(key) || setSeriesName(key, `${p.name} (${strokeName(p)})`);
    };

    const plotMarks: Plot.Markish[] = [
        Plot.line(data, {
            x: 'x',
            y: 'force',
            stroke: getSeriesName,
            strokeWidth: 2,
            filter,
            title: (p: TaggedPoint) => `${p.force}g @ ${p.x}mm`,
        }),
    ];

    if (marks?.bottomOut) {
        plotMarks.push(
            Plot.dot(bottom, {
                x: 'x',
                y: 'force',
                facet: 'exclude',
                stroke: 'currentColor',
                fill: getSeriesName,
                filter,
                r: 4,
                title: (p: TaggedPoint) => `Bottom out: ${p.force}g @ ${p.x}mm`,
            }),
        );
    }
    if (marks?.peak) {
        plotMarks.push(
            Plot.dot(peak, {
                x: 'x',
                y: 'force',
                facet: 'exclude',
                stroke: 'currentColor',
                fill: getSeriesName,
                filter,
                r: 4,
                title: (p: TaggedPoint) => `Peak: ${p.force}g @ ${p.x}mm`,
            }),
        );
    }
    if (marks?.trough) {
        const trough = curves.filter((c) => c.isTactile).flatMap((c) => c.tactileMin);

        plotMarks.push(
            Plot.dot(trough, {
                x: 'x',
                y: 'force',
                facet: 'exclude',
                stroke: 'currentColor',
                fill: getSeriesName,
                filter,
                r: 4,
                title: (p: TaggedPoint) => `Trough: ${p.force}g @ ${p.x}mm`,
            }),
        );
    }

    // TODO: chart sorts items by name, but I would rather they be not sorted at all.
    // Make multiple lines and color them separately?
    const chart = Plot.plot({
        width: 800,
        height: 450,
        marginLeft: 70,
        marginBottom: 60,
        marks: plotMarks,
        x: {
            label: 'Displacement (mm)',
            labelAnchor: 'center',
            labelOffset: 50,
            grid: true,
        },
        y: {
            label: 'Force (gf)',
            labelAnchor: 'center',
            labelOffset: 60,
            grid: true,
            domain: [0, maxForce],
        },
        facet,
        color: {
            // Based on seaborn's "Paired" palette
            type: 'categorical',
            range: [
                'rgb(31, 120, 180)',
                'rgb(255, 127, 0)',
                'rgb(51, 160, 44)',
                'rgb(227, 26, 28)',
                'rgb(106, 61, 154)',
                'rgb(255, 224, 31)',
            ].flatMap((color) => [color, fadeColor(color, token.colorBgContainer, upStrokeFade)]),
        },
        style: {
            fontSize: '1rem',
        },
    });

    const legend = getLegendEntries(chart, showUpStrokeLegend, showDownStrokeLegend);

    return [chart, legend];
}

function strokeName(point: TaggedPoint) {
    return point.upStroke ? 'Up' : 'Down';
}

function fadeColor(color1: string, color2: string, percent: number) {
    if (percent === 0) {
        return color1;
    }

    return `color-mix(in srgb, ${color1}, ${color2} ${percent}%)`;
}

function getLegendEntries(chart: ChartType, showUpStroke: boolean, showDownStroke: boolean) {
    const entries: Record<string, LegendEntry> = {};
    const scale = chart.scale('color');

    if (!scale) {
        throw new Error('Chart has no scale');
    }

    for (const domain of scale.domain! as Iterable<string>) {
        const color = scale?.apply(domain) as string;

        const m = domain.match(/^(.+) \((Up|Down)\)$/);
        if (m) {
            const name = m[1]!;
            const upStroke = m[2]! === 'Up';

            if ((upStroke && !showUpStroke) || (!upStroke && !showDownStroke)) {
                continue;
            }

            const colorField: Partial<LegendEntry> = upStroke
                ? { upColor: color }
                : { downColor: color };

            entries[name] = {
                name,
                ...entries[name],
                ...colorField,
            };
        }
    }

    return Object.values(entries);
}

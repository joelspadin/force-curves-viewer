import * as Plot from '@observablehq/plot';
import { Spin, theme } from 'antd';
import React, { useEffect, useRef } from 'react';
import { ForceCurve, TaggedPoint } from './curve';

import './ForceCurveChart.css';

const { useToken } = theme;

type ChartType = ReturnType<typeof Plot.plot>;
type LegendType = ReturnType<ChartType['legend']>;

export type DisplayMode = 'combined' | 'separate' | 'down' | 'up';

export interface ForceCurveChartProps {
    data?: ForceCurve[];
    display?: DisplayMode;
}

export const ForceCurveChartPlaceholder: React.FC = () => {
    return (
        <figure className="chart-container placeholder">
            <Spin />
        </figure>
    );
};

export const ForceCurveChart: React.FC<ForceCurveChartProps> = ({ data, display }) => {
    const { token } = useToken();

    const chartRef = useRef<HTMLDivElement>(null);
    const legendRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const [chart, legend] = getChart(data ?? [], display);
        chartRef.current?.append(chart);
        if (legend) {
            legendRef.current?.append(legend);
        }

        return () => {
            chart.remove();
            legend?.remove();
        };
    }, [data, display]);

    return (
        <figure className="chart-container" style={{ color: token.colorText }}>
            <div className="chart" ref={chartRef}></div>
            <div className="legend" ref={legendRef}></div>
        </figure>
    );
};

const FONT_FAMILY = `
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji',
    'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'
    `;

function getChart(
    curves: ForceCurve[],
    display: DisplayMode = 'combined',
): [ChartType, LegendType] {
    const data = curves.flatMap((c) => c.points);

    let facet: Plot.PlotFacetOptions | undefined = undefined;
    let filter: Plot.ChannelValue | undefined = undefined;

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
            break;

        case 'up':
            filter = (p: TaggedPoint) => p.upStroke;
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

    // TODO: chart sorts items by name, but I would rather they be not sorted at all.
    // Make multiple lines and color them separately?
    const chart = Plot.plot({
        width: 800,
        height: 450,
        marginLeft: 70,
        marginBottom: 60,
        marks: [
            Plot.line(data, {
                x: 'x',
                y: 'force',
                stroke: getSeriesName,
                strokeWidth: 2,
                title: (p: TaggedPoint) => `${p.force}g`,
                filter,
            }),
        ],
        x: {
            label: 'Displacement (mm)',
            labelAnchor: 'center',
            labelOffset: 50,
        },
        y: {
            label: 'Force (gf)',
            labelAnchor: 'center',
            labelOffset: 58,
            grid: true,
            domain: [0, 120],
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
            ].flatMap((color) => [color, setOpacity(color, 0.3)]),
        },
        style: {
            fontSize: '1rem',
            fontFamily: FONT_FAMILY,
        },
    });

    const legend = chart.legend('color', {
        swatchSize: 14,
        columns: '1',
        style: {
            fontSize: '0.875rem',
            fontFamily: FONT_FAMILY,
        },
    });

    return [chart, legend];
}

function strokeName(point: TaggedPoint) {
    return point.upStroke ? 'Up' : 'Down';
}

function setOpacity(color: string, opacity: number) {
    return color.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/, `rgba($1, $2, $3, ${opacity})`);
}

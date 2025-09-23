import type { DefaultOptionType, FilterFunc } from 'rc-select/lib/Select';
import { Divider, Select, Space } from 'antd';
import React, { Dispatch, useEffect, useState } from 'react';
import { CurveFile, CurveMetadata, getForceCurves } from './curve';
import { isDefined } from './util';
import fuzzysort from 'fuzzysort';

import './ForceCurveSelect.css';

const { Option } = Select;

const curves = getForceCurves();
const noMetadata = curves.map((curve) => ({
    name: curve.name,
    path: curve.path,
}));
const metadata = Promise.all(
    curves.map(async (curve) => {
        const meta = await curve.metadata();
        return {
            name: curve.name,
            path: curve.path,
            metadata: meta,
        };
    }),
);

interface CurveOption {
    path: string;
    name: string;
    metadata?: CurveMetadata;
}

export type SwitchTypeFilter = 'all' | 'linear' | 'tactile';

export type SortOrder = 'alphabetical' | 'bottomOut' | 'tactilePeak';

export interface ForceCurveSelectProps {
    value?: CurveFile[];
    onChange?: Dispatch<CurveFile[]>;
    switchTypes?: SwitchTypeFilter;
    sortOrder?: SortOrder;
    bottomOutRange?: [number, number];
    tactilePeakRange?: [number, number];
}

export const ForceCurveSelect: React.FC<ForceCurveSelectProps> = ({
    value,
    onChange,
    switchTypes,
    bottomOutRange,
    tactilePeakRange,
}) => {
    const [options, setOptions] = useState<CurveOption[]>(noMetadata);
    const [search, setSearch] = useState('');

    const clearSearch = () => setSearch('');

    useEffect(() => {
        metadata.then(setOptions);
    }, [metadata]);

    const filtered = options.filter((option) =>
        filterSwitch(option, switchTypes, bottomOutRange, tactilePeakRange),
    );

    const results = search
        ? fuzzysort.go(search, filtered, { key: 'name' }).map((result) => ({
              score: result.score,
              key: result.obj.path,
              name: result.obj.name,
              label: getLabel(result),
          }))
        : filtered.map((obj) => ({
              score: 0,
              key: obj.path,
              name: obj.name,
              label: getLabel(obj),
          }));

    const handleChange = (paths: string[]) => {
        const selected = paths
            .map((path) => curves.find((opt) => opt.path === path))
            .filter(isDefined);
        onChange?.(selected);
    };

    return (
        <Select
            className="curve-select"
            classNames={{
                popup: {
                    root: 'curve-select-menu',
                },
            }}
            mode="multiple"
            placeholder="Select switches"
            allowClear
            autoFocus
            value={value?.map((v) => v.path)}
            onChange={handleChange}
            onSearch={setSearch}
            onSelect={clearSearch}
            onDeselect={clearSearch}
            onBlur={clearSearch}
            filterOption={filterOption}
            filterSort={filterSort}
            optionLabelProp="name"
        >
            {results.map((result) => (
                <Option key={result.key} score={result.score} name={result.name}>
                    {result.label}
                </Option>
            ))}
        </Select>
    );
};

const SCORE_THRESHOLD = -5000;

const filterOption: FilterFunc<DefaultOptionType> = (_, option) => {
    return option?.score >= SCORE_THRESHOLD;
};

function filterSort(a: DefaultOptionType, b: DefaultOptionType) {
    return b.score - a.score || a.name.localeCompare(b.name);
}

function getLabel(optionOrResult: CurveOption | Fuzzysort.KeyResult<CurveOption>) {
    const result = 'obj' in optionOrResult ? optionOrResult : undefined;
    const option = 'obj' in optionOrResult ? optionOrResult.obj : optionOrResult;

    const name = result ? result.highlight((m, i) => <strong key={i}>{m}</strong>) : option.name;

    return (
        <Space split={<Divider type="vertical" />}>
            <span className="name">{name}</span>
            {option.metadata && (
                <>
                    <span className="metadata">
                        {isTactile(option.metadata) ? 'Tactile' : 'Linear'}
                    </span>
                    <span className="metadata">
                        Bottom out: {Math.round(option.metadata.bottomOut.force)}g
                    </span>
                    {isTactile(option.metadata) && (
                        <span className="metadata">
                            Peak: {Math.round(option.metadata.tactileMax!.force)}g at{' '}
                            {option.metadata.tactileMax!.x.toFixed(1)} mm
                        </span>
                    )}
                </>
            )}
        </Space>
    );
}

const TACTILE_THRESHOLD = 5;

function isTactile(option: CurveMetadata) {
    if (option.tactileMax === undefined || option.tactileMin === undefined) {
        return false;
    }

    return option.tactileMax.force - option.tactileMin.force > TACTILE_THRESHOLD;
}

function forceInRange(force: number | undefined, range: [number, number] | undefined) {
    if (!force || !range) {
        return true;
    }

    return force >= range[0] && force <= range[1];
}

function filterSwitch(
    option: CurveOption,
    switchTypes?: SwitchTypeFilter,
    bottomOutRange?: [number, number],
    tactilePeakRange?: [number, number],
) {
    const metadata = option.metadata;
    if (!metadata) {
        return true;
    }

    if (switchTypes && switchTypes !== 'all') {
        if (isTactile(metadata) !== (switchTypes === 'tactile')) {
            return false;
        }
    }

    const bottomOutForce = Math.round(metadata.bottomOut.force);

    if (!forceInRange(bottomOutForce, bottomOutRange)) {
        return false;
    }

    if (metadata.tactileMax) {
        const tactilePeakForce = Math.round(metadata.tactileMax.force);

        if (!forceInRange(tactilePeakForce, tactilePeakRange)) {
            return false;
        }
    }

    return true;
}

import { Divider, Select, Space } from 'antd';
import fuzzysort from 'fuzzysort';
import type { DefaultOptionType, FilterFunc } from 'rc-select/lib/Select';
import React, { Dispatch, useState } from 'react';
import { CurveFile, ForceCurveMetadata, getForceCurves } from './curve';
import { isDefined } from './util';

import './ForceCurveSelect.css';

const curves = getForceCurves();

interface CurveOption extends DefaultOptionType {
    score: number;
    value: string;
    meta: ForceCurveMetadata;
}

export type SwitchTypeFilter = 'all' | 'linear' | 'tactile';

export type SortOrder = 'alphabetical' | 'bottomOut' | 'tactilePeak' | 'travel';

export interface SwitchFilterProps {
    switchTypes?: SwitchTypeFilter;
    tactilePeakForce?: [number, number];
    bottomOutForce?: [number, number];
    bottomOutDistance?: [number, number];
}

export interface SwitchSortProps {
    sortOrder?: SortOrder;
    invertSort?: boolean;
}

export interface ForceCurveSelectProps extends SwitchFilterProps, SwitchSortProps {
    value?: CurveFile[];
    onChange?: Dispatch<CurveFile[]>;
}

export const ForceCurveSelect: React.FC<ForceCurveSelectProps> = ({
    value,
    onChange,
    ...props
}) => {
    const [search, setSearch] = useState('');

    const clearSearch = () => setSearch('');

    const filtered = curves.filter((option) => filterSwitch(option, props));

    const results: CurveOption[] = search
        ? fuzzysort.go(search, filtered, { key: 'name' }).map((result) => ({
              score: result.score,
              value: result.obj.path,
              name: result.obj.name,
              meta: result.obj.metadata,
              label: <OptionLabel option={result.obj} result={result} />,
          }))
        : filtered.map((obj) => ({
              score: 0,
              value: obj.path,
              name: obj.name,
              meta: obj.metadata,
              label: <OptionLabel option={obj} />,
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
            filterSort={(a, b) => filterSort(a, b, props)}
            optionLabelProp="name"
            options={results}
        />
    );
};

const SCORE_THRESHOLD = -5000;

const filterOption: FilterFunc<CurveOption> = (_, option) => {
    return (option?.score ?? 0) >= SCORE_THRESHOLD;
};

function filterSort(a: CurveOption, b: CurveOption, props: SwitchSortProps) {
    const scoreDifference = b.score - a.score;
    if (scoreDifference != 0) {
        return scoreDifference;
    }

    const sign = props.invertSort ? -1 : 1;

    switch (props.sortOrder) {
        case 'travel':
            return sign * (a.meta.bottomOut[0] - b.meta.bottomOut[0]);

        case 'bottomOut':
            return sign * (a.meta.bottomOut[1] - b.meta.bottomOut[1]);

        case 'tactilePeak':
            if (!a.meta.isTactile) {
                return b.meta.isTactile ? 1 : 0;
            }
            if (!b.meta.isTactile) {
                return -1;
            }

            return sign * (a.meta.tactileMax[1] - b.meta.tactileMax[1]);
    }

    return sign * a.value.localeCompare(b.value);
}

interface OptionLabelProps {
    option: CurveFile;
    result?: Fuzzysort.KeyResult<CurveFile>;
}

const OptionLabel: React.FC<OptionLabelProps> = ({ option, result }) => {
    const name = result ? result.highlight((m, i) => <strong key={i}>{m}</strong>) : option.name;

    return (
        <Space split={<Divider type="vertical" />}>
            <span className="name">{name}</span>
            {option.metadata && (
                <>
                    <span className="metadata">
                        {option.metadata.isTactile ? 'Tactile' : 'Linear'}
                    </span>
                    <span className="metadata">
                        Bottom out: {Math.round(option.metadata.bottomOut[1])}g at{' '}
                        {option.metadata.bottomOut[0].toFixed(1)} mm
                    </span>
                    {option.metadata.isTactile && (
                        <span className="metadata">
                            Peak: {Math.round(option.metadata.tactileMax[1])}g at{' '}
                            {option.metadata.tactileMax[0].toFixed(1)} mm
                        </span>
                    )}
                </>
            )}
        </Space>
    );
};

function inRange(value: number | undefined, range: [number, number] | undefined) {
    if (!value || !range) {
        return true;
    }

    return value >= range[0] && value <= range[1];
}

function filterSwitch(option: CurveFile, props: SwitchFilterProps) {
    const metadata = option.metadata;

    if (props.switchTypes && props.switchTypes !== 'all') {
        if (metadata.isTactile !== (props.switchTypes === 'tactile')) {
            return false;
        }
    }

    const bottomOutDistance = Math.round(metadata.bottomOut[0] * 10) / 10;
    const bottomOutForce = Math.round(metadata.bottomOut[1]);

    if (!inRange(bottomOutForce, props.bottomOutForce)) {
        return false;
    }

    if (!inRange(bottomOutDistance, props.bottomOutDistance)) {
        return false;
    }

    if (metadata.isTactile) {
        const tactilePeakForce = Math.round(metadata.tactileMax[1]);

        if (!inRange(tactilePeakForce, props.tactilePeakForce)) {
            return false;
        }
    }

    return true;
}

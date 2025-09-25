import { Divider, Select, Space } from 'antd';
import fuzzysort from 'fuzzysort';
import type { DefaultOptionType, FilterFunc } from 'rc-select/lib/Select';
import React, { Dispatch, useState } from 'react';
import { CurveFile, getForceCurves } from './curve';
import { isDefined } from './util';

import './ForceCurveSelect.css';

const curves = getForceCurves();

interface CurveOption extends DefaultOptionType {
    score: number;
    value: string;
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
    const [search, setSearch] = useState('');

    const clearSearch = () => setSearch('');

    const filtered = curves.filter((option) =>
        filterSwitch(option, switchTypes, bottomOutRange, tactilePeakRange),
    );

    const results: CurveOption[] = search
        ? fuzzysort.go(search, filtered, { key: 'name' }).map((result) => ({
              score: result.score,
              value: result.obj.path,
              name: result.obj.name,
              label: <OptionLabel option={result.obj} result={result} />,
          }))
        : filtered.map((obj) => ({
              score: 0,
              value: obj.path,
              name: obj.name,
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
            filterSort={filterSort}
            optionLabelProp="name"
            options={results}
        />
    );
};

const SCORE_THRESHOLD = -5000;

const filterOption: FilterFunc<CurveOption> = (_, option) => {
    return (option?.score ?? 0) >= SCORE_THRESHOLD;
};

function filterSort(a: CurveOption, b: CurveOption) {
    return b.score - a.score || a.value.localeCompare(b.value);
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
                        Bottom out: {Math.round(option.metadata.bottomOut.force)}g
                    </span>
                    {option.metadata.isTactile && (
                        <span className="metadata">
                            Peak: {Math.round(option.metadata.tactileMax.force)}g at{' '}
                            {option.metadata.tactileMax.x.toFixed(1)} mm
                        </span>
                    )}
                </>
            )}
        </Space>
    );
};

function forceInRange(force: number | undefined, range: [number, number] | undefined) {
    if (!force || !range) {
        return true;
    }

    return force >= range[0] && force <= range[1];
}

function filterSwitch(
    option: CurveFile,
    switchTypes?: SwitchTypeFilter,
    bottomOutRange?: [number, number],
    tactilePeakRange?: [number, number],
) {
    const metadata = option.metadata;

    if (switchTypes && switchTypes !== 'all') {
        if (metadata.isTactile !== (switchTypes === 'tactile')) {
            return false;
        }
    }

    const bottomOutForce = Math.round(metadata.bottomOut.force);

    if (!forceInRange(bottomOutForce, bottomOutRange)) {
        return false;
    }

    if (metadata.isTactile) {
        const tactilePeakForce = Math.round(metadata.tactileMax.force);

        if (!forceInRange(tactilePeakForce, tactilePeakRange)) {
            return false;
        }
    }

    return true;
}

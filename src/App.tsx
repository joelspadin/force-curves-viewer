import { Col, Divider, Flex, Form, Radio, Row, Slider } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { Suspense, useState, useCallback, use, cache } from 'react';
import { CurveFile, loadForceCurve, ForceCurve } from './curve';
import { DisplayMode, ForceCurveChart, ForceCurveChartPlaceholder } from './ForceCurveChart';
import { ForceCurveSelect, SwitchTypeFilter } from './ForceCurveSelect';

import './App.css';
import { SliderMarks } from 'antd/lib/slider';

interface FormValues {
    displayMode: DisplayMode;
    switchTypes: SwitchTypeFilter;
    bottomOutForce: [number, number];
    peakForce: [number, number];
}

const marks: SliderMarks = {
    0: '0g',
    50: '50g',
    100: '100g+',
};

function adjustRange(range: [number, number]): [number, number] {
    if (range[1] >= 100) {
        return [range[0], Infinity];
    }
    return range;
}

function App() {
    const [form] = useForm();
    const [displayMode, setDisplayMode] = useState<DisplayMode>('combined');
    const [switchTypes, setSwitchTypes] = useState<SwitchTypeFilter>('all');
    const [bottomOutForce, setBottomOutForce] = useState<[number, number]>([0, 150]);
    const [peakForce, setPeakForce] = useState<[number, number]>([0, 150]);

    const [curves, setCurves] = useState<CurveFile[]>([]);
    const getCurvesPromise = fetchForceCurves(curves);

    const onValuesChanged = useCallback(
        (values: Partial<FormValues>) => {
            values.displayMode && setDisplayMode(values.displayMode);
            values.switchTypes && setSwitchTypes(values.switchTypes);
            values.bottomOutForce && setBottomOutForce(values.bottomOutForce);
            values.peakForce && setPeakForce(values.peakForce);
        },
        [setDisplayMode],
    );

    return (
        <div className="App">
            <Suspense fallback={<ForceCurveChartPlaceholder />}>
                <ForceCurveChartWrapper
                    getCurvesPromise={getCurvesPromise}
                    displayMode={displayMode}
                />
            </Suspense>
            <div className="options">
                <Form
                    form={form}
                    initialValues={{ displayMode, switchTypes, bottomOutForce, peakForce }}
                    onValuesChange={onValuesChanged}
                    layout="vertical"
                >
                    <Form.Item name="displayMode" label="Display">
                        <Radio.Group>
                            <Radio.Button value="combined">Combined</Radio.Button>
                            <Radio.Button value="separate">Separate</Radio.Button>
                            <Radio.Button value="down">Downstroke</Radio.Button>
                            <Radio.Button value="up">Upstroke</Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    <Divider orientation="start">Select Switches</Divider>

                    <Form.Item>
                        <ForceCurveSelect
                            value={curves}
                            onChange={setCurves}
                            switchTypes={switchTypes}
                            bottomOutRange={adjustRange(bottomOutForce)}
                            tactilePeakRange={adjustRange(peakForce)}
                        />
                    </Form.Item>

                    <Flex gap="middle" justify="space-between" className="columns">
                        <Form.Item name="switchTypes" label="Feel">
                            <Radio.Group>
                                <Radio.Button value="all">All</Radio.Button>
                                <Radio.Button value="linear">Linear</Radio.Button>
                                <Radio.Button value="tactile">Tactile</Radio.Button>
                            </Radio.Group>
                        </Form.Item>
                        <Form.Item
                            name="peakForce"
                            label="Tactile operating force"
                            className="slider"
                        >
                            <Slider range min={0} max={100} step={5} marks={marks} />
                        </Form.Item>
                        <Form.Item
                            name="bottomOutForce"
                            label="Bottom out force"
                            className="slider"
                        >
                            <Slider range min={0} max={100} step={5} marks={marks} />
                        </Form.Item>
                    </Flex>
                </Form>
            </div>
        </div>
    );
}

export default App;

const fetchForceCurves = cache(async (curves: CurveFile[]) =>
    Promise.all(curves.map(loadForceCurve)),
);

interface ForceCurveChartWrapperProps {
    getCurvesPromise: Promise<ForceCurve[]>;
    displayMode: DisplayMode;
}

const ForceCurveChartWrapper: React.FC<ForceCurveChartWrapperProps> = ({
    getCurvesPromise,
    displayMode,
}) => {
    const data = use(getCurvesPromise);

    return <ForceCurveChart data={data} display={displayMode} />;
};

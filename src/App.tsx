import { Col, Form, Radio, Row, Slider } from 'antd';
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
    100: '100g',
    150: '150g',
};

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
                >
                    <Form.Item name="displayMode" label="Display">
                        <Radio.Group>
                            <Radio.Button value="combined">Combined</Radio.Button>
                            <Radio.Button value="separate">Separate</Radio.Button>
                            <Radio.Button value="down">Downstroke</Radio.Button>
                            <Radio.Button value="up">Upstroke</Radio.Button>
                        </Radio.Group>
                    </Form.Item>
                    <Row>
                        <Col span={11}>
                            <Form.Item name="switchTypes" label="Filter Switches">
                                <Radio.Group>
                                    <Radio.Button value="all">All</Radio.Button>
                                    <Radio.Button value="linear">Linear</Radio.Button>
                                    <Radio.Button value="tactile">Tactile</Radio.Button>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="bottomOutForce" label="Bottom Out">
                                <Slider range min={0} max={150} step={5} marks={marks} />
                            </Form.Item>
                            <Form.Item name="peakForce" label="Tactile Force">
                                <Slider range min={0} max={150} step={5} marks={marks} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item>
                        <ForceCurveSelect
                            value={curves}
                            onChange={setCurves}
                            switchTypes={switchTypes}
                            bottomOutRange={bottomOutForce}
                            tactilePeakRange={peakForce}
                        />
                    </Form.Item>
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

import { ConfigProvider, Divider, Flex, Form, Segmented, Slider, theme } from 'antd';
import { App as AntApp } from 'antd/lib';
import { useForm } from 'antd/lib/form/Form';
import { SliderMarks } from 'antd/lib/slider';
import {
    createContext,
    Dispatch,
    SetStateAction,
    Suspense,
    use,
    useCallback,
    useEffect,
    useState,
} from 'react';
import { CurveFile, ForceCurve, loadForceCurve } from './curve';
import { DisplayMode, ForceCurveChart, ForceCurveChartPlaceholder } from './ForceCurveChart';
import { ForceCurveSelect, SwitchTypeFilter } from './ForceCurveSelect';

import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { SegmentedOptions } from 'antd/es/segmented';
import './App.css';
import { useLocalStorage } from './util';

const { useToken } = theme;

interface FormValues {
    displayMode: DisplayMode;
    switchTypes: SwitchTypeFilter;
    darkTheme: boolean;
    bottomOutForce: [number, number];
    peakForce: [number, number];
}

const displayModeOptions: SegmentedOptions<DisplayMode> = [
    { value: 'combined', label: 'Combined' },
    { value: 'separate', label: 'Separate' },
    { value: 'down', label: 'Downstroke' },
    { value: 'up', label: 'Upstroke' },
];

const themeOptions: SegmentedOptions<boolean> = [
    { value: false, icon: <SunOutlined />, label: 'Light' },
    { value: true, icon: <MoonOutlined />, label: 'Dark' },
];

const feelOptions: SegmentedOptions<SwitchTypeFilter> = [
    { value: 'all', label: 'All' },
    { value: 'linear', label: 'Linear' },
    { value: 'tactile', label: 'Tactile' },
];

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

const DarkThemeContext = createContext<[boolean, Dispatch<SetStateAction<boolean>>]>([
    false,
    () => {},
]);

const defaultDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;

function App() {
    const [darkTheme, setDarkTheme] = useLocalStorage('forceCurve.darkTheme', defaultDarkTheme);

    return (
        <ConfigProvider
            theme={{
                algorithm: darkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
                cssVar: true,
                hashed: false,
            }}
        >
            <AntApp>
                <DarkThemeContext value={[darkTheme, setDarkTheme]}>
                    <MainLayout />
                </DarkThemeContext>
            </AntApp>
        </ConfigProvider>
    );
}

export default App;

function MainLayout() {
    const [form] = useForm();
    const [displayMode, setDisplayMode] = useLocalStorage<DisplayMode>(
        'forceCurve.displayMode',
        'combined',
    );
    const [switchTypes, setSwitchTypes] = useLocalStorage<SwitchTypeFilter>(
        'forceCurve.switchFeel',
        'all',
    );
    const [bottomOutForce, setBottomOutForce] = useLocalStorage<[number, number]>(
        'forceCurve.bottomOutForce',
        [0, 150],
    );
    const [peakForce, setPeakForce] = useLocalStorage<[number, number]>(
        'forceCurve.tactilePeakForce',
        [0, 150],
    );

    const [darkTheme, setDarkTheme] = use(DarkThemeContext);
    const [curves, setCurves] = useState<CurveFile[]>([]);
    const getCurvesPromise = fetchForceCurves(curves);

    const onValuesChanged = useCallback(
        (values: Partial<FormValues>) => {
            values.displayMode && setDisplayMode(values.displayMode);
            values.darkTheme !== undefined && setDarkTheme(values.darkTheme);
            values.switchTypes && setSwitchTypes(values.switchTypes);
            values.bottomOutForce && setBottomOutForce(values.bottomOutForce);
            values.peakForce && setPeakForce(values.peakForce);
        },
        [setDisplayMode],
    );

    const { token } = useToken();

    useEffect(() => {
        document.body.style.backgroundColor = token.colorBgContainer;
    }, [token]);

    return (
        <>
            <Suspense fallback={<ForceCurveChartPlaceholder />}>
                <ForceCurveChartWrapper
                    getCurvesPromise={getCurvesPromise}
                    displayMode={displayMode}
                />
            </Suspense>
            <div className="options">
                <Form
                    form={form}
                    initialValues={{
                        displayMode,
                        darkTheme,
                        switchTypes,
                        bottomOutForce,
                        peakForce,
                    }}
                    onValuesChange={onValuesChanged}
                    layout="vertical"
                >
                    <Flex gap="large" justify="space-between" className="row">
                        <Form.Item name="displayMode" label="Graph type">
                            <Segmented options={displayModeOptions} size="large" />
                        </Form.Item>
                        <Form.Item name="darkTheme" label="Theme">
                            <Segmented options={themeOptions} size="large" shape="round" />
                        </Form.Item>
                    </Flex>

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

                    <Flex gap="large" justify="space-between" className="row">
                        <Form.Item name="switchTypes" label="Feel">
                            <Segmented options={feelOptions} size="large" />
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
        </>
    );
}

// React's cache() keeps re-evaluating this for some reason, so I'll do it myself.
let forceCurvePromise: Promise<ForceCurve[]> | undefined;
let cachedCurves: CurveFile[] | undefined;

function fetchForceCurves(curves: CurveFile[]) {
    if (!forceCurvePromise || curves !== cachedCurves) {
        forceCurvePromise = Promise.all(curves.map(loadForceCurve));
        cachedCurves = curves;
    }

    return forceCurvePromise;
}

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

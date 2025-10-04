import {
    Checkbox,
    CheckboxOptionType,
    ConfigProvider,
    Divider,
    Form,
    Segmented,
    Slider,
    theme,
} from 'antd';
import { App as AntApp } from 'antd/lib';
import { useForm } from 'antd/lib/form/Form';
import { SliderMarks } from 'antd/lib/slider';
import { createContext, Dispatch, SetStateAction, Suspense, use, useEffect } from 'react';
import { ForceCurve, getForceCurves, loadForceCurve } from './curve';
import {
    DisplayMode,
    ForceCurveChart,
    ForceCurveChartMarks,
    ForceCurveChartPlaceholder,
} from './ForceCurveChart';
import { ForceCurveSelect, SortOrder, SwitchTypeFilter } from './ForceCurveSelect';

import { GithubFilled, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { SegmentedOptions } from 'antd/es/segmented';
import { Route, Routes, useNavigate, useParams } from 'react-router';
import './App.css';
import { isDefined, useLocalStorage } from './util';

const { useToken } = theme;

type Mark = 'peak' | 'min' | 'bottomOut';

interface FormValues {
    displayMode: DisplayMode;
    marks: Mark[];
    darkTheme: boolean;
    switchTypes: SwitchTypeFilter;
    sortOrder: SortOrder;
    invertSort: boolean;
    bottomOutForce: [number, number];
    bottomOutDistance: [number, number];
    peakForce: [number, number];
}

const displayModeOptions: SegmentedOptions<DisplayMode> = [
    { value: 'combined', label: 'Combined' },
    { value: 'separate', label: 'Separate' },
    { value: 'down', label: 'Downstroke' },
    { value: 'up', label: 'Upstroke' },
];

const markOptions: CheckboxOptionType<Mark>[] = [
    { value: 'peak', label: 'Peak' },
    { value: 'min', label: 'Trough' },
    { value: 'bottomOut', label: 'Bottom out' },
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

const sortOptions: SegmentedOptions<SortOrder> = [
    { value: 'alphabetical', label: 'Alphabetical' },
    { value: 'tactilePeak', label: 'Peak force' },
    { value: 'bottomOut', label: 'Bottom out force' },
    { value: 'travel', label: 'Total travel' },
];

const sortOrderOptions: SegmentedOptions<boolean> = [
    { value: false, label: 'Ascending' },
    { value: true, label: 'Descending' },
];

const forceMarks: SliderMarks = {
    0: '0',
    50: '50',
    100: '100+',
};

const distanceMarks: SliderMarks = {
    0: '0',
    1: '1',
    2: '2',
    3: '3',
    4: '4',
    5: '5+',
};

function adjustRange(range: [number, number], max = 100): [number, number] {
    if (range[1] >= max) {
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
            <DarkThemeContext value={[darkTheme, setDarkTheme]}>
                <Routes>
                    <Route path=":files?" element={<MainLayout />} />
                </Routes>
            </DarkThemeContext>
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
    const [marks, setMarks] = useLocalStorage<Mark[]>('forceCurve.marks', []);
    const [switchTypes, setSwitchTypes] = useLocalStorage<SwitchTypeFilter>(
        'forceCurve.switchFeel',
        'all',
    );
    const [sortOrder, setSortOrder] = useLocalStorage<SortOrder>(
        'forceCurve.sortOrder',
        'alphabetical',
    );
    const [invertSort, setInvertSort] = useLocalStorage<boolean>('forceCurve.invertSort', false);
    const [bottomOutForce, setBottomOutForce] = useLocalStorage<[number, number]>(
        'forceCurve.bottomOutForce',
        [0, 100],
    );
    const [bottomOutDistance, setBottomOutDistance] = useLocalStorage<[number, number]>(
        'forceCurve.bottomOutDistance',
        [0, 5],
    );
    const [peakForce, setPeakForce] = useLocalStorage<[number, number]>(
        'forceCurve.tactilePeakForce',
        [0, 100],
    );

    const [darkTheme, setDarkTheme] = use(DarkThemeContext);
    const [curves, setCurves] = useUrlCurves();
    const getCurvesPromise = fetchForceCurves(curves);

    const handleValuesChanged = useFormValueHandler({
        displayMode: setDisplayMode,
        marks: setMarks,
        darkTheme: setDarkTheme,
        switchTypes: setSwitchTypes,
        sortOrder: setSortOrder,
        invertSort: setInvertSort,
        bottomOutForce: setBottomOutForce,
        bottomOutDistance: setBottomOutDistance,
        peakForce: setPeakForce,
    });

    const { token } = useToken();

    useEffect(() => {
        document.body.style.backgroundColor = token.colorBgContainer;
    }, [token]);

    return (
        <AntApp style={{ color: token.colorText }}>
            <Suspense fallback={<ForceCurveChartPlaceholder />}>
                <ForceCurveChartWrapper
                    getCurvesPromise={getCurvesPromise}
                    displayMode={displayMode}
                    marks={{
                        peak: marks.includes('peak'),
                        trough: marks.includes('min'),
                        bottomOut: marks.includes('bottomOut'),
                    }}
                />
            </Suspense>
            <div className="options">
                <Form
                    form={form}
                    initialValues={{
                        displayMode,
                        marks,
                        darkTheme,
                        switchTypes,
                        sortOrder,
                        invertSort,
                        bottomOutForce,
                        bottomOutDistance,
                        peakForce,
                    }}
                    onValuesChange={handleValuesChanged}
                    layout="vertical"
                >
                    <div className="row">
                        <Form.Item name="displayMode" label="Chart type">
                            <Segmented options={displayModeOptions} />
                        </Form.Item>
                        <Form.Item name="marks" label="Chart marks">
                            <Checkbox.Group options={markOptions} />
                        </Form.Item>
                        <Form.Item name="darkTheme" label="Theme">
                            <Segmented options={themeOptions} shape="round" />
                        </Form.Item>
                    </div>

                    <Divider orientation="start">Select Switches</Divider>

                    <Form.Item>
                        <ForceCurveSelect
                            value={curves}
                            onChange={setCurves}
                            switchTypes={switchTypes}
                            sortOrder={sortOrder}
                            invertSort={invertSort}
                            bottomOutForce={adjustRange(bottomOutForce)}
                            bottomOutDistance={adjustRange(bottomOutDistance, 5)}
                            tactilePeakForce={adjustRange(peakForce)}
                        />
                    </Form.Item>

                    <div className="row">
                        <Form.Item name="switchTypes" label="Feel">
                            <Segmented options={feelOptions} />
                        </Form.Item>
                        <Form.Item name="sortOrder" label="Sort">
                            <Segmented options={sortOptions} />
                        </Form.Item>
                        <Form.Item name="invertSort" label="Order">
                            <Segmented options={sortOrderOptions} />
                        </Form.Item>
                    </div>
                    <div className="row slider-row">
                        <Form.Item
                            name="peakForce"
                            label="Tactile peak force (g)"
                            className="slider"
                        >
                            <Slider range min={0} max={100} step={5} marks={forceMarks} />
                        </Form.Item>
                        <Form.Item
                            name="bottomOutForce"
                            label="Bottom out force (g)"
                            className="slider"
                        >
                            <Slider range min={0} max={100} step={5} marks={forceMarks} />
                        </Form.Item>
                        <Form.Item
                            name="bottomOutDistance"
                            label="Total travel (mm)"
                            className="slider"
                        >
                            <Slider range min={0} max={5} step={0.1} marks={distanceMarks} />
                        </Form.Item>
                    </div>
                </Form>
            </div>

            <div className="site-info">
                <Divider />
                <p>
                    All force curve data{' '}
                    <a
                        href="https://github.com/ThereminGoat/force-curves"
                        target="_blank"
                        rel="noreferrer"
                    >
                        provided by ThereminGoat
                    </a>
                </p>
                <p>
                    <a
                        href="https://github.com/joelspadin/force-curves-viewer"
                        target="_blank"
                        rel="noreferrer"
                    >
                        <GithubFilled /> View on GitHub
                    </a>
                </p>
            </div>
        </AntApp>
    );
}

let forceCurvePromise: Promise<ForceCurve[]> | undefined;
let cachedCurves: string[] | undefined;

function fetchForceCurves(paths: string[]) {
    const curves = getForceCurves();

    if (!forceCurvePromise || paths !== cachedCurves) {
        forceCurvePromise = Promise.all(
            paths
                .map((p) => curves[p])
                .filter(isDefined)
                .map(loadForceCurve),
        );
        cachedCurves = paths;
    }

    return forceCurvePromise;
}

interface ForceCurveChartWrapperProps {
    getCurvesPromise: Promise<ForceCurve[]>;
    displayMode: DisplayMode;
    marks: ForceCurveChartMarks;
}

const ForceCurveChartWrapper: React.FC<ForceCurveChartWrapperProps> = ({
    getCurvesPromise,
    displayMode,
    marks,
}) => {
    const data = use(getCurvesPromise);

    return <ForceCurveChart data={data} display={displayMode} marks={marks} />;
};

type FormValueHandlers = {
    [K in keyof FormValues]: Dispatch<SetStateAction<FormValues[K]>>;
};

function useFormValueHandler(handlers: FormValueHandlers) {
    return (values: Partial<FormValues>) => {
        for (const [key, value] of Object.entries(values)) {
            if (value !== undefined) {
                // @ts-expect-error No way to properly type "value" here
                handlers[key as keyof FormValues](value);
            }
        }
    };
}

function useUrlCurves(): [string[], Dispatch<string[]>] {
    const { files } = useParams();
    const navigate = useNavigate();

    const curves = files ? files.split(',').map((s) => s.trim()) : [];

    const setCurves = (curves: string[]) => {
        navigate('/' + curves.join(','));
    };

    return [curves, setCurves];
}

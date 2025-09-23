import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { forceCurvePlugin } from './rollup-plugin-force-curve';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        forceCurvePlugin(),
    ],
});

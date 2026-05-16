import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    entry: './src/map.ts',
    output: {
        filename: 'dist/map.js',
        path: __dirname
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader"
            }
        ]
    },
    resolve: {
        extensionAlias: { '.js': ['.ts', '.js'] },
        extensions: ['.ts', '.js']
    },
    devtool: 'inline-source-map',
};
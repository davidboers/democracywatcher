import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpack from 'webpack';
const { ProvidePlugin } = webpack;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __distname = path.resolve(__dirname, 'dist');

export default {
    entry: {
        map: './src/map.ts',
        marimekko: './src/marimekko.ts',
        progress: './src/progress.ts',
        race: './src/race-select.ts' // Do we need race.ts too?
    },
    output: {
        filename: '[name].bundle.js',
        path: __distname
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
    devtool: 'inline-source-map'
};
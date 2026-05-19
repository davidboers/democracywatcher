
import { ReportingStatus } from './data/reporting.js';
import { BallotOption, leading, totalVotes, votesFor } from './data/structures.js';
import { makeLegend } from './utils.js';

import seedrandom from 'seedrandom';

const color_palette = [
    'purple',
    'green',
    'orange',
    'crimson',
    'teal',
    'pink',
    'royalblue'
];

const color_palette_extended = [
    'tomato',
    'saddlebrown',
    'springgreen'
];

const DEM_COLOR = 'royalblue';
const REP_COLOR = 'crimson';
const LIB_COLOR = 'orange';
const GRN_COLOR = 'limegreen';

const party_label_colors = {
    Dem: DEM_COLOR,
    Rep: REP_COLOR,
    Lib: LIB_COLOR,
    Grn: GRN_COLOR
} as const;

export const EMPTY_COLOR = '#aaaaaa';

var sortedPalettes: { [key: string]: string[] } = {};

export function getColor(all_options: BallotOption[], option: BallotOption) {
    // Referendum colors
    if (['Yes', 'Yes / Sí'].includes(option.name)) { // Spanish should be stripped out, this is just a safeguard
        return 'green';
    }

    if (option.name === 'No') {
        return 'crimson';
    }

    const sorted_color_palette = getSortedColorPalette(all_options);

    all_options = all_options.toSorted((a, b) => a.ballotOrder - b.ballotOrder);
    let index = all_options.findIndex((bo) => bo.name == option.name);

    if (index === -1) {
        console.warn(`Couldn't find candidate ${option.name} in a given option list.`);
        return sorted_color_palette[0];
    }

    if (index >= sorted_color_palette.length) {
        console.warn(`I need at least ${index + 1} colors!`);
        index = index % sorted_color_palette.length;
    }

    return sorted_color_palette[index];
}

function getSortedColorPalette(options: BallotOption[]): string[] {
    const hash = options.map(bo => bo.name).toSorted().toString();
    if (sortedPalettes[hash]) return sortedPalettes[hash];
    const rng = seedrandom(hash);
    const sorted_color_palette = color_palette.toSorted(() => (rng() * 2 - 1) - (rng() * 2 - 1));
    sorted_color_palette.push(...color_palette_extended.toSorted(() => (rng() * 2 - 1) - (rng() * 2 - 1)));

    let label: keyof typeof party_label_colors;
    for (label in party_label_colors) {
        const labelsWithThisParty = options.map((_, i) => i).filter((i) => options[i].name.includes(`(${label})`));

        if (labelsWithThisParty.length === 1) {
            const [index] = labelsWithThisParty;
            const color = party_label_colors[label];

            if (sorted_color_palette[index] === color) continue;

            const existingColorIndex = sorted_color_palette.indexOf(color);
            if (existingColorIndex !== -1) {
                sorted_color_palette[existingColorIndex] = sorted_color_palette[index];
            }

            sorted_color_palette[index] = color;
        }
    }

    sortedPalettes[hash] = sorted_color_palette;
    return sorted_color_palette;
}

function getMapColorWorker(all_options: BallotOption[], worker: (all_options: BallotOption[], option: BallotOption) => string): string {
    const winner = leading(all_options);

    if (winner === 'Awaiting Results') return EMPTY_COLOR;
    if (winner === 'Tie') return '#969696';

    return worker(all_options, winner as BallotOption);
}

export function getMapSolidColor(all_options: BallotOption[]): string {
    return getMapColorWorker(all_options, getColor);
}

export function pickReportingColor(reportingStatus: ReportingStatus) {
    switch (reportingStatus) {
        case 'Not Reported': return EMPTY_COLOR;
        case 'Partially Reported': return '#767676';
        case 'Election Night Complete': return '#242424';
        case 'Fully Reported': return '#008000';
    }
}

// Gradients

export function getMapShadedColor(all_options: BallotOption[]): string {
    return getMapColorWorker(all_options, function (all_options, winner) {
        const share = votesFor(winner) / totalVotes(all_options);

        return gradientPick(getColor(all_options, winner), share);
    });
}

export function gradientPick(color: string, ratio: number) {
    let [r, g, b] = nameToRGB(color);

    if (ratio > 1 || ratio < 0) {
        throw new Error('Illegal gradient value!');
    }

    ratio = 1 - ratio;

    // Use only 80% of the spectrum to prevent fully white or black
    ratio = 0.8 * (ratio - 0.5) + 0.5

    if (ratio >= 0.5) {
        r = 2 * (ratio - 0.5) * (0xff - r) + r;
        g = 2 * (ratio - 0.5) * (0xff - g) + g;
        b = 2 * (ratio - 0.5) * (0xff - b) + b;

    } else {
        r = 2 * ratio * r;
        g = 2 * ratio * g;
        b = 2 * ratio * b;

    }

    const [r1, g1, b1] = [r, g, b].map(toHex);

    return `#${r1}${g1}${b1}`;
}

export function createInspectionGradient(ballotOptions: BallotOption[]): JQuery<HTMLElement> {
    const $gradient = $('<div id="gradient-inspect"></div>');
    $gradient.append(`<div class="gradient-header"></div>`);
    for (let r = 0; r <= 1; r += 0.1)
        $gradient.append(`<div class="gradient-header">${Math.round(r * 100)}</div>`);

    const legendLabels = makeLegend(ballotOptions.map(bo => bo.name));
    for (let ballotOption of ballotOptions) {
        $gradient.append(`<span class="gradient-margin">${legendLabels[ballotOption.name]}</span>`);
        let color = getColor(ballotOptions, ballotOption);

        for (let r = 0; r <= 1; r += 0.1) {
            $gradient.append(`<div class="gradient-color-display" style="background-color:${gradientPick(color, r)};"></div>`);
        }
    }

    return $gradient;
}

// Hex tools

function toHex(num: number): string {
    return Math.round(num).toString(16).padStart(2, '0');
}

export function nameToHex(color: string): string {
    const [r, g, b] = nameToRGB(color)?.map(toHex);
    return `#${r}${g}${b}`;
}

function nameToRGB(color: string): number[] {
    const temp = document.createElement("div");
    temp.style.color = color;
    document.body.appendChild(temp);

    // Get the computed RGB color
    const rgb = window.getComputedStyle(temp).color;
    document.body.removeChild(temp);

    return rgb.match(/\d+/g)?.map(x => parseInt(x)) || [0xdd, 0xdd, 0xdd];
}

// Graphs

export function candidateLegend(ballotOptions: BallotOption[]) {
    const $legend = $('#candidates-legend');
    const legendLabels = makeLegend(ballotOptions.map(bo => bo.name));
    for (const i in ballotOptions) {
        const ballotOption = ballotOptions[i];
        const color = getColor(ballotOptions, ballotOption);
        $legend.append(`
            <div class="candidate-item">
                <div style="background-color: ${color};" class="candidate-color-box"></div>
                <span>${legendLabels[ballotOption.name]}</span>
            </div>
            `.trim());
    }
}
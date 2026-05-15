
import { ReportingStatus } from './data/reporting.js';
import { BallotOption, leading, totalVotes, votesFor } from './data/structures.js';

const color_palette = [
    'purple',
    'green',
    'orange',
    'crimson',
    'teal',
    'pink',
    'royalblue',
    'saddlebrown'
];

export const EMPTY_COLOR = '#aaaaaa';

export function getColor(all_options: BallotOption[], option: BallotOption) {
    if (option.name === 'Yes') {
        return 'green';
    }

    if (option.name === 'No') {
        return 'red';
    }

    all_options = all_options.toSorted((a, b) => a.ballotOrder - b.ballotOrder);

    let index = all_options.findIndex((bo) => bo.name == option.name);

    if (index === -1) {
        console.warn(`Couldn\'t find candidate ${option.name} in a given option list.`);
        return color_palette[0];
    }

    if (index >= color_palette.length) {
        console.warn(`I need at least ${index + 1} colors!`);
        index = index % color_palette.length;
    }

    return color_palette[index];
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
        case 'Partially Reported': return '#aaa';
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
    for (let ballotOption of ballotOptions) {
        $gradient.append(`<span class="gradient-margin">${ballotOption.name}</span>`);
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
    for (const i in ballotOptions) {
        const ballotOption = ballotOptions[i];
        const color = getColor(ballotOptions, ballotOption);
        $legend.append(`
            <div class="candidate-item">
                <div style="background-color: ${color};" class="candidate-color-box"></div>
                <span>${ballotOption.name}</span>
            </div>
            `.trim());
    }
}
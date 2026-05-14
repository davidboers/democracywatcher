import { getFullResults } from './data/media-export.js';
import { BallotItem, BallotOption, totalVotes, votesFor } from './data/structures.js';

import { candidateLegend, getColor } from './colors.js';
import { createJQuerySVG, formatTimestamp, preciseShare, setupAbstract } from './utils.js';

type TimestampedFile = {
    file: string;
    timestamp: string
};

type TimestampedBallotItem = {
    ballotItem: BallotItem;
    timestamp: string
};

type Timeline = {
    [key: number]: number
}

type TimelineSet = {
    [key: string]: Timeline;
}

function drawProgress(timestampedBallotItems: TimestampedBallotItem[]) {
    const timelines = convertToTimelines(timestampedBallotItems);
    const $lines = $('#lines');
    const $updates = $('#updates');
    const $markings = $('#markings');
    const ballotOptions = timestampedBallotItems[0].ballotItem.ballotOptions;

    $('#loading').hide();

    if (Object.values(timelines).length === 0) {
        failMessage();
        return;
    }

    candidateLegend(ballotOptions);

    const width = $('svg').width() as number * 0.95;
    const height = $('svg').height() as number * 0.9;

    const updateLines: { [key: number]: SVGElement } = {};

    for (const candidate_name in timelines) {
        const timeline = timelines[candidate_name];
        const d = drawLine(width, height, timeline);
        const color = getColor(ballotOptions, ballotOptions.find(bo => bo.name === candidate_name) as BallotOption);
        const line = createJQuerySVG(`<path d="${d}" stroke="${color}"></path>`);
        $lines.append(line);

        // Update lines (for hover)

        const timestamps = getTimestamps(timeline);
        const total_time = totalTime(timestamps);

        function createUpdateG(timestamp: number) {
            const x = Math.round((timestamp - timestamps[0]) / total_time * width);
            const g = createJQuerySVG(`
                <g transform="translate(${x})" id="${x}">
                    <path d="m0 0v${Math.round(height) + 15}" stroke="black" stroke-width="2"></path>
                    <g class="share-indicator"></g>
                    <text x="4" y="${height + 15}" class="time-indicator">${formatTimestamp(timestamp)}</text>
                </g>`.trim());

            $updates.append(g);
            $(g).hide();
            return g;
        }

        let lasty = null;
        for (const timestamp of timestamps) {
            const g = (updateLines[timestamp] ||= createUpdateG(timestamp));
            const y = getY(height, timeline[timestamp]);
            if (y === lasty) continue;
            const share_label = createJQuerySVG(`<text x="5" y="${y}" fill="${color}">${preciseShare(timeline[timestamp] * 100)}</text>`);
            $(g).find('.share-indicator').first().append(share_label);
            lasty = y;
            // Any update <g> tags that don't contain any share labels will be eliminated later.
        }
    }

    const majority_mark = createJQuerySVG(`<path transform="translate(1.5 0)" d="m0 ${Math.round(height / 2)}h${width}" stroke="darkgray" stroke-width="1"></path>`);
    const majority_label = createJQuerySVG(`<text transform="translate(2, ${Math.round(height / 2)})" fill="darkgray" stroke="none">Majority</text>`);
    const border = createJQuerySVG(`<rect width="${width + 2}" height="${height}" fill="none" stroke-width="2" stroke="black"></rect>`);
    $markings.append(majority_mark);
    $markings.append(majority_label);
    $markings.append(border);

    // Hover

    let currentUpdate: Element | null = null;

    $('svg').on('mousemove', function (e) {
        const closestUpdate = Array.from($updates.children()).sort((a, b) => {
            const aX = parseInt(a.id);
            const bX = parseInt(b.id);
            return Math.abs(aX - e.clientX) - Math.abs(bX - e.clientX);
        })[0];

        if (!closestUpdate || closestUpdate === currentUpdate) {
            return;
        }

        if (closestUpdate && $(closestUpdate).find('.share-indicator').first().children().length === 0) {
            closestUpdate.remove();
            return;
        }

        if (currentUpdate) {
            $(currentUpdate).hide();
        }

        currentUpdate = closestUpdate;
        $(closestUpdate).show();
        $lines.attr('stroke-opacity', '0.25');
    }).on('mouseleave', function () {
        if (currentUpdate) {
            $(currentUpdate).hide();
            currentUpdate = null;
        }
        $lines.removeAttr('stroke-opacity');
    });
}

function getTimestamps(timeline: Timeline): number[] {
    return Object.keys(timeline).map(Number).sort();
}

function totalTime(timestamps: number[]): number {
    const end = timestamps[timestamps.length - 1] + 1.2e6; // Last timestamp, 20 minute buffer;
    return end - timestamps[0];
}

function getY(height: number, share: number): number {
    return (1 - share) * height;
}

function convertToTimelines(timestampedBallotItems: TimestampedBallotItem[]): TimelineSet {
    return timestampedBallotItems.reduce((acc: TimelineSet, timestampedBallotItem) => {
        const timestamp = new Date(timestampedBallotItem.timestamp).getTime();

        for (const ballotOption of timestampedBallotItem.ballotItem.ballotOptions) {
            const total_votes = totalVotes(timestampedBallotItem.ballotItem.ballotOptions);
            if (!total_votes) continue;
            (acc[ballotOption.name] ||= [])[timestamp] = votesFor(ballotOption) / total_votes;
        }

        return acc;
    }, {});
}

function drawLine(width: number, height: number, timeline: Timeline) {
    const timestamps = getTimestamps(timeline);
    const total_time = totalTime(timestamps);

    const y0 = Math.round((1 - timeline[timestamps[0]]) * height);
    let d = `m0 ${y0}`;
    let yl = y0;

    let lst_o = 1;
    for (let i = 1; i < timestamps.length; i++) {
        let timestamp = timestamps[i];
        let yi = getY(height, timeline[timestamp]);
        const dx = Math.round((timestamp - timestamps[i - lst_o]) / total_time * width);
        const dy = Math.round(yi - yl);

        if (Number.isNaN(dx) || Number.isNaN(dy)) {
            throw new Error('Line NaN!');
        }

        if (dy === 0) {
            lst_o++;
            continue;
        };

        d = `${d}h${dx}v${dy}`;
        lst_o = 1;
        yl = yi;
    }

    d = `${d}H${width}`;

    return d;
}

const awaitResultsWithTimestmap = (race_name: string) => async function (ts: TimestampedFile): Promise<TimestampedBallotItem> {
    const ballotItem = await getFullResults(race_name, `data/${ts.file}`);
    return { ballotItem, timestamp: ts.timestamp };
}

function failMessage() {
    $('#error').html('<p>Awaiting results.</p>');
}

void function () {
    const race_name = setupAbstract();

    if (!race_name) return;

    const base = window.location.origin.replace(/:[0-9]{4}/, '');
    fetch(`${base}:5000/results-timestamps`)
        .then(response => response.json())
        .then((data: TimestampedFile[]) => Promise.allSettled(data.map(awaitResultsWithTimestmap(race_name))))
        .then(promises => promises.filter(p => p.status === 'fulfilled').map(result => result.value))
        .then(drawProgress)
    //.error(failMessage);
}();
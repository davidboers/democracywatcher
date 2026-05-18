
import { getLocalResults, localReturnsForRace } from '../data/media-export.js';
import { ballotItemReportingStatusFromPrecinctLevel, BallotOption, County, leading, LocalReturn } from '../data/structures.js';

import { recolorMap } from './color-map.js';
import { drawMap, fetchTopography } from './draw.js';
import { buildRegionalStrengthBreakdown, changeSelection, getNotHover } from './side.js';

export async function setUpProjection(race_name: string, topojsonPath: string, buttonID: string, clipGroup: ClipGroup) {
    const topology = await fetchTopography(topojsonPath);
    getLocalResults()
        .then(counties => getClippedRaces(clipGroup, counties, race_name))
        .then(localReturns => drawMap(topology, localReturns))
        .then(([localReturns, path_chain, _]) => recolorMap(localReturns, path_chain))
        .then(localReturns => {
            changeSelection('map-geo', buttonID);
            $('#warn-projections').show();

            if (clipGroup.chamberReference) {
                const tally = createTally(clipGroup.chamberReference, localReturns);
                buildLegislativeDistrictBreakdown(tally);

            } else {
                buildRegionalStrengthBreakdown(localReturns);
            }
        });
}


// Race clipping in general

export type ClipGroup = {
    temp: (counties: County[], district: number) => string;
    maxDistricts: number;
    chamberReference?: ChamberReference;
};

function clipRace(localReturnsA: LocalReturn[], localReturnsB: LocalReturn[]): BallotOption[] {
    return localReturnsA.reduce((acc: BallotOption[], lrA) => {
        const lrB = localReturnsB.find(lr => lr.jurisName === lrA.jurisName);
        if (!lrB) return acc;
        const precinctResultsB = lrB.ballotItem.ballotOptions.map(bo => bo.precinctResults).flat();
        const precinctsB = [...new Set(precinctResultsB.map(p => {
            if (!p) throw new Error('Incomplete precinct results (Race B)');
            return p.id;
        }))];

        for (const ballotOption of lrA.ballotItem.ballotOptions) {
            const precinctResults = ballotOption.precinctResults;

            if (!precinctResults) {
                throw new Error('Incomplete precinct results (Race A)');
            }

            const filteredPrecincts = precinctResults.filter(pr => precinctsB.includes(pr.id));
            const existingBo = acc.find(bo => bo.id === ballotOption.id);
            const clippedVotes = filteredPrecincts.map(pr => Object.values(pr.groupResults)).flat().reduce((t, v) => t + v, 0);

            if (existingBo) {
                existingBo.voteCount += clippedVotes;
                existingBo.precinctResults?.push(...filteredPrecincts);

            } else {
                acc.push({
                    id: ballotOption.id,
                    name: ballotOption.name,
                    ballotOrder: ballotOption.ballotOrder,
                    voteCount: clippedVotes,
                    //groupResults: combineReportingStatuses(filteredPrecincts.map(p => p.reportingStatus)),
                    precinctResults: filteredPrecincts
                });
            }
        }

        return acc;
    }, []);
}

export function getClippedRaces(clipGroup: ClipGroup, counties: County[], race_a: string): LocalReturn[] {
    const localReturnsA = localReturnsForRace(race_a, counties);
    const clippedReturns: LocalReturn[] = [];

    for (let d = 1; d <= clipGroup.maxDistricts; d++) {
        const race_b = clipGroup.temp(counties, d);
        const localReturnsB = localReturnsForRace(race_b, counties);

        const ballotOptions = clipRace(localReturnsA, localReturnsB);
        const ballotItem = {
            id: localReturnsA[0].ballotItem.id,
            name: race_a,
            ballotOptions
        };

        clippedReturns.push({
            jurisName: `${d}`,
            ballotItem,
            reportingStatus: ballotItemReportingStatusFromPrecinctLevel(ballotItem)
        });
    }

    return clippedReturns;
}


// Legislative districts

type LegislativeTally = {
    [candidate: string]: {
        [party: string]: number
    }
}

type ChamberReference = {
    [party: string]: string[]
};

export const STATE_SENATE: ChamberReference = {
    'GOP': [1, ...rg(3, 4), 6, 8, 11, 13, 16, ...rg(18, 21), ...rg(23, 25), 27, ...rg(29, 32), 37, 42, ...rg(45, 54), 56].map(d => `${d}`),
    'Dem': [2, 5, 7, ...rg(9, 10), 12, ...rg(14, 15), 17, 22, 26, 28, ...rg(33, 36), ...rg(38, 41), ...rg(43, 44), 55].map(d => `${d}`)
};

export const STATE_HOUSE: ChamberReference = {
    'GOP': [...rg(1, 34), 36, 40, ...rg(44, 49), 53, ...rg(70, 73), ...rg(81, 82), ...rg(99, 100), ...rg(103, 105), ...rg(111, 112), 114
        , ...rg(118, 121), ...rg(123, 125), 127, 131, ...rg(133, 136), ...rg(138, 139), 144, ...rg(146, 148), ...rg(151, 152), ...rg(154, 161)
        , 164, ...rg(166, 167), ...rg(169, 176), ...rg(178, 180)].map(d => `${d}`),
    'Dem': [35, ...rg(37, 39), ...rg(41, 43), ...rg(50, 52), ...rg(54, 69), ...rg(74, 80), ...rg(83, 98), ...rg(101, 102), ...rg(106, 110)
        , 113, ...rg(115, 117), 122, 126, ...rg(128, 130), 132, 137, ...rg(140, 143), 145, ...rg(149, 150), 153, ...rg(162, 163), 165, 168, 177
    ].map(d => `${d}`)
};

function* rg(start: number, end: number) {
    for (let i = start; i <= end; i += 1) {
        yield i;
    }
}

export function createTally(ref: ChamberReference, localReturns: LocalReturn[]): LegislativeTally {
    const partiesPrototype = Object.fromEntries(Object.keys(ref).map(party => [party, 0]));

    return localReturns.reduce((tally: LegislativeTally, localReturn) => {
        let party = Object.keys(ref).find(pt => ref[pt].includes(localReturn.jurisName));
        let candidate = leading(localReturn.ballotItem.ballotOptions);

        if (!party) {
            console.warn(`Did not find party data for ${localReturn.jurisName};`);
            return tally;
        }

        if (typeof candidate !== 'string') {
            candidate = candidate.name;
        }

        (tally[candidate] ||= Object.create(partiesPrototype))[party]++;

        return tally;
    }, {});
}

export function buildLegislativeDistrictBreakdown(legislativeTally: LegislativeTally) {
    const $template = $('#leg-district-breakdown-temp');
    const $not_hover = getNotHover();
    $not_hover.append($template.html());

    let gop_total = 0;
    let dem_total = 0;

    const $tbody = $not_hover.find('tbody.candidate-list-lb').first();
    const candidatesSorted = Object.entries(legislativeTally)
        .toSorted(([, districtsA], [, districtsB]) =>
            [...Object.values(districtsA)].reduce((t, l) => t + l) -
            [...Object.values(districtsB)].reduce((t, l) => t + l))
        .reverse().map(([c, _]) => c);
    for (let candidate of candidatesSorted) {
        const byParty = legislativeTally[candidate];
        const gop = byParty['GOP'];
        const dem = byParty['Dem'];
        const subtotal = gop + dem;
        gop_total += gop;
        dem_total += dem;

        $tbody.append(`
            <tr>
                <td class="leg-breakdown-cand">${candidate}</td>
                <td class="leg-breakdown-tally">${gop}</td>
                <td class="leg-breakdown-tally">${dem}</td>
                <td class="leg-breakdown-tally-total">${subtotal}</td>
            </tr>
        `);
    }

    $not_hover.find('.leg-breakdown-sub.gop').html(`${gop_total}`);
    $not_hover.find('.leg-breakdown-sub.dem').html(`${dem_total}`);
    $not_hover.find('.leg-breakdown-big-total').html(`${gop_total + dem_total}`);
}


import { formatCountyNameAsValue } from '../utils.js';

import { BallotItem, County, countyReportingStatusFromPrecinctLevel, findBallotItem, LocalReturn } from './structures.js';

export const DEFAULT_SOURCE = 'latest.json.gz';

export type Root = {
    results: { ballotItems: BallotItem[] },
    localResults: County[]
};

async function worker(url: string): Promise<Root> {
    return fetch(url)
        .then(async response => (await response.blob()).stream().pipeThrough(new DecompressionStream('gzip')))
        .then(async decompressedStream => await new Response(decompressedStream).text())
        .then(async decompressedJSON => JSON.parse(decompressedJSON))
    /*.then((response: Root) => {
        response.results.ballotItems.map(bi => bi.ballotOptions.map(bo => bo.voteCount = Math.round(Math.random() * 1000)));

        response.localResults.forEach(county => county.ballotItems.forEach(bi => bi.ballotOptions.forEach(bo => (bo.precinctResults as PrecinctResults[]).forEach(pr => {
            pr.groupResults =
            {
                'Election Day': Math.round(Math.random() * ((county.name === 'Fulton County') ? 50 : 10)),
                'Absentee by Mail': Math.round(Math.random() * ((county.name === 'Fulton County') ? 50 : 10)),
                'Provisional': Math.round(Math.random() * ((county.name === 'Fulton County') ? 50 : 10)),
                'Advance Voting': Math.round(Math.random() * ((county.name === 'Fulton County') ? 50 : 10))
            }
            bo.voteCount += Object.values(pr.groupResults).reduce((t, v) => t + v, 0);
        }))));

        return response;
    });*/
}

export async function withRoot<T>(url: string = DEFAULT_SOURCE, pred: (_: Root) => T): Promise<T> {
    return worker(url).then(pred);
}

export async function getAllFullResults(url: string = DEFAULT_SOURCE): Promise<BallotItem[]> {
    return worker(url).then(data => data.results.ballotItems);
}

export async function withAllFullResults<T>(pred: (_: BallotItem[]) => T, url: string = DEFAULT_SOURCE): Promise<T> {
    return worker(url)
        .then(data => pred(data.results.ballotItems));
}

export async function getFullResults(race_name: string, url: string = DEFAULT_SOURCE): Promise<BallotItem> {
    return worker(url).then(data => {
        const item = findBallotItem(data.results.ballotItems, race_name);

        if (!item) {
            throw new Error(`Cannot find race ${race_name}`);
        }

        return item;
    });
}

export async function withFullResults<T>(pred: (_: BallotItem) => T, race_name: string, url: string = DEFAULT_SOURCE): Promise<T> {
    return withAllFullResults(ballotItems => {
        const item = findBallotItem(ballotItems, race_name);

        if (!item) {
            throw new Error(`Cannot find race ${race_name}`);
        }

        return pred(item);
    }, url);
}

export async function getLocalResults(url: string = DEFAULT_SOURCE): Promise<County[]> {
    return worker(url)
        .then(response => response.localResults);
}

export async function withLocalResults<T>(pred: (_: LocalReturn[]) => T, race_name: string, county?: string, url: string = DEFAULT_SOURCE): Promise<T> {
    return getLocalResults(url)
        .then(counties => {
            let localReturns = localReturnsForRace(race_name, counties);

            if (county) {
                localReturns = localReturns.filter(lr => formatCountyNameAsValue(lr.jurisName) === county);
            }

            return pred(localReturns);
        });
}

export function localReturnsForRace(race_name: string, counties: County[]): LocalReturn[] {
    let race_id: string | undefined;

    return counties
        .map(county => {
            const ballotItem = findBallotItem(county.ballotItems, race_name, race_id);
            if (!ballotItem) return null;
            race_id = ballotItem.id;

            return {
                jurisName: county.name,
                ballotItem: ballotItem,
                reportingStatus: countyReportingStatusFromPrecinctLevel(county)
            };
        }).filter((item) => item !== null);
}
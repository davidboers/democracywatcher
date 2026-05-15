import { BallotItem, County, countyReportingStatusFromPrecinctLevel, findBallotItem, LocalReturn, PrecinctResults } from './structures.js';

export const PSC_PRIMARY_2025 = 'https://results.sos.ga.gov/cdn/results/Georgia/export-2025PSCPrimary.json';
export const MAY_12_SPC_2026 = 'https://results.sos.ga.gov/cdn/results/Georgia/export-51226SpecialElection.json';
//export const GEN_PRIMARY_2026 = 'https://results.sos.ga.gov/cdn/results/Georgia/export-51926GeneralPrimary.json'
//export const GEN_PRIMARY_2026 = 'latest.json'
export const GEN_ELECTION_2024 = 'https://results.sos.ga.gov/cdn/results/Georgia/export-2024NovGen.json';

export const DEFAULT_SOURCE = 'latest.json';

export type Root = {
    results: { ballotItems: BallotItem[] },
    localResults: County[]
};

async function worker(url: string): Promise<Root> {
    return fetch(url)
        .then(async response => await response.json())
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

export async function withLocalResults<T>(pred: (_: LocalReturn[]) => T, race_name: string, url: string = DEFAULT_SOURCE): Promise<T> {
    return getLocalResults(url)
        .then(counties => {
            const localReturns = localReturnsForRace(race_name, counties);
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
                reportingStatus: countyReportingStatusFromPrecinctLevel(county) /// See Python script notes
            };
        }).filter((item) => item !== null);
}
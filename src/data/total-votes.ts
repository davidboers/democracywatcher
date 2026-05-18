
import * as XLSX from 'xlsx';

import { ReportingGroup, BallotItem, BallotOption, GroupResults } from './structures.js';

// Sources

export const GEN_PRIMARY_2026 = 'https://results.sos.ga.gov/cdn/results/09378a07-e6cf-4f66-be7c-ca4aa534f99a/Total%20Votes%20Results_6fd0ba53-0a99-47ca-9168-d76513e0d382.xlsx';
export const MAY_12_SPC_2026 = 'https://results.sos.ga.gov/cdn/results/09378a07-e6cf-4f66-be7c-ca4aa534f99a/Total%20Votes%20Results_8aff1cd1-747d-4761-9529-922c3d89d704.xlsx'
export const MAR_10_SPC_2026 = 'https://results.sos.ga.gov/cdn/results/09378a07-e6cf-4f66-be7c-ca4aa534f99a/Total%20Votes%20Results_0dbf4738-5105-42d9-a21f-84a34abd28c6.xlsx';
export const GEN_PRIMARY_2024 = 'https://results.sos.ga.gov/cdn/results/09378a07-e6cf-4f66-be7c-ca4aa534f99a/Total%20Votes%20Results_dd4a2851-411f-4720-abea-3ce4cf813d1f.xlsx';
export const PSC_PRIMARY_2025 = 'https://results.sos.ga.gov/cdn/results/09378a07-e6cf-4f66-be7c-ca4aa534f99a/Total%20Votes%20Results_1f7bc44e-ecd2-4e56-a5bf-73e0401b5bf7.xlsx';

export const DEFAULT_SOURCE = GEN_PRIMARY_2026;

function stripSpanish(input: string): string {
    if (!input) return input;
    return input.replace(/\s?\/.+?(?=$| - (?:Dem|Rep)| \()/, '')
}

// Sheet 2 data structure

interface TotalVotesByGroupEntry {
    officeName: string,
    contestID: string,
    ballotName: string,
    choiceID: string | null,
    party: string | null,
    group: ReportingGroup,
    total: number
};

type TotalVotesByGroupEntryRow = [string, string, string, string | null, string | null, ReportingGroup, number];

function makeTotalVotesByGroupEntry(values: TotalVotesByGroupEntryRow): TotalVotesByGroupEntry {
    return {
        officeName: stripSpanish(values[0]),
        contestID: values[1],
        ballotName: values[2],
        choiceID: values[3],
        party: values[4],
        group: values[5],
        total: values[6]
    }
}

// Sheet 3 data structure

interface CountyResultsEntry {
    county: string,
    officeName: string,
    contestID: string,
    ballotName: string,
    choiceID: string | null,
    party: string | null,
    total: number
};

type CountyResultsEntryRow = [string, string, string, string, string | null, string | null, number];

function makeCountyResultsEntry(values: CountyResultsEntryRow): CountyResultsEntry {
    return {
        county: values[0],
        officeName: stripSpanish(values[1]),
        contestID: values[2],
        ballotName: values[3],
        choiceID: values[4],
        party: values[5],
        total: values[6]
    }
}

export function mergeToBallotItem([groups, entries]: [TotalVotesByGroupEntry[], CountyResultsEntry[]]): BallotItem {
    const id = entries[0].contestID;
    const name = entries[0].officeName;

    const ballotOptions: BallotOption[] = entries
        .filter(e => !['Total Votes', 'Ballots Cast'].includes(e.ballotName))
        .reduce((acc: BallotOption[], e, i) => {
            const bo = acc.find(bo => bo.id === e.choiceID);
            if (!bo) {
                const groupResults = groups.filter(group =>
                    group.contestID === e.contestID &&
                    group.choiceID === e.choiceID
                ).reduce((groupResultsAcc: GroupResults, group) => {
                    groupResultsAcc[group.group as string] = group.total;
                    return groupResultsAcc;
                }, {});

                acc.push({
                    id: e.choiceID as string,
                    name: e.ballotName,
                    ballotOrder: i, // Not technically accurate, but effective
                    voteCount: e.total,
                    groupResults
                });
                return acc;
            };
            bo.voteCount += e.total;
            return acc;
        }, []);

    const ballotsCast = entries.filter(e => e.ballotName === 'Ballots Cast')
        .reduce((t, e) => t + e.total, 0);

    return {
        id,
        name,
        ballotOptions,
        ballotsCast
    };
}

// Scrape functions

async function worker(url: string): Promise<[TotalVotesByGroupEntry[], CountyResultsEntry[]]> {
    return fetch(url)
        .then(async function (response) {
            const wb = XLSX.read(await response.arrayBuffer());
            const groups = (XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]], { header: 1 }) as TotalVotesByGroupEntryRow[])
                .map(makeTotalVotesByGroupEntry);

            return [groups, (XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[2]], { header: 1 }) as CountyResultsEntryRow[])
                .map(makeCountyResultsEntry)]
        });
}

async function workerSpecific(race_name: string, url: string): Promise<[TotalVotesByGroupEntry[], CountyResultsEntry[]]> {
    return worker(url).then(([groups, entries]) =>
        [groups, entries.filter((e: CountyResultsEntry) => e.officeName === race_name)]
    );
}

export async function withFullResults<T>(pred: (_: BallotItem) => T, race_name: string, url: string = DEFAULT_SOURCE): Promise<T> {
    return workerSpecific(race_name, url)
        .then(mergeToBallotItem)
        .then(pred);
}

export async function withAllFullResults<T>(url: string = DEFAULT_SOURCE, pred: (_: BallotItem[]) => T): Promise<T> {
    return worker(url).then(([groups, entries]) => {
        return entries.filter(e => e.contestID && e.contestID !== 'Contest ID')
            .reduce((acc: CountyResultsEntry[][], e) => {
                let el = acc.find(el => el[0].contestID === e.contestID);
                if (!el) {
                    acc.push([e]);
                    return acc;
                }
                el.push(e);
                return acc;
            }, [])
            .map(sortedEntries => mergeToBallotItem([groups, sortedEntries]));
    }).then(pred);
}
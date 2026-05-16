import { combineReportingStatusList, ReportingStatus, ReportingStatuses } from './reporting.js';

export interface County {
    name: string;
    ballotItems: BallotItem[];
    reportingStatuses: ReportingStatuses;
};

export function countyReportingStatusFromPrecinctLevel(county: County): ReportingStatus {
    return combineReportingStatusList(county.ballotItems.map(ballotItemReportingStatusFromPrecinctLevel))
}

export interface BallotItem {
    id: string;
    name: string;
    ballotOrder?: number;
    ballotOptions: BallotOption[];
    ballotsCast?: number;
    allowSwap?: boolean;
};

export function findBallotItem(ballotItems: BallotItem[], race_name: string, race_id?: string) {
    return ballotItems.find(bi => bi.name == race_name || (race_id && race_id === bi.id));
}

export function ballotItemReportingStatusFromPrecinctLevel(ballotItem: BallotItem): ReportingStatus {
    return combineReportingStatusList(ballotItem.ballotOptions.map(bo => (bo.precinctResults as PrecinctResults[]).map(pr => pr.reportingStatus).flat()).flat());
}

export function leading(ballotOptions: BallotOption[]): BallotOption | string {
    ballotOptions.sort(candidateCompare);

    if (!totalVotes(ballotOptions))
        return 'Awaiting Results';

    if (ballotOptions.length > 1 && ballotOptions[0].voteCount === ballotOptions[1].voteCount)
        return 'Tie';

    return ballotOptions[0];
}

export function votesForCandidate(option: BallotOption, ballotItem: BallotItem): number {
    return ballotItem.ballotOptions.find(c => option.name == c.name)?.voteCount || 0;
}

export function votesFor(ballotOption: BallotOption, filterGroup?: ReportingGroup) {
    return (filterGroup && ballotOption.groupResults) ? ballotOption.groupResults[filterGroup] : ballotOption.voteCount;
}

export function totalVotes(ballotOptions: BallotOption[], filterGroup?: ReportingGroup): number {
    return sum(ballotOptions.map(bo => votesFor(bo, filterGroup)));
}

function sum(l: number[]): number {
    return l.reduce((t, li) => t + li, 0);
}

export function isStateWide(countyReturns: LocalReturn[]) {
    return countyReturns.length === 159;
}

export function isIncumbentTrailing(ballotItem: BallotItem): boolean {
    const incumbent = ballotItem.ballotOptions.find(bo =>
        bo.name.endsWith('(I)')
        || bo.name === 'Venola Mason'
    );

    if (!incumbent) return false;
    if (totalVotes(ballotItem.ballotOptions) === 0) return false;
    /// Exclude disqualified/withdrawn candidates
    const leader = leading(ballotItem.ballotOptions);
    return incumbent !== leader;
};

export type ReportingGroup = 'Election Day' | 'Absentee by Mail' | 'Provisional' | 'Advance Voting';

export interface LocalReturn {
    jurisName: string;
    ballotItem: BallotItem;
    reportingStatus: ReportingStatus | ReportingStatuses;
    members?: string[];
    altName?: string; // For precincts
};

export function getPrecinctReturns(localReturns: LocalReturn[]): LocalReturn[] {
    return localReturns.map(getPrecinctReturnsWorker).flat();
}

function getPrecinctReturnsWorker(localReturn: LocalReturn): LocalReturn[] {
    return localReturn.ballotItem.ballotOptions.reduce((acc: LocalReturn[], ballotOption) => {
        for (let precinct of ballotOption.precinctResults || []) {
            const precinctID = `${localReturn.jurisName} - ${precinct.name}`;
            let precinctReturn = acc.find(pr => pr.jurisName.toLowerCase() === precinctID.toLowerCase() ||
                (pr.altName && pr.altName === `${localReturn.jurisName} - ${precinct.id}`));

            if (!precinctReturn) {
                const newBallotItem = structuredClone(localReturn.ballotItem);
                newBallotItem.ballotOptions.forEach((bo: BallotOption) => bo.voteCount = 0);
                precinctReturn = {
                    jurisName: precinctID,
                    ballotItem: newBallotItem,
                    reportingStatus: precinct.reportingStatus,
                    altName: `${localReturn.jurisName} - ${precinct.id}`
                };
                acc.push(precinctReturn);
            }

            const precinctBallotOption = precinctReturn.ballotItem.ballotOptions.find(pbo => pbo.name === ballotOption.name);
            (precinctBallotOption as BallotOption).voteCount += sumFromPrecinctResults(precinct);
        }

        return acc;
    }, []);
}

export function sumFromPrecinctResults(precinct: PrecinctResults) {
    const groupTallies = Object.values(precinct.groupResults);
    if (groupTallies.includes(-1)) return precinct.voteCount; // Accounting for obfuscation
    return groupTallies.reduce((t, v) => t + v, 0);
}

export interface BallotOption {
    id: string;
    name: string;
    ballotOrder: number;
    voteCount: number;
    groupResults?: GroupResults,
    precinctResults?: PrecinctResults[];
};

export function candidateCompare(a: BallotOption, b: BallotOption, filterGroup?: ReportingGroup) {
    let votesA = votesFor(a, filterGroup);
    let votesB = votesFor(b, filterGroup);
    return (votesA === votesB) ? a.ballotOrder - b.ballotOrder : -(votesA - votesB);
}

export interface PrecinctResults {
    id: string,
    name: string,
    voteCount: number,
    reportingStatus: ReportingStatus,
    groupResults: GroupResults
};

export type GroupResults = {
    [groupName: string]: number
};

export interface LocalGroup {
    returns: LocalReturn[];
    name: string;
};
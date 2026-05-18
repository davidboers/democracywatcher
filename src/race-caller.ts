import { BallotItem, BallotOption, candidateCompare, leading, totalVotes } from './data/structures.js';
import { ReportingStatus } from './data/reporting.js';

import { ENUM_CAMEL_WORD_REGEX } from './utils.js';

export enum Status {
    AwaitingResults,
    NotFinal,
    ToCloseToCall,
    EffectivelyFinal,
    Final
};

export function raceStatus(ballotItem: BallotItem, reportingStatus: ReportingStatus): Status {
    switch (reportingStatus) {
        case 'Not Reported':
            return Status.AwaitingResults;

        case 'Partially Reported':
            return Status.NotFinal;

        case 'Election Night Complete':
            const call = callRace(ballotItem);
            const tolerance = (call.total_votes >= 100000) ? 1000 : 100;
            const leader = leading(ballotItem.ballotOptions);
            const over_threshold = (typeof leader === 'string') ? -1 : leader.voteCount - call.threshold;

            if (call.margin < tolerance || (over_threshold >= 0 && over_threshold < tolerance))
                return Status.ToCloseToCall;
            else
                return Status.EffectivelyFinal;

        case 'Fully Reported':
            return Status.Final;
    }
}

export function statusString(status: Status): string {
    return Status[status].replace(ENUM_CAMEL_WORD_REGEX, ' $1').replace(/(?<!^)[A-Z]/g, (s) => s.toLowerCase());
}

interface CallBase {
    total_votes: number,
    margin: number,
    threshold: number
};

export interface Winner extends CallBase {
    winner: BallotOption
};

export interface Runoff extends CallBase {
    progressing: BallotOption[]
};

export interface Special extends CallBase {
    reason: string,
    msg: string
};

type Call = Winner | Runoff | Special;

function droop(total_votes: number): number {
    return Math.floor(total_votes / 2) + 1;
}

export function callRace(ballotItem: BallotItem, votes_left: number = 0): Call {
    const total_votes = totalVotes(ballotItem.ballotOptions);
    const threshold = droop(total_votes);
    const num_candidates = ballotItem.ballotOptions.length;
    ballotItem.ballotOptions.sort(candidateCompare);

    if (num_candidates === 1) {
        if (total_votes + votes_left === 0) {
            return {
                reason: 'Unopposed candidate failing to receive a single vote',
                msg: 'Under Georgia law, an unopposed candidate in a primary must receive at least one vote to be nominated. See O.C.G.A. § 21-2-158.',
                margin: 0,
                total_votes,
                threshold
            };

        } else {
            const winner = ballotItem.ballotOptions[0];
            return {
                winner,
                total_votes,
                margin: winner.voteCount,
                threshold
            };

        }

    } else {
        const a_votes = ballotItem.ballotOptions[0].voteCount;
        const b_votes = ballotItem.ballotOptions[1].voteCount;

        if (a_votes >= droop(total_votes + votes_left)) {
            return {
                winner: ballotItem.ballotOptions[0],
                total_votes,
                margin: a_votes - b_votes,
                threshold
            }

        } else {
            /// This does not respect votes_left
            const progressing = [ballotItem.ballotOptions[0], ballotItem.ballotOptions[1]];

            return {
                progressing,
                total_votes,
                margin: a_votes - b_votes,
                threshold
            }

        }

    }
}
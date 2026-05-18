import { ReportingStatus } from '../data/reporting.js';
import { BallotOption, leading, LocalReturn, totalVotes } from '../data/structures.js';

import { createInspectionGradient, EMPTY_COLOR, getColor, pickReportingColor } from '../colors.js';
import { regionIDName, regionViewBoxes } from '../regions.js';
import { makeLegend, preciseShare } from '../utils.js';
import { BorderChain } from './draw.js';
import { calculateViewBox, zoomTo, zoomToFull } from './animations.js';

export function changeSelection(groupID: string, selection: string) {
    $(`#${groupID} button.selected`).each(function () {
        $(this).removeClass('selected');
    });
    $(`#${selection}`).addClass('selected');
}

export function getNotHover() {
    const $not_hover = $('#not-hover');
    $not_hover.empty();
    return $not_hover;
}

export function showInspectionGradient(ballotOptions: BallotOption[]) {
    getNotHover().append(createInspectionGradient(ballotOptions));
}

export function showReportingKey() {
    const $not_hover = getNotHover();
    const $table = $('<table id="reporting-key"></table>');

    (['Not Reported', 'Partially Reported', 'Election Night Complete', 'Fully Reported'] as ReportingStatus[]).forEach((status) => {
        $table.append(`<tr><td style="background-color: ${pickReportingColor(status)}"></td><td>${status}</td></tr>`);
    });

    $not_hover.append($table);
}

// Regional strength (for regions and congressional districts)

export function buildRegionalStrengthBreakdown(
    localReturns: LocalReturn[],
    doNumber: boolean = false,
    doListMembers: boolean = false,
    grand_total?: number) {

    const $template = $('#reg-strength-breakdown-temp');
    const $not_hover = getNotHover();
    $not_hover.append($template.html());
    const $tbody = $not_hover.find('.reg-strength-list').first();

    if (!doNumber)
        $not_hover.find('.num-header').remove();

    if (!doListMembers)
        $not_hover.find('.members-header').remove();

    const legendLabels = makeLegend(localReturns[0].ballotItem.ballotOptions.map(bo => bo.name));

    grand_total = grand_total || totalVotes(localReturns.map(lr => lr.ballotItem.ballotOptions).flat());
    for (const i in localReturns) {
        const num = parseInt(i) + 1;
        const localReturn = localReturns[i];
        const ballotOptions = localReturn.ballotItem.ballotOptions;
        const total_votes = totalVotes(ballotOptions);

        const leader = leading(ballotOptions);
        const winning_points =
            (leader === 'Awaiting Results') ? '-'
                : (leader === 'Tie') ? '='
                    : pointDifferenceF(leader as BallotOption, ballotOptions[1], total_votes);
        const leader_name = (typeof leader === 'string') ? leader : legendLabels[leader.name];

        const votebase_share = total_votes / grand_total * 100;
        const color = (typeof leader === 'string') ? EMPTY_COLOR : getColor(ballotOptions, leader);

        /// Add list of counties
        $tbody.append(`
            <tr id="region-select-${regionIDName(localReturn.jurisName)}">
                ${(doNumber) ? `<td class="reg-brk-num">${num}</td>` : ''}
                <td class="reg-brk-name">${localReturn.jurisName}</td>
                <td class="reg-brk-leader">${leader_name}</td>
                <td class="reg-brk-points"><div style="width: 100%; padding: 5px; background-color:${color}; color: white;">${winning_points}</div></td>
                <td class="reg-brk-votebase">${preciseShare(votebase_share)}</td>
                ${(doListMembers) ? `<td title="${getMemberList(localReturn)}" class="reg-brk-members"><i class="fa-solid fa-circle-info"></i></td>` : ''}
            </tr>
        `.trim());
    }

    return localReturns;
}

function pointDifferenceF(leader: BallotOption, runnerUp: BallotOption, total_votes: number): string {
    return `+${Math.round(pointDifference(leader, runnerUp, total_votes))}`;
}

function pointDifference(leader: BallotOption, runnerUp: BallotOption, total_votes: number): number {
    const shareA = leader.voteCount / total_votes * 100;
    const shareB = runnerUp.voteCount / total_votes * 100;
    return shareA - shareB;
}

function getMemberList(localReturn: LocalReturn) {
    const names = (localReturn.members as string[]).toSorted().map(nm => nm.replace(' County', ''));
    if (names.length === 1) return names[0];
    const [body, last] = bodyAndLast(names);
    return [body.join(', '), last].join(' and ');
}

function bodyAndLast<T>(l: T[]): [T[], T] {
    return [l.slice(0, l.length - 1), l[l.length - 1]];
}

export type DivisionTree = { [key: string]: [LocalReturn[], DivisionTree | null] };

export function buildClickableRegionalBreakdown(
    theseReturns: LocalReturn[],
    nextLowerReturns: DivisionTree,
    region_border_chain: BorderChain | null,
    total_votes: number,
    doNumber?: boolean) {

    buildRegionalStrengthBreakdown(theseReturns, doNumber);
    $('#not-hover .reg-strength-click-notice').show();

    for (const regionReturn of theseReturns) {
        const regionName = regionReturn.jurisName;
        const id = regionIDName(regionName);
        const row = $(`#region-select-${id}`);
        const [theseDivisionReturns, furtherDivisions] = nextLowerReturns[regionName];

        row.css('cursor', 'pointer');
        row.off().on('click', () => {
            region_border_chain?.attr('stroke', 'black').attr('stroke-width', '2px');
            $(`svg #${id}`).attr('transform', 'translate(1000)');
            $('svg text').each(function () { $(this).hide(); });

            if (regionViewBoxes[regionName])
                zoomTo(calculateViewBox(...regionViewBoxes[regionName]));

            if (furtherDivisions) {
                buildClickableRegionalBreakdown(theseDivisionReturns, furtherDivisions, null, total_votes, true);
            } else {
                buildRegionalStrengthBreakdown(theseDivisionReturns, true, true, total_votes);
            }

            theseDivisionReturns.forEach((dr, i) => {
                const $label = $(`text#path-label-${regionIDName(dr.jurisName)}`);
                if ($label.length) $label[0].innerHTML = `${i + 1}`; else console.log('nope');
                if ($label.hasClass('awaiting-layer')) {
                    $label.removeClass('awaiting-layer');
                    $label.addClass(`label-layer-${id}`);
                }
                $label.show();
            });

            const $numHeader = $('.num-header').first();
            if ($numHeader.length) {
                const $btn = $(
                    '<button title="Back to previous level"><i class="fa-solid fa-rotate-left"></i></button>'
                );
                $btn.off('click').on('click', () => {
                    buildClickableRegionalBreakdown(theseReturns, nextLowerReturns, region_border_chain, total_votes, doNumber);
                    $numHeader.append($btn);
                    if (regionViewBoxes[regionName]) {
                        zoomToFull();
                        $numHeader.empty();
                    }
                    region_border_chain?.attr('stroke', 'white').attr('stroke-width', '1px');
                    $(`svg #${id}`).removeAttr('transform');
                    $(`svg text`).each(function () { $(this).show(); });
                });
                $numHeader.append($btn);
            }

        });
    }
}

import { getColor, nameToHex } from './colors.js';
import { withFullResults } from './data/total-votes.js';
import { BallotItem, BallotOption, candidateCompare, totalVotes, votesFor } from './data/structures.js';
import { callRace, raceStatus, Runoff, Special, Status, statusString, Winner } from './race-caller.js';
import { formatNum, preciseShare, redirectWithRaceName, updateHtml } from './utils.js';
import { ReportingGroup } from './data/structures.js';

const CAND_LIST_TEMPLATE = `
    <div class="candidate-details-holder">
        <div class="candidate-details">
            <div class="candidate-name" style="flex: 50%">

            </div>
            <div class="candidate-votes" style="flex: 20%">

            </div>
            <div class="candidate-share" style="flex: 20%">

            </div>
            <div class="candidate-tag" style="flex: 10%">

            </div>
        </div>
        <div class="bar">
            <div class="candidate-share-bar candidate-color"></div>
            <div class="candidate-color-translucent bar-butt"></div>
        </div>
    </div>
    <div class="candidate-color-box candidate-color"></div>`;

export function makeListEntry(ballotOption: BallotOption, total_votes: number, ballotItem: BallotItem, filterGroup?: ReportingGroup) {
    const $list_entry = $(`<div>${CAND_LIST_TEMPLATE}</div>`);

    $list_entry.addClass('candidate-list-entry');

    const status = raceStatus(ballotItem);
    const share = votesFor(ballotOption, filterGroup) / total_votes * 100;

    const candidate_color = getColor(ballotItem.ballotOptions, ballotOption);
    $list_entry.find('.candidate-color').each(function () {
        $(this).css('background-color', candidate_color);
    });

    $list_entry.find('.candidate-color-translucent').each(function () {
        $(this).css('background-color', `${nameToHex(candidate_color)}64`);
    });

    $list_entry.find('.candidate-name').each(function () {
        updateHtml($(this), ballotOption.name);
    });

    $list_entry.find('.candidate-votes').each(function () {
        if (status === Status.AwaitingResults)
            updateHtml($(this), 'Awaiting results');
        else
            updateHtml($(this), formatNum(votesFor(ballotOption, filterGroup)));
    });

    $list_entry.find('.candidate-share').each(function () {
        if (status === Status.AwaitingResults) {
            $(this).hide();
        } else {
            $(this).show();
            updateHtml($(this), preciseShare(share));
        }
    });

    $list_entry.find('.candidate-share-bar').each(function () {
        $(this).css('flex', `${share}%`);
    });

    return $list_entry;
}

export function setRace(ballotItem: BallotItem) {
    const rn = ballotItem.name;

    const dem = 'dem';
    const gop = 'gop';
    const np = 'np';

    const party = rn.endsWith('Dem') ? dem : rn.endsWith('Rep') ? gop : np;

    const $race_name = $('#race-name');
    const $status_indicator = $('#status-indicator');
    const $swap_party = $('#swap-party');

    updateHtml($race_name, rn);
    $race_name.removeClass(dem).removeClass(gop).removeClass(np);
    $race_name.addClass(party);

    const status = raceStatus(ballotItem);
    const call = callRace(ballotItem);
    updateHtml($status_indicator, statusString(status));
    if (Object.hasOwn(call, 'msg')) {
        updateHtml($('#status-special'), (call as Special).msg);
    } else {
        $('#status-special').empty();
    }

    /// Check whether there actually is a primary on the other side
    if (party === np) {
        $swap_party.hide();

    } else {
        $swap_party.show();

    }
    $swap_party.off('click').on('click', function () {
        const current_party = party === dem ? 'Dem' : 'Rep';
        const new_party = party === dem ? 'Rep' : 'Dem';

        const $container = $('#race-container');

        // Fade out, fetch, then fade in
        $container.css('opacity', '0.5').css('pointer-events', 'none');

        withFullResults(setRace, rn.replace(current_party, new_party))
            .then(() => {
                window.requestAnimationFrame(() => {
                    $container.css('opacity', '1').css('pointer-events', 'auto');
                });
            });
    });

    displayNonStaticData(ballotItem);

    // Filter by vote type

    buildFilterButton(ballotItem, 'filter-early-voting', 'Advance Voting');
    buildFilterButton(ballotItem, 'filter-absentee', 'Absentee by Mail');
    buildFilterButton(ballotItem, 'filter-election-day', 'Election Day');
    buildFilterButton(ballotItem, 'filter-provisional', 'Provisional');
}

function displayNonStaticData(ballotItem: BallotItem, filterGroup?: ReportingGroup) {
    const $reporting_bar_filled = $('#reporting-bar-filled');
    const $reporting_percentage = $('#reporting-percentage');
    const $candidate_list = $('#candidate-list');
    $candidate_list.empty();

    const votes_left = 0;
    const status = raceStatus(ballotItem);
    const call = callRace(ballotItem);
    const call_results = (status === Status.EffectivelyFinal || status === Status.Final) && (!filterGroup);
    const filtered_total_results = (filterGroup) ? totalVotes(ballotItem.ballotOptions, filterGroup) : call.total_votes;

    const reporting = filtered_total_results / (filtered_total_results + votes_left) * 100;
    $reporting_bar_filled.css('flex', `${reporting}%`);
    updateHtml($reporting_percentage, preciseShare(reporting));

    ballotItem.ballotOptions.sort((a, b) => candidateCompare(a, b, filterGroup));
    for (const ballotOption of ballotItem.ballotOptions) {
        const $list_entry = makeListEntry(ballotOption, filtered_total_results, ballotItem, filterGroup);

        $list_entry.find('.candidate-tag').each(function () {
            const $candidate_tag = $(this);

            if (call_results) {
                void function (call): call is Winner {
                    const is_winner = ballotOption === (call as Winner).winner;

                    if (is_winner) {
                        const $candidate_tag_won = $('#candidate-tag-won');
                        updateHtml($candidate_tag, $candidate_tag_won.html());
                        $list_entry.find('.candidate-details.holder').each(function () {
                            $(this).css('background-color', '#ffe557');
                        });
                    }

                    return is_winner;

                }(call);

                void function (call): call is Runoff {
                    const is_progressing = (call as Runoff).progressing?.includes(ballotOption);

                    if (is_progressing) {
                        const $candidate_tag_runoff = $('#candidate-tag-runoff');
                        updateHtml($candidate_tag, $candidate_tag_runoff.html());
                    }

                    return is_progressing;

                }(call);

            } else {
                $(this).hide();

            }

            if (!filterGroup) {
                void function (call): call is Runoff {
                    const share = ballotOption.voteCount / call.total_votes * 100;
                    const show = (call as Runoff).progressing?.includes(ballotOption) && share >= 45;

                    if (show) {
                        const $candidate_tag_short = $(`<div class="bar-annotation">${$('#candidate-tag-short').html()}</div>`);
                        const num_short = call.threshold - ballotOption.voteCount;
                        updateHtml($candidate_tag_short.find('.more-to-avoid-runoff'), formatNum(num_short));
                        $list_entry.find('.bar-butt').append($candidate_tag_short);
                    }

                    return show;

                }(call);
            }
        });

        $candidate_list.append($list_entry);
    }

    const $blank_votes_indicator = $('#blank-votes-indicator');
    const $blank_votes_share = $('#blank-votes-share');
    const $total_votes_indicator = $('#total-votes-indicator');
    //const $dem_turnout = $('#dem-turnout');

    if (ballotItem.ballotsCast && !filterGroup) {
        const blank_votes = (ballotItem.ballotsCast as number) - call.total_votes;
        const blank_share = blank_votes / (ballotItem.ballotsCast as number) * 100;

        updateHtml($blank_votes_indicator, formatNum(blank_votes));
        updateHtml($blank_votes_share, preciseShare(blank_share));
        $blank_votes_share.show();

    } else {
        updateHtml($blank_votes_indicator, '-');
        $blank_votes_share.hide();
    }

    updateHtml($total_votes_indicator, formatNum(filtered_total_results));
}

function buildFilterButton(ballotItem: BallotItem, id: string, filterGroup: ReportingGroup) {
    const $filter_note = $('#filter-note');

    $(`#${id}`).off('click').on('click', function () {
        if ($(this).hasClass('selected')) {
            $(this).removeClass('selected');
            displayNonStaticData(ballotItem);
            $filter_note.hide();

        } else {
            if ($('.selected')) $('.selected').removeClass('selected');
            $(this).addClass('selected');
            displayNonStaticData(ballotItem, filterGroup);
            updateHtml($filter_note, `Showing ${filterGroup} only`);
            $filter_note.show();

        }
    });
}

void function () {
    $('#map').on('click', () => redirectWithRaceName('./map.html', $('#race-name').html()));
    $('#marimekko').on('click', () => redirectWithRaceName('./marimekko.html', $('#race-name').html()));
    $('#progress-tracker').on('click', () => redirectWithRaceName('./progress.html', $('#race-name').html()));
}();

import { regions, findRegion, regionIDName } from './regions.js';
import { candidateLegend, getColor } from './colors.js';
import { createJQuerySVG, setupAbstract } from './utils.js';

import { withLocalResults } from './data/media-export.js';
import { BallotOption, totalVotes, LocalGroup, votesForCandidate, LocalReturn, candidateCompare, isStateWide, getPrecinctReturns } from './data/structures.js';

function updateMarimekko(localReturns: LocalReturn[]) {
    const width_ratio = (window.outerWidth <= 640) ? 0.85 : 0.95;
    const width_coefficient = ($('svg').width() || 1600) * width_ratio;
    const height_coefficient = ($('svg').height() || 600) * 0.85;

    const statewide = isStateWide(localReturns);
    const groupedReturns =
        (statewide)
            ? groupByRegion(localReturns)
            : groupByCounty(localReturns);

    $('#unit').html((statewide) ? 'county' : 'precinct');

    const candidates = groupedReturns.map(gr => gr.returns).flat().map(lr => lr.ballotItem.ballotOptions).flat()
        .reduce((acc: BallotOption[], ballotOption: BallotOption) => {
            const bo1 = acc.find(bo1 => bo1.name == ballotOption.name);
            if (!bo1) { acc.push({ ...ballotOption }); return acc; }
            bo1.voteCount += ballotOption.voteCount;
            return acc;
        }, []);
    candidateLegend(candidates);
    candidates.sort(candidateCompare);
    if (candidates.length > 1) {
        // Bring runner up to end of list.
        candidates.push(candidates.splice(1, 1)[0]);
    }
    const total_votes = totalVotes(candidates);

    const $parent = $('#counties');
    const $group_borders = $('#group-borders');
    const $header = $('#mg-header');
    const $footer = $('#mg-footer');
    const header_height = 25;

    const shift = 1.5;
    let gx = 0;

    $('#graph').attr('transform', `translate(${shift}, ${header_height + shift})`);

    groupedReturns.map((localGroup: LocalGroup) => {
        const group_border = createJQuerySVG(`<rect x="${gx}" y="0" height="${height_coefficient}" title="${localGroup.name}"></rect>`);
        $group_borders.append(group_border);

        const group_header = createJQuerySVG(`<text x="${gx}" y="25" style="font-weight: bold;" id="${regionIDName(localGroup.name)}"></text>`);
        group_header.innerHTML = localGroup.name.replace(/ (County|Georgia)/, '');
        $header.append(group_header);

        localGroup.returns.sort((a, b) => (votesForCandidate(candidates[0], a.ballotItem) / totalVotes(a.ballotItem.ballotOptions))
            - (votesForCandidate(candidates[0], b.ballotItem) / totalVotes(b.ballotItem.ballotOptions)));

        let group_width = 0;
        for (let local of localGroup.returns) {
            const g = createJQuerySVG(`<g transform="translate(${gx}, 0)" class="county-g"></g>`);
            const total_votes_local = totalVotes(local.ballotItem.ballotOptions);
            const width = (total_votes_local / total_votes * width_coefficient) || 0;

            if (width === 0) continue;

            group_width += width;
            let y = 0;
            for (let i = 0; i < candidates.length; i++) {
                const candidate = candidates[i];
                let candidate_votes = votesForCandidate(candidate, local.ballotItem);
                let color = getColor(candidates, candidate);
                const height = candidate_votes / total_votes_local * height_coefficient;
                const rect = createJQuerySVG(`<rect x="0" y="${y}" width="${width}" height="${height}" fill="${color}"></rect>`);
                $(g).append(rect);
                y += height;
            }

            $parent.append(g);

            const label_x = gx + (width / 2);
            const unit_label = createJQuerySVG(`<g transform="translate(${label_x}, 5)" style="display: none;"></g>`);
            const label_text = createJQuerySVG('<text transform="rotate(90)"></text>');
            label_text.innerHTML = (statewide) ? local.jurisName.replace(' County', '') : local.jurisName.replace(/.* - /, '');
            unit_label.append(label_text);
            $footer.append(unit_label);

            $(g).on('mouseover', function () {
                $(unit_label).show();
            }).on('mouseout', function () {
                $(unit_label).hide();
            });

            gx += width;
        }

        $(group_border).attr('width', group_width);

        if ((group_header as SVGTextContentElement).getComputedTextLength() >= group_width) {
            $(group_header).hide();
        }
    });

    $footer.attr('transform', `translate(${shift}, ${header_height + height_coefficient})`);

    // Markings
    const $markings = $('#markings');
    const $line_labels = $('#line-labels');
    const num_markings = 10;
    const marking_e = height_coefficient / num_markings;
    let w = Math.round(width_coefficient * 1.01);
    for (let i = 1; i < num_markings; i++) {
        let y = Math.round(i * marking_e);
        let share = Math.round(i / num_markings * 100);
        const $line = createJQuerySVG(`<path d="m0 ${y}h${w}"></path>`);
        const $label = createJQuerySVG(`<text x="${w + 2}" y="${y}"></text>`);
        $label.innerHTML = `${share}%`;
        $markings.append($line);
        $line_labels.append($label);
    }
}

function groupByRegion(localReturns: LocalReturn[]): LocalGroup[] {
    return localReturns.reduce((acc: LocalGroup[], local) => {
        const group_name = findRegion(regions, local.jurisName);
        const group = acc.find(region => region.name == group_name);
        if (!group) { acc.push({ name: group_name, returns: [local] }); return acc; }
        group.returns.push(local);
        return acc;

    }, [])
}

function groupByCounty(localReturns: LocalReturn[]): LocalGroup[] {
    return localReturns.map(lr => { return { name: lr.jurisName, returns: getPrecinctReturns([lr]) }; });
}

// Entrypoint 

void function () {
    const [race_name, county] = setupAbstract();

    if (race_name) withLocalResults(updateMarimekko, race_name, county || undefined);
}();
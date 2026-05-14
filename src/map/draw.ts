import { getColor, gradientPick } from '../colors.js';
import { candidateCompare, LocalReturn, totalVotes } from '../data/structures.js';
import { makeListEntry } from '../race.js';

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import * as topojson from 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm';

export function drawMap(topology: any, localReturns: LocalReturn[], border_topology?: any): [LocalReturn[], any, any] {
    const width = $('svg').width();
    const height = $('svg').height();

    topology.objects.paths.geometries = topology.objects.paths.geometries.filter((d: any) => findLocalReturn(localReturns, d));

    const paths = topojson.feature(topology, topology.objects.paths);
    const borders = topojson.mesh((border_topology || topology), (border_topology || topology).objects.paths, (a, b) => a !== b);

    const svg = d3.select('svg');
    svg.selectAll('*').remove();
    const projection = d3.geoMercator().fitSize([width, height], paths);
    const path = d3.geoPath(projection);

    const path_chain = svg.selectAll('path.paths')
        .data(paths.features)
        .join('path')
        .attr('class', 'hoverable')
        .attr('d', path);

    const border_chain = svg.selectAll('path.borders')
        .data([borders])
        .join('path')
        .attr('class', 'no-end-hover')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', 'white');

    // Hover

    let pause_hover = false;
    const $candidate_list_mini = $('#candidate-list-mini');

    function restoreBeforeHover() {
        $candidate_list_mini.empty();
        $('#not-hover').show();
    }

    function switchHover(d: TopoJsonObject) {
        const target_name = (typeof d.properties.name === 'number'
            || d.properties.name.replace(/[0-9]+/, '').length === 0)
            ? `District ${d.properties.name}`
            : d.properties.name
        $candidate_list_mini.append(`<h2>${target_name}</h2>`);

        const localReturn = findLocalReturn(localReturns, d);
        if (!localReturn) return;
        const ballotItem = localReturn.ballotItem;
        const total_votes = totalVotes(ballotItem.ballotOptions);
        $('#not-hover').hide();
        ballotItem.ballotOptions
            .toSorted(candidateCompare)
            .map(bo => makeListEntry(bo, total_votes, ballotItem))
            .map($list_entry => $candidate_list_mini.append($list_entry));
    }

    svg.on('mouseover', (event: any) => {
        const target = d3.select(event.target);

        if (target.classed('hoverable') && !pause_hover) {
            switchHover(target.data()[0]);
        }

    }).on('mouseout', () => {
        if (!pause_hover) {
            restoreBeforeHover();
        }

    }).on('click', (event: any) => {
        const target = d3.select(event.target);

        if (target.classed('hoverable')) {
            pause_hover = true;
            $candidate_list_mini.empty();
            switchHover(target.data()[0]);

        } else {
            pause_hover = false;
            restoreBeforeHover();
        }
    });

    $('#not-hover').empty();

    return [localReturns, path_chain, border_chain]

}

export function findLocalReturn(localReturns: LocalReturn[], d: TopoJsonObject) {
    let name = d.properties.name;
    if (typeof name === 'number') {
        name = `${name}`;
    }
    return localReturns.find(lr => lr.countyName.replace(' County', '').toLowerCase() === name.toLowerCase());
}

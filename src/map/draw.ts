import { candidateCompare, LocalReturn, totalVotes } from '../data/structures.js';
import { makeListEntry } from '../race.js';
import { regionIDName } from '../regions.js';

import * as d3 from 'd3';
import * as topojson from 'topojson-client';

type Feature = GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>;
type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>;
export type PathChain = d3.Selection<d3.BaseType | SVGPathElement, GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>, d3.BaseType, unknown>;
export type BorderChain = d3.Selection<d3.BaseType | SVGPathElement, GeoJSON.MultiLineString, d3.BaseType, unknown>

function pathName(d: Feature | TopoJSON.GeometryObject): string {
    const properties: any = d.properties;
    if (!properties) {
        console.warn('A TopoJSON feature does not have properties!');
        return 'Unnamed feature';
    }
    return `${properties['name']}`;
}

export function drawMap(topology: TopoJSON.Topology, localReturns: LocalReturn[], border_topology?: any, noClear?: boolean, doLabel?: boolean): [LocalReturn[], PathChain, BorderChain] {
    const width = $('svg').width() as number;
    const height = $('svg').height() as number;

    topology = structuredClone(topology);

    const paths = topojson.feature(topology, topology.objects.paths) as FeatureCollection;
    paths.features = paths.features.filter(d => findLocalReturn(localReturns, d));
    paths.features.forEach(d => (d.properties ||= {}).return = findLocalReturn(localReturns, d));
    const borders = topojson.mesh(
        (border_topology || topology),
        (border_topology || topology).objects.paths,
        (a, b) => (a !== b) && (!!border_topology || (!!findLocalReturn(localReturns, a) && !!findLocalReturn(localReturns, b))));

    const svg = d3.select('svg');
    if (!noClear)
        svg.selectAll('*').remove();
    const projection = d3.geoMercator().fitSize([width, height], paths);
    const path = d3.geoPath(projection);

    const path_chain = svg.selectAll('path.paths')
        .data(paths.features)
        .join('path')
        .attr('id', d => regionIDName(pathName(d)))
        .attr('class', 'hoverable')
        .attr('d', path);

    const border_chain = svg.selectAll('path.borders')
        .data([borders])
        .join('path')
        .attr('class', 'no-end-hover')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', 'white');

    if (doLabel) {
        for (const d of paths.features) {
            const [x, y] = path.centroid(d);
            svg.append('text')
                .attr('x', x)
                .attr('y', y)
                .attr('id', `path-label-${regionIDName(pathName(d))}`);
        }
    }

    // Hover

    let pause_hover = false;
    const $candidate_list_mini = $('#candidate-list-mini');

    function restoreBeforeHover() {
        $candidate_list_mini.empty();
        $('#not-hover').show();
    }

    function switchHover(d: Feature) {
        const localReturn = d.properties?.return as LocalReturn;
        const ballotItem = localReturn.ballotItem;

        const target_name = (typeof pathName(d) === 'number'
            || pathName(d).replace(/[0-9]+/, '').length === 0)
            ? `District ${pathName(d)}`
            : pathName(d)
        $candidate_list_mini.append(`<h2>${target_name}</h2>`);
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
            switchHover(target.data()[0] as Feature);
        }

    }).on('mouseout', () => {
        if (!pause_hover) {
            restoreBeforeHover();
        }

    }).on('click', (event: any) => {
        const target = d3.select(event.target);

        if (target.classed('hoverable') && event.detail === 1) {
            pause_hover = true;
            $candidate_list_mini.empty();
            switchHover(target.data()[0] as Feature);

        } else {
            pause_hover = false;
            restoreBeforeHover();
        }
    });


    $('#not-hover').empty();

    return [localReturns, path_chain, border_chain]
}

export function findLocalReturn(localReturns: LocalReturn[], d: Feature | TopoJSON.GeometryObject) {
    let name = pathName(d);
    if (typeof name === 'number') {
        name = `${name}`;
    }

    return localReturns.find(lr => lr.jurisName.replace(' County', '').toLowerCase() === name.toLowerCase());
}

export async function fetchTopography(path: string) {
    return fetch(path, {
        cache: 'force-cache'
    }).then(r => r.json());
}
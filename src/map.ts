import { withLocalResults } from './data/media-export.js';
import { County, getPrecinctReturns, isStateWide, LocalReturn, totalVotes } from './data/structures.js';

import { divisionsIn, getRegionReturns, metroATLDivisionsIn, regions } from './regions.js';
import { queryCounty, queryRace, redirectWithRaceName, toObject } from './utils.js';
import divisions from './divisions.json';
import metroDivs from './metro-divs.json';

import { drawMap, fetchTopography } from './map/draw.js';
import { buildClickableRegionalBreakdown, changeSelection, DivisionTree, showInspectionGradient, showReportingKey } from './map/side.js';
import { recolorMap } from './map/color-map.js';
import { calculateViewBox, zoomTo, zoomToFull } from './map/animations.js';
import { setUpProjection, STATE_HOUSE, STATE_SENATE } from './map/projections.js';

import * as d3 from 'd3';

function recolorWorker([localReturns, path_chain, border_chain]: [LocalReturn[], any, any]) {
    return recolorMap(localReturns, path_chain);
}

async function updateWithRegions(race_name: string) {
    const topology = await fetchTopography('src/topo/GA-REGION.json');
    return withLocalResults(localReturns => {
        const regionReturns = getRegionReturns(regions, localReturns);
        const divisionReturns = getRegionReturns(divisions, localReturns);
        const metroATLCountyReturns = localReturns.filter(lr => regions['Metro Atlanta'].includes(lr.jurisName.replace(/ County$/, '')));
        const metroDivReturns = getRegionReturns(metroDivs, getPrecinctReturns(metroATLCountyReturns));

        regionReturns.sort((a, b) => Object.keys(regions).indexOf(a.jurisName) - Object.keys(regions).indexOf(b.jurisName));
        divisionReturns.sort((a, b) => Object.keys(divisions).indexOf(a.jurisName) - Object.keys(divisions).indexOf(b.jurisName));
        metroDivReturns.sort((a, b) => Object.keys(metroDivs).indexOf(a.jurisName) - Object.keys(metroDivs).indexOf(b.jurisName));

        const divisionTree: DivisionTree = toObject(
            Object.keys(regions),
            regionReturns.map(rr => [divisionReturns.filter(dr => divisionsIn[rr.jurisName].includes(dr.jurisName)), null])
        );
        divisionTree['Metro Atlanta'][1] = toObject(
            divisionTree['Metro Atlanta'][0].map(dr => dr.jurisName),
            divisionTree['Metro Atlanta'][0].map(dr => [metroDivReturns.filter(mdr => metroATLDivisionsIn[dr.jurisName].includes(mdr.jurisName)), null])
        );

        drawMap(topology, metroDivReturns, null, false, true);
        drawMap(topology, divisionReturns, null, true, true);
        const [, , region_border_chain] = drawMap(topology, regionReturns, null, true);

        recolorMap([...regionReturns, ...divisionReturns, ...metroDivReturns], d3.select('svg').selectAll('path.hoverable'));
        const total_votes = totalVotes(divisionReturns.map(dr => dr.ballotItem.ballotOptions).flat());
        buildClickableRegionalBreakdown(regionReturns, divisionTree, region_border_chain, total_votes);
    }, race_name);
}

async function updateWithCounties(race_name: string, county?: string) {
    const topology = await fetchTopography('src/topo/GA-COUNTIES.json');
    return withLocalResults(localReturns => drawMap(topology, localReturns, null, false, false, true), race_name, county)
        .then(recolorWorker);
}

async function updateWithPrecincts(race_name: string, county?: string) {
    const topology = await fetchTopography('src/topo/GA-PRECINCTS.json');
    topology.objects.paths.geometries.map((path: any) =>
        path.properties.name = `${path.properties.COUNTY} - ${path.properties.PRECINCT_N}`);
    const county_topology = await fetchTopography('src/topo/GA-COUNTIES.json');
    return withLocalResults(localReturns => drawMap(topology, getPrecinctReturns(localReturns), county_topology, false, false, true), race_name, county)
        .then(recolorWorker);
}

async function checkIfShowInspectionGradient(localReturns: LocalReturn[]) {
    if ($('#map-toggle .selected').attr('id') === 'set-shade')
        showInspectionGradient(localReturns[0].ballotItem.ballotOptions);
    else if ($('#map-toggle .selected').attr('id') === 'set-reporting')
        showReportingKey();
    else
        $('#not-hover').empty();
}

// Set up sidebar

function setUpSidebar(race_name: string, countyReturns: LocalReturn[], county?: string) {
    $('#metro-zoom').on('click', function () {
        if ($(this).hasClass('selected')) {
            $(this).removeClass('selected');
            zoomToFull();

        } else {
            $(this).addClass('selected');
            zoomTo(calculateViewBox(0.270, 0.1513, 0.0578, 0.2306));

        }
    });

    $('#go-back').on('click', function () {
        redirectWithRaceName('./race.html', race_name, county);
    });

    if (isStateWide(countyReturns)) {
        $('#set-region').off().on('click', function () {
            updateWithRegions(race_name);
            changeSelection('map-geo', 'set-region');
            $('#warn-projections').hide();
        });

        $('#set-cd').off().on('click', function () {
            setUpProjection(race_name, 'src/topo/GA-CD.json', 'set-cd',
                {
                    temp: clipGroupTemplate(d => `US House of Representatives - District ${d}`),
                    maxDistricts: 14
                });
        });

        $('#set-sd').off().on('click', function () {
            setUpProjection(race_name, 'src/topo/GA-SD.json', 'set-sd',
                {
                    temp: clipGroupTemplate(d => `State Senate - District ${d}`),
                    maxDistricts: 56,
                    chamberReference: STATE_SENATE
                });
        });

        $('#set-hd').off().on('click', function () {
            setUpProjection(race_name, 'src/topo/GA-HD.json', 'set-hd',
                {
                    temp: clipGroupTemplate(d => `State House of Representatives - District ${d}`),
                    maxDistricts: 180,
                    chamberReference: STATE_HOUSE
                });
        });

    } else {
        $('#metro-zoom, #set-region, #set-cd, #set-sd, #set-hd').each(function () {
            $(this).addClass('disabled');
            $(this).off('click');
        });
    }

    $('#set-county').off().on('click', function () {
        updateWithCounties(race_name, county).then(checkIfShowInspectionGradient);
        changeSelection('map-geo', 'set-county');
        $('#warn-projections').hide();
    });

    $('#set-precinct').off().on('click', function () {
        updateWithPrecincts(race_name, county).then(checkIfShowInspectionGradient);
        changeSelection('map-geo', 'set-precinct');
        $('#warn-projections').hide();
    });
}

function clipGroupTemplate(temp: (district: number) => string): (counties: County[], district: number) => string {
    return function (counties, district) {
        const dem = `${temp(district)} - Dem`;
        const rep = `${temp(district)} - Rep`;
        const race_names = counties.map(c => c.ballotItems).flat().map(bi => bi.name);
        return (race_names.includes(dem)) ? dem : rep;
    }
}

// Entry point

void function () {
    const race_name = queryRace();
    const county = queryCounty();

    if (!race_name) {
        failMessage();
        return;
    }

    $('#race-name-map').html(race_name);

    $('svg').attr('viewBox', Object.values(calculateViewBox(0, 0, 1, 1)).join(' '));

    updateWithCounties(race_name, county || undefined)
        .then(countyReturns => setUpSidebar(race_name, countyReturns, county || undefined))
        .catch(failMessage);

}();

function failMessage() {
    $('#core-container').html('<p>Selected race not recognized.</p>');
}

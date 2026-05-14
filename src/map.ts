
import { withLocalResults } from './data/media-export.js';
import { County, getPrecinctReturns, isStateWide, LocalReturn } from './data/structures.js';

import { getRegionReturns, regionIDName, regions } from './regions.js';
import { queryRace, redirectWithRaceName } from './utils.js';

import { drawMap, fetchTopography } from './map/draw.js';
import { buildRegionalStrengthBreakdown, changeSelection, showInspectionGradient, showReportingKey } from './map/side.js';
import { recolorMap } from './map/color-map.js';
import { calculateViewBox } from './map/animations.js';
import { setUpProjection, STATE_HOUSE, STATE_SENATE } from './map/projections.js';

function recolorWorker([localReturns, path_chain, border_chain]: [LocalReturn[], any, any]) {
    return recolorMap(localReturns, path_chain, border_chain);
}

async function updateWithRegions(race_name: string) {
    const topology = await fetchTopography('src/topo/GA-REGION.json');
    return withLocalResults(localReturns => {
        localReturns = getRegionReturns(regions, localReturns);
        localReturns.sort((a, b) => Object.keys(regions).indexOf(a.countyName) - Object.keys(regions).indexOf(b.countyName));
        return drawMap(topology, localReturns);
    }, race_name)
        .then(recolorWorker)
        .then(localReturns => buildRegionalStrengthBreakdown(localReturns))
        .then(localReturns => {
            for (let localReturn of localReturns) {
                const id = regionIDName(localReturn.countyName);
                const row = $(`#${id}`);
                row.css('cursor', 'pointer');
            }
        });
}

async function updateWithDivisions(race_name: string) {

}

async function updateWithCounties(race_name: string) {
    const topology = await fetchTopography('src/topo/GA-COUNTIES.json');
    return withLocalResults(localReturns => drawMap(topology, localReturns), race_name)
        .then(recolorWorker);
}

async function updateWithPrecincts(race_name: string) {
    const topology = await fetchTopography('src/topo/GA-PRECINCTS.json');
    topology.objects.paths = { geometries: topology.objects.objects.geometries, type: 'GeometryCollection' };
    topology.objects.paths.geometries.map((path: any) => path.properties.name = `${path.properties.COUNTY} - ${path.properties.PRECINCT_N}`);
    const county_topology = await fetchTopography('src/topo/GA-COUNTIES.json');
    return withLocalResults(localReturns => drawMap(topology, getPrecinctReturns(localReturns), county_topology), race_name)
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

function setUpSidebar(race_name: string, countyReturns: LocalReturn[]) {
    $('#metro-zoom').on('click', function () {
        if ($(this).hasClass('selected')) {
            $(this).removeClass('selected');
            $('svg').removeAttr('viewBox');

        } else {
            $(this).addClass('selected');
            $('svg').attr('viewBox', calculateViewBox(0.270, 0.1513, 0.0578, 0.2306));

        }
    });

    $('#go-back').on('click', function () {
        redirectWithRaceName('./race.html', race_name);
    });

    if (isStateWide(countyReturns)) {
        $('#set-region').on('click', function () {
            updateWithRegions(race_name);
            changeSelection('map-geo', 'set-region');
            $('#warn-projections').hide();
        });

        $('#set-cd').on('click', function () {
            setUpProjection(race_name, 'src/topo/GA-CD.json', 'set-cd',
                {
                    temp: clipGroupTemplate(d => `US House of Representatives - District ${d}`),
                    maxDistricts: 14
                });
        });

        $('#set-sd').on('click', function () {
            setUpProjection(race_name, 'src/topo/GA-SD.json', 'set-sd',
                {
                    temp: clipGroupTemplate(d => `State Senate - District ${d}`),
                    maxDistricts: 56,
                    chamberReference: STATE_SENATE
                });
        });

        $('#set-hd').on('click', function () {
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

    $('#set-county').on('click', function () {
        updateWithCounties(race_name).then(checkIfShowInspectionGradient);
        changeSelection('map-geo', 'set-county');
        $('#warn-projections').hide();
    });

    $('#set-precinct').on('click', function () {
        updateWithPrecincts(race_name).then(checkIfShowInspectionGradient);
        changeSelection('map-geo', 'set-precinct');
        $('#warn-projections').hide();
    });

    /*$('#test-button').on('click', function () {
        $('svg').each(function () {
            $(this).attr('viewBox', calculateViewBox(100 / DEFAULT_WIDTH, 100 / DEFAULT_HEIGHT, DEFAULT_WIDTH_RATIO, DEFAULT_HEIGHT_RATIO));
        });
    });*/
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

    if (!race_name) {
        failMessage();
        return;
    }

    updateWithCounties(race_name)
        .then(countyReturns => setUpSidebar(race_name, countyReturns))
        .catch(failMessage);

}();

function failMessage() {
    $('#core-container').html('<p>Selected race not recognized.</p>');
}

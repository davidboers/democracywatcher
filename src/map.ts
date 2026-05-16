// `npx webpack` to compile

import { withLocalResults } from './data/media-export.js';
import { County, getPrecinctReturns, isStateWide, LocalReturn, totalVotes } from './data/structures.js';

import { divisions, divisionsIn, getRegionReturns, regionIDName, regions, regionViewBoxes } from './regions.js';
import { queryRace, redirectWithRaceName } from './utils.js';

import { BorderChain, drawMap, fetchTopography, PathChain } from './map/draw.js';
import { buildRegionalStrengthBreakdown, changeSelection, showInspectionGradient, showReportingKey } from './map/side.js';
import { recolorMap } from './map/color-map.js';
import { calculateViewBox, zoomTo, zoomToFull } from './map/animations.js';
import { setUpProjection, STATE_HOUSE, STATE_SENATE } from './map/projections.js';

function recolorWorker([localReturns, path_chain, border_chain]: [LocalReturn[], any, any]) {
    return recolorMap(localReturns, path_chain, border_chain);
}

async function updateWithRegions(race_name: string) {
    const topology = await fetchTopography('src/topo/GA-REGION.json');
    return withLocalResults(localReturns => {
        const regionReturns = getRegionReturns(regions, localReturns);
        const divisionReturns = getRegionReturns(divisions, localReturns);
        regionReturns.sort((a, b) => Object.keys(regions).indexOf(a.jurisName) - Object.keys(regions).indexOf(b.jurisName));
        divisionReturns.sort((a, b) => Object.keys(divisions).indexOf(a.jurisName) - Object.keys(divisions).indexOf(b.jurisName));
        const [, division_path_chain, division_border_chain] = drawMap(topology, divisionReturns, null, false, true);
        recolorMap(divisionReturns, division_path_chain, division_border_chain);
        const [, region_path_chain, region_border_chain] = drawMap(topology, regionReturns, null, true);
        recolorMap(regionReturns, region_path_chain, region_border_chain);
        buildClickableRegionalBreakdown(regionReturns, divisionReturns, region_border_chain, division_path_chain);
    }, race_name);
}

function buildClickableRegionalBreakdown(regionReturns: LocalReturn[], divisionReturns: LocalReturn[], region_border_chain: BorderChain, division_path_chain: PathChain) {
    const total_votes = totalVotes(divisionReturns.map(dr => dr.ballotItem.ballotOptions).flat());

    buildRegionalStrengthBreakdown(regionReturns);

    for (const regionReturn of regionReturns) {
        const regionName = regionReturn.jurisName;
        const id = regionIDName(regionName);
        const row = $(`#region-select-${id}`);
        const theseDivisionReturns = divisionReturns.filter(dr => divisionsIn[regionName].includes(dr.jurisName));

        row.css('cursor', 'pointer');
        row.off().on('click', () => {
            region_border_chain.attr('stroke', 'black').attr('stroke-width', '2px');
            $(`svg #${regionIDName(regionName)}`).attr('transform', 'translate(1000)');
            zoomTo(calculateViewBox(...regionViewBoxes[regionName]));
            buildRegionalStrengthBreakdown(theseDivisionReturns, true, true, total_votes);
            theseDivisionReturns.forEach((dr, i) => {
                const $label = $(`text#path-label-${regionIDName(dr.jurisName)}`);
                if ($label.first()) $label[0].innerHTML = `${i + 1}`; else console.log('nope');
            });

            $('.num-header').first()
                .html('<button><i class="fa-solid fa-rotate-left"></i></button>')
                .off('click')
                .on('click', () => {
                    buildClickableRegionalBreakdown(regionReturns, divisionReturns, region_border_chain, division_path_chain);
                    zoomToFull();
                    region_border_chain.attr('stroke', 'white').attr('stroke-width', '1px');
                    $(`svg #${id}`).removeAttr('transform');
                });
        });
    }
}

async function updateWithCounties(race_name: string) {
    const topology = await fetchTopography('src/topo/GA-COUNTIES.json');
    return withLocalResults(localReturns => drawMap(topology, localReturns), race_name)
        .then(recolorWorker);
}

async function updateWithPrecincts(race_name: string) {
    const topology = await fetchTopography('src/topo/GA-PRECINCTS.json');
    topology.objects.paths = { geometries: topology.objects.objects.geometries, type: 'GeometryCollection' };
    topology.objects.paths.geometries.map((path: any) =>
        path.properties.name = `${path.properties.COUNTY} - ${path.properties.PRECINCT_N}`);
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
            zoomToFull();

        } else {
            $(this).addClass('selected');
            zoomTo(calculateViewBox(0.270, 0.1513, 0.0578, 0.2306));

        }
    });

    $('#go-back').on('click', function () {
        redirectWithRaceName('./race.html', race_name);
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
        updateWithCounties(race_name).then(checkIfShowInspectionGradient);
        changeSelection('map-geo', 'set-county');
        $('#warn-projections').hide();
    });

    $('#set-precinct').off().on('click', function () {
        updateWithPrecincts(race_name).then(checkIfShowInspectionGradient);
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

    if (!race_name) {
        failMessage();
        return;
    }

    $('svg').attr('viewBox', Object.values(calculateViewBox(0, 0, 1, 1)).join(' '));

    updateWithCounties(race_name)
        .then(countyReturns => setUpSidebar(race_name, countyReturns))
        .catch(failMessage);

}();

function failMessage() {
    $('#core-container').html('<p>Selected race not recognized.</p>');
}

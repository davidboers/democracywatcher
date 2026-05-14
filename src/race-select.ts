import { BallotItem, County, findBallotItem, isIncumbentTrailing, totalVotes } from './data/structures.js';
import * as MediaExport from './data/media-export.js';
import * as TotalVotes from './data/total-votes.js';
import { callRace, Runoff } from './race-caller.js';
import { setRace } from './race.js';
import { queryCounty, queryRace } from './utils.js';

interface PanelSection {
    name: PanelSectionName,
    partisan: boolean,
    races: PartyItems | BallotItem[]
};

type PartyItems = { [party: string]: BallotItem[] };

type PanelSectionName
    = 'Congressional' | 'Statewide officers' | 'State Senate' | 'State House of Representatives'
    | 'Georgia Supreme Court' | 'Georgia Court of Appeals' | 'Superior courts' | 'District attornies'
    | 'Party questions'
    | 'County executives' | 'County Commission' | 'Board of Education'
    | 'State Court' | 'Chief Magistrate' | 'Juvenile Court Judge'
    | 'Local referenda'
    | 'Other local races';

const STATE_LEVEL_SECTIONS = ['Congressional', 'Statewide officers', 'State Senate', 'State House of Representatives',
    'Georgia Supreme Court', 'Georgia Court of Appeals', 'Superior courts', 'District attornies', 'Party questions']

const STATEWIDE_OFFICERS = ['Governor', 'Lieutenant Governor', 'Secretary of State', 'Attorney General', 'Commissioner of Agriculture',
    'Commissioner of Insurance', 'State School Superintendent', 'Commissioner of Labor', 'PSC'];

function sortIntoSection(ballotItem: BallotItem): PanelSectionName {
    const testPrefixes = (qs: string[]) => qs.filter(q => ballotItem.name.startsWith(q)).length > 0;

    if (testPrefixes(['US Senate', 'US House']))
        return 'Congressional';

    if (testPrefixes(STATEWIDE_OFFICERS))
        return 'Statewide officers';

    if (ballotItem.name.startsWith('State Senate'))
        return 'State Senate';

    if (ballotItem.name.startsWith('State House'))
        return 'State House of Representatives';

    if (ballotItem.name.startsWith('Justice - Supreme Court of Georgia'))
        return 'Georgia Supreme Court';

    if (ballotItem.name.startsWith('Judge - Court of Appeals of Georgia'))
        return 'Georgia Court of Appeals';

    if (ballotItem.name.startsWith('Judge - Superior Court'))
        return 'Superior courts';

    if (ballotItem.name.startsWith('District Attorney'))
        return 'District attornies';

    if (ballotItem.name.startsWith('Party Question'))
        return 'Party questions';

    if (testPrefixes(['Solicitor General', 'State Court Solicitor', 'Solicitor-General']))
        return 'County executives';

    if (testPrefixes(['County Commission']))
        return 'County Commission';

    if (testPrefixes(['Board of Education', 'BOE', 'County BOE']))
        return 'Board of Education';

    if (testPrefixes(['State Court', 'Judge, State Court']))
        return 'State Court';

    if (testPrefixes(['Chief Magistrate']))
        return 'Chief Magistrate';

    if (testPrefixes(['Juvenile Court Judge']))
        return 'Juvenile Court Judge';

    if (testPrefixes(['ESPLOST', 'Homestead Exemption', 'City of Lawrenceville Annexation']))
        return 'Local referenda';

    return 'Other local races';
}

function getParty(ballotItem: BallotItem): string | void {
    if (ballotItem.name.endsWith('Dem')) return 'dem';
    if (ballotItem.name.endsWith('Rep')) return 'gop';
}

function getButtonName(name: string) {
    name = name.replace(/ - (Dem|Rep)/, ''); // Strip party labels

    switch (name) {
        case 'Lieutenant Governor':
            return 'LG';

        case 'Secretary of State':
            return 'SoS';

        case 'Attorney General':
            return 'AG';
    }

    let port;
    if (port = /Commissioner of ([A-Za-z]+)/.exec(name))
        return `${port[1]} Commissioner`;

    let district;
    if (district = /US House of Representatives - District ([0-9]+)/.exec(name))
        return `CD${district[1]}`;

    if (district = /State House of Representatives - District ([0-9]+)/.exec(name))
        return `HD${district[1]}`;

    if (district = /State Senate - District ([0-9]+)/.exec(name))
        return `SD${district[1]}`;

    if (district = /PSC - District ([0-9]+)/.exec(name))
        return `PSC${district[1]}`;

    let circuit;
    if (circuit = /District Attorney - (.*) Judicial Circuit/.exec(name))
        return circuit[1];

    let office;
    if (office = /(Solicitor-?General).*/.exec(name)) {
        return office[1];
    }

    if (name === 'County Commission Chairperson')
        return 'Chairperson';

    if (district = /County (?:BOE|Commission(?:er)?) - District ([0-9]+)/.exec(name))
        return `District ${district[1]}`;

    let court;
    let incumbent_judge;
    if (incumbent_judge = /(?:Justice|Judge) - (?:Supreme Court|Court of Appeals) of Georgia \((.*)\)/.exec(name))
        return incumbent_judge[1];

    let results
    if (results = /Judge(?: -|,)(?:.* County)? (?:Superior|State) Court - (.*) Judicial Circuit \((.*)\)/.exec(name)) {
        [, court, incumbent_judge] = results;
        return incumbent_judge;
    }

    return name;
}

function makeButtonFor(ballotItem: BallotItem): JQuery<HTMLElement> {
    const $button = $(`<button class="race-select">${getButtonName(ballotItem.name)}</button>`);

    if (ballotItem.ballotOptions.length > 1) {
        $button.addClass('contested');
    }

    if (isIncumbentTrailing(ballotItem)) {
        $button.addClass('incumbent-trailing');
    }

    void function (call): call is Runoff {
        if ((call as Runoff).progressing?.length && totalVotes(ballotItem.ballotOptions) > 0)
            $button.addClass('to-runoff');
        return true;

    }(callRace(ballotItem));

    $button.on('click', function () {
        setRace(ballotItem);
        $('#selector-container').hide();
        $('#race-container').show();
    });

    return $button;
}

function updateSelectionPanel(ballotItems: BallotItem[], filterState: boolean = false): BallotItem[] {
    const $selection_panel = $('#selection-panel');
    $selection_panel.empty();

    ballotItems.sort((a, b) => (a.ballotOrder as number) - (b.ballotOrder as number));
    const sections = ballotItems.reduce((acc: PanelSection[], bi) => {
        const section_name = sortIntoSection(bi);

        if (filterState && STATE_LEVEL_SECTIONS.includes(section_name)) {
            return acc;
        }

        const section = acc.find(s => s.name === section_name);
        const party = getParty(bi);

        if (section_name === 'Other local races' && !filterState) {
            console.log(bi.name);
            return acc;
        }

        if (!section) {
            acc.push({
                name: section_name,
                partisan: !!party,
                races: (party) ? { [party]: [bi] } : [bi]
            });

            return acc;
        }

        if (party) {
            ((section.races as PartyItems)[party] ||= []).push(bi);

        } else {
            (section.races as BallotItem[]).push(bi);
        }

        return acc;
    }, []);

    for (let section of sections) {
        if (section.partisan) {
            const template = $('#selection-panel-section-temp').html();
            const $section = $(`<section>${template}</section>`);

            $section.find('.section-panel-header').html(section.name);

            for (let party in section.races as PartyItems) {
                $section.find(`.race-select-party.${party}`).each(function () {
                    for (const ballotItem of (section.races as PartyItems)[party]) {
                        $(this).find('.section-panel-races').append(makeButtonFor(ballotItem));
                    }
                });
            }

            $selection_panel.append($section);

        } else {
            const template = $('#selection-panel-section-np-temp').html();
            const $section = $(`<section class="race-select-party np">${template}</section>`);

            $section.find('.section-panel-header').html(section.name);

            for (let ballotItem of (section.races as BallotItem[])) {
                $section.find('.section-panel-races').append(makeButtonFor(ballotItem));
            }

            $selection_panel.append($section);

        }
    }

    return ballotItems;
}

function formatCountyNameAsValue(county_name: string) {
    return county_name.replace(' County', '').toLowerCase();
}

function updateRaceSelector(root: MediaExport.Root): Promise<BallotItem[]> {
    const county_names = root.localResults.map(lr => lr.name);
    const $county_filter = $('#filter-by-county');
    $county_filter.empty();
    $county_filter.append('<option value="state"></option>');
    county_names.sort();
    county_names.forEach(county_name => {
        county_name = county_name.replace(' County', '');
        let value = formatCountyNameAsValue(county_name);
        $county_filter.append(`<option value="${value}">${county_name}</option>`);
    });

    $county_filter.off('change').on('change', () => {
        let county_name = $county_filter.val();
        if (county_name === 'state') {
            displayStateLevelResults();
            return;
        }
        displayCountyResults(root.localResults, county_name as string);
    });

    let county_name;
    if (county_name = queryCounty()) {
        return (async () => displayCountyResults(root.localResults, county_name))();
    } else {
        return displayStateLevelResults();
    }
}

function displayStateLevelResults() {
    return TotalVotes.withAllFullResults(TotalVotes.DEFAULT_SOURCE, updateSelectionPanel);
}

function displayCountyResults(counties: County[], county_name: string) {
    let localResults = counties.find(lr => formatCountyNameAsValue(lr.name) === county_name);
    return updateSelectionPanel((localResults as County).ballotItems, true);
}

function filterRaces(groupClassName: string, className?: string) {
    $(`.${groupClassName}`).each(function () {
        if (className === undefined) { $(this).show(); return; }

        className = className as string;

        ($(this).hasClass(className))
            ? $(this).show()
            : $(this).hide();

    });
}

async function importAndUpdate() {
    const promise = MediaExport.withRoot(MediaExport.DEFAULT_SOURCE, updateRaceSelector);

    /// Loading screen

    return promise;
}

void function () {
    // Back to select button (for race page)

    void function () {
        $('#back-to-select').on('click', () => {
            importAndUpdate();
            $('#race-container').hide();
            $('#selector-container').show();
        });
    }();

    // Selection display buttons

    $('#filter-by-race-type').on('change', () => {
        const groupClassName = 'race-select';
        const new_value = $('#filter-by-race-type').val();

        switch (new_value) {
            case 'all':
                filterRaces(groupClassName);
                break;

            case 'contested':
            case 'incumbent-trailing':
            case 'to-runoff':
                filterRaces(groupClassName, new_value);
                break;
        }

    });

    $('#filter-by-party').on('change', () => {
        const groupClassName = 'race-select-party';
        const new_value = $('#filter-by-party').val();

        switch (new_value) {
            case 'all':
                filterRaces(groupClassName);
                break;

            default:
                filterRaces(groupClassName, new_value as string);
                break;
        }

    });

    importAndUpdate().then(ballotItems => {
        const preselectedRaceName = queryRace();
        let preselectedRace;
        if (preselectedRaceName && (preselectedRace = findBallotItem(ballotItems, preselectedRaceName))) {
            setRace(preselectedRace);
            $('#race-container').show();
            $('#selector-container').hide();

        } else {
            $('#race-container').hide();
            $('#selector-container').show();
        }
    });
}();
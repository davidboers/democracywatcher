export const ENUM_CAMEL_WORD_REGEX = /(?<!^)([A-Z])/g;

export function sum(l: number[]): number {
    return l.reduce((t, li) => t + li, 0);
}

export function formatCountyNameAsValue(county_name: string) {
    return county_name.replace(' County', '').toLowerCase();
}

export function toObject<T>(keys: string[], labels: T[]): { [key: string]: T } {
    return Object.fromEntries(keys.reduce((acc: [string, T][], key, i) => {
        acc.push([key, labels[i]]);
        return acc;
    }, []));
}

export function updateHtml($obj: JQuery<HTMLElement>, new_html: string) {
    $obj.each(function () {
        $(this).empty().append(new_html);
    });
}

export function formatNum(num: number): string {
    if (isNaN(num)) {
        throw new Error(`${num}`);
    }
    return new Intl.NumberFormat('en-us').format(num);
}

export function preciseShare(share: number): string {
    const p = 2;
    return (Number.isNaN(share) || share < 1 / (10 ^ p)) ? '0%' : `${share.toFixed(p)}%`;
}

export function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    const ampm = (date.getHours() > 12) ? 'PM' : 'AM';
    return `${date.getMonth()}/${date.getDate()} ${date.getHours() % 12}:${minutes} ${ampm}`;
}

// Regex name parser

export interface PersonalName {
    fullName: string;
    firstName: string;
    lastName: string;
};

export function parseName(name: string): PersonalName | null {
    const regex = /^([\S]+)(?: [\S]+)*? ([\S]+?)(?:,? (?:I+|[sj]r\.?))?(?: ?\(I\))?$/gimu;
    let result;
    if (result = regex.exec(name)) {
        const [fullName, firstName, lastName] = result;
        return { fullName, firstName, lastName };
    }

    return null;
}

/** Takes a list of personal names, and allows the last names to be used as labels for a legend. 
 * If there are multiple candidates with the same last name, it will add the first initials.
 */
export function createLegendLabels(personalNames: PersonalName[]): string[] {
    return personalNames.reduce((labels: string[], personalName) => {
        const lastName = personalName.lastName;

        if (labels.includes(lastName)) {
            const indexOfExistingLabel = labels.indexOf(lastName);
            const addition1 = personalNames[indexOfExistingLabel].firstName;
            const addition2 = personalName.firstName;
            let newNameForExisting = composeLabelWith(lastName, addition1);
            let newName = composeLabelWith(lastName, addition2);
            labels[indexOfExistingLabel] = newNameForExisting;
            labels.push(newName);

        } else {
            labels.push(lastName);
        }

        return labels;
    }, []);
}

function composeLabelWith(lastName: string, addition: string) {
    return `${addition} ${lastName}`;
}

export function makeLegend(names: string[]): { [key: string]: string } {
    if (names.includes('No')) // Referenda
        return toObject(names, names);

    const personalNames = names.map(parseName);
    const parsedNameDerivedLabels = createLegendLabels(personalNames.filter(pn => pn !== null));
    let parsedLi = 0;
    const labels = personalNames.reduce((acc: string[], personalName, i) => {
        if (personalName === null) {
            acc.push(names[i]);

        } else {
            acc.push(parsedNameDerivedLabels[parsedLi]);
            parsedLi++;
        }

        return acc;
    }, []);

    return toObject(names, labels);
}

// Graphs

export function createJQuerySVG(html: string) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const $obj = $(html)[0];
    const elem = document.createElementNS(svgNS, $obj.tagName.toLowerCase());
    $.each($obj.attributes, function () {
        $(elem).attr(this.name, this.value);
    });
    $(html).children().each(function () {
        $(elem).append(createJQuerySVG($(this)[0].outerHTML));
    });
    elem.innerHTML = $obj.innerHTML;
    return elem;
}

export function setupAbstract() {
    const race_name = queryRace();
    const county = queryCounty();

    if (race_name) {
        $('#race-name').html(race_name);

        $('#go-back').on('click', function () {
            redirectWithRaceName('./race.html', race_name, county || undefined);
        });

    }

    return [race_name, county];
}

// Race search queries

const URL_BASE = (window.location.origin.includes('dawieboers.com'))
    ? 'https://www.dawieboers.com/democracywatcher/'
    : window.location.origin;

export function redirectWithRaceName(doc: string, race_name?: string, county?: string, blockReferesh?: boolean) {
    const url = new URL(doc, URL_BASE);
    if (race_name) {
        url.searchParams.set('race_name', race_name);
        if (county) {
            url.searchParams.set('county', county);
        }
    }

    if (blockReferesh)
        window.history.pushState({}, '', url);
    else
        window.location.href = url.toString();
}

export function queryRace(): string | null {
    return new URLSearchParams(window.location.search).get('race_name');
}

export function queryCounty(): string | null {
    return new URLSearchParams(window.location.search).get('county');
}
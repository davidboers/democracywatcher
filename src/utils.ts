
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

// Graphs

export function setupAbstract() {
    const race_name = queryRace();

    if (!race_name) return;

    $('#race-name').html(race_name);

    $('#go-back').on('click', function () {
        redirectWithRaceName('./race.html', race_name);
    });

    return race_name;
}

// Race search queries

const URL_BASE = (window.location.origin.includes('dawieboers.com'))
    ? 'https://www.dawieboers.com/democracywatcher/'
    : window.location.origin;

export function redirectWithRaceName(doc: string, race_name: string, county?: string) {
    const url = new URL(doc, URL_BASE);
    url.searchParams.set('race_name', race_name);
    if (county) {
        url.searchParams.set('county', county);
    }
    window.location.href = url.toString();
}

export function queryRace(): string | null {
    return new URLSearchParams(window.location.search).get('race_name');
}

export function queryCounty(): string | null {
    return new URLSearchParams(window.location.search).get('county');
}

export function clearRaceQueries() {
    const params = new URLSearchParams(window.location.search);
    params.delete('race_name');
    params.delete('county');
}
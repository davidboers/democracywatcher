import { combineReportingStatuses, combineReportingStatusList } from './data/reporting.js';
import { BallotOption, LocalReturn, votesFor } from './data/structures.js';

interface RegionList {
    [key: string]: string[];
};

function combineRegions(subregions: string[]): string[] {
    return subregions.map(region => divisions[region]).flat();
}

export const divisions: RegionList = {
    'Alapaha': ['Ben Hill', 'Berrien', 'Brooks', 'Colquitt', 'Cook', 'Crisp', 'Grady', 'Irwin', 'Lowndes', 'Thomas', 'Tift', 'Turner', 'Worth'],
    'Altamaha': ['Bleckley', 'Bulloch', 'Candler', 'Dodge', 'Dooly', 'Emanuel', 'Evans', 'Jenkins', 'Johnson', 'Laurens', 'Montgomery', 'Pulaski', 'Screven', 'Tattnall', 'Telfair', 'Toombs', 'Treutlen', 'Wheeler', 'Wilcox'],
    'Augusta': ['Burke', 'Columbia', 'Glascock', 'Greene', 'Hancock', 'Jefferson', 'McDuffie', 'Richmond', 'Taliaferro', 'Warren', 'Washington'],
    'Carrollton-Dallas-Cedartown': ['Carroll', 'Haralson', 'Paulding', 'Polk'],
    'Chatham': ['Chatham'],
    'Coastal Georgia': ['Bryan', 'Camden', 'Effingham', 'Glynn', 'Liberty', 'Long', 'McIntosh'],
    'Columbus': ['Chattahoochee', 'Macon', 'Marion', 'Muscogee', 'Schley', 'Stewart', 'Talbot', 'Taylor', 'Webster'],
    'DeKalb': ['DeKalb'],
    'Fulton': ['Fulton'],
    'Griffin-Thomaston': ['Butts', 'Lamar', 'Monroe', 'Pike', 'Spalding', 'Upson'],
    'Gwinnett': ['Gwinnett'],
    'Macon-Warner Robins': ['Bibb', 'Crawford', 'Houston', 'Peach'],
    'Metro Athens': ['Barrow', 'Clarke', 'Morgan', 'Oconee', 'Walton'],
    'Milledgeville': ['Baldwin', 'Jasper', 'Jones', 'Putnam', 'Twiggs', 'Wilkinson'],
    'Newnan-LaGrange': ['Coweta', 'Harris', 'Heard', 'Meriwether', 'Troup'],
    'North East Georgia': ['Dawson', 'Fannin', 'Gilmer', 'Habersham', 'Lumpkin', 'Pickens', 'Rabun', 'Stephens', 'Towns', 'Union', 'White'],
    'North Metro Atlanta': ['Cherokee', 'Forsyth', 'Hall'],
    'North West Georgia': ['Bartow', 'Catoosa', 'Chattooga', 'Dade', 'Floyd', 'Gordon', 'Murray', 'Walker', 'Whitfield'],
    'Outer East Georgia': ['Banks', 'Elbert', 'Franklin', 'Hart', 'Jackson', 'Lincoln', 'Madison', 'Oglethorpe', 'Wilkes'],
    'Satilla': ['Appling', 'Atkinson', 'Bacon', 'Brantley', 'Charlton', 'Clinch', 'Coffee', 'Echols', 'Jeff Davis', 'Lanier', 'Pierce', 'Ware', 'Wayne'],
    'South Metro Atlanta': ['Clayton', 'Fayette', 'Henry', 'Newton', 'Rockdale'],
    'South West Georgia': ['Baker', 'Calhoun', 'Clay', 'Decatur', 'Dougherty', 'Early', 'Lee', 'Miller', 'Mitchell', 'Quitman', 'Randolph', 'Seminole', 'Sumter', 'Terrell'],
    'West Metro Atlanta': ['Cobb', 'Douglas']
};

export const regions: RegionList = {
    'North Georgia': combineRegions(['North East Georgia', 'North West Georgia']),
    'West Georgia': combineRegions(['Carrollton-Dallas-Cedartown', 'Newnan-LaGrange']),
    'Metro Atlanta': combineRegions(['North Metro Atlanta', 'West Metro Atlanta', 'Fulton', 'DeKalb', 'Gwinnett', 'South Metro Atlanta']),
    'East Georgia': combineRegions(['Metro Athens', 'Outer East Georgia']),
    'Middle Georgia': combineRegions(['Columbus', 'Macon-Warner Robins', 'Griffin-Thomaston', 'Milledgeville', 'Augusta']),
    'South Georgia': combineRegions(['Alapaha', 'Altamaha', 'Chatham', 'Coastal Georgia', 'South West Georgia', 'Satilla'])
};

export function findRegion(regionList: RegionList, county: string) {
    county = county.replace(' County', '');

    for (const region in regionList) {
        const contains = regionList[region];

        if (contains.includes(county)) {
            return region;
        }
    }

    return 'Other';
}

export function regionIDName(name: string) {
    return name.replace(' ', '-').toLowerCase();
}

export function getRegionReturns(regionList: RegionList, localReturns: LocalReturn[]): LocalReturn[] {
    return localReturns.reduce((acc: LocalReturn[], lr) => {
        const region = findRegion(regionList, lr.countyName);
        if (!region) {
            console.warn(`No region for [${lr.countyName}]`);
            return acc;
        }

        let regionReturn = acc.find(rr => rr.countyName === region);

        if (!regionReturn) {
            const newBallotItem = structuredClone(lr.ballotItem);
            newBallotItem.ballotOptions.forEach((bo: BallotOption) => bo.voteCount = votesFor(bo));
            regionReturn = {
                countyName: region,
                ballotItem: newBallotItem,
                reportingStatus: combineReportingStatuses(lr.reportingStatus)
            };
            acc.push(regionReturn);

        } else {
            regionReturn.ballotItem.ballotOptions.forEach(bo => bo.voteCount += votesFor(lr.ballotItem.ballotOptions.find(bo2 => bo.name === bo2.name) as BallotOption));
            regionReturn.reportingStatus = combineReportingStatusList([regionReturn.reportingStatus, lr.reportingStatus]);

        }

        return acc;
    }, []);
}
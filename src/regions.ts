import { combineReportingStatuses } from './data/reporting.js';
import { combineReportingStatusList } from './data/reporting.js';
import { BallotOption } from './data/structures.js';
import { LocalReturn } from './data/structures.js';
import { votesFor } from './data/structures.js';

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
    'Metro Athens': ['Barrow', 'Clarke', 'Jackson', 'Morgan', 'Oconee', 'Walton'],
    'Milledgeville': ['Baldwin', 'Jasper', 'Jones', 'Putnam', 'Twiggs', 'Wilkinson'],
    'Newnan-LaGrange': ['Coweta', 'Harris', 'Heard', 'Meriwether', 'Troup'],
    'North East Georgia': ['Dawson', 'Fannin', 'Gilmer', 'Habersham', 'Lumpkin', 'Pickens', 'Rabun', 'Stephens', 'Towns', 'Union', 'White'],
    'North Metro Atlanta': ['Cherokee', 'Forsyth', 'Hall'],
    'North West Georgia': ['Bartow', 'Catoosa', 'Chattooga', 'Dade', 'Floyd', 'Gordon', 'Murray', 'Walker', 'Whitfield'],
    'Outer East Georgia': ['Banks', 'Elbert', 'Franklin', 'Hart', 'Lincoln', 'Madison', 'Oglethorpe', 'Wilkes'],
    'Satilla': ['Appling', 'Atkinson', 'Bacon', 'Brantley', 'Charlton', 'Clinch', 'Coffee', 'Echols', 'Jeff Davis', 'Lanier', 'Pierce', 'Ware', 'Wayne'],
    'South Metro Atlanta': ['Clayton', 'Fayette', 'Henry', 'Newton', 'Rockdale'],
    'South West Georgia': ['Baker', 'Calhoun', 'Clay', 'Decatur', 'Dougherty', 'Early', 'Lee', 'Miller', 'Mitchell', 'Quitman', 'Randolph', 'Seminole', 'Sumter', 'Terrell'],
    'West Metro Atlanta': ['Cobb', 'Douglas']
};

export const divisionsIn: { [key: string]: string[] } = {
    'North Georgia': ['North East Georgia', 'North West Georgia'],
    'West Georgia': ['Carrollton-Dallas-Cedartown', 'Newnan-LaGrange'],
    'Metro Atlanta': ['North Metro Atlanta', 'West Metro Atlanta', 'Fulton', 'DeKalb', 'Gwinnett', 'South Metro Atlanta'],
    'East Georgia': ['Metro Athens', 'Outer East Georgia'],
    'Middle Georgia': ['Columbus', 'Macon-Warner Robins', 'Griffin-Thomaston', 'Milledgeville', 'Augusta'],
    'South Georgia': ['Alapaha', 'Altamaha', 'Chatham', 'Coastal Georgia', 'South West Georgia', 'Satilla']
};

export const regions: RegionList = {
    'North Georgia': combineRegions(divisionsIn['North Georgia']),
    'West Georgia': combineRegions(divisionsIn['West Georgia']),
    'Metro Atlanta': combineRegions(divisionsIn['Metro Atlanta']),
    'East Georgia': combineRegions(divisionsIn['East Georgia']),
    'Middle Georgia': combineRegions(divisionsIn['Middle Georgia']),
    'South Georgia': combineRegions(divisionsIn['South Georgia'])
};

export const regionViewBoxes: { [key: string]: [number, number, number, number] } = {
    'North Georgia': [0, -0.15, 0.58, 0.2164],
    'West Georgia': [-0.0667, 0.1636, 0.3911, 0.3927],
    'Metro Atlanta': [0.1544, 0.0945, 0.2889, 0.2909],
    'East Georgia': [0.3178, 0.0091, 0.3911, 0.3927],
    'Middle Georgia': [0.0978, 0.0727, 0.7622, 0.7636],
    'South Georgia': [0.0689, 0.1945, 0.9467, 0.9473],
}

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
    return name.replaceAll(' ', '-').toLowerCase();
}

export function getRegionReturns(regionList: RegionList, localReturns: LocalReturn[]): LocalReturn[] {
    return localReturns.reduce((acc: LocalReturn[], lr) => {
        const region = findRegion(regionList, lr.jurisName);
        if (!region) {
            console.warn(`No region for [${lr.jurisName}]`);
            return acc;
        }

        let regionReturn = acc.find(rr => rr.jurisName === region);

        if (!regionReturn) {
            const newBallotItem = structuredClone(lr.ballotItem);
            newBallotItem.ballotOptions.forEach((bo: BallotOption) => bo.voteCount = votesFor(bo));
            regionReturn = {
                jurisName: region,
                ballotItem: newBallotItem,
                reportingStatus: combineReportingStatuses(lr.reportingStatus),
                members: [lr.jurisName]
            };
            acc.push(regionReturn);

        } else {
            regionReturn.ballotItem.ballotOptions.forEach(bo => bo.voteCount += votesFor(lr.ballotItem.ballotOptions.find(bo2 => bo.name === bo2.name) as BallotOption));
            regionReturn.reportingStatus = combineReportingStatusList([regionReturn.reportingStatus, lr.reportingStatus]);
            (regionReturn.members ||= []).push(lr.jurisName);

        }

        return acc;
    }, []);
}
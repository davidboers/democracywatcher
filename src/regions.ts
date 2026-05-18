import { combineReportingStatuses, combineReportingStatusList } from './data/reporting.js';
import { BallotOption, LocalReturn, votesFor } from './data/structures.js';

import divisions from './divisions.json';

interface RegionList {
    [key: string]: string[];
};

function combineRegions(subRegionList: RegionList, subregions: string[]): string[] {
    return subregions.map(region => subRegionList[region]).flat();
}

export const divisionsIn: RegionList = {
    'North Georgia': ['North East Georgia', 'North West Georgia'],
    'West Georgia': ['Carrollton-Dallas-Cedartown', 'Newnan-LaGrange'],
    'Metro Atlanta': ['North Metro Atlanta', 'West Metro Atlanta', 'Fulton', 'DeKalb', 'Gwinnett', 'South Metro Atlanta'],
    'East Georgia': ['Metro Athens', 'Outer East Georgia'],
    'Middle Georgia': ['Columbus', 'Macon-Warner Robins', 'Griffin-Thomaston', 'Milledgeville', 'Augusta'],
    'South Georgia': ['Alapaha', 'Altamaha', 'Chatham', 'Coastal Georgia', 'South West Georgia', 'Satilla']
};

export const regions: RegionList = {
    'North Georgia': combineRegions(divisions, divisionsIn['North Georgia']),
    'West Georgia': combineRegions(divisions, divisionsIn['West Georgia']),
    'Metro Atlanta': combineRegions(divisions, divisionsIn['Metro Atlanta']),
    'East Georgia': combineRegions(divisions, divisionsIn['East Georgia']),
    'Middle Georgia': combineRegions(divisions, divisionsIn['Middle Georgia']),
    'South Georgia': combineRegions(divisions, divisionsIn['South Georgia'])
};

export const metroATLDivisionsIn: RegionList = {
    'North Metro Atlanta': ['Cherokee', 'North Forsyth', 'South Forsyth', 'Hall'],
    'West Metro Atlanta': ['Douglas', 'South Cobb', 'Kennesaw-Acworth', 'Marietta', 'North East Cobb'],
    'Fulton': ['North Fulton', 'Sandy Springs', 'Midtown-Buckhead', 'Downtown-West Atlanta', 'South Fulton'],
    'DeKalb': ['Doraville-Dunwoody-Brookhaven', 'Decatur', 'Tucker-Stone Mountain', 'South DeKalb'],
    'Gwinnett': ['West Gwinnett', 'Central Gwinnett', 'South Gwinnett', 'North Gwinnett'],
    'South Metro Atlanta': ['Fayette', 'Clayton', 'Henry', 'Newton-Rockdale'],
}

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

        if (contains.map(c => c.toLowerCase()).includes(county.toLowerCase())) {
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
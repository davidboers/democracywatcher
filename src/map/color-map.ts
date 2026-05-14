import { changeSelection } from './side.js';
import { EMPTY_COLOR, getMapShadedColor, getMapSolidColor } from '../colors.js';
import { combineReportingStatuses } from '../data/reporting.js';
import { LocalReturn } from '../data/structures.js';
import { findLocalReturn } from './draw.js';

type ColorWorker = (localReturn: LocalReturn) => string;

function getSolidColor(localReturn: LocalReturn): string {
    return getMapSolidColor(localReturn.ballotItem.ballotOptions);
}

function getGradientColor(localReturn: LocalReturn): string {
    return getMapShadedColor(localReturn.ballotItem.ballotOptions);
}

function getReportingColor(localReturn: LocalReturn): string {
    let reportingStatus = combineReportingStatuses(localReturn.reportingStatus);

    switch (reportingStatus) {
        case 'Not Reported': return EMPTY_COLOR;
        case 'Partially Reported': return '#aaa';
        case 'Election Night Complete': return '#242424';
        case 'Fully Reported': return '#008000';
    }
}

function colorMap(worker: ColorWorker, localReturns: LocalReturn[], path_chain: any, border_chain: any) {
    path_chain.attr('fill', (d: TopoJsonObject) => {
        const localReturn = findLocalReturn(localReturns, d);
        if (!localReturn) {
            return '#00000000'; // No election in this jurisdiction
        }
        return worker(localReturn as LocalReturn);
    });
}

export function recolorMap(localReturns: LocalReturn[], path_chain: any, border_chain: any) {
    const default_toggle = $('#map-toggle .selected').attr('id');
    let defaultColorWorker: ColorWorker;

    defaultColorWorker = function () {
        switch (default_toggle) {
            case 'set-solid': return getSolidColor;
            case 'set-shade': return getGradientColor;
            case 'set-reporting': return getReportingColor;
            default: return getSolidColor;
        }
    }();

    colorMap(defaultColorWorker, localReturns, path_chain, border_chain);

    function updateToggle(id: string, worker: any) {
        $(`#${id}`).off('click').on('click', function () {
            colorMap(worker, localReturns, path_chain, border_chain);
            changeSelection('map-toggle', id);
        });
    }

    updateToggle('set-solid', getSolidColor);
    updateToggle('set-shade', getGradientColor);
    updateToggle('set-reporting', getReportingColor);

    return localReturns;
}
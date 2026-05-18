import { changeSelection, showInspectionGradient, showReportingKey } from './side.js';
import { getMapShadedColor, getMapSolidColor, pickReportingColor } from '../colors.js';

import { combineReportingStatuses } from '../data/reporting.js';
import { LocalReturn } from '../data/structures.js';

import { Feature, findLocalReturn } from './draw.js';

type ColorWorker = (localReturn: LocalReturn) => string;

function getSolidColor(localReturn: LocalReturn): string {
    return getMapSolidColor(localReturn.ballotItem.ballotOptions);
}

function getGradientColor(localReturn: LocalReturn): string {
    return getMapShadedColor(localReturn.ballotItem.ballotOptions);
}

function getReportingColor(localReturn: LocalReturn): string {
    return pickReportingColor(combineReportingStatuses(localReturn.reportingStatus));
}

function colorMap(worker: ColorWorker, localReturns: LocalReturn[], path_chain: any) {
    path_chain.attr('fill', (d: Feature) => {
        const localReturn = findLocalReturn(localReturns, d);
        if (!localReturn) {
            return '#00000000'; // No election in this jurisdiction
        }
        return worker(localReturn as LocalReturn);
    });
}

export function recolorMap(localReturns: LocalReturn[], path_chain: any) {
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

    colorMap(defaultColorWorker, localReturns, path_chain);

    function updateToggle(id: string, worker: any) {
        $(`#${id}`).off('click').on('click', function () {
            const selected_geo = $('#map-geo .selected').attr('id');
            if (selected_geo && ['set-county', 'set-precinct'].includes(selected_geo)) {
                if (id === 'set-shade') {
                    showInspectionGradient(localReturns[0].ballotItem.ballotOptions);
                } else if (id === 'set-reporting') {
                    showReportingKey();
                } else {
                    $('#not-hover').empty();
                }
            }

            colorMap(worker, localReturns, path_chain);
            changeSelection('map-toggle', id);
        });
    }

    updateToggle('set-solid', getSolidColor);
    updateToggle('set-shade', getGradientColor);
    updateToggle('set-reporting', getReportingColor);

    return localReturns;
}
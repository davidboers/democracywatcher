export type ReportingStatus = 'Not Reported' | 'Partially Reported' | 'Election Night Complete' | 'Fully Reported';

export type ReportingStatuses = [
    { groupName: 'Election Day', status: ReportingStatus },
    { groupName: 'Advance Voting', status: ReportingStatus },
    { groupName: 'Absentee by Mail', status: ReportingStatus },
    { groupName: 'Provisional', status: ReportingStatus }
] | {
    'Election Day': ReportingStatus,
    'Advance Voting': ReportingStatus,
    'Absentee by Mail': ReportingStatus,
    'Provisional': ReportingStatus
};

export function combineReportingStatusList(reportingStatusList: (ReportingStatuses | ReportingStatus)[]): ReportingStatus {
    reportingStatusList = reportingStatusList.map(combineReportingStatuses);

    if (reportingStatusList.length === 0) {
        throw new Error('No reporting status data');
    }

    let any_not = false;
    let any_enc = false;
    let any_fully = false;

    for (let reportingStatus of reportingStatusList) {
        switch (reportingStatus) {
            case 'Not Reported':
                any_not = true;
                break;

            case 'Partially Reported':
                return reportingStatus;

            case 'Election Night Complete':
                any_enc = true;

            case 'Fully Reported':
                any_fully = true;
        }

        if (any_not && (any_enc || any_fully)) return 'Partially Reported';
    }

    return (any_not) ? 'Not Reported' :
        (any_enc) ? 'Election Night Complete' : 'Fully Reported';
}

export function combineReportingStatuses(reportingStatuses: ReportingStatuses | ReportingStatus): ReportingStatus {
    if (typeof reportingStatuses === 'object') {
        return combineReportingStatusList(Object.values(reportingStatuses));

    } else if (Array.isArray(reportingStatuses)) {
        return combineReportingStatusList((reportingStatuses as { status: ReportingStatus }[]).map(o => o.status));

    } else if (typeof reportingStatuses === 'string') {
        return reportingStatuses;

    } else {
        console.warn('Failed to combine reporting statuses (neither object, array, nor string)');
        console.warn(reportingStatuses);
        return 'Not Reported';
    }
}
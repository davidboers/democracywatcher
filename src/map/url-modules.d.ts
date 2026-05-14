declare module 'https://cdn.jsdelivr.net/npm/d3@7/+esm' {
    export function select(selector: string): any;
    export function geoMercator(): any;
    export function geoPath(projection: any): any;
}

declare module 'https://cdn.jsdelivr.net/npm/topojson-client@3/+esm' {
    export function feature(topology: any, object: any): any;
    export function mesh(topology: any, object: any, func: (a: any, b: any) => boolean): any;
}

declare type TopoJsonObject = {
    geometry: {
        type: string,
        coordinates: number[][][],
    },
    properties: {
        name: string
    },
    type: string
};
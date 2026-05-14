
const DEFAULT_WIDTH = 450;
const DEFAULT_HEIGHT = 550;

export function calculateViewBox(min_x: number, min_y: number, width: number, height: number): string {
    const svg_width = $('svg').width() || DEFAULT_WIDTH;
    const svg_height = $('svg').height() || DEFAULT_HEIGHT;

    return `${min_x * svg_width}
    ${min_y * svg_height}
    ${width * svg_width}
    ${height * svg_height}`;
}


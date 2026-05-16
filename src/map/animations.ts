
import gsap from 'gsap';

const DEFAULT_WIDTH = 450;
const DEFAULT_HEIGHT = 550;

type ViewBox = [number, number, number, number];

const svg = $('svg');

export function calculateViewBox(min_x: number, min_y: number, width: number, height: number): ViewBox {
    const svg_width = svg.width() || DEFAULT_WIDTH;
    const svg_height = svg.height() || DEFAULT_HEIGHT;

    return roundViewBox([
        min_x * svg_width,
        min_y * svg_height,
        width * svg_width,
        height * svg_height]);
}

function roundViewBox(viewBox: ViewBox): ViewBox {
    return viewBox.map(Math.round) as ViewBox;
}

export function zoomToFull() {
    animateZoom(calculateViewBox(0, 0, 1, 1), 'power1.out');
}

export function zoomTo(viewBox: ViewBox) {
    animateZoom(viewBox, 'power1.in');
}

function animateZoom(to: ViewBox, ease: string) {
    const from = svg.attr('viewBox')?.split(' ').map(s => parseInt(s)) as ViewBox;
    gsap.to(from, {
        endArray: to,
        duration: 1.5,
        ease: ease,
        round: 'endArray',
        onUpdate: () => {
            svg.attr('viewBox', from.join(' '))
        }
    });
}
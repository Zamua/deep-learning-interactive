// The Phosphor Light glyphs Explore draws that the shared icon set does not carry.
import crosshair from '../../../../node_modules/@phosphor-icons/core/assets/light/crosshair-simple-light.svg?raw';
import mapPin from '../../../../node_modules/@phosphor-icons/core/assets/light/map-pin-light.svg?raw';

const ico = (svg: string) => svg.replace('<svg ', '<svg class="ico" aria-hidden="true" ');

export const locateGlyph = ico(crosshair);

/** A glyph's drawing as a `<symbol>`, so a map can place it many times by reference. */
export const symbolOf = (svg: string, id: string): string => svg.replace(/<svg[^>]*>/, `<symbol id="${id}" viewBox="0 0 256 256">`).replace('</svg>', '</symbol>');

export const pinSymbol = symbolOf(mapPin, 'ex-pin');

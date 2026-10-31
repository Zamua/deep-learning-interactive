import { h } from './dom';

const ICON_SVGS = import.meta.glob('../../node_modules/@phosphor-icons/core/assets/light/{play,pause,skip-forward,skip-back,arrow-counter-clockwise,shuffle,list,x,sun,moon,arrow-right,arrow-left,check,lightbulb,warning,function,book-open,clipboard-text,eye,math-operations,graduation-cap,code,brain,image,info,closed-captioning,corners-out,corners-in,rewind,lock-simple,clock,backspace,graph,rows,x-circle,check-circle,sparkle,compass,flag,target,caret-right,gear-six,cloud-check,cloud-slash,cloud-arrow-up,cloud-warning,share-network,copy,devices,key,eye,eye-slash,airplane,download-simple,circle-half,bell}-light.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const FILL_SVGS = import.meta.glob('../../node_modules/@phosphor-icons/core/assets/fill/{play,pause,rewind,fast-forward,lock-simple,lock-simple-open,lightning}-fill.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const ALIAS: Record<string, string> = { next: 'skip-forward', prev: 'skip-back', reset: 'arrow-counter-clockwise', menu: 'list', close: 'x', arrowRight: 'arrow-right', arrowLeft: 'arrow-left', book: 'book-open', clipboard: 'clipboard-text', math: 'math-operations', playFill: 'play-fill', pauseFill: 'pause-fill', rewindFill: 'rewind-fill', ffFill: 'fast-forward-fill', lockFill: 'lock-simple-fill', unlockFill: 'lock-simple-open-fill', lock: 'lock-simple', bolt: 'lightning-fill', gear: 'gear-six' };

/** A settings menu line: an icon, the setting's name, then its controls. */
export function settingRow(glyph: string, label: string, ...controls: (HTMLElement | string)[]): HTMLElement {
  return h('div', { class: 'set-item' }, h('span', { class: 'set-item-i', html: icon(glyph) }), h('span', { class: 'set-item-l' }, label), ...controls);
}

/** Inline Phosphor Light glyph by name (or alias), sized by CSS `.ico`. */
export function icon(name: string): string {
  const file = ALIAS[name] ?? name;
  const svg = Object.entries(ICON_SVGS).find(([k]) => k.endsWith(`/${file}-light.svg`))?.[1] ?? Object.entries(FILL_SVGS).find(([k]) => k.endsWith(`/${file}.svg`))?.[1];
  return svg ? svg.replace('<svg ', '<svg class="ico" aria-hidden="true" ') : '';
}

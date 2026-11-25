import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { COLOR_SWATCHES, GarmentType } from '../../domain/entities/common';

const BG: Record<string, string> = {
  Preto: '#ece9e6', Branco: '#e9e2d8', Vermelho: '#fbe4e1', Azul: '#e2e9f6', Verde: '#e0f0e7', Amarelo: '#fdf0d2',
  Rosa: '#fce6ee', Bege: '#f3ebe0', Laranja: '#fde6d6', Ganga: '#e1e8f1', Castanho: '#efe4dc', Cinzento: '#ecebea',
};

function shade(hex: string, p: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + p));
  return '#' + ((1 << 24) | (c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).slice(1);
}

let uid = 0;

/** Desenho vectorial da peça — usado quando ainda não há fotografia. */
export function garmentSvg(type: GarmentType, colorName: string, pattern: boolean): string {
  const c = COLOR_SWATCHES[colorName] ?? '#888888';
  const d = shade(c, -26);
  const pid = `cp${++uid}`;
  const defs = pattern
    ? `<defs><pattern id="${pid}" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="${c}"/><circle cx="8" cy="8" r="4.5" fill="none" stroke="#fff" stroke-width="1.6" opacity=".85"/><circle cx="8" cy="8" r="1.4" fill="#f2b632"/><path d="M0 0l3 3M16 0l-3 3M0 16l3-3M16 16l-3-3" stroke="#1b1715" stroke-width="1.2" opacity=".5"/></pattern></defs>`
    : '';
  const fill = pattern ? `url(#${pid})` : c;
  const s = `stroke="${d}" stroke-width="2" stroke-linejoin="round"`;
  const shapes: Record<GarmentType, string> = {
    dress: `<path d="M38 10h24l4 18-6 4 16 58H24l16-58-6-4z" fill="${fill}" ${s}/><path d="M40 10q10 10 20 0" fill="none" ${s}/><path d="M36 32h28" ${s} opacity=".6"/>`,
    tee: `<path d="M34 12l-20 12 8 14 10-5v55h36V33l10 5 8-14-20-12q-6 8-16 8t-16-8z" fill="${fill}" ${s}/><path d="M42 12q8 7 16 0" fill="none" ${s}/>`,
    shirt: `<path d="M34 12l-20 12 8 14 10-5v55h36V33l10 5 8-14-20-12-8 6h-16z" fill="${fill}" ${s}/><path d="M42 18l8 10 8-10M50 28v60" fill="none" ${s}/><circle cx="50" cy="42" r="1.6" fill="${d}"/><circle cx="50" cy="56" r="1.6" fill="${d}"/><circle cx="50" cy="70" r="1.6" fill="${d}"/>`,
    pants: `<path d="M30 10h40l6 82H56l-6-52-6 52H24z" fill="${fill}" ${s}/><path d="M30 18h40M50 18v22" ${s} fill="none"/>`,
    shorts: `<path d="M26 22h48l6 44H56l-6-24-6 24H20z" fill="${fill}" ${s}/><path d="M26 30h48" ${s}/>`,
    skirt: `<path d="M34 18h32l14 66H20z" fill="${fill}" ${s}/><path d="M34 26h32" ${s}/><path d="M42 26l-8 58M50 26v58M58 26l8 58" ${s} opacity=".45" fill="none"/>`,
    shoe: `<path d="M14 66q0-14 8-20l14-6 10 10q12 8 26 8 14 0 16 12v6H14z" fill="${fill}" ${s}/><path d="M14 76h74" stroke="${d}" stroke-width="5" stroke-linecap="round"/><path d="M38 46l6 6M44 42l6 6" ${s}/>`,
    bag: `<path d="M36 36q0-18 14-18t14 18" fill="none" stroke="${d}" stroke-width="4"/><path d="M22 36h56l-6 52H28z" fill="${fill}" ${s}/>`,
    cap: `<path d="M20 60q0-34 30-34t30 34z" fill="${fill}" ${s}/><path d="M50 60h40q-4 8-20 8H50z" fill="${fill}" ${s}/><circle cx="50" cy="26" r="3" fill="${d}"/>`,
    wrap: `<rect x="22" y="14" width="56" height="74" rx="3" fill="${fill}" ${s}/><path d="M22 26h56M22 76h56" stroke="#1b1715" stroke-width="2" opacity=".35"/>`,
  };
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${defs}${shapes[type] ?? shapes.tee}</svg>`;
}

/**
 * Imagem de produto: fotografia (se existir) ou ilustração na cor escolhida.
 * Ocupa 100% do contentor; a proporção é definida por quem a usa.
 */
@Component({
  selector: 'app-product-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.background]': 'bg()' },
  styles: `
    :host{display:grid;place-items:center;width:100%;height:100%;overflow:hidden}
    img{width:100%;height:100%;object-fit:cover}
    .ill{width:var(--ill, 70%);display:grid;place-items:center}
    .ill ::ng-deep svg{width:100%;height:auto}
  `,
  template: `
    @if (src(); as s) {
      <img [src]="s" [alt]="alt()" loading="lazy" />
    } @else {
      <div class="ill" [innerHTML]="svg()"></div>
    }
  `,
})
export class ProductImage {
  private readonly sanitizer = inject(DomSanitizer);
  readonly images = input<string[]>([]);
  readonly type = input<GarmentType>('tee');
  readonly pattern = input(false);
  readonly color = input<string>('Preto');
  /** Índice da fotografia; se exceder as fotos, mostra a ilustração. */
  readonly index = input(0);
  readonly alt = input('');

  protected readonly src = computed(() => this.images()[this.index()] ?? null);
  protected readonly bg = computed(() => (this.src() ? '#f4f1ec' : (BG[this.color()] ?? '#f1ece6')));
  protected readonly svg = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(garmentSvg(this.type(), this.color(), this.pattern())),
  );
}

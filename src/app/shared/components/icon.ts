import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { inject } from '@angular/core';

/** Ícones de linha (24×24, traço 1.8). */
const PATHS: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bag: '<path d="M5 7h14l-1.2 13H6.2z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  truck: '<path d="M3 7h12v10H3zM15 10h3.5l2.5 3v4h-6"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
  package: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z"/><path d="M4 7V6a2 2 0 0 1 2-2h10v3"/><circle cx="16" cy="13.5" r="1.2"/>',
  bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  box: '<path d="M4 8h16v12H4zM2 4h20v4H2z"/><path d="M10 12h4"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  store: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5 11v9h14v-9"/><path d="M10 20v-5h4v5"/>',
  refresh: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5"/><path d="M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m3 18 6-5 4 3 3-2 5 4"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
  'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',
  shield: '<path d="M12 3 4 6.5V12c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6.5z"/><path d="m9 12 2 2 4-4"/>',
  return: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  flash: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  dashboard: '<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.2 2 1-1 2c-3 .2-7.8-4.5-7.7-7.7l2-1 1 2z"/>',
};

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-icon', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  styles: `:host{display:inline-flex;flex-shrink:0} svg{width:100%;height:100%}`,
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round" [class.filled]="fill()" [attr.fill]="fill() ? 'currentColor' : 'none'" aria-hidden="true" [innerHTML]="svg()"></svg>`,
})
export class Icon {
  private readonly sanitizer = inject(DomSanitizer);
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly stroke = input(1.8);
  readonly fill = input(false);
  protected readonly svg = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name()] ?? PATHS['info']));
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `:host{display:inline-flex;align-items:center;gap:7px;font-family:var(--display);font-weight:800;letter-spacing:-.6px;white-space:nowrap;line-height:1}
    svg{flex-shrink:0} .s{font-family:var(--font);font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:3px 6px;border-radius:5px;background:var(--ink);color:#fff;margin-left:2px}`,
  host: { '[style.font-size.px]': 'size()', '[style.color]': 'light() ? "#fff" : "var(--brand)"' },
  template: `
    <svg [attr.width]="size() * 0.95" [attr.height]="size() * 0.95" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" [attr.fill]="light() ? '#fff' : '#d9480f'" />
      <path d="M9 12h14l-1.2 13H10.2z" [attr.fill]="light() ? '#d9480f' : '#fff'" />
      <path d="M12.5 12a3.5 3.5 0 0 1 7 0" fill="none" [attr.stroke]="light() ? '#d9480f' : '#fff'" stroke-width="2.2" />
      <circle cx="16" cy="18.5" r="2.6" fill="#f2b632" />
    </svg>
    xitolo
    @if (suffix()) {
      <span class="s">{{ suffix() }}</span>
    }
  `,
})
export class Logo {
  readonly size = input(26);
  readonly light = input(false);
  readonly suffix = input('');
}

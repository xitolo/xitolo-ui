import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';
import { Icon } from './icon';

/**
 * Selecção de imagens com redimensionamento no navegador (JPEG ≤ 900px),
 * para caber no armazenamento local enquanto não há backend de ficheiros.
 */
@Component({
  selector: 'app-image-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styles: `.g{display:flex;flex-wrap:wrap;gap:10px}
    .it{position:relative;width:92px;height:116px;border-radius:10px;overflow:hidden;border:1px solid var(--line)}
    .it img{width:100%;height:100%;object-fit:cover}
    .it .acts{position:absolute;inset:auto 4px 4px 4px;display:flex;justify-content:space-between}
    .it button{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.95);display:grid;place-items:center}
    .main{position:absolute;top:4px;left:4px;font-size:10px;font-weight:700;background:var(--ink);color:#fff;padding:2px 6px;border-radius:5px}
    label.add{width:92px;height:116px;border:1.5px dashed var(--line-2);border-radius:10px;display:grid;place-items:center;text-align:center;color:var(--muted);font-size:12px;cursor:pointer}
    label.add:hover{border-color:var(--ink);color:var(--ink)} input{display:none}`,
  template: `
    <div class="g">
      @for (img of images(); track $index) {
        <div class="it">
          <img [src]="img" alt="" />
          @if ($first) { <span class="main">Principal</span> }
          <div class="acts">
            <button type="button" (click)="makeMain($index)" [disabled]="$first" title="Definir como principal"><app-icon name="star" [size]="14" /></button>
            <button type="button" (click)="remove($index)" title="Remover"><app-icon name="trash" [size]="14" /></button>
          </div>
        </div>
      }
      @if (images().length < max()) {
        <label class="add">
          @if (busy()) { <span class="spinner sm"></span> } @else { <span><app-icon name="upload" [size]="20" /><br />Adicionar</span> }
          <input type="file" accept="image/*" multiple (change)="onFiles($event)" />
        </label>
      }
    </div>
  `,
})
export class ImagePicker {
  readonly images = model<string[]>([]);
  readonly max = input(6);
  protected readonly busy = signal(false);

  async onFiles(ev: Event): Promise<void> {
    const inputEl = ev.target as HTMLInputElement;
    const files = Array.from(inputEl.files ?? []).slice(0, this.max() - this.images().length);
    this.busy.set(true);
    try {
      const urls = await Promise.all(files.map((f) => this.resize(f)));
      this.images.update((list) => [...list, ...urls]);
    } finally {
      this.busy.set(false);
      inputEl.value = '';
    }
  }

  remove(i: number): void {
    this.images.update((list) => list.filter((_, ix) => ix !== i));
  }

  makeMain(i: number): void {
    this.images.update((list) => [list[i], ...list.filter((_, ix) => ix !== i)]);
  }

  private resize(file: File, maxSide = 900): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagem inválida'));
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }
}

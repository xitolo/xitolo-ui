import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FREE_SHIPPING_FROM, PROVINCES } from '../../../domain/value-objects/shipping';
import { PAYMENT_METHODS } from '../../../domain/value-objects/statuses';
import { MznPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-help-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MznPipe, RouterLink],
  styles: `.wrap{max-width:860px;margin:0 auto} section{scroll-margin-top:140px;margin-bottom:16px}
    h2{font-size:19px;margin-bottom:8px} p,li{color:var(--ink-2);font-size:14.5px} ul{padding-left:18px} li{margin:4px 0}
    nav{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px}`,
  template: `
    <div class="container page wrap">
      <div class="page-head"><div><h1>Ajuda</h1><p>Tudo o que precisas de saber sobre compras na Xitolo.</p></div></div>
      <nav class="chips">
        <a class="chip" routerLink="." fragment="entregas">Entregas</a>
        <a class="chip" routerLink="." fragment="pagamentos">Pagamentos</a>
        <a class="chip" routerLink="." fragment="trocas">Trocas</a>
        <a class="chip" routerLink="." fragment="tamanhos">Tamanhos</a>
        <a class="chip" routerLink="." fragment="sobre">Sobre nós</a>
        <a class="chip" routerLink="." fragment="termos">Termos</a>
      </nav>

      <section id="entregas" class="card pad">
        <h2>Entregas</h2>
        <p>Entregamos nas 11 províncias. Envio grátis em entregas ao domicílio a partir de {{ free | mzn }}.</p>
        <div class="table-wrap" style="margin-top:10px">
          <table class="table">
            <thead><tr><th>Província</th><th>Prazo</th><th class="num">Taxa</th></tr></thead>
            <tbody>
              @for (p of provinces; track p.name) {
                <tr><td>{{ p.name }}</td><td>{{ p.etaLabel }}</td><td class="num">{{ p.fee | mzn }}</td></tr>
              }
            </tbody>
          </table>
        </div>
        <p class="small muted" style="margin-top:8px">Expresso no mesmo dia (+150 MT) e levantamento grátis na loja disponíveis em Maputo.</p>
      </section>

      <section id="pagamentos" class="card pad">
        <h2>Formas de pagamento</h2>
        <ul>
          @for (m of methods; track m.id) { <li><b>{{ m.label }}</b> — {{ m.description }}</li> }
        </ul>
        <p class="small muted">As encomendas pagas por M-Pesa, e-Mola ou transferência são preparadas depois da confirmação do pagamento.</p>
      </section>

      <section id="trocas" class="card pad">
        <h2>Trocas e devoluções</h2>
        <p>Tens 7 dias após a entrega para trocar o tamanho, sem custos, desde que a peça esteja sem uso e com etiqueta. Contacta-nos pelo WhatsApp +258 84 000 0000 com o número da encomenda.</p>
      </section>

      <section id="tamanhos" class="card pad">
        <h2>Guia de tamanhos</h2>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Tamanho</th><th>Peito (cm)</th><th>Cintura (cm)</th><th>Anca (cm)</th></tr></thead>
            <tbody>
              <tr><td>XS</td><td>80–84</td><td>62–66</td><td>86–90</td></tr>
              <tr><td>S</td><td>84–88</td><td>66–70</td><td>90–94</td></tr>
              <tr><td>M</td><td>88–94</td><td>70–76</td><td>94–100</td></tr>
              <tr><td>L</td><td>94–100</td><td>76–82</td><td>100–106</td></tr>
              <tr><td>XL</td><td>100–106</td><td>82–88</td><td>106–112</td></tr>
              <tr><td>XXL</td><td>106–112</td><td>88–96</td><td>112–118</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="sobre" class="card pad">
        <h2>Sobre a Xitolo</h2>
        <p>“Xitolo” quer dizer loja. Somos uma loja online moçambicana de moda acessível, com uma colecção própria de peças em capulana feitas por costureiras parceiras em Maputo.</p>
      </section>

      <section id="termos" class="card pad">
        <h2>Termos e condições</h2>
        <p>Esta é uma versão de demonstração. Nenhum pagamento real é processado e os dados ficam guardados apenas neste navegador.</p>
      </section>
    </div>
  `,
})
export class HelpPage {
  protected readonly provinces = PROVINCES;
  protected readonly methods = Object.values(PAYMENT_METHODS);
  protected readonly free = FREE_SHIPPING_FROM;
}

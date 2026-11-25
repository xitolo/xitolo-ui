import { GarmentType } from '../../domain/entities/common';

/* Dados base do catálogo de demonstração (preços em MT). */

export interface CategorySeed {
  id: string;
  name: string;
  description: string;
  type: GarmentType;
  color: string;
}

export const CATEGORY_SEED: CategorySeed[] = [
  { id: 'cat_mulher', name: 'Mulher', description: 'Vestidos, saias, tops e calças para todas as ocasiões.', type: 'dress', color: 'Rosa' },
  { id: 'cat_homem', name: 'Homem', description: 'Camisas, t-shirts, polos e calças com conforto para o calor.', type: 'shirt', color: 'Azul' },
  { id: 'cat_crianca', name: 'Criança', description: 'Roupa resistente e colorida para os mais pequenos.', type: 'tee', color: 'Amarelo' },
  { id: 'cat_capulana', name: 'Capulana', description: 'Peças feitas com capulana por costureiras moçambicanas.', type: 'wrap', color: 'Laranja' },
  { id: 'cat_calcado', name: 'Calçado', description: 'Ténis, sandálias e chinelos.', type: 'shoe', color: 'Branco' },
  { id: 'cat_acessorios', name: 'Acessórios', description: 'Malas, bonés e outros detalhes.', type: 'bag', color: 'Castanho' },
];

export interface ProductSeed {
  name: string;
  cat: string;
  type: GarmentType;
  price: number;
  promo: number | null;
  colors: string[];
  sizes: string[];
  stock: number;
  min: number;
  popularity: number;
  local?: boolean;
  inactive?: boolean;
  ageDays: number;
  desc: string;
  features: string[];
}

const S = ['S', 'M', 'L', 'XL'];
const SX = ['S', 'M', 'L', 'XL', 'XXL'];

export const PRODUCT_SEED: ProductSeed[] = [
  { name: 'Vestido midi floral com alças', cat: 'cat_mulher', type: 'dress', price: 1490, promo: 890, colors: ['Rosa', 'Amarelo', 'Azul'], sizes: S, stock: 70, min: 10, popularity: 9, ageDays: 120,
    desc: 'Vestido midi leve com estampado floral, alças ajustáveis e saia fluida. Perfeito para os dias quentes de Maputo.', features: ['100% viscose', 'Alças ajustáveis', 'Forro na parte superior', 'Lavar à máquina a 30°'] },
  { name: 'Vestido capulana de manga balão', cat: 'cat_capulana', type: 'dress', price: 1650, promo: null, colors: ['Laranja', 'Verde'], sizes: SX, stock: 28, min: 6, popularity: 7, local: true, ageDays: 20,
    desc: 'Vestido em capulana 100% algodão com mangas balão e cinto do mesmo tecido. Costurado à mão em Maputo.', features: ['Capulana 100% algodão', 'Feito à mão', 'Cinto incluído', 'Padrão ligeiramente único em cada peça'] },
  { name: 'T-shirt oversize básica algodão', cat: 'cat_homem', type: 'tee', price: 450, promo: null, colors: ['Preto', 'Branco', 'Verde', 'Bege'], sizes: SX, stock: 160, min: 20, popularity: 10, ageDays: 150,
    desc: 'A t-shirt de todos os dias: corte largo, algodão penteado de 180 g e gola reforçada.', features: ['Algodão penteado 180 g/m²', 'Corte oversize', 'Gola canelada reforçada'] },
  { name: 'Calças de ganga slim stretch', cat: 'cat_homem', type: 'pants', price: 1590, promo: 1190, colors: ['Ganga', 'Preto'], sizes: ['30', '32', '34', '36', '38'], stock: 55, min: 8, popularity: 7, ageDays: 110,
    desc: 'Ganga com elastano para mais conforto, corte slim e cinco bolsos.', features: ['98% algodão, 2% elastano', 'Corte slim', 'Cinco bolsos'] },
  { name: 'Saia plissada cintura alta', cat: 'cat_mulher', type: 'skirt', price: 690, promo: null, colors: ['Bege', 'Preto', 'Verde'], sizes: ['S', 'M', 'L'], stock: 40, min: 8, popularity: 5, ageDays: 12,
    desc: 'Saia midi plissada com cintura alta elástica, fácil de combinar.', features: ['Poliéster acetinado', 'Cintura elástica', 'Comprimento midi'] },
  { name: 'Camisa capulana manga curta', cat: 'cat_capulana', type: 'shirt', price: 1250, promo: null, colors: ['Azul', 'Laranja', 'Vermelho'], sizes: ['M', 'L', 'XL', 'XXL'], stock: 32, min: 6, popularity: 6, local: true, ageDays: 70,
    desc: 'Camisa de capulana com corte direito, ideal para festas e sextas-feiras no escritório.', features: ['Capulana 100% algodão', 'Botões de coco', 'Feito em Maputo'] },
  { name: 'Ténis brancos casual', cat: 'cat_calcado', type: 'shoe', price: 1990, promo: 1450, colors: ['Branco', 'Preto'], sizes: ['38', '39', '40', '41', '42', '43'], stock: 48, min: 8, popularity: 8, ageDays: 100,
    desc: 'Ténis de cano baixo em pele sintética com sola de borracha antiderrapante.', features: ['Pele sintética', 'Palmilha almofadada', 'Sola de borracha'] },
  { name: 'Mala tote de capulana', cat: 'cat_acessorios', type: 'bag', price: 590, promo: null, colors: ['Laranja', 'Verde', 'Azul'], sizes: ['Único'], stock: 45, min: 8, popularity: 7, local: true, ageDays: 90,
    desc: 'Mala tote espaçosa com forro e bolso interior, em capulana resistente.', features: ['Capulana dupla', 'Bolso interior', 'Alças reforçadas'] },
  { name: 'Conjunto infantil t-shirt + calções', cat: 'cat_crianca', type: 'tee', price: 750, promo: 520, colors: ['Amarelo', 'Azul', 'Rosa'], sizes: ['2A', '4A', '6A', '8A'], stock: 50, min: 10, popularity: 7, ageDays: 80,
    desc: 'Conjunto de algodão macio para brincar o dia inteiro.', features: ['100% algodão', 'Calções com elástico', 'Lavar à máquina'] },
  { name: 'Vestido de festa menina', cat: 'cat_crianca', type: 'dress', price: 780, promo: null, colors: ['Rosa', 'Branco'], sizes: ['4A', '6A', '8A', '10A'], stock: 22, min: 6, popularity: 4, ageDays: 9,
    desc: 'Vestido com saia de tule e laço na cintura para aniversários e casamentos.', features: ['Saia em tule', 'Forro de algodão', 'Fecho nas costas'] },
  { name: 'Top cropped canelado', cat: 'cat_mulher', type: 'tee', price: 490, promo: 350, colors: ['Branco', 'Preto', 'Rosa', 'Verde'], sizes: ['XS', 'S', 'M', 'L'], stock: 90, min: 15, popularity: 9, ageDays: 95,
    desc: 'Top curto em malha canelada elástica que se ajusta ao corpo.', features: ['Malha canelada', 'Elástico', 'Corte curto'] },
  { name: 'Calças cargo largas', cat: 'cat_mulher', type: 'pants', price: 1090, promo: null, colors: ['Bege', 'Verde', 'Preto'], sizes: S, stock: 35, min: 8, popularity: 6, ageDays: 15,
    desc: 'Calças cargo de corte largo com bolsos laterais e cintura ajustável.', features: ['Sarja de algodão', 'Seis bolsos', 'Cordão na cintura'] },
  { name: 'Sandálias rasas de tiras', cat: 'cat_calcado', type: 'shoe', price: 650, promo: null, colors: ['Castanho', 'Preto'], sizes: ['36', '37', '38', '39', '40'], stock: 6, min: 8, popularity: 6, ageDays: 85,
    desc: 'Sandálias rasas com tiras cruzadas e fivela ajustável.', features: ['Pele sintética', 'Fivela metálica', 'Sola flexível'] },
  { name: 'Capulana tradicional 2 metros', cat: 'cat_capulana', type: 'wrap', price: 600, promo: null, colors: ['Laranja', 'Azul', 'Vermelho', 'Verde'], sizes: ['Único'], stock: 200, min: 25, popularity: 10, local: true, ageDays: 160,
    desc: 'Capulana de 2 metros em algodão estampado, com as cores vivas de sempre.', features: ['2 m × 1,15 m', '100% algodão', 'Cores resistentes à lavagem'] },
  { name: 'Polo piqué clássico', cat: 'cat_homem', type: 'shirt', price: 890, promo: 690, colors: ['Azul', 'Branco', 'Preto'], sizes: S, stock: 60, min: 10, popularity: 7, ageDays: 130,
    desc: 'Polo em malha piqué com três botões e gola firme.', features: ['Piqué de algodão', 'Três botões', 'Aberturas laterais'] },
  { name: 'Boné ajustável bordado', cat: 'cat_acessorios', type: 'cap', price: 290, promo: null, colors: ['Preto', 'Bege', 'Verde'], sizes: ['Único'], stock: 80, min: 15, popularity: 7, ageDays: 18,
    desc: 'Boné de seis painéis com bordado frontal Xitolo e fecho ajustável.', features: ['Algodão', 'Fecho ajustável', 'Bordado frontal'] },
  { name: 'Vestido longo de verão', cat: 'cat_mulher', type: 'dress', price: 1150, promo: null, colors: ['Amarelo', 'Branco', 'Verde'], sizes: S, stock: 30, min: 6, popularity: 5, ageDays: 6,
    desc: 'Vestido longo e fresco com decote em V e fenda lateral.', features: ['Viscose', 'Decote em V', 'Fenda lateral'] },
  { name: 'Calções de praia Costa do Sol', cat: 'cat_homem', type: 'shorts', price: 650, promo: 480, colors: ['Azul', 'Laranja', 'Verde'], sizes: S, stock: 70, min: 10, popularity: 8, ageDays: 75,
    desc: 'Calções de banho de secagem rápida com rede interior.', features: ['Secagem rápida', 'Rede interior', 'Bolso traseiro com velcro'] },
  { name: 'Saia capulana envelope', cat: 'cat_capulana', type: 'skirt', price: 890, promo: null, colors: ['Vermelho', 'Amarelo', 'Azul'], sizes: S, stock: 4, min: 6, popularity: 6, local: true, ageDays: 14,
    desc: 'Saia envelope em capulana que se ajusta a vários tamanhos com laço lateral.', features: ['Capulana 100% algodão', 'Ajuste com laço', 'Feito à mão'] },
  { name: 'Camisa de linho manga comprida', cat: 'cat_homem', type: 'shirt', price: 1350, promo: null, colors: ['Branco', 'Bege'], sizes: ['M', 'L', 'XL'], stock: 25, min: 5, popularity: 4, ageDays: 10,
    desc: 'Camisa de linho respirável, ideal para cerimónias e dias de calor.', features: ['55% linho, 45% algodão', 'Corte regular', 'Botões de madrepérola'] },
  { name: 'Chinelos de verão', cat: 'cat_calcado', type: 'shoe', price: 390, promo: 290, colors: ['Preto', 'Azul', 'Rosa'], sizes: ['36-37', '38-39', '40-41', '42-43'], stock: 120, min: 20, popularity: 9, ageDays: 140,
    desc: 'Chinelos de borracha leves e confortáveis.', features: ['Borracha EVA', 'Antiderrapante', 'Resistentes à água'] },
  { name: 'Mala de ombro em pele sintética', cat: 'cat_acessorios', type: 'bag', price: 1390, promo: 990, colors: ['Preto', 'Castanho', 'Bege'], sizes: ['Único'], stock: 0, min: 5, popularity: 5, ageDays: 60,
    desc: 'Mala de ombro estruturada com alça regulável e fecho de correr.', features: ['Pele sintética', 'Alça regulável', 'Três compartimentos'] },
  { name: 'Calções de ganga criança', cat: 'cat_crianca', type: 'shorts', price: 420, promo: null, colors: ['Ganga'], sizes: ['4A', '6A', '8A', '10A', '12A'], stock: 38, min: 8, popularity: 5, ageDays: 65,
    desc: 'Calções de ganga resistentes com cintura ajustável por dentro.', features: ['Ganga de algodão', 'Cintura ajustável', 'Costuras reforçadas'] },
  { name: 'Calças de fato alfaiataria', cat: 'cat_mulher', type: 'pants', price: 1290, promo: null, colors: ['Preto', 'Bege', 'Castanho'], sizes: S, stock: 26, min: 6, popularity: 4, ageDays: 22,
    desc: 'Calças de alfaiataria com vinco, cintura alta e perna recta.', features: ['Tecido com caimento', 'Cintura alta', 'Perna recta'] },
  { name: 'T-shirt estampada Moçambique', cat: 'cat_homem', type: 'tee', price: 550, promo: null, colors: ['Branco', 'Preto', 'Amarelo'], sizes: SX, stock: 75, min: 12, popularity: 6, local: true, ageDays: 4,
    desc: 'T-shirt com estampado inspirado no mapa e nas cores de Moçambique, impressa em Maputo.', features: ['100% algodão', 'Serigrafia local', 'Corte regular'] },
  { name: 'Lenço de cabeça capulana', cat: 'cat_capulana', type: 'wrap', price: 350, promo: null, colors: ['Vermelho', 'Amarelo', 'Verde', 'Azul'], sizes: ['Único'], stock: 95, min: 15, popularity: 6, local: true, ageDays: 40,
    desc: 'Lenço em capulana para amarrar no cabelo ou usar ao pescoço.', features: ['90 × 90 cm', 'Algodão', 'Bainha feita à mão'] },
  { name: 'Sapatilhas de corrida leves', cat: 'cat_calcado', type: 'shoe', price: 2490, promo: null, colors: ['Preto', 'Azul'], sizes: ['39', '40', '41', '42', '43', '44'], stock: 18, min: 5, popularity: 4, ageDays: 3,
    desc: 'Sapatilhas de malha respirável com entressola amortecedora.', features: ['Malha respirável', 'Amortecimento EVA', 'Peso: 240 g'] },
  { name: 'Mochila escolar reforçada', cat: 'cat_crianca', type: 'bag', price: 890, promo: null, colors: ['Azul', 'Rosa', 'Preto'], sizes: ['Único'], stock: 30, min: 8, popularity: 4, ageDays: 50,
    desc: 'Mochila com compartimento para portátil, bolsos laterais e costas almofadadas.', features: ['Poliéster impermeável', 'Costas almofadadas', 'Capacidade 20 L'] },
  { name: 'Blusa de cetim manga comprida', cat: 'cat_mulher', type: 'shirt', price: 980, promo: null, colors: ['Branco', 'Rosa', 'Preto'], sizes: S, stock: 3, min: 6, popularity: 5, ageDays: 30,
    desc: 'Blusa elegante em cetim com punhos de botão.', features: ['Cetim', 'Punhos com botão', 'Corte fluido'] },
  { name: 'Calções desportivos', cat: 'cat_homem', type: 'shorts', price: 520, promo: null, colors: ['Preto', 'Cinzento', 'Azul'], sizes: S, stock: 64, min: 10, popularity: 5, ageDays: 45,
    desc: 'Calções leves para treino com cintura elástica e bolsos.', features: ['Tecido técnico', 'Cintura elástica', 'Bolsos laterais'] },
  { name: 'Chapéu de palha praia', cat: 'cat_acessorios', type: 'cap', price: 450, promo: null, colors: ['Bege'], sizes: ['Único'], stock: 15, min: 5, popularity: 3, inactive: true, ageDays: 200,
    desc: 'Chapéu de palha de aba larga (colecção anterior).', features: ['Palha natural', 'Aba larga'] },
  { name: 'Macacão de capulana', cat: 'cat_capulana', type: 'dress', price: 1850, promo: null, colors: ['Verde', 'Vermelho'], sizes: S, stock: 12, min: 4, popularity: 4, local: true, ageDays: 2,
    desc: 'Macacão de capulana com bolsos e cinto, uma peça de destaque da nova colecção.', features: ['Capulana 100% algodão', 'Bolsos laterais', 'Feito à mão'] },
];

export const REVIEW_COMMENTS: Record<number, string[]> = {
  5: [
    'Adorei! O tecido é muito bom e chegou antes do prazo.',
    'Excelente qualidade, recomendo. Vou voltar a comprar.',
    'Ficou perfeito, o tamanho corresponde à tabela.',
    'Muito bonito e confortável. A entrega foi rápida.',
    'Peça linda, a minha irmã também quer uma!',
  ],
  4: [
    'Gostei bastante, só achei a cor um pouco mais escura que na foto.',
    'Boa qualidade pelo preço. A entrega demorou um dia a mais.',
    'Confortável, mas veste um pouco largo — escolham um tamanho abaixo.',
  ],
  3: ['É razoável. Esperava um tecido mais grosso.', 'Bom, mas a costura de um lado não estava perfeita.'],
  2: ['O tamanho não correspondeu, tive de trocar.'],
};

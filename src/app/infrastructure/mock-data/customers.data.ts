/* Clientes de demonstração. Palavra-passe de todos: xitolo123 */

export interface CustomerSeed {
  id: string;
  name: string;
  email: string;
  phone: string;
  province: string;
  city: string;
  street: string;
  reference: string;
  weight: number;
  ageDays: number;
  active?: boolean;
}

export const DEMO_PASSWORD = 'xitolo123';

export const CUSTOMER_SEED: CustomerSeed[] = [
  { id: 'cli_ana', name: 'Ana Macuácua', email: 'ana@exemplo.co.mz', phone: '841234567', province: 'Maputo Cidade', city: 'Maputo', street: 'Bairro da Malhangalene, Rua da Resistência, 1234', reference: 'Perto da escola primária, portão azul', weight: 6, ageDays: 150 },
  { id: 'cli_joao', name: 'João Sitoe', email: 'joao.sitoe@exemplo.co.mz', phone: '852345678', province: 'Maputo Província', city: 'Matola', street: 'Bairro Fomento, Rua 3, casa 45', reference: 'Atrás do mercado', weight: 4, ageDays: 140 },
  { id: 'cli_celia', name: 'Célia Nhantumbo', email: 'celia.n@exemplo.co.mz', phone: '867654321', province: 'Sofala', city: 'Beira', street: 'Bairro da Ponta Gêa, Av. Eduardo Mondlane, 210', reference: 'Prédio amarelo, 2º andar', weight: 3, ageDays: 120 },
  { id: 'cli_fernando', name: 'Fernando Chissano', email: 'fernando.c@exemplo.co.mz', phone: '823456789', province: 'Nampula', city: 'Nampula', street: 'Bairro de Muahivire, Rua dos Sem Medo, 77', reference: 'Junto à farmácia', weight: 2, ageDays: 110 },
  { id: 'cli_luisa', name: 'Luísa Mondlane', email: 'luisa.m@exemplo.co.mz', phone: '845556677', province: 'Maputo Cidade', city: 'Maputo', street: 'Bairro da Sommerschield, Rua Kassuende, 98', reference: 'Condomínio Acácias, casa 4', weight: 5, ageDays: 130 },
  { id: 'cli_tomas', name: 'Tomás Cumbe', email: 'tomas.cumbe@exemplo.co.mz', phone: '871112233', province: 'Gaza', city: 'Xai-Xai', street: 'Bairro 1, Av. Samora Machel, 15', reference: 'Frente à igreja', weight: 2, ageDays: 95 },
  { id: 'cli_marta', name: 'Marta Tembe', email: 'marta.tembe@exemplo.co.mz', phone: '848889900', province: 'Maputo Província', city: 'Marracuene', street: 'Bairro Agostinho Neto, Rua 7, 300', reference: 'Casa com muro verde', weight: 3, ageDays: 80 },
  { id: 'cli_paulo', name: 'Paulo Guambe', email: 'paulo.g@exemplo.co.mz', phone: '826667788', province: 'Inhambane', city: 'Maxixe', street: 'Bairro Chambone, Rua 2, 61', reference: 'Perto do terminal', weight: 2, ageDays: 70 },
  { id: 'cli_rosa', name: 'Rosa Matsinhe', email: 'rosa.m@exemplo.co.mz', phone: '854443322', province: 'Maputo Cidade', city: 'Maputo', street: 'Bairro do Alto Maé, Av. Guerra Popular, 540', reference: 'Prédio ao lado da padaria', weight: 4, ageDays: 60 },
  { id: 'cli_helio', name: 'Hélio Bila', email: 'helio.bila@exemplo.co.mz', phone: '862223344', province: 'Tete', city: 'Tete', street: 'Bairro Chingodzi, Rua 12, 8', reference: 'Junto ao campo de futebol', weight: 1, ageDays: 50 },
  { id: 'cli_esperanca', name: 'Esperança Muianga', email: 'esperanca@exemplo.co.mz', phone: '847771122', province: 'Zambézia', city: 'Quelimane', street: 'Bairro Coalane, Rua 5, 102', reference: 'Casa de esquina', weight: 2, ageDays: 40 },
  { id: 'cli_daniel', name: 'Daniel Mabote', email: 'daniel.m@exemplo.co.mz', phone: '843332211', province: 'Maputo Cidade', city: 'Maputo', street: 'Bairro Central, Av. Julius Nyerere, 1100', reference: 'Edifício 33 andares, 12º', weight: 3, ageDays: 30 },
  { id: 'cli_neide', name: 'Neide Cossa', email: 'neide.cossa@exemplo.co.mz', phone: '879998877', province: 'Cabo Delgado', city: 'Pemba', street: 'Bairro de Cariacó, Rua 4, 19', reference: 'Perto da praia do Wimbe', weight: 1, ageDays: 20 },
  { id: 'cli_simao', name: 'Simão Langa', email: 'simao.l@exemplo.co.mz', phone: '828880011', province: 'Manica', city: 'Chimoio', street: 'Bairro 25 de Setembro, Rua 9, 70', reference: 'Frente ao posto de saúde', weight: 1, ageDays: 10, active: false },
];

# Gestão de Cautelas

Site estático para controlar cautelas (empréstimo de materiais/equipamentos) em formato de calendário.

## Como usar

Abra o `index.html` no navegador. Não precisa de servidor nem de instalação.
Também dá para publicar direto no GitHub Pages.

## Funcionalidades

- **Calendário mensal** mostrando, em cada dia:
  - 🔵 retiradas de material
  - 🟠 devoluções previstas (🔴 quando já estão atrasadas)
  - 🟢 devoluções feitas
- Clique em um dia para ver as movimentações dele e criar uma cautela naquela data.
- **Cadastro** com material, patrimônio/nº de série, quantidade, responsável, identificação,
  datas de retirada, devolução prevista e devolução efetiva, quem entregou e observações.
- **Painel** com totais de cautelas ativas, com devolução hoje, atrasadas e devolvidas.
- **Lista** com busca, filtro por status e botão rápido de "Devolver".
- **Exportar CSV** (abre no Excel) e **backup/importação em JSON**.

## Armazenamento

Os dados ficam no `localStorage` do navegador: cada computador/navegador tem sua própria base.
Use o backup JSON para levar os dados para outra máquina ou guardar uma cópia.

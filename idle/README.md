# Saque Infinito

RPG idle em pixel art para celular, no estilo *Taskbar Hero*: o herói luta sozinho numa faixa de
batalha, encontra equipamentos com raridade e número de série, e os jogadores negociam esses itens
num **mercado** com preços definidos por eles.

## Como funciona

- **Combate automático:** o herói avança por zonas (10 inimigos + 1 chefe cada). A cada 5 zonas
  muda o bioma: Campos Verdes, Floresta Sombria, Cripta Esquecida, Picos Gelados e Terras de Cinza.
- **Saque:** 11 tipos de item em 6 espaços (arma, cabeça, armadura, botas, anel, amuleto) e
  6 raridades: Comum, Incomum, Raro, Épico, Lendário e Mítico. Cada raridade acima de Comum traz
  um atributo extra. Itens míticos têm nome próprio. Cada item tem um número de série (Nº 0001 a 9999).
- **Fusão:** 6 itens da mesma raridade viram 1 item da raridade seguinte, com o nível médio deles
  e o tipo que mais aparece entre os 6. Cada tentativa custa ouro e pode falhar:

  | Fusão | Chance | Bônus por falha |
  |---|---|---|
  | Comum → Incomum | 90% | +5% |
  | Incomum → Raro | 75% | +6% |
  | Raro → Épico | 55% | +8% |
  | Épico → Lendário | 35% | +8% |
  | Lendário → Mítico | 15% | +5% |

  Se falhar, os 6 itens se perdem, mas a próxima fusão daquele nível ganha o bônus da tabela
  (acumula até 95% e volta ao normal no próximo sucesso). As chances ficam em `FUSE_CHANCE`
  e `FUSE_PITY` no `game.js`.
- **Progresso offline:** ao voltar, o jogo calcula até 12 h de luta (ouro, experiência e itens).
- **Mercado:**
  - anuncie qualquer item da mochila pelo preço que quiser;
  - outros jogadores compram com ouro, e o vendedor recebe o valor menos **5% de taxa**;
  - mercadores NPC sempre têm itens à venda e compram anúncios com preço justo, então o mercado
    nunca fica vazio.

Para rodar: `python3 -m http.server` nesta pasta e abra `http://localhost:8000`.

## Modos do mercado

| Modo | Quando | Como |
|---|---|---|
| Local | arquivo aberto direto ou no GitHub Pages | só mercadores NPC; anúncios ficam no navegador |
| Compartilhado | página publicada no claude.ai | anúncios num banco compartilhado por quem tem acesso à página, ao vivo |

No modo compartilhado, cada compra reserva o anúncio antes de pagar, assim duas pessoas não compram
o mesmo item. Quem vende recebe o ouro quando abre o jogo, mesmo que a venda tenha acontecido
com o jogo fechado. Itens vindos de outros jogadores passam por `cleanItem()`, que recusa campos
desconhecidos e limita cada atributo ao máximo possível para aquele nível e raridade.

## Antes de lançar na loja

Hoje o jogo confia no aparelho de cada jogador. Para um mercado público:

1. **Servidor que valida tudo:** o servidor deve gerar os itens e processar compra e venda numa
   transação. Opções: Firebase com Cloud Functions, que este repositório já usa no site de
   cautelas, ou Supabase. O código do mercado está isolado no objeto `Market` em `game.js`, então
   basta trocar a parte "shared" pelas chamadas ao servidor.
2. **Contas:** login (Google Play Games ou Firebase Auth) para ligar o progresso ao jogador.
3. **Regras das lojas:** mantenha o ouro do mercado como moeda **só do jogo**, sem saque em dinheiro
   real. Venda de itens por dinheiro entre jogadores traz exigências legais e de política das lojas.
4. **Monetização sugerida:**
   - gemas (compra no app) para mais vagas de anúncio, taxa reduzida e espaço extra na mochila;
   - passe de temporada com visuais exclusivos;
   - anúncio com recompensa para dobrar o ganho offline.

## Onde mexer no código (`game.js`)

- `RAR`: chances, multiplicadores e valores de cada raridade.
- `BASES` e `STATS`: tipos de item e atributos. `MITICOS` guarda os nomes únicos.
- `BIOMES` e `enemyFor()`: biomas, inimigos e curva de dificuldade.
- `Market`: anunciar, comprar, cancelar, receber pagamento e mercadores NPC.
- `doFuse()`, `FUSE_CHANCE`, `FUSE_PITY` e `FUSE_COST`: regras da fusão.

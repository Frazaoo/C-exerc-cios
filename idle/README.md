# Saque Infinito

RPG idle em pixel art para celular, no estilo *Taskbar Hero*. Uma party de 3 heróis luta sozinha
numa faixa de batalha, encontra equipamentos e pets com raridade e número de série, e os jogadores
negociam esses itens num **mercado** com os preços que quiserem.

Para jogar localmente: `python3 -m http.server` nesta pasta e abra `http://localhost:8000`.

## Party e classes

São 3 heróis ativos por vez. Cada um tem nível, equipamento e uma habilidade especial com tempo
de recarga. Os inimigos preferem atacar o Cavaleiro quando ele está na party.

| Classe | Papel | Armas | Habilidade | Custo |
|---|---|---|---|---|
| Cavaleiro | Tanque | Espada, Martelo | Muralha: party recebe 50% menos dano por 4s | grátis |
| Arqueira | Dano | Arco, Besta | Rajada: 6 flechas rápidas | grátis |
| Sacerdote | Cura | Cetro, Livro Sagrado | Luz Sagrada: cura 40% de todos e revive | grátis |
| Mago | Área | Cajado, Orbe | Meteoro: 300% de dano em todos os inimigos | 300 |
| Bárbaro | Equilibrado | Machado, Montante | Redemoinho: 160% em todos e se cura | 1.200 |
| Ladino | Crítico | Adaga, Lâminas Gêmeas | Golpe Sombrio: crítico de 500% | 4.000 |
| Necromante | Dreno | Foice, Grimório | Exército: 2 esqueletos lutam por 8s | 12.000 |
| Bardo | Suporte | Alaúde, Flauta | Balada: party ataca 60% mais rápido por 5s | 30.000 |

## Itens

Cada arma pertence a uma classe e tem um perfil de atributos próprio. Armaduras e acessórios
servem em qualquer herói.

| Item | Atributos principais | Para quem |
|---|---|---|
| Espada | Ataque, Bloqueio | Cavaleiro que segura dano |
| Martelo | Ataque alto, Vida | Cavaleiro que bate forte |
| Arco | Ataque, Velocidade de ataque | Dano constante |
| Besta | Ataque muito alto, Dano crítico | Golpes lentos e pesados |
| Cetro | Poder de cura alto, Vida | Cura forte |
| Livro Sagrado | Poder de cura, Velocidade | Cura frequente |
| Cajado | Ataque, Dano em área | Mago equilibrado |
| Orbe | Dano em área muito alto, Crítico | Limpar ondas |
| Machado | Ataque, Dano crítico | Bárbaro ofensivo |
| Montante | Ataque, Roubo de vida | Bárbaro que se sustenta |
| Adaga | Velocidade, Crítico | Muitos golpes |
| Lâminas Gêmeas | Crítico, Esquiva | Ladino evasivo |
| Foice | Ataque, Roubo de vida alto | Necromante que cura a party |
| Grimório | Ataque, Dano em área | Necromante ofensivo |
| Alaúde | Inspiração (dano da party), Velocidade | Bardo de dano |
| Flauta | Inspiração, Poder de cura | Bardo de suporte |

**Raridade:** multiplica todos os atributos do item e adiciona atributos extras.

| Raridade | Multiplicador | Atributos extras |
|---|---|---|
| Comum | ×1 | 0 |
| Incomum | ×1,25 | 1 |
| Raro | ×1,6 | 2 |
| Épico | ×2,1 | 3 |
| Lendário | ×2,8 | 4 |
| Mítico | ×3,8 | 5 |

Por exemplo, o crítico de um anel vai de cerca de 4% (Comum) a 15% (Mítico). Itens míticos têm
nome único.

## Pets

Caem dos chefes e dão um bônus para toda a party. O primeiro chefe de cada bioma sempre deixa o
seu pet; depois, a chance é de 8% (maior com Sorte). Só um pet fica ativo. Pets também podem ser
vendidos no mercado.

| Pet | Bioma | Bônus |
|---|---|---|
| Slime Dourado | Campos Verdes | Ouro extra |
| Lobinho | Floresta Sombria | Dano da party |
| Fantasminha | Cripta Esquecida | Sorte |
| Golemzinho | Picos Gelados | Vida da party |
| Dragãozinho | Terras de Cinza | Crítico, e cospe fogo nos inimigos |

## Fusão

6 itens da mesma raridade viram 1 item da raridade seguinte. Se falhar, os 6 se perdem, e a
próxima fusão daquele nível ganha chance extra.

| Fusão | Chance | Bônus por falha |
|---|---|---|
| Comum → Incomum | 90% | +5% |
| Incomum → Raro | 75% | +6% |
| Raro → Épico | 55% | +8% |
| Épico → Lendário | 35% | +8% |
| Lendário → Mítico | 15% | +5% |

## Mercado

Taxa de 5% sobre cada venda. Mercadores NPC sempre têm itens à venda. Ao anunciar, o jogo mostra as
últimas vendas daquele tipo e raridade para ajudar a escolher o preço.

| Modo | Quando | Segurança |
|---|---|---|
| Local | sem servidor configurado | só mercadores; tudo fica no aparelho |
| Compartilhado | página publicada no claude.ai | anúncios compartilhados entre quem tem acesso |
| **Online (Firebase)** | `firebase-config.js` preenchido | servidor confere cada compra e venda |

### Como o servidor protege a economia

- **Ouro:** fica no servidor (`carteiras/{uid}`). O jogo só informa quanto ganhou, e o servidor
  aceita no máximo o que daria para ganhar no tempo real que passou e na zona alcançada. A zona
  sobe no máximo 1 a cada 20 segundos.
- **Anunciar, comprar e cancelar:** são Cloud Functions que rodam em transação. Duas pessoas não
  compram o mesmo item, e o vendedor recebe na hora, mesmo offline.
- **Itens:**
  - todo item anunciado passa por `cleanItem()` em `regras.js`, o mesmo código do jogo;
  - atributos impossíveis para o nível e a raridade são cortados;
  - o nível não pode passar da zona do jogador.
- **Duplicação:** o servidor registra o dono de cada item negociado (`donos/{id}`). Uma cópia antiga
  de um item já vendido não pode ser anunciada de novo.
- **Regras do Firestore:** o app só lê o mercado e grava o próprio progresso. Ouro, anúncios e
  caixa de entrada só o servidor grava.

Ainda é possível, para quem modifica o jogo, gerar itens bons dentro dos limites. O próximo passo
é o servidor sortear os próprios itens a partir do progresso registrado.

### Configurar o Firebase (uma vez)

1. Em <https://console.firebase.google.com>, crie um projeto. As Cloud Functions exigem o plano
   **Blaze** (paga pelo uso, com cota gratuita mensal; um jogo pequeno costuma ficar dentro dela).
2. **Authentication** → Método de login → ative **Anônimo**.
3. **Firestore Database** → criar banco, região `southamerica-east1` (São Paulo).
4. No computador:
   ```bash
   npm install -g firebase-tools
   firebase login
   cd idle
   firebase use --add            # escolha o projeto criado
   cd functions && npm install && cd ..
   firebase deploy               # regras, índices, funções e o site do jogo
   ```
5. Em Configurações do projeto → Geral → Seus apps, crie um app da Web, copie a configuração para
   `firebase-config.js` e rode `firebase deploy --only hosting` de novo. O jogo fica no endereço
   `https://SEU-PROJETO.web.app`.

### Testar o servidor no computador (sem custo)

```bash
cd idle/functions && npm install && npm run emular
```

Em outro terminal, sirva a pasta `idle` e, em `firebase-config.js`, use
`window.FIREBASE_CONFIG = { apiKey: 'demo', projectId: 'demo-saque', authDomain: 'demo-saque.firebaseapp.com', appId: 'demo' }`
e `window.FIREBASE_EMULADOR = true`.

## Onde mexer no código

- `regras.js`: classes, armas, atributos, raridades, pets e validação, usado pelo jogo e pelo servidor.
- `game.js`:
  - `attack()` e `castSkill()`: comportamento de cada classe;
  - `makeFoe()` e `BIOMES`: inimigos e curva de dificuldade;
  - `Market`: os três modos do mercado.
- `functions/index.js`: Cloud Functions `sincronizar`, `anunciar`, `comprar` e `cancelar`.
- `firestore.rules`: quem lê e grava o quê.

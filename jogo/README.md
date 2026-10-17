# Sobreviventes da Noite

Jogo de sobrevivência em pixel art no estilo *Vampire Survivors*, feito para jogar no celular
direto no navegador (HTML5 Canvas, sem dependências e sem instalação).

## Como jogar

- **Celular:** arraste o dedo em qualquer lugar da tela para andar (joystick virtual).
- **Computador:** WASD ou setas. `Esc` ou `P` pausa.
- As armas atacam sozinhas. Colete as gemas de experiência para subir de nível e escolher melhorias.
- Sobreviva **10 minutos** e derrote **o Ceifador** para vencer.

Para rodar localmente: `python3 -m http.server` dentro desta pasta e abra `http://localhost:8000`.
No celular, abra a página e use "Adicionar à tela inicial" para jogar em tela cheia.

## Classes

| Classe | Arma inicial | Bônus | Custo |
|---|---|---|---|
| Guerreiro | Espada | Vida 130, +1 armadura | grátis |
| Arqueira | Arco | +15% velocidade, +10% dano | grátis |
| Mago | Míssil Mágico | -10% recarga, +10% área | 120 ouro |
| Necromante | Foice | Regenera vida, +20% duração | 250 ouro |
| Piromante | Frasco de Fogo | +20% área, +5% dano | 400 ouro |

## Combos (evoluções)

Leve uma arma ao nível 5, tenha o item passivo indicado e abra um **baú** (derrubado pelos golems
que aparecem a cada minuto).

| Arma | + Passiva | = Combo |
|---|---|---|
| Espada | Escudo | Excalibur |
| Míssil Mágico | Tomo Veloz | Tempestade Arcana |
| Arco | Botas | Chuva de Flechas |
| Machado | Poção de Força | Ragnarök |
| Orbes Solares | Cristal | Galáxia |
| Aura Sagrada | Coração | Santuário |
| Raio | Duplicador | Ira dos Céus |
| Frasco de Fogo | Ampulheta | Inferno |
| Foice | Anel Vital | Foice Vampírica |

## Estrutura do código (`game.js`)

- **Sprites**: desenhados como texto (`ART`), cada letra é uma cor da paleta `PAL`.
  Para criar um inimigo novo, desenhe as linhas e adicione em `ENEMIES`.
- **Armas** (`WEAPONS`): tabela de status por nível (`L`), status da evolução (`E`) e funções `fire`/`update`.
- **Passivas** (`PASSIVES`), **classes** (`CLASSES`) e **loja** (`SHOP`) são só dados — fácil de balancear.
- `director()` controla as ondas, golems, hordas e o chefe.
- O progresso (ouro, loja, classes liberadas) fica salvo no `localStorage` do navegador.
- Teste rápido do fim de jogo: abra `index.html?t=590` para começar perto do chefe.

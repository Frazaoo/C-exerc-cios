# Gestão de Cautelas

Site para controlar cautelas (empréstimo de materiais e equipamentos) em formato de calendário.
Os dados ficam online no **Firebase** e aparecem **ao mesmo tempo em todos os computadores**:
o que um usuário cadastra, devolve ou exclui aparece na tela dos outros em segundos, sem recarregar.

## Funcionalidades

- **Calendário mensal** mostrando, em cada dia:
  - 🔵 retiradas de material
  - 🟠 devoluções previstas (🔴 quando já estão atrasadas)
  - 🟢 devoluções feitas
- Ao clicar em um dia, aparecem as movimentações dele e um botão para criar uma cautela naquela data.
- **Cadastro** com número automático, material, patrimônio/nº de série, quantidade, responsável,
  identificação, datas de retirada, devolução prevista e devolução efetiva, quem entregou e observações.
- **Painel** com totais de cautelas ativas, com devolução hoje, atrasadas e devolvidas.
- **Lista** com busca, filtro por status e botão rápido "Devolver".
- **Login** por e-mail e senha. Cada cautela registra quem a criou e quem a alterou por último.
- **Exportar CSV** (abre no Excel) e backup/importação em JSON (opcional).

## Configuração (uma única vez, cerca de 10 minutos)

### 1. Criar o projeto no Firebase
1. Acesse <https://console.firebase.google.com> com sua conta Google e clique em **Criar projeto**.
   Dê um nome (ex.: `cautelas`). O Google Analytics pode ficar desativado.

### 2. Ativar o login
1. No menu, abra **Authentication** e clique em **Começar**.
2. Na aba **Método de login**, ative **E-mail/senha** e salve.
3. Na aba **Usuários**, clique em **Adicionar usuário** e cadastre o e-mail e a senha de cada pessoa
   que vai usar o sistema.
4. Na aba **Configurações → Ações do usuário**, desmarque **Ativar criação (inscrição)**.
   Assim só entra quem você cadastrar.
5. Ainda em **Configurações → Domínios autorizados**, adicione `frazaoo.github.io`.

### 3. Criar o banco de dados
1. No menu, abra **Firestore Database** e clique em **Criar banco de dados**.
2. Escolha o local `southamerica-east1 (São Paulo)` e o **modo de produção**.
3. Na aba **Regras**, apague o conteúdo, cole o conteúdo do arquivo [`firestore.rules`](firestore.rules)
   e clique em **Publicar**.

### 4. Ligar o site ao Firebase
1. Clique na engrenagem ⚙️ → **Configurações do projeto**. Em **Seus apps**, clique no ícone **`</>`** (Web),
   dê um apelido e clique em **Registrar app** (não precisa ativar o Hosting).
2. Copie os valores de `firebaseConfig` que aparecem na tela para o arquivo
   [`firebase-config.js`](firebase-config.js) e salve. Esses valores não são secretos:
   quem protege os dados são o login e as regras do passo 3.

### 5. Colocar o site online (GitHub Pages)
1. No GitHub, abra **Settings → Pages**, escolha o branch `main` e a pasta `/ (root)` e clique em **Save**.
2. Depois de 1 ou 2 minutos, o site estará em **<https://frazaoo.github.io/C-exerc-cios/>**.

> Agora o site precisa ser aberto por esse endereço. Dar dois cliques no `index.html` não funciona mais.

## Custos

O plano gratuito do Firebase (Spark) aguenta com folga o uso de uma seção ou unidade
(50 mil leituras e 20 mil gravações por dia). Não é preciso cadastrar cartão.

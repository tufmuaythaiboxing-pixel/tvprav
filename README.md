# 🎬 CENTRAL DE TV — BOT TELEGRAM PROFISSIONAL & PAINEL DE CONTROLE

Sistema completo, profissional e pronto para execução em servidor/hospedagem (VPS, Docker, Cloud Run, Render, Railway, etc.), com banco de dados persistente, integração oficial com a API do Telegram e painel web administrativo completo.

---

## 👑 PROPRIETÁRIO ABSOLUTO DO SISTEMA

- **Telegram ID do Proprietário:** `6918626496`
- **Permissão:** Acesso TOTAL e irrestrito ao sistema em qualquer circunstância.
- **Reconhecimento:** Reconhecido automaticamente pelo servidor e bot sem necessidade de cadastro manual.

---

## 🚀 ARQUITETURA DO PROJETO

```
├── /src
│   ├── /admin        # Handlers administrativos (aprovações, recusas, estatísticas)
│   ├── /bot          # Núcleo Grammy do Bot Telegram (polling/webhook)
│   ├── /config       # Configurações globais e OWNER_ID
│   ├── /database     # Banco de dados persistente JSON e relacionamentos por ID
│   ├── /handlers     # Handlers de grupo (/checkin) e privado (/start, canais)
│   ├── /models       # Interfaces TypeScript (User, Access, Channel, CheckIn, etc.)
│   ├── /services     # Rotina automática de expiração e alertas (3d, 1d, expirado)
│   ├── /utils        # Validação anti-pirataria e formatadores de datas
│   ├── App.tsx       # Console Web Administrativo em Cinema/Streaming Theme
│   └── main.tsx      # Entrypoint React
├── /data             # Diretório de persistência do banco (database.json)
├── server.ts         # Servidor Full-Stack Express (API + Webhook + Vite)
├── .env.example      # Variáveis de ambiente modelo
└── package.json
```

---

## 📋 REQUISITOS E INSTALAÇÃO

### Pré-requisitos
- Node.js 20+ ou 22+
- NPM ou Yarn

### 1. Clonar e Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o `.env.example` para `.env`:
```bash
cp .env.example .env
```
Edite o arquivo `.env`:
```env
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
OWNER_ID="6918626496"
APP_URL="https://seu-dominio.com"
PORT=3000
NODE_ENV=production
```

### 3. Compilar e Iniciar o Sistema
```bash
# Modo de desenvolvimento
npm run dev

# Modo de produção
npm run build
npm run start
```

---

## 🤖 PASSO A PASSO PARA CONFIGURAR O BOT NO TELEGRAM

### 1. Criar o Bot no BotFather
1. No Telegram, abra a conversa com o `@BotFather`.
2. Envie o comando `/newbot`.
3. Escolha o nome de exibição: `Central de TV`.
4. Escolha o username (exemplo: `central_de_tv_oficial_bot`).
5. Copie o **HTTP API Token** fornecido e insira na variável `TELEGRAM_BOT_TOKEN` no arquivo `.env` (ou configure diretamente pela aba *Configurações* do Painel Web).

### 2. Configurar Permissões de Grupo no BotFather
1. No `@BotFather`, envie `/mybots` e selecione seu bot.
2. Acesse **Bot Settings** > **Group Privacy** > selecione **Turn off** (Desativar a privacidade de grupo permite que o bot leia comandos e interações no grupo com eficiência).
3. Em **Bot Settings** > **Allow Groups?** certifique-se de que está **Enabled**.

### 3. Adicionar o Bot ao Grupo
1. Acesse o grupo de usuários no Telegram.
2. Adicione seu bot como membro do grupo.
3. Promova o bot a **Administrador** com permissões para:
   - Enviar mensagens
   - Fixar mensagens
   - Excluir mensagens (opcional, para moderação)

### 4. Fixar a Mensagem de Check-in
1. No grupo, digite o comando `/checkin`.
2. O bot responderá com o banner oficial:
   ```
   🎬 CENTRAL DE TV
   Para liberar seu acesso à plataforma, faça seu check-in.
   [ ✅ FAZER CHECK-IN ]
   ```
3. Clique com o botão direito / toque e segure na mensagem do bot e selecione **Fixar Mensagem (Pin)**.

---

## ⚡ FLUXO DE CHECK-IN E LIBERAÇÃO

1. **Usuário clica em `[ ✅ FAZER CHECK-IN ]`:**
   - O bot captura automaticamente: Telegram ID, Nome, Sobrenome, Username, Grupo e Data/Hora.
   - O usuário é registrado com `STATUS: AGUARDANDO LIBERAÇÃO`.
2. **Proprietário (`6918626496`) recebe notificação instantânea:**
   ```
   🔔 NOVO CHECK-IN
   👤 Nome: João Silva
   📱 Username: @joaosilva
   🆔 Telegram ID: 123456789
   👥 Grupo: Grupo Central de TV Oficial
   🕐 Data/hora: 28/09/2026 às 14:30
   📌 Status: Aguardando liberação
   [(1 DIA)] [(7 DIAS)]
   [(15 DIAS)] [(30 DIAS)]
   [(PERSONALIZAR)] [(❌ RECUSAR)]
   ```
3. **Confirmação de Segurança:**
   - Ao clicar no botão, o bot solicita confirmação ("Você deseja liberar 7 dias para João Silva? [✅ CONFIRMAR] [❌ CANCELAR]").
4. **Liberação e Notificação ao Usuário:**
   - Ao confirmar, o acesso é gravado com data de início e fim.
   - O bot envia mensagem privada ao usuário informando a validade.
   - **Tratamento de Limitação de Chat Privado:** Caso o usuário nunca tenha iniciado o bot no privado, a API do Telegram retorna restrição de envio. O bot avisa imediatamente o administrador:
     `⚠️ O usuário ainda não iniciou o bot no privado.`
     com o botão `[ 👉 INICIAR BOT ]` para orientar o usuário a dar `/start`.

---

## 📺 CATÁLOGO DE CANAIS & POLÍTICA ANTI-PIRATARIA

### Princípio Fundamental de Legalidade:
- **Estritamente proibido:** Sinais fechados, IPTV pirata, listas M3U/M3U8, links encurtados ou transmissões sem autorização.
- **O sistema aceita exclusivamente:** Portais e páginas oficiais públicas autorizadas por seus respectivos detentores de direitos.
- **Catálogo Inicial (Desativado por Padrão):** O sistema já vem provisionado com 17 fontes oficiais gratuitas (Pluto TV, Plex, Rakuten TV, Samsung TV Plus, LG Channels, Red Bull TV, NASA+, TED, DW, Euronews, TV Brasil, Canal Gov, Câmara, Senado, TV Cultura, SescTV, Futura).
- **Validação Manual Obrigatória:** Todos os canais iniciam com `status: inactive` e `admin_authorized: false`. O administrador deve conferir a disponibilidade regional antes de ativar qualquer canal via painel web ou bot.

---

## ⏰ ROTINA AUTOMÁTICA DE EXPIRAÇÃO

O sistema executa uma rotina contínua em segundo plano:
- **Faltando 3 dias:** `⚠️ Seu acesso expira em 3 dias.`
- **Faltando 1 dia:** `⚠️ Seu acesso expira amanhã.`
- **Ao expirar:** `🔴 SEU ACESSO EXPIROU. Seu período de acesso terminou. Faça um novo check-in para solicitar uma nova liberação.`
- **Bloqueio Automático:** Usuários expirados são impedidos imediatamente de abrir o menu de canais.

---

## 👑 COMANDOS DO BOT

| Comando | Descrição | Quem pode usar |
|---|---|---|
| `/start` | Abre o menu principal de usuário (Ver Canais, Meu Acesso, Info) | Todos |
| `/checkin` | Envia o banner oficial de check-in para o grupo | Grupo / Admin |
| `/central` | Atalho para o catálogo / menu principal | Todos |
| `/admin` | Abre o Painel Administrativo de Gestão | Apenas ID `6918626496` e admins |

## 🌐 CONFIGURAÇÃO DE WEBHOOK (TEMPO REAL) VS LONG POLLING

O sistema suporta nativamente dois modos de operação para receber atualizações do Telegram:

### 1. Long Polling (Padrão para Desenvolvimento)
- O servidor consulta a API do Telegram periodicamente em busca de mensagens e cliques.
- Funciona em qualquer rede local sem necessidade de certificado SSL ou porta pública aberta.
- Pode ser iniciado ou pausado a qualquer momento pelo painel web.

### 2. Webhook em Tempo Real (Recomendado para Produção / Servidor)
- As atualizações (mensagens, check-ins, aprovações) são enviadas **instantaneamente** pelo Telegram para a rota `/api/telegram-webhook` do servidor via HTTP POST.
- **Vantagens:** Latência zero, sem conexões ociosas contínuas e menor consumo de CPU e memória.
- **Requisitos do Telegram:**
  - URL obrigatoriamente protegida por **HTTPS** com certificado SSL/TLS válido.
  - Portas aceitas pela API do Telegram: `443`, `80`, `88` ou `8443`.
  - Exemplo de URL: `https://meu-dominio.com/api/telegram-webhook`.

### Como Configurar o Webhook no Painel:
1. Acesse o Painel de Controle e clique na aba **⚙️ Configurações**.
2. Na seção **Configuração de Webhook (Tempo Real)**:
   - Insira a URL pública HTTPS do seu servidor (ou clique em *"Usar URL atual deste servidor"*).
   - *(Opcional)* Defina um **Token Secreto de Validação** para segurança adicional. O servidor validará o cabeçalho `X-Telegram-Bot-Api-Secret-Token`.
   - Clique em **⚡ Ativar Webhook em Tempo Real**. O sistema registrará a URL automaticamente na API oficial do Telegram e desligará o polling.
3. Clique em **🔄 Consultar Status no Telegram API** para verificar a contagem de mensagens pendentes, IP detectado e relatórios de erro.
4. Para reverter para o modo clássico a qualquer momento, basta clicar em **↩️ Desativar Webhook (Voltar ao Polling)**.

---

*Desenvolvido com padrão de excelência para a CENTRAL DE TV.*

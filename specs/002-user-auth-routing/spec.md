# Feature Specification: Autenticação de Utilizadores e Roteamento `/app/*` · `/auth/*` · `/`

**Feature Branch**: `002-user-auth-routing`
**Created**: 2026-04-26
**Status**: Draft
**Input**: User description: "Agora eu quero focar na feature de autencicação do usuario no meu projeto e roteamento /app/* /auth/*(login/criarconta/sair) /(homepage), onde eu quero criar paginas para que seja possivel o usuario entrar no app ver a home page e autenciações"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Visitante anónimo vê a homepage pública (Priority: P1)

Um visitante sem conta abre o domínio raiz e cai numa página pública que apresenta brevemente o produto e oferece duas acções claras: "Entrar" e "Criar conta". A homepage não exige autenticação e não mostra dados de nenhum tenant.

**Why this priority**: É a porta de entrada do produto. Sem uma homepage pública é impossível um visitante chegar ao login/registo a partir de uma URL partilhada e o produto fica preso atrás de URLs internos. Toda a aquisição de novos tenants começa aqui.

**Independent Test**: Abrir o domínio raiz (`/`) numa janela em modo anónimo (sem sessão). Sucesso = a página renderiza sem redirecionar para login/app, identifica claramente o produto, e contém pelo menos um link visível para "Entrar" e outro para "Criar conta".

**Acceptance Scenarios**:

1. **Given** um visitante sem sessão, **When** abre `/`, **Then** vê uma página pública com nome do produto, uma frase descritiva e dois CTAs ("Entrar" e "Criar conta") visíveis sem rolagem em ecrãs comuns.
2. **Given** um visitante sem sessão, **When** clica em "Entrar", **Then** é levado para a página de login (`/auth/login`).
3. **Given** um visitante sem sessão, **When** clica em "Criar conta", **Then** é levado para a página de registo (`/auth/register`).
4. **Given** um utilizador já autenticado, **When** abre `/`, **Then** o sistema reconhece a sessão e leva-o directamente para o app em vez da homepage.

---

### User Story 2 — Visitante cria conta e entra no app (Priority: P1)

Um visitante sem conta abre `/auth/register`, preenche um formulário de registo (email + senha), submete, e é levado para o app autenticado, sem precisar passar pelo login.

**Why this priority**: Sem registo, ninguém entra no produto pela primeira vez. É o gatilho que transforma um visitante numa empresa-cliente operacional. Tem de funcionar de raiz para a MVP da auth ser válida.

**Independent Test**: A partir de `/auth/register`, preencher email não usado e senha válida, submeter. Sucesso = a sessão fica activa, o utilizador é redireccionado para o app, e ao recarregar a página continua autenticado.

**Acceptance Scenarios**:

1. **Given** um visitante sem sessão em `/auth/register`, **When** submete email válido e senha que cumpre os requisitos, **Then** a conta é criada, a sessão fica activa e o utilizador é levado para o app.
2. **Given** um email já registado, **When** o visitante tenta criar conta com esse email, **Then** o sistema rejeita o registo com uma mensagem clara associada ao campo email, sem revelar se o email pertence a outro tenant.
3. **Given** uma senha que não cumpre os requisitos mínimos, **When** o visitante submete, **Then** o formulário sinaliza o problema antes de chamar o servidor.
4. **Given** o registo foi submetido mas o servidor falhou (rede, erro inesperado), **When** o utilizador re-tenta, **Then** o formulário continua preenchido (excepto a senha) e mostra erro humanizado.

---

### User Story 3 — Utilizador existente faz login e entra no app (Priority: P1)

Um utilizador com conta abre `/auth/login`, introduz email e senha, e é levado para o app. Se já tinha aberto um link interno (ex.: `/app/inbox/123`) antes de ter sessão, é levado de volta a esse link após login.

**Why this priority**: É o caminho de entrada quotidiano para todos os utilizadores recorrentes (owners e agents). Sem este caminho fluido, o produto é inutilizável no dia-a-dia.

**Independent Test**: Em modo anónimo, abrir `/app/inbox` (rota protegida); o sistema redirecciona para `/auth/login`. Submeter credenciais válidas. Sucesso = sessão fica activa e o utilizador chega exactamente a `/app/inbox`.

**Acceptance Scenarios**:

1. **Given** um utilizador com conta válida em `/auth/login`, **When** submete email e senha correctos, **Then** a sessão fica activa e é levado para o app.
2. **Given** credenciais inválidas, **When** o utilizador submete, **Then** o sistema mostra uma mensagem genérica ("email ou senha inválidos") sem distinguir qual dos dois falhou, e não revoga eventuais tentativas posteriores.
3. **Given** um visitante anónimo abriu uma URL protegida (ex.: `/app/pipeline`), **When** completa o login, **Then** é levado para essa URL original em vez da página inicial do app.
4. **Given** uma sessão já activa, **When** o utilizador abre `/auth/login`, **Then** o sistema reconhece a sessão e leva-o para o app sem mostrar o formulário.

---

### User Story 4 — Utilizador autenticado termina sessão (Priority: P2)

Um utilizador autenticado, em qualquer ecrã do app, encontra uma acção de "Sair" visível (ex.: no menu do utilizador). Ao confirmar, a sessão termina e ele volta à homepage pública.

**Why this priority**: Sem logout não há higiene básica de sessão (computadores partilhados, troca de utilizador no mesmo browser). Fica em P2 porque P1 já entrega valor visível mesmo sem este caminho — mas é obrigatório para fechar o ciclo de auth.

**Independent Test**: Com sessão activa em `/app/inbox`, accionar "Sair". Sucesso = a sessão termina, o utilizador é levado para `/`, e ao tentar voltar a `/app/inbox` é redireccionado para `/auth/login`.

**Acceptance Scenarios**:

1. **Given** sessão activa, **When** o utilizador acciona "Sair", **Then** a sessão é invalidada e ele é levado para a homepage pública.
2. **Given** dois separadores abertos com a mesma sessão, **When** o utilizador termina sessão num deles, **Then** o outro separador, ao próximo pedido protegido, deixa de mostrar dados do app e acaba na página de login.
3. **Given** uma sessão expirou enquanto o utilizador estava num ecrã do app, **When** ele tenta uma acção que requer sessão, **Then** o sistema reage como se "Sair" tivesse acontecido — leva-o para o login com indicação de que a sessão expirou.

---

### User Story 5 — Roteamento e protecção das áreas do app (Priority: P2)

Toda a aplicação interna do CRM (inbox, pipeline, definições, ligação WhatsApp) passa a viver sob o prefixo `/app/*`. Rotas de autenticação ficam sob `/auth/*`. A homepage fica em `/`. As regras de redireccionamento entre estas três zonas são consistentes em todos os ecrãs.

**Why this priority**: Sem uma estrutura de URLs estável e regras claras, o produto comporta-se de forma errática (ecrãs flash de conteúdo protegido, redireccionamentos circulares, links partilhados que não funcionam). É a base sobre a qual P1/US1–US3 funcionam de forma fiável.

**Independent Test**: Com sessão e sem sessão, visitar uma matriz fixa de URLs (`/`, `/auth/login`, `/auth/register`, `/app/inbox`, `/app/pipeline`, `/app/settings/team`, URL inexistente). Sucesso = cada combinação cai no ecrã esperado, sem flicker de conteúdo protegido e sem ciclos de redirecção.

**Acceptance Scenarios**:

1. **Given** sem sessão, **When** o utilizador abre qualquer rota sob `/app/*`, **Then** é redireccionado para `/auth/login` com o caminho original preservado para retorno após login.
2. **Given** com sessão, **When** o utilizador abre `/auth/login` ou `/auth/register`, **Then** é redireccionado para a página inicial do app sem ver o formulário.
3. **Given** sem sessão, **When** o utilizador abre `/auth/login` ou `/auth/register`, **Then** vê o formulário sem qualquer redirecção.
4. **Given** uma URL inexistente (ex.: `/app/foo` ou `/qualquer-coisa`), **When** o utilizador abre, **Then** vê uma página de "não encontrado" coerente em vez de erro técnico.
5. **Given** a sessão é validada antes do conteúdo do app aparecer, **When** o utilizador abre uma rota protegida, **Then** não há flash visível de dados protegidos antes de uma eventual redirecção para login.

---

### Edge Cases

- **Email já registado no sistema, mas com tipo de letra diferente** (ex.: `Foo@Bar.com` vs `foo@bar.com`): o sistema trata o email de forma case-insensitive na verificação de unicidade.
- **Senha colada com espaços extra acidentais**: o sistema não corta nem ignora espaços (a senha é exactamente o que o utilizador escreveu); o formulário avisa se a senha começa/termina com espaço antes de submeter.
- **Sessão expira entre dois pedidos numa mesma página**: o ecrã actual deixa de devolver dados; o utilizador é levado para login na próxima interacção sem perder o caminho actual.
- **Botão "voltar" do browser após logout**: a página anterior do app aparece em cache mas qualquer interacção dispara redirecção para login (não é possível continuar a operar a partir do estado em cache).
- **Múltiplos pedidos paralelos quando a sessão acabou**: todos os pedidos falham coerentemente; o utilizador vê **um** redireccionamento para login, não cinco mensagens de erro empilhadas.
- **Click em "Entrar" estando já com sessão activa noutro separador**: o redireccionamento para o app respeita a sessão em vez de exigir nova autenticação.
- **Email com formato inválido** (`abc`, `abc@`, `abc@def`): o formulário rejeita antes de chamar o servidor.
- **Tentativas repetidas de login com senha errada**: o sistema preserva uma resposta consistente (sem revelar contagem ou estado da conta) mas pode introduzir atraso/bloqueio passados N intentos para mitigar força bruta.
- **Visita a `/auth/foo`** (rota inexistente sob auth): cai no "não encontrado" geral, não num login mal renderizado.
- **Recarregar a página `/auth/register` após registo bem-sucedido**: o utilizador já tem sessão, portanto é redireccionado para o app.

## Requirements *(mandatory)*

### Functional Requirements

**Estrutura de rotas**

- **FR-001**: O sistema MUST servir uma homepage pública em `/` acessível sem autenticação, sem dados de nenhum tenant.
- **FR-002**: O sistema MUST agrupar todas as páginas internas do CRM (inbox, pipeline, definições, ligação WhatsApp e equivalentes) sob o prefixo de URL `/app/*`.
- **FR-003**: O sistema MUST agrupar todos os fluxos de autenticação sob o prefixo `/auth/*` e, no mínimo, expor `/auth/login` (entrar), `/auth/register` (criar conta) e uma forma de "sair" (a "saída" pode ser uma acção a partir do app que termina em redirecção para `/`, não obrigatoriamente uma página dedicada).
- **FR-004**: O sistema MUST apresentar uma página "não encontrado" coerente para qualquer URL fora destes prefixos ou inexistente dentro deles.

**Homepage pública (US1)**

- **FR-005**: A homepage MUST identificar claramente o produto (nome + uma frase de proposta de valor) e expor pelo menos um CTA de "Entrar" (link para `/auth/login`) e um CTA de "Criar conta" (link para `/auth/register`).
- **FR-006**: A homepage MUST ser totalmente renderizável sem chamadas a APIs autenticadas e MUST NOT depender de estado de sessão.

**Registo (US2)**

- **FR-007**: A página de registo MUST aceitar pelo menos email e senha como entradas e validar formato/força antes de submeter ao servidor.
- **FR-008**: O sistema MUST recusar criação de conta com um email já registado, com uma mensagem associada ao campo email que não distinga entre "email já existe" e outros erros sensíveis (resposta uniforme do ponto de vista de enumeração de utilizadores).
- **FR-009**: Após registo bem-sucedido, o sistema MUST estabelecer uma sessão activa e levar o utilizador directamente para o app, sem passar pelo login.
- **FR-010**: O sistema MUST associar cada conta criada a um tenant. **Decisão**: registo público em `/auth/register` é **auto-serviço** — qualquer visitante pode criar conta; ao criar, o sistema **cria automaticamente um novo tenant** para essa conta e atribui-lhe o papel `owner`. O nome do tenant é solicitado no formulário de registo (campo "nome da empresa") ou, em fallback, derivado do email. Convite de agentes para tenants já existentes é tratado pelo fluxo de team management já implementado na feature 001 (não passa por `/auth/register`).
- **FR-010a**: O formulário de registo MUST pedir, além de email e senha, o **nome da empresa/tenant**. Esse nome é guardado como `tenant.name` e exibido no app. Validação: 2–80 caracteres, sem unicidade global (tenants podem partilhar nome).

**Login (US3)**

- **FR-011**: A página de login MUST aceitar email e senha e devolver, em caso de erro, **uma mesma mensagem genérica** ("email ou senha inválidos") independentemente da causa (email não existe / senha errada).
- **FR-012**: Após login bem-sucedido, o sistema MUST levar o utilizador para o destino pretendido — se existe um caminho original guardado sob `/app/*` que despoletou o login, é esse; caso contrário, a página inicial do app.
- **FR-013**: O sistema MUST manter a sessão entre recarregamentos da página e novos separadores do mesmo browser, até o utilizador terminar sessão ou esta expirar.

**Logout (US4)**

- **FR-014**: O app MUST oferecer uma acção de "Sair" visível em qualquer ecrã interno (ex.: no menu do utilizador).
- **FR-015**: Ao terminar sessão, o sistema MUST invalidar a sessão actual, levar o utilizador para `/`, e impedir que voltar atrás no browser permita continuar a operar dentro do app.

**Gating e redirecções (US5)**

- **FR-016**: O sistema MUST redireccionar um utilizador sem sessão que tente abrir qualquer rota sob `/app/*` para `/auth/login`, preservando o caminho original para retorno após autenticação.
- **FR-017**: O sistema MUST redireccionar um utilizador com sessão activa que abra `/auth/login` ou `/auth/register` para o app, sem mostrar o formulário de auth.
- **FR-018**: O sistema MUST redireccionar um utilizador com sessão activa que abra `/` para o app, de modo a que `/` actue como atalho coerente para o app quando há sessão.
- **FR-019**: A protecção de rotas `/app/*` MUST garantir que conteúdo interno **nunca** é renderizado antes da sessão estar verificada (sem flash de UI protegida).

**Sessão e segurança**

- **FR-020**: O sistema MUST tratar email de forma case-insensitive na verificação de unicidade e no login (`Foo@bar.com` ≡ `foo@bar.com`).
- **FR-021**: O sistema MUST aplicar mitigação razoável contra força bruta no login (ex.: atraso ou bloqueio temporário após N tentativas falhadas a partir do mesmo cliente), sem revelar ao utilizador final detalhes do mecanismo.
- **FR-022**: O sistema MUST garantir que tentativas de chamada a APIs internas sem sessão válida devolvem erro de auth e nunca conteúdo de outro tenant.

### Key Entities *(include if feature involves data)*

- **Conta de utilizador**: representa uma pessoa que acede ao CRM. Atributos relevantes ao domínio: email (identificador), credencial de acesso, papel dentro do tenant (`owner` ou `agent`), tenant a que pertence. Uma conta pertence a exactamente um tenant.
- **Tenant**: organização (empresa-cliente da agência) à qual a conta pertence. Já existe como entidade na feature 001 — esta feature apenas garante que cada conta criada fica ligada a um tenant.
- **Sessão**: vínculo temporário entre uma conta e um cliente browser. Tem início (login/registo), fim (logout/expiração), e identidade do utilizador. É a unidade que o gating de `/app/*` consulta a cada navegação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um visitante novo consegue completar o registo e ver o ecrã inicial do app em menos de **90 segundos** desde abrir `/auth/register`.
- **SC-002**: Um utilizador com credenciais correctas chega ao app em menos de **5 segundos** desde submeter o login (medido no caminho feliz, em condições de rede normais).
- **SC-003**: **100%** das tentativas de abrir uma rota sob `/app/*` sem sessão acabam no ecrã de login, sem flash de conteúdo interno (verificável por inspecção do que é renderizado entre o pedido e o redireccionamento).
- **SC-004**: **100%** das tentativas de abrir `/auth/login` ou `/auth/register` com sessão activa acabam no app sem mostrar o formulário.
- **SC-005**: O caminho de logout completa em menos de **2 segundos** e, após logout, qualquer URL `/app/*` reaberta no mesmo browser cai em login (não há "fantasma" de sessão).
- **SC-006**: Após login, o utilizador chega à URL protegida que originalmente tentou abrir em **≥ 95%** dos casos com caminho original (os 5% restantes correspondem a casos legítimos onde a URL deixou de existir, p.ex. id removido).
- **SC-007**: A homepage pública renderiza em menos de **3 segundos** num browser comum sem cache prévio, e não dispara nenhuma chamada a APIs autenticadas.
- **SC-008**: Em testes de usabilidade simples, **≥ 90%** dos novos utilizadores conseguem encontrar e usar a acção "Sair" sem ajuda externa.

## Assumptions

- **Mecanismo de auth**: email + senha como método primário. Login social (Google, etc.), passwordless e SSO ficam fora do âmbito desta spec.
- **Recuperação de senha** ("esqueci-me da senha") fica explicitamente fora do âmbito desta spec — será tratada numa feature seguinte para não inflar este corte.
- **Verificação de email**: o registo segue a postura conservadora do produto — o utilizador entra logo na sessão após criar conta, mas o sistema MAY exigir verificação de email para certas operações sensíveis. A política exacta de "exigir verificação antes de quê" segue a configuração padrão do provider de auth e fica fora do âmbito desta spec; o caminho feliz é "regista → entra no app".
- **Política de senha**: requisitos mínimos seguem padrão da indústria (≥ 8 caracteres, mistura de tipos). Detalhe exacto fica para o plan, não é critério de aceitação aqui.
- **Idioma**: PT-PT, alinhado com o resto do produto.
- **Mobile**: a UI é responsiva (homepage e ecrãs de auth funcionam em ecrãs pequenos), mas não há app nativa.
- **Tema visual**: a homepage é funcional e consistente com o estilo do app, mas conteúdo de marketing rico (testemunhos, comparativos, vídeos) fica fora do âmbito desta spec.
- **Tenant existente**: a entidade tenant já existe na feature 001; esta spec não redefine a sua semântica, apenas garante que cada conta de utilizador fica associada a um tenant válido.
- **Rotas existentes do app**: as páginas `/inbox`, `/pipeline`, `/connect`, `/settings/*` já existentes na feature 001 são movidas para baixo de `/app/*` (`/app/inbox`, etc.) como parte desta feature; as suas funcionalidades internas não mudam.
- **Persistência de sessão**: sessões persistem até logout explícito ou expiração; a duração exacta da expiração é configurável e segue o padrão do provider de auth.

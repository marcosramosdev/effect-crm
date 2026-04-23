# Feature Specification: WhatsApp CRM Core (Inbox, Resposta, Pipeline, Conexão)

**Feature Branch**: `001-whatsapp-crm-core`
**Created**: 2026-04-23
**Status**: Draft
**Input**: User description: "CRM multi-tenant para empresa de marketing digital oferecer aos seus próprios clientes. Ver leads que entram por WhatsApp num único lugar; responder directamente pelo sistema; acompanhar cada contacto por etapas de funil; personalizar as etapas por cliente; conectar WhatsApp facilmente ao sistema."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Conectar o WhatsApp da empresa ao CRM (Priority: P1)

O utilizador da empresa-cliente (tenant) abre o CRM pela primeira vez, segue um fluxo guiado de conexão do WhatsApp e, ao final, vê o estado "conectado" sem precisar sair do app. A partir desse momento, as mensagens recebidas nesse número começam a aparecer no sistema.

**Why this priority**: Sem conexão do WhatsApp não há dados a processar — todas as outras funcionalidades dependem desta. É a primeira coisa que qualquer novo tenant precisa fazer.

**Independent Test**: Pode ser totalmente testado pedindo a uma empresa-cliente de teste que siga o fluxo de conexão. Sucesso = o estado do número aparece como "conectado" no CRM e, ao enviar uma mensagem de fora para esse número, essa mensagem chega à base de dados do tenant em menos de 10 segundos.

**Acceptance Scenarios**:

1. **Given** um tenant recém-criado sem WhatsApp ligado, **When** o utilizador inicia o fluxo de conexão, **Then** o sistema apresenta o mecanismo de emparelhamento (ex.: QR code) num ecrã claro com instruções passo a passo.
2. **Given** o emparelhamento foi concluído com sucesso, **When** o utilizador volta ao dashboard, **Then** o número do WhatsApp aparece identificado com estado "conectado" e uma hora do último ping bem-sucedido.
3. **Given** um WhatsApp já estava conectado e caiu a ligação, **When** o utilizador abre o painel de conexão, **Then** o sistema avisa claramente que a sessão caiu e oferece "reconectar" sem obrigar a reconfigurar tudo de raiz.
4. **Given** o emparelhamento falha (tempo esgotado, código inválido), **When** o utilizador tenta novamente, **Then** o sistema mostra uma mensagem de erro compreensível e permite reiniciar o fluxo sem contactar suporte.

---

### User Story 2 — Ver todas as conversas de leads num inbox unificado (Priority: P1)

Um agente da empresa-cliente abre o CRM e vê uma lista única, ordenada por actividade recente, com todas as pessoas que contactaram a empresa por WhatsApp. Para cada lead: identificação (nome/telefone), última mensagem, quando chegou, e se está lida ou não.

**Why this priority**: Centralizar as conversas num único local é o valor central vendido ao tenant. Sem o inbox, o CRM é invisível mesmo que a conexão funcione.

**Independent Test**: Enviando N mensagens de diferentes números para o WhatsApp conectado, o inbox apresenta N conversas distintas, ordenadas pela chegada da última mensagem, com o conteúdo correcto visível na linha de preview.

**Acceptance Scenarios**:

1. **Given** um tenant com WhatsApp conectado, **When** chegam mensagens novas de números diferentes, **Then** cada número cria/actualiza uma conversa no inbox em menos de 5 segundos desde a recepção pelo servidor.
2. **Given** uma conversa com mensagens não lidas, **When** o agente abre essa conversa, **Then** as mensagens passam a "lidas" e o contador de não-lidas do inbox diminui consistentemente.
3. **Given** o inbox tem muitas conversas (>50), **When** o agente rola ou filtra por "não lidas", **Then** a interface continua fluida e mostra apenas as conversas relevantes.
4. **Given** duas mensagens chegam do mesmo número em horas diferentes, **When** o agente abre a conversa, **Then** vê um único histórico consolidado desse lead, não duas conversas separadas.

---

### User Story 3 — Responder ao lead directamente pelo sistema (Priority: P1)

Um agente abre uma conversa no inbox, escreve uma resposta e envia. O lead recebe essa resposta no WhatsApp dele; o agente vê o envio confirmado (e eventual falha) sem sair do CRM.

**Why this priority**: Ver mensagens sem poder responder reduz o CRM a um painel de leitura. Resposta bidireccional é o que fecha o ciclo de atendimento.

**Independent Test**: A partir de uma conversa existente, o agente envia uma mensagem de texto; a mensagem aparece no histórico como "enviada", o WhatsApp de destino recebe-a, e a entrega é confirmada no sistema em menos de 15 segundos.

**Acceptance Scenarios**:

1. **Given** uma conversa aberta, **When** o agente envia uma mensagem de texto, **Then** a mensagem aparece imediatamente no histórico como "a enviar" e transita para "enviada/entregue" assim que o WhatsApp confirma.
2. **Given** a mensagem não pôde ser enviada (ligação caída, número bloqueado), **When** a falha é detectada, **Then** a mensagem aparece com estado "falhou" e uma acção clara de "tentar novamente".
3. **Given** dois agentes do mesmo tenant têm a mesma conversa aberta, **When** um deles envia uma resposta, **Then** o outro vê essa resposta sem refrescar manualmente em menos de 5 segundos.
4. **Given** o agente não tem sessão WhatsApp activa (caiu a ligação do tenant), **When** tenta enviar, **Then** o sistema bloqueia o envio com aviso "WhatsApp desconectado — reconecte para responder" em vez de aceitar e perder a mensagem.

---

### User Story 4 — Acompanhar leads através de etapas de funil (Priority: P2)

Cada lead aparece numa vista de pipeline (tipo kanban) organizada por etapas (ex.: "Novo", "Em conversa", "Proposta", "Ganho", "Perdido"). O agente move o lead entre etapas conforme o atendimento evolui; a etapa actual é visível também dentro da conversa.

**Why this priority**: O pipeline é o que transforma o inbox num funil de vendas/atendimento — é o diferencial face a ver apenas o WhatsApp. Fica em P2 porque P1 já entrega valor autónomo (inbox + resposta).

**Independent Test**: Com leads existentes no inbox, o agente abre a vista de pipeline, arrasta um lead de "Novo" para "Em conversa"; a mudança persiste ao refrescar e é visível na conversa desse lead.

**Acceptance Scenarios**:

1. **Given** um novo lead entrou pelo inbox, **When** o agente abre a vista pipeline, **Then** esse lead aparece por omissão na primeira etapa configurada.
2. **Given** um lead está na etapa X, **When** o agente o move para a etapa Y, **Then** a nova etapa persiste, é visível em todas as vistas (pipeline e conversa) e fica registada com data/hora da transição.
3. **Given** o pipeline tem muitos leads, **When** o agente filtra por etapa ou pesquisa por nome, **Then** vê só os leads relevantes sem perder a ordenação dentro de cada coluna.
4. **Given** um lead foi marcado como "Perdido", **When** esse lead envia uma nova mensagem, **Then** a conversa reabre no inbox e o sistema não o exclui automaticamente do pipeline.

---

### User Story 5 — Personalizar as etapas do funil por tenant (Priority: P3)

O responsável do tenant entra nas definições, vê as etapas actuais do pipeline, e pode adicionar, renomear, reordenar ou remover etapas para reflectir o fluxo de trabalho da sua empresa. As alterações aplicam-se só a esse tenant.

**Why this priority**: Cada empresa-cliente trabalha de forma diferente, por isso personalização é um requisito do produto. Fica em P3 porque é possível arrancar com um conjunto de etapas por omissão razoável (Novo, Em conversa, Proposta, Ganho, Perdido) e só depois abrir edição — isso desbloqueia a MVP mais cedo.

**Independent Test**: A partir das etapas por omissão, o responsável renomeia "Proposta" para "Orçamento", adiciona uma nova etapa "Agendado" antes de "Ganho", e remove "Perdido". A vista pipeline passa a reflectir exactamente essa configuração; leads previamente em "Perdido" são reatribuídos a uma etapa segura (ex.: última etapa activa) e não desaparecem.

**Acceptance Scenarios**:

1. **Given** as etapas por omissão, **When** o responsável adiciona uma nova etapa, **Then** essa etapa aparece na vista pipeline e no seletor de etapa dentro da conversa sem recarregar.
2. **Given** uma etapa existente tem leads associados, **When** o responsável tenta remover essa etapa, **Then** o sistema pede confirmação e oferece mover esses leads para uma etapa destino antes de concluir a remoção.
3. **Given** o responsável reordena as etapas, **When** guarda as alterações, **Then** a nova ordem aparece para todos os utilizadores do tenant e persiste ao refrescar.
4. **Given** dois tenants distintos, **When** um altera o pipeline, **Then** o pipeline do outro tenant não é afectado de forma alguma.

---

### Edge Cases

- **Sessão WhatsApp cai silenciosamente**: o sistema deve detectar ausência de heartbeat e sinalizar desconexão em vez de parecer funcional; mensagens não entregues ficam com estado claro.
- **Mesmo número contacta mais do que uma vez depois de muito tempo**: o lead é o mesmo (deduplicado por número + tenant), não um novo.
- **Mensagem recebida enquanto o sistema estava offline**: ao reconectar, as mensagens em atraso são ingeridas em ordem cronológica e o inbox actualiza sem duplicar.
- **Múltiplos agentes respondem à mesma conversa ao mesmo tempo**: ambos os envios partem, mas o histórico mostra quem enviou o quê; não há sobreposição silenciosa.
- **Tenant tenta aceder a dados de outro tenant** (URL forjado, token de outra conta): o sistema recusa e regista a tentativa.
- **Lead envia tipos de mensagem não suportados na MVP** (áudio, vídeo, figurinhas): a mensagem aparece no histórico com um marcador "tipo não suportado" e a sua existência é preservada, mesmo que o conteúdo não seja renderizado.
- **Número do WhatsApp é trocado** (tenant troca de linha): o fluxo de reconexão permite recomeçar; histórico anterior fica preservado associado ao novo número ou à sessão antiga, sem perder leads.
- **Remoção de uma etapa ocupada**: o sistema obriga a escolher destino para os leads dessa etapa antes de remover.

## Requirements *(mandatory)*

### Functional Requirements

**Conexão do WhatsApp (US1)**

- **FR-001**: O sistema MUST permitir a cada tenant iniciar um fluxo de conexão do seu WhatsApp a partir do próprio CRM, sem dependências externas.
- **FR-002**: O sistema MUST apresentar o elemento de emparelhamento (ex.: QR code) com instruções explícitas e auto-renovação quando expira.
- **FR-003**: O sistema MUST indicar, em permanência e de forma visível, o estado de ligação do WhatsApp do tenant (conectado, desconectado, a reconectar, erro).
- **FR-004**: O sistema MUST permitir reconectar uma sessão que caiu sem obrigar a recriar configuração inicial.
- **FR-005**: O sistema MUST registar o instante do último sinal saudável da ligação e avisar o tenant quando esse sinal excede um limiar razoável (ex.: 2 minutos) sem actualizar.

**Inbox (US2)**

- **FR-006**: O sistema MUST listar todas as conversas de WhatsApp do tenant numa vista única, ordenada por actividade mais recente.
- **FR-007**: O sistema MUST deduplicar conversas pelo par (tenant, número do lead) — o mesmo número nunca origina duas conversas separadas.
- **FR-008**: Cada linha do inbox MUST mostrar identificação do lead, preview da última mensagem, timestamp, e indicador de mensagens não lidas.
- **FR-009**: O sistema MUST marcar mensagens como lidas quando o agente abre a conversa, e MUST manter o contador de não lidas do inbox consistente.
- **FR-010**: O sistema MUST suportar filtrar o inbox por "não lidas" e pesquisar por nome/telefone do lead.
- **FR-011**: O sistema MUST entregar novas mensagens em tempo quasi real ao inbox dos agentes com sessão aberta (sem exigir refresh manual).

**Resposta (US3)**

- **FR-012**: O sistema MUST permitir ao agente enviar uma mensagem de texto ao lead a partir de uma conversa aberta.
- **FR-013**: O sistema MUST reflectir no histórico da conversa o ciclo de vida do envio: a enviar → enviada/entregue → lida (quando disponível) ou falhou.
- **FR-014**: O sistema MUST apresentar uma acção de "tentar novamente" para mensagens em estado "falhou".
- **FR-015**: O sistema MUST bloquear o envio quando a sessão WhatsApp do tenant não está ligada, com uma mensagem de erro accionável.
- **FR-016**: O sistema MUST propagar uma mensagem enviada por um agente às outras sessões de agentes do mesmo tenant que tenham a conversa aberta.

**Pipeline (US4)**

- **FR-017**: O sistema MUST fornecer uma vista de pipeline (kanban por etapas) com todos os leads do tenant.
- **FR-018**: Novos leads MUST entrar automaticamente na primeira etapa configurada do pipeline do tenant.
- **FR-019**: O sistema MUST permitir mover um lead entre etapas directamente na vista pipeline e a partir da conversa.
- **FR-020**: Cada mudança de etapa MUST ficar registada com timestamp e autor para auditoria futura.
- **FR-021**: O sistema MUST suportar filtro por etapa e pesquisa por lead dentro da vista pipeline.
- **FR-022**: Um lead marcado como "encerrado" (ex.: Perdido) MUST reabrir no inbox se enviar nova mensagem, mantendo o histórico.

**Personalização de etapas (US5)**

- **FR-023**: O sistema MUST permitir a utilizadores autorizados do tenant adicionar, renomear, reordenar e remover etapas do pipeline.
- **FR-024**: A remoção de uma etapa com leads associados MUST exigir a escolha de uma etapa destino antes de concluir.
- **FR-025**: Alterações ao pipeline MUST ter efeito apenas para o tenant que as fez — nunca afectar outros tenants.
- **FR-026**: Cada tenant novo MUST receber um conjunto razoável de etapas por omissão para poder trabalhar sem configurar nada primeiro.

**Isolamento multi-tenant e segurança** (transversal)

- **FR-027**: Todos os dados de leads, conversas, mensagens e configurações de pipeline MUST estar isolados por tenant — nenhum utilizador de um tenant pode ler ou modificar dados de outro.
- **FR-028**: O sistema MUST autenticar todos os utilizadores antes de permitir qualquer operação em dados do tenant, incluindo leitura do inbox.
- **FR-029**: Tentativas de acesso a dados fora do tenant do utilizador MUST ser rejeitadas e registadas para auditoria.

### Key Entities

- **Tenant (empresa-cliente)**: Uma empresa-cliente da agência; contém utilizadores, configuração de pipeline e uma ligação WhatsApp. Chave de isolamento para todos os dados.
- **User (utilizador/agente)**: Pessoa autenticada que opera o CRM dentro de um tenant; pode ver o inbox, responder, mover leads entre etapas. (Gestão de papéis detalhados fica fora da MVP — ver Assumptions.)
- **WhatsApp Connection**: Uma ligação activa entre um tenant e um número de WhatsApp; contém estado (conectado/desconectado/erro), timestamp do último sinal e metadados de emparelhamento.
- **Lead**: Pessoa do lado de fora, identificada por (tenant, número de telefone); possui nome (se conhecido), etapa actual do pipeline, e referência à sua conversa.
- **Conversation**: O histórico contínuo de mensagens entre um lead e o tenant. Há exactamente uma por par (tenant, lead).
- **Message**: Uma mensagem isolada dentro de uma conversa; direcção (entrada/saída), conteúdo, timestamp, estado de envio (quando saída), autor (utilizador que enviou, quando saída).
- **Pipeline Stage**: Uma etapa do funil de um tenant; tem nome, ordem, e pode ser removida/editada pelo próprio tenant. Pertence exclusivamente a um tenant.
- **Stage Transition** (log): Registo de que um lead moveu de uma etapa para outra, com timestamp e utilizador responsável.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um novo tenant consegue concluir o fluxo completo de conexão do WhatsApp em menos de 3 minutos, sem ajuda externa, em ≥90% das tentativas.
- **SC-002**: Uma mensagem recebida pelo WhatsApp aparece no inbox do tenant em menos de 5 segundos na vasta maioria dos casos (p95), e em menos de 15 segundos no pior caso observado (p99) sob condições normais de ligação.
- **SC-003**: O agente consegue abrir o inbox, seleccionar uma conversa e enviar uma resposta em menos de 30 segundos a partir do login.
- **SC-004**: Em 95% dos envios de mensagem, o estado "enviada/entregue" é confirmado em menos de 15 segundos; falhas têm uma mensagem accionável em 100% dos casos.
- **SC-005**: Um responsável de tenant consegue customizar o pipeline (adicionar, renomear, reordenar e remover etapas) sem recorrer a suporte em ≥90% dos casos.
- **SC-006**: Zero incidentes de fuga de dados entre tenants em testes adversariais internos (tentativas de aceder a recursos de outro tenant via IDs/tokens manipulados devolvem sempre erro).
- **SC-007**: Quedas da ligação WhatsApp são detectadas e sinalizadas ao tenant em menos de 2 minutos do corte real.
- **SC-008**: O inbox continua fluido (scroll sem lag perceptível) com pelo menos 500 conversas e 10 000 mensagens por tenant.

## Assumptions

- **Multi-tenancy por empresa-cliente**: cada empresa-cliente da agência é um tenant. A MVP assume múltiplos utilizadores por tenant, todos com o mesmo nível de permissão efectivo (qualquer agente autenticado do tenant pode ver e operar qualquer conversa desse tenant). Papéis detalhados (ex.: só gestor pode editar pipeline) ficam fora da MVP e serão adicionados depois.
- **Provisionamento de tenants**: a criação inicial de um tenant e dos seus primeiros utilizadores é operada pela agência de marketing fora do produto (não há, na MVP, um "self-service" de sign-up de agências). O produto entrega-se já com o tenant existente, e os utilizadores recebem acesso por convite.
- **Um WhatsApp por tenant**: cada tenant liga exactamente um número de WhatsApp na MVP. Múltiplos números por tenant é um follow-up.
- **Um pipeline por tenant**: cada tenant tem exactamente um pipeline (único funil). Múltiplos pipelines por tenant (ex.: um para vendas, outro para suporte) é um follow-up.
- **Tipos de mensagem na MVP**: só texto é totalmente suportado em ambos os sentidos. Mensagens recebidas de outros tipos (áudio, imagem, vídeo, documentos, localizações, figurinhas) são preservadas como registo ("tipo não suportado") mas não são renderizadas nem podem ser respondidas nesse formato. Envio a partir do CRM é só texto na MVP.
- **Retenção de dados**: mensagens, conversas e leads são retidos indefinidamente enquanto o tenant estiver activo, seguindo a prática comum em ferramentas de CRM. Políticas de retenção específicas (ex.: RGPD, apagar após X meses) ficam fora da MVP.
- **Estado de "lido" do lead**: a MVP não tenta reflectir se o lead leu a mensagem do agente, apenas o estado de envio/entrega que o canal WhatsApp reporta. "Lido do lado do lead" pode vir depois.
- **Atribuição de conversa a agente**: não existe na MVP. Qualquer agente do tenant pode atender qualquer conversa. A noção de "conversa atribuída a um agente específico" é um follow-up.
- **Etapas por omissão**: um novo tenant recebe o conjunto de etapas `Novo → Em conversa → Proposta → Ganho / Perdido`, ajustável depois via US5.
- **Alcance geográfico e idioma**: produto pensado primeiro para português (PT-PT / PT-BR) e mercado lusófono. Internacionalização ampla fica fora da MVP.
- **Integração WhatsApp "não-oficial"**: a ligação usa uma biblioteca comunitária, não a API oficial WhatsApp Business. O produto assume que essa biblioteca pode cair ou mudar comportamento sem aviso — a UX de reconexão está desenhada para tolerar isso.

## Dependencies

- Disponibilidade de uma biblioteca/solução de integração WhatsApp utilizável por empresas-cliente (não oficial). A estabilidade desta dependência é externa ao produto.
- Uma identidade/sessão por utilizador confiável (autenticação) que permita marcar requisições como pertencentes a um tenant específico.
- Um mecanismo de armazenamento persistente para leads, conversas, mensagens, pipelines e ligações WhatsApp, com separação segura entre tenants.

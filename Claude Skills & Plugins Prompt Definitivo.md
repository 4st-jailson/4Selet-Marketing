# **The Ultimate Claude Skills & Plugins Prompt**

## **PARTE 1 — O QUE É UMA SKILL? (Core Mental Model)**

Uma **skill** é uma pasta que ensina o Claude a lidar com tarefas específicas de forma confiável, toda vez, sem precisar se re-explicar.

your-skill-name/  
├── SKILL.md          ← OBRIGATÓRIO. O cérebro da skill.  
├── scripts/          ← Opcional. Código executável Python/Bash.  
├── references/       ← Opcional. Docs que o Claude carrega quando necessário.  
└── assets/           ← Opcional. Templates, fonts, icons.

**Three-level progressive disclosure** (como o Claude carrega skills):

| Level | O quê | Quando Carrega | Token Cost |
| ----- | ----- | ----- | ----- |
| 1 | YAML frontmatter (name \+ description) | Sempre, toda conversa | \~100 words |
| 2 | SKILL.md body (instruções completas) | Quando o Claude decide que a skill é relevante | \< 500 lines ideal |
| 3 | Bundled files em scripts/ references/ assets/ | Apenas quando explicitamente necessário | Unlimited |

**Insight chave:** O Claude decide se carrega uma skill baseado APENAS na description no YAML frontmatter. Sua description é a coisa mais importante que você vai escrever.

---

## **PARTE 2 — O YAML FRONTMATTER (Domine Isso Primeiro)**

### **Formato mínimo válido**

\---  
name: your-skill-name  
description: O que faz. Use when user asks to \[specific phrases\].  
\---

### **Formato completo com todos os campos opcionais**

\---  
name: your-skill-name  
description: \>  
  Explicação detalhada do que esta skill faz e quando usar.  
  Inclua trigger phrases específicas que usuários podem dizer. Mencione file  
  types se relevante. Máximo 1024 characters total.  
license: MIT  
compatibility: Requires Python 3.10+, network access to Notion API  
metadata:  
  author: Seu Nome ou Empresa  
  version: 1.0.0  
  mcp-server: your-mcp-server-name  
  category: productivity  
  tags: \[project-management, automation\]  
  documentation: https://example.com/docs  
  support: support@example.com  
\---

### **Regras dos campos — memorize estas**

**Campo `name`:**

* ✅ Apenas `kebab-case`  
* ✅ Deve corresponder ao nome da pasta  
* ❌ Sem espaços: `My Cool Skill`  
* ❌ Sem underscores: `my_cool_skill`  
* ❌ Sem maiúsculas: `MyCoolSkill`  
* ❌ Não pode começar com `claude` ou `anthropic` (reservados)

**Campo `description`:**

* ✅ Deve incluir O QUE a skill faz E QUANDO usar  
* ✅ Inclua frases específicas que usuários realmente diriam  
* ✅ Mencione file types se relevante (`.pdf`, `.fig`, `.csv`)  
* ✅ Seja um pouco "pushy" — o Claude tende a undertrigger, então vá mais pra explícito  
* ❌ Sem XML angle brackets `< >` em nenhum lugar  
* ❌ Máximo 1024 characters

**Regra de segurança:** Nunca coloque `< >` angle brackets no frontmatter. O frontmatter vive no system prompt do Claude e pode ser explorado.

---

## **PARTE 3 — ESCREVENDO BOAS DESCRIPTIONS (A Skill \#1)**

### **A fórmula**

\[O que faz\] \+ \[Quando usar\] \+ \[Trigger phrases específicas\] \+ \[File types se relevante\]

### **Bons exemplos de description ✅**

\# Clara, específica, inclui trigger phrases  
description: \>  
  Analyzes Figma design files and generates developer handoff documentation.  
  Use when user uploads .fig files, asks for "design specs", "component  
  documentation", or "design-to-code handoff". Always use this skill when  
  any Figma file is mentioned.

\# Focada em resultado com triggers explícitos  
description: \>  
  End-to-end customer onboarding for PayFlow. Handles account creation,  
  payment setup, and subscription management. Use when user says "onboard  
  new customer", "set up subscription", "create PayFlow account", or  
  mentions new client setup.

\# Com negative triggers para prevenir overtriggering  
description: \>  
  Advanced statistical analysis for CSV data including regression, clustering,  
  and modeling. Use for statistical modeling tasks. Do NOT use for simple  
  data exploration or basic charts (use the data-viz skill instead).

### **Maus exemplos de description ❌**

\# Vaga demais — não vai triggerar  
description: Helps with projects.

\# Faltando trigger phrases — Claude não vai saber quando usar  
description: Creates sophisticated multi-page documentation systems.

\# Técnica demais, sem linguagem voltada ao usuário  
description: Implements the Project entity model with hierarchical relationships.

### **Debugando problemas de trigger**

Pergunte ao Claude diretamente: *"When would you use the \[skill name\] skill?"*  
 O Claude vai citar a description de volta. Se soa vago ou confuso pra você, é confuso pro Claude.

---

## **PARTE 4 — ESCREVENDO O BODY DO SKILL.MD**

### **Template de estrutura recomendada**

\---  
name: your-skill-name  
description: \[Sua description otimizada\]  
\---

\# Skill Name

Resumo breve de uma linha do que esta skill faz.

\#\# When to Use This Skill  
\- Lista de cenários específicos de trigger  
\- File types ou contextos que se aplicam

\#\# Step 1: \[Primeira Ação\]

O que acontece aqui. Seja específico e actionable.

\`\`\`bash  
\# Exemplo de comando ou código  
python scripts/process.py \--input {filename}  
\# Expected output: descreva como o sucesso se parece

## **Step 2: \[Segunda Ação\]**

Continue com passos claros...

## **Examples**

### **Example 1: \[Cenário comum\]**

**Usuário diz:** "Set up a new marketing campaign"  
 **Actions:**

1. Fetch existing campaigns via MCP  
2. Create campaign com os parâmetros fornecidos  
    **Result:** Campaign criada com link de confirmação

## **Troubleshooting**

### **Error: \[Mensagem de erro comum\]**

**Cause:** Por que acontece  
 **Solution:** Como resolver

## **Quality Checklist**

Antes de finalizar, verifique:

* \[ \] Step 1 completado com sucesso  
* \[ \] Output validado  
* \[ \] Usuário notificado do resultado

\#\#\# Escrevendo instruções que o Claude realmente segue

\*\*Seja específico e actionable:\*\*  
\`\`\`markdown  
\# ✅ Bom  
Execute \`python scripts/validate.py \--input {filename}\` para checar o formato dos dados.  
Se a validação falhar, problemas comuns incluem:  
\- Missing required fields (adicione-os ao CSV)  
\- Invalid date formats (use YYYY-MM-DD)

\# ❌ Ruim  
Valide os dados antes de prosseguir.

**Para steps críticos, use headers explícitos:**

\#\# CRITICAL: Antes de chamar create\_project, verifique:  
\- Project name não está vazio  
\- Pelo menos um team member atribuído  
\- Start date não está no passado

**Adicione incentivo de performance para tarefas complexas:**

\#\# Performance Notes  
\- Tome seu tempo para fazer isso com cuidado  
\- Qualidade importa mais que velocidade  
\- Não pule validation steps

**Use progressive disclosure — mantenha o SKILL.md focado, referencie arquivos para profundidade:**

Antes de escrever queries, consulte \`references/api-patterns.md\` para:  
\- Rate limiting guidance  
\- Pagination patterns  
\- Error codes and handling

---

## **PARTE 5 — OS 5 PATTERNS QUE FUNCIONAM**

### **Pattern 1: Sequential Workflow Orchestration**

*Use quando:* Usuários precisam de processos multi-step numa ordem específica.

\# Workflow: Onboard New Customer

\#\# Step 1: Create Account  
Call MCP tool: \`create\_customer\`  
Parameters: name, email, company  
Expected: customer\_id returned

\#\# Step 2: Setup Payment  
Call MCP tool: \`setup\_payment\_method\`  
Wait for: payment method verification

\#\# Step 3: Create Subscription  
Call MCP tool: \`create\_subscription\`  
Use customer\_id from Step 1

\#\# Step 4: Send Welcome Email  
Call MCP tool: \`send\_email\`  
Template: welcome\_email\_template

\#\# Se qualquer step falhar:  
\- Logue o erro  
\- Notifique o usuário de qual step falhou  
\- Forneça instruções de recovery manual

### **Pattern 2: Multi-MCP Coordination**

*Use quando:* Workflows abrangem múltiplos serviços.

\# Phase 1: Figma MCP — Export design assets  
\# Phase 2: Drive MCP — Store assets, generate links  
\# Phase 3: Linear MCP — Create dev tasks with asset links  
\# Phase 4: Slack MCP — Post handoff summary to \#engineering

\#\# Data passing entre phases:  
\- Phase 1 → Phase 2: asset list  
\- Phase 2 → Phase 3: shareable URLs  
\- Phase 3 → Phase 4: task references

### **Pattern 3: Iterative Refinement**

*Use quando:* A qualidade do output melhora com iteração (reports, documents, designs).

\#\# Initial Draft  
1\. Fetch data via MCP  
2\. Gere o first draft  
3\. Salve em temp file

\#\# Quality Check  
Execute: \`python scripts/check\_report.py\`  
Verifique: missing sections, formatting issues, data errors

\#\# Refinement Loop  
1\. Corrija cada issue identificada  
2\. Re-validate  
3\. Repita até atingir o quality threshold

\#\# Finalization  
Aplique formatação, gere summary, salve a versão final

### **Pattern 4: Context-Aware Tool Selection**

*Use quando:* Mesmo objetivo, ferramentas diferentes dependendo do contexto.

\#\# Decision Tree: File Storage  
1\. Cheque o file type e size  
2\. Direcione de acordo:  
   \- Large files (\>10MB) → cloud storage MCP  
   \- Collaborative docs → Notion/Docs MCP  
   \- Code files → GitHub MCP  
   \- Temp files → local storage  
3\. Sempre explique ao usuário POR QUE aquele storage foi escolhido

### **Pattern 5: Domain-Specific Intelligence**

*Use quando:* Sua skill embute conhecimento especializado (compliance, legal, finance).

\#\# Payment Processing with Compliance

\#\#\# Before Processing (Execute Toda Vez)  
1\. Verifique sanctions lists  
2\. Verifique jurisdiction allowances  
3\. Avalie o risk level  
4\. Documente a compliance decision

\#\#\# Processing (Apenas Se Compliance Passou)  
\- Call payment processing MCP  
\- Aplique fraud checks  
\- Processe a transaction

\#\#\# Se Compliance Falhou  
\- Flag for review  
\- Crie um compliance case  
\- NÃO processe

\#\#\# Audit Trail (Obrigatório)  
Logue todos os checks, decisions e results

---

## **PARTE 6 — SKILLS \+ MCP (The Power Combo)**

### **A analogia da cozinha**

* **MCP** \= Cozinha profissional (tools, ingredients, access)  
* **Skills** \= Receitas (como usar tudo de forma eficaz)

### **Sem skills \+ MCP:**

* Usuários conectam seu MCP mas não sabem o que fazer depois  
* Cada conversa começa do zero  
* Resultados inconsistentes porque usuários promptam de forma diferente  
* Tickets de suporte perguntando "como faço X?"

### **Com skills \+ MCP:**

* Workflows pré-construídos ativam automaticamente  
* Best practices embutidas em toda interação  
* Menor learning curve, resultados consistentes

### **Checklist de troubleshooting de conexão MCP:**

1. Verifique se o MCP server mostra "Connected" em Settings → Extensions  
2. Confirme que as API keys são válidas e não expiraram  
3. Verifique se os OAuth tokens foram refreshed  
4. Teste o MCP independentemente: *"Use \[Service\] MCP to fetch my projects"*  
5. Se a direct MCP call falhar → o problema é no MCP, não na sua skill  
6. Verifique se os tool names correspondem exatamente (case-sensitive)

---

## **PARTE 7 — TESTANDO SUA SKILL**

### **Três níveis de testing**

| Level | Método | Melhor Para |
| ----- | ----- | ----- |
| Quick | Manual testing no Claude.ai | Iteração rápida, sem setup |
| Moderate | Scripted testing no Claude Code | Validação repetível |
| Rigorous | Programmatic eval via API | Production-grade skills |

### **As 3 categorias de teste**

**1\. Trigger tests** — Carrega nos momentos certos?

✅ Deve triggerar:  
\- "Help me set up a new ProjectHub workspace"  
\- "I need to create a project in ProjectHub"  
\- "Initialize a ProjectHub project for Q4 planning"

❌ NÃO deve triggerar:  
\- "What's the weather in San Francisco?"  
\- "Help me write Python code"  
\- "Create a spreadsheet" (a não ser que sua skill lide com sheets)

**2\. Functional tests** — Produz output correto?

Test: Criar project com 5 tasks  
Given: Project name "Q4 Planning", 5 task descriptions  
When: Skill executa  
Then:  
  \- Project criado  
  \- 5 tasks criadas com propriedades corretas  
  \- Todas as tasks linkadas ao project  
  \- Zero API errors

**3\. Performance comparison** — É melhor do que sem skill?

Sem skill:              Com skill:  
15 back-and-forth       2 clarifying questions  
3 failed API calls      0 failed API calls  
12,000 tokens           6,000 tokens  
Usuário digita steps    Automatic workflow

### **Dica pro: Itere em UMA tarefa difícil primeiro**

Encontre a tarefa mais desafiadora e representativa. Itere até o Claude acertar. Extraia essa abordagem vencedora para a skill. Depois expanda para múltiplos test cases.

---

## **PARTE 8 — GUIA DE TROUBLESHOOTING**

### **Skill não faz upload**

| Error | Causa | Fix |
| ----- | ----- | ----- |
| "Could not find SKILL.md" | Nome de arquivo errado | Deve ser exatamente `SKILL.md` (case-sensitive) |
| "Invalid frontmatter" | Problema de formatação YAML | Adicione delimitadores `---` acima e abaixo |
| "Invalid skill name" | Tem espaços ou maiúsculas | Use apenas `kebab-case` |

**YAML frontmatter válido:**

\---  
name: my-skill  
description: Does things clearly and specifically.  
\---

### **Skill não triggera (undertriggering)**

**Checklist:**

* A description é genérica demais? ("Helps with projects" não funciona)  
* Inclui frases que usuários realmente diriam?  
* Menciona file types se relevante?

**Fix:** Adicione trigger phrases mais específicas. Torne a description mais "pushy."

### **Skill triggera demais (overtriggering)**

**Fix 1:** Adicione negative triggers

description: \>  
  Advanced data analysis for CSV files. Use for statistical modeling.  
  Do NOT use for simple data exploration (use data-viz skill instead).

**Fix 2:** Restrinja o scope

\# Amplo demais:  
description: Processes documents

\# Melhor:  
description: Processes PDF legal documents for contract review

### **Instruções não seguidas**

1. **Verbose demais?** Mova conteúdo detalhado para arquivos em `references/`  
2. **Step crítico enterrado?** Coloque no TOPO com um header `## CRITICAL:`  
3. **Linguagem ambígua?** Substitua "make sure to validate things" por comandos exatos  
4. **Model pulando steps?** Considere incluir um validation script — código é determinístico, linguagem não

### **Skill está lenta ou respostas degradadas**

* Mantenha o SKILL.md abaixo de 5.000 palavras (idealmente abaixo de 500 lines)  
* Mova docs longos para `references/` e linke a eles  
* Evite habilitar mais de 20-50 skills simultaneamente  
* Use progressive disclosure — nem tudo num único arquivo

---

## **PARTE 9 — DISTRIBUTION CHECKLIST**

### **GitHub hosting (recomendado)**

1. Crie um repo público: `github.com/yourcompany/skills`  
2. Adicione um `README.md` no nível do repo (para visitantes humanos — NÃO dentro da pasta da skill)  
3. Inclua screenshots e exemplos de uso  
4. Linke a partir da sua documentação MCP

### **Template de guia de instalação para usuários**

\# Instalando a Skill \[Seu Serviço\]

1\. \*\*Download:\*\*  
   \- Clone: \`git clone https://github.com/yourcompany/skills\`  
   \- Ou baixe o ZIP em Releases

2\. \*\*Instale no Claude:\*\*  
   \- Abra Claude.ai → Settings → Capabilities → Skills  
   \- Clique "Upload skill"  
   \- Selecione a pasta da skill (zipada)

3\. \*\*Ative:\*\*  
   \- Toggle on a skill \[Seu Serviço\]  
   \- Certifique-se que seu MCP server está conectado

4\. \*\*Teste:\*\*  
   \- Pergunte ao Claude: "Set up a new project in \[Seu Serviço\]"

### **Posicionando sua skill (copie este framing)**

❌ Ruim:

"The skill is a folder containing YAML frontmatter and Markdown instructions."

✅ Bom:

"A skill ProjectHub permite que equipes configurem workspaces completos de projeto em segundos — incluindo pages, databases e templates — ao invés de gastar 30 minutos em setup manual."

---

## **PARTE 10 — VALIDATION CHECKLIST COMPLETO**

Use antes E depois do upload.

### **Antes de começar**

* \[ \] Identificou 2–3 use cases concretos  
* \[ \] Identificou tools necessárias (built-in ou MCP)  
* \[ \] Planejou a folder structure

### **Durante o desenvolvimento**

* \[ \] Pasta nomeada em `kebab-case`  
* \[ \] `SKILL.md` existe (grafia exata, case-sensitive)  
* \[ \] YAML frontmatter tem delimitadores `---`  
* \[ \] Campo `name`: kebab-case, sem espaços, sem maiúsculas  
* \[ \] `description` inclui O QUÊ e QUANDO  
* \[ \] Sem XML angle brackets `< >` em nenhum lugar no frontmatter  
* \[ \] Instruções são claras e actionable  
* \[ \] Error handling incluído para falhas comuns  
* \[ \] Examples fornecidos com cenários realistas  
* \[ \] References claramente linkadas do SKILL.md

### **Antes do upload**

* \[ \] Skill triggera em tarefas obviamente relacionadas  
* \[ \] Skill triggera em requests parafraseados  
* \[ \] Skill NÃO triggera em tópicos não relacionados  
* \[ \] Functional tests passam  
* \[ \] Integração MCP funciona (se aplicável)  
* \[ \] Comprimido como arquivo `.zip`

### **Após o upload**

* \[ \] Teste em conversas reais  
* \[ \] Monitore para under/over-triggering  
* \[ \] Colete feedback dos usuários  
* \[ \] Atualize `version` no metadata ao iterar

---

## **PARTE 11 — PROMPTS DE REFERÊNCIA RÁPIDA PARA USAR COM O CLAUDE**

Use estes prompts nas suas conversas com o Claude para aproveitar skills de forma eficaz:

**Construir uma skill do zero:**

Use the skill-creator skill to help me build a skill for \[seu use case\].  
My top 2-3 workflows are: \[liste-os\].

**Revisar e melhorar uma skill existente:**

Review this skill and suggest improvements to make it trigger more reliably:  
\[cole seu SKILL.md\]

**Debugar problemas de triggering:**

When would you use the \[skill name\] skill?   
What phrases would make you load it automatically?

**Corrigir overtriggering:**

The \[skill name\] skill is loading for unrelated queries.  
Help me add negative triggers to make it more specific.

**Melhorar instruções:**

My skill loads correctly but Claude isn't following the instructions.  
Help me rewrite these steps to be more explicit and actionable:  
\[cole as instruções\]

**Testar uma skill manualmente:**

Pretend you have access to the \[skill name\] skill.   
Follow its instructions to complete this task: \[task description\]

---

## **BÔNUS — SKILL STRUCTURE CHEAT SHEET**

✅ CORRETO nome de pasta:    notion-project-setup  
❌ ERRADO — tem espaços:     Notion Project Setup  
❌ ERRADO — underscores:     notion\_project\_setup  
❌ ERRADO — maiúsculas:      NotionProjectSetup

✅ CORRETO nome de arquivo:  SKILL.md  
❌ ERRADO — lowercase:       skill.md  
❌ ERRADO — variação:        SKILL.MD

✅ CORRETA description:      Inclui O QUÊ \+ QUANDO \+ trigger phrases  
❌ ERRADA description:       Vaga demais, faltando trigger phrases

✅ INCLUA no repo:           README.md (para visitantes humanos)  
❌ NÃO INCLUA na skill:      README.md (dentro da pasta da skill)

✅ Progressive disclosure:   SKILL.md curto \+ references/ para docs profundos  
❌ Jogar tudo:               Um SKILL.md gigante com 10.000 palavras

✅ Teste três coisas:        Triggering \+ Functionality \+ Performance  
❌ Shipar sem testar:        Sem trigger tests \= comportamento imprevisível

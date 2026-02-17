# Boss Prime — Prompt de Desenvolvimento

> Documento de referência para continuar o desenvolvimento do Boss Prime.
> Contém tudo que é necessário para retomar de onde paramos.

---

## Projeto

- **Nome**: Boss Prime
- **Plataforma**: HubSpot CMS (HubL / Jinja2)
- **Tipo de módulo**: Global Content (coleção de itens editáveis)
- **Repositório**: `jrl-nasah/bossprime`, branch `main`
- **Editor**: VS Code + GitHub Copilot (Claude)
- **Deploy**: Copiar/colar manual do VS Code para o editor do HubSpot → Publicar
- **Idioma do código**: inglês (variáveis, commits) | **Comunicação**: português BR

---

## Estrutura do repositório

```
boss/
├── bp-property-hero-collection-global.module/
│   ├── module.html   ← HubL (template server-side)
│   ├── module.css    ← Estilos
│   └── module.js     ← JavaScript (IIFE, vanilla)
├── bp-listing-grid.module/
│   ├── module.html
│   ├── module.css
│   └── module.js
└── doc/
    ├── prompt.md     ← este arquivo
    └── futuro.md     ← tarefas futuras planejadas
```

---

## Regras de trabalho

### Fluxo

1. Usuário descreve problema ou feature (em português, direto)
2. Copilot investiga — lê arquivos, busca padrões, entende contexto
3. Copilot implementa — edita os arquivos locais
4. Usuário copia o código para o HubSpot e publica
5. Usuário testa no site e reporta o resultado
6. Se não funcionou → debug → ajuste → nova publicação
7. Quando funcionar → usuário autoriza commit e push

### Regra de ouro

> **NUNCA commitar ou dar push sem o usuário autorizar.**
> Sempre perguntar: "Posso commitar e dar push?"

### Princípio de segurança

> Nenhuma alteração pode quebrar funcionalidades existentes.
> Filtros, busca, favoritos, paginação, carrossel, sort — tudo deve continuar funcionando após qualquer mudança.

---

## Tecnologias e padrões

### HubL (server-side)

- **Campos de escolha (Sim/Não)** retornam strings (`"true"`, `"false"`) ou `[]` vazio quando nunca salvo
- **Coerção robusta obrigatória**:
  ```jinja
  {% set _raw = it.campo|default('true') %}
  {% set _s   = (_raw ~ '')|trim|lower %}
  {% set _is_true = (_raw is boolean and _raw) or _s in ['sim','yes','true','1','on'] %}
  ```
- **Sempre** concatenar `~ ''` antes de `|trim` — protege contra Number, null, undefined
- **`selectattr('x.y')`** não funciona com atributo aninhado — usar loop explícito
- **`{% set %}` dentro de `{% for %}`** não persiste fora do loop (escopo de bloco Jinja2)
- **Solução universal**: renderizar elementos com `hidden` no HTML, JS controla visibilidade

### JavaScript

- **IIFE**: `(() => { ... })()`
- **Vanilla JS** puro, sem frameworks nem bibliotecas
- **Binding via `data-*`**: `data-track`, `data-prev`, `data-next`, `data-slide`, etc.
- **Lazy init**: `IntersectionObserver` para carrosséis e mapas
- **Carrossel**: setas/thumbs/dots renderizados com `hidden`, JS revela quando 2+ slides
- **Favoritos**: `localStorage` chave `bp_fav_codigo_imovel_v1`, evento GTM `favorite_toggle`
- **Shuffle**: `sessionStorage` chave `bp_shuffle_seed_v1`, PRNG determinístico `mulberry32`
- **Normalização de código**: `normCode()` (minúsculo, só alfanumérico)
- **Swipe**: pointer events com captura, threshold 40px

### CSS

- **Escopo**: classes `bp-*` (sem resets globais)
- **BEM**: `bp-componente__elemento` / `bp-componente--modificador`
- **Estados**: `.is-active`, `.is-sold`, `.is-stack`, `.is-hidden`
- **Responsivo**: `clamp()` para sizing fluido
- **Full-bleed**: `left:50%; margin-left:calc(-50vw + var(--edge))`

---

## Debug no HubSpot

Quando algo não funciona após publicar:

1. Adicionar banner visual com valores brutos:
   ```html
   <p style="color:red;background:yellow;padding:8px;font-size:14px">
     DEBUG: campo_raw=[{{ _raw }}] | campo_s=[{{ _s }}]
   </p>
   ```
2. Publicar e verificar os valores reais
3. Ajustar a lógica com base nos dados
4. **Remover debug antes de commitar**

---

## Git

### Formato de commit

```
tipo(escopo): descrição curta em inglês
```

**Tipos**: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`
**Escopo**: nome do módulo simplificado (ex: `collection-global`)

### Histórico de commits

| Hash | Descrição |
|------|-----------|
| `e49741e` | init: módulos bp-listing-grid e bp-property-hero-collection-global |
| `a81a017` | feat: carrossel por card na listagem (até 4 mídias, swipe, vídeo lazy) |
| `b70128f` | style: chips .is-v1..v5 nos badges dos cards de listagem |
| `4458731` | feat: JSON-LD ItemList (SEO) + hover sutil no card de listagem |
| `caa4198` | fix: remover try/except inválido no HubL do JSON-LD |
| `5af0003` | feat: suporte a gallery_bulk_urls (fotos extras via URLs com `;`) |
| `497b994` | feat: isVisible_home + isInvisible_Sell choice fields |
| `c55c013` | fix: redirect ?codigo_imovel para /imoveis/ |
| `d573d0e` | fix: carousel arrows always rendered, JS controls visibility |
| `6ede664` | docs: add workflow prompt |
| `b06f9aa` | feat: shuffle listing cards per session (isOrder_Alter) |

### Fluxo git

```
git add <arquivos>
git commit -m "tipo(escopo): descrição"
git push
```

Listar arquivos explícitos no `git add` (não usar `git add .` cegamente).

---

## Armadilhas conhecidas

| Problema | Causa | Solução |
|----------|-------|---------|
| `selectattr('image.src')` não funciona | HubL não suporta ponto em selectattr | Loop explícito com `{% if g.image.src %}` |
| `{% set %}` dentro de `{% for %}` não persiste | Escopo de bloco do Jinja2 | Renderizar com `hidden`, JS controla |
| Campo escolha retorna `[]` | Nunca salvo no editor | `\|default('valor')` trata |
| CEP como Number causa crash | Campo numérico no HubSpot | `(it.cep\|default('') ~ '')\|trim` |
| `?codigo_imovel=X` na home | URL errada para detalhe | Redirect JS para `/imoveis/` |
| Booleano em campo escolha | HubSpot retorna string | Coerção robusta com lista de valores |

---

## Checklist antes de publicar

- [ ] Sem banners de debug no HTML
- [ ] Coerções `~ ''` em todos os campos que podem ser Number/null
- [ ] Setas/thumbs com `hidden` no HTML (JS revela)
- [ ] Testado no site com diferentes imóveis
- [ ] Commit autorizado pelo usuário

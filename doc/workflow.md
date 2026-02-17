# Boss Prime — Workflow de Desenvolvimento

## Stack

- **CMS**: HubSpot (HubL / Jinja2)
- **Módulos**: Global Content (coleção de itens)
- **Arquivos por módulo**: `module.html`, `module.css`, `module.js`
- **Repositório**: `jrl-nasah/bossprime`, branch `main`
- **Editor**: VS Code + GitHub Copilot (Claude)
- **Deploy**: Copiar/colar manual no editor do HubSpot → Publicar

---

## Fluxo de trabalho

1. **Usuário descreve o problema ou feature** (em português, direto)
2. **Copilot investiga** — lê arquivos, busca padrões, entende contexto
3. **Copilot implementa** — edita os arquivos locais
4. **Usuário copia o código para o HubSpot** e publica
5. **Usuário testa no site** e reporta o resultado
6. **Se não funcionou** → debug com banners visuais ou ajustes
7. **Quando funcionar** → usuário autoriza commit e push
8. **Copilot commita e faz push** (somente após autorização)

### Regra de ouro

> **NUNCA commitar ou dar push sem o usuário autorizar.**  
> Sempre perguntar: "Posso commitar e dar push?"

---

## Estrutura dos módulos

```
bp-nome-do-modulo.module/
├── module.html   ← HubL (template server-side)
├── module.css    ← Estilos (classes bp-*)
└── module.js     ← JavaScript (IIFE, vanilla JS)
```

### Módulos atuais

| Módulo | Função |
|--------|--------|
| `bp-property-hero-collection-global.module` | Landing de detalhe + listagem com filtros |
| `bp-listing-grid.module` | Grid de listagem (referência de padrões) |

---

## Padrões HubL

### Campos de escolha (Sim/Não)

HubSpot retorna **strings** (`"true"`, `"false"`) ou **`[]` vazio** quando nunca definido.

Padrão de coerção robusto (referência: `bp-listing-grid` campo `exibir`):

```jinja
{% set _raw = it.campo|default('true') %}
{% set _s   = (_raw ~ '')|trim|lower %}
{% set _is_false = (_raw is boolean and (not _raw)) or _s in ['nao','não','no','false','0','off'] %}
```

- `|default('true')` → valor quando campo é `[]` (nunca salvo)
- `~ ''` → força string (evita crash com tipos inesperados)
- `|trim|lower` → normaliza
- Checagem dupla: booleano nativo OU string em lista

### Coerção de campos numéricos/texto

```jinja
{% set _val = (it.campo|default('') ~ '')|trim %}
```

Sempre concatenar `~ ''` antes de `|trim` — protege contra Number, null, undefined.

### CEP como Number

```jinja
{% set __cep_s = (it.cep|default('') ~ '')|trim %}
{% set __cep_digits = __cep_s|regex_replace('[^0-9]', '') %}
```

### Contagem de mídias

**NÃO usar** `selectattr('image.src')` — HubL não suporta atributo aninhado com ponto.

**NÃO usar** `{% set %}` dentro de `{% for %}` esperando persistir fora do loop — Jinja2 tem escopo de bloco.

**Solução**: renderizar elementos sempre no HTML com `hidden` e deixar o JS controlar visibilidade contando slides no DOM.

---

## Padrões JavaScript

### Estrutura

- IIFE: `(() => { ... })()`
- Vanilla JS, sem frameworks
- `data-*` attributes para binding (ex: `data-track`, `data-prev`, `data-next`)
- IntersectionObserver para lazy init

### Carrossel — visibilidade das setas

Setas e thumbs são renderizados com `hidden` no HTML. O JS revela quando há 2+ slides:

```javascript
if (slides.length > 1) {
  if (prev) prev.hidden = false;
  if (next) next.hidden = false;
}
```

### Favoritos

- LocalStorage: chave `bp_fav_codigo_imovel_v1`
- GTM: evento `favorite_toggle`
- Código normalizado: `normCode()` (minúsculo, só alfanumérico)

---

## Padrões CSS

- Escopo: classes `bp-*` (sem resets globais)
- BEM: `bp-componente__elemento` / `bp-componente--modificador`
- Estado: `.is-active`, `.is-sold`, `.is-stack`, `.is-hidden`
- Responsivo: `clamp()` para sizing fluido
- Full-bleed: `left:50%; margin-left:calc(-50vw + var(--edge))`

---

## Debug

Quando algo não funciona no HubSpot:

1. Adicionar banners visuais com valores brutos:
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

Tipos: `feat`, `fix`, `refactor`, `style`, `chore`  
Escopo: nome do módulo simplificado (ex: `collection-global`, `listing-grid`)

Exemplos:
```
feat(collection-global): isVisible_home + isInvisible_Sell choice fields
fix(collection-global): carousel arrows always rendered, JS controls visibility
fix(collection-global): redirect ?codigo_imovel to /imoveis/ page
```

### Fluxo git

```
git add <arquivos>
git commit -m "tipo(escopo): descrição"
git push
```

Sempre listar arquivos explícitos no `git add` (não usar `git add .`).

---

## Armadilhas conhecidas

| Problema | Causa | Solução |
|----------|-------|---------|
| `selectattr('image.src')` não funciona | HubL não suporta ponto em selectattr | Loop explícito com `{% if g.image.src %}` |
| `{% set %}` dentro de `{% for %}` não persiste | Escopo de bloco do Jinja2 | Renderizar sempre no HTML, JS controla |
| Campo escolha retorna `[]` | Nunca salvo no editor | `\|default('valor')` trata |
| CEP como Number causa crash | Campo numérico no HubSpot | `(it.cep\|default('') ~ '')\|trim` |
| `?codigo_imovel=X` na home | URL errada para detalhe | Redirect JS para `/imoveis/` |
| Booleano não funciona em campo escolha | HubSpot retorna string, não bool | Coerção robusta com lista de valores |

---

## Checklist antes de publicar

- [ ] Sem banners de debug no HTML
- [ ] Coerções `~ ''` em todos os campos que podem ser Number/null
- [ ] Setas/thumbs com `hidden` no HTML (JS revela)
- [ ] Testado no site com diferentes imóveis
- [ ] Commit autorizado pelo usuário

// bp-listing-grid / module.js
(() => {
  const root  = document.currentScript.closest('.bp-listing-grid') || document;
  const grid  = root.querySelector('[data-grid]');
  const cards = Array.from(root.querySelectorAll('[data-card]'));

  /* ============================ Utils ============================ */
  const slugify = (s) => (s||'').toString().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
    .replace(/-{2,}/g,'-').slice(0,80);

  const parseNumber = (v) => {
    if (typeof v === 'number') return v;
    const s = String(v||'').trim(); if (!s) return NaN;
    let n = s.replace(/[^\d.,-]/g,'');
    if (n.includes('.') && n.includes(',')) n = n.replace(/\./g,'').replace(',','.');
    else if (n.includes(',') && !n.includes('.')) n = n.replace(',','.');
    return parseFloat(n);
  };
  const formatBRL = (v) => {
    const num = parseNumber(v);
    if (!isFinite(num)) return null;
    return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(num);
  };

  // Hash FNV-1a 32-bit → hex de 6 chars
  const fnv1a = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8).slice(0,6);
  };

  /* ======= Auto-fit do preço: numeric (1 linha) vs texto (até 2) ======= */
  function fitPrice(el){
    if (!el) return;
    const mode = el.dataset.mode || 'text'; // 'numeric' | 'text'
    let max = 20;                // deve casar com CSS base
    const min = 13;              // mínimo aceitável
    el.style.fontSize = max + 'px';
    el.style.lineHeight = '1.15';
    el.classList.remove('is-fullrow', 'is-nowrap');

    // helpers
    const lines = () => {
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
      return Math.ceil(el.scrollHeight / lh);
    };
    const overflowX = () => el.scrollWidth > el.clientWidth + 0.5; // tolerância

    if (mode === 'numeric'){
      // não quebrar: reduz fonte até caber em 1 linha; se não couber, dá linha inteira e tenta de novo
      el.classList.add('is-nowrap');

      let guard = 20;
      while (overflowX() && max > min && guard--) {
        max -= 1;
        el.style.fontSize = max + 'px';
      }
      if (overflowX()){
        // dá a linha toda pro preço e reavalia
        el.classList.add('is-fullrow');
        // forçar reflow
        void el.offsetWidth;
        guard = 20;
        while (overflowX() && max > min && guard--) {
          max -= 1;
          el.style.fontSize = max + 'px';
        }
      }
      return;
    }

    // Texto livre: até 2 linhas; se não couber, ocupa linha inteira
    let guard = 20;
    while (lines() > 2 && max > min && guard--) {
      max -= 1;
      el.style.fontSize = max + 'px';
    }
    if (lines() > 2){
      el.classList.add('is-fullrow');
    }
  }

  /* ===================== Favoritos (LocalStorage) ===================== */
  const FAVORITES_KEY = 'bp_fav_v1';
  const loadFavs = () => { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || {}; } catch { return {}; } };
  const saveFavs = (o) => { try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(o)); } catch {} };
  let favs = loadFavs();

  const applyFavState = (btn, active) => {
    if (!btn) return;
    btn.classList.toggle('is-active', !!active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.setAttribute('aria-label', active ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
  };

  const toggleFavorite = (id, title, btn) => {
    const willFav = !favs[id];
    if (willFav) favs[id] = true; else delete favs[id];
    saveFavs(favs); applyFavState(btn, willFav);
    try {
      (window.dataLayer = window.dataLayer || []).push({
        event:'favorite_toggle', propertyId:id, propertyTitle:title||'', favorited:willFav
      });
    } catch {}
  };

  // Pré-computa um ID único e estável para cada card
  cards.forEach((card, idx) => {
    const rawBase = (card.getAttribute('data-id') || card.getAttribute('data-title') || `item-${idx+1}`).trim();
    const base    = slugify(rawBase) || `item-${idx+1}`;
    const sig     = card.getAttribute('data-uid') || `${rawBase}|${idx+1}`;
    const hash    = fnv1a(sig);
    const favId   = `${base}-${hash}`;
    card.dataset.favid = favId;
  });

  /* =================== Paginação por linhas (Ver mais) ================== */
  const moreWrap = root.querySelector('[data-more]');
  const moreBtn  = root.querySelector('[data-more-btn]');
  const INITIAL_ROWS = 6;
  const STEP_ROWS    = 4;
  let shownRows = INITIAL_ROWS;

  const getComputedColumns = () => {
    if (!grid) return 1;
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
    return Math.max(1, cols);
  };
  const visibleCards = () => cards.filter(c => c.style.display !== 'none');

  function applyRowVisibility(){
    const cols     = getComputedColumns();
    const maxItems = shownRows * cols;
    const list     = visibleCards();
    list.forEach((c, i) => { c.dataset.pgHidden = i >= maxItems ? '1' : ''; });
  }

  function recomputePaginator(){
    if (!moreWrap || !moreBtn) return;
    const cols       = getComputedColumns();
    const list       = visibleCards();
    const totalRows  = Math.ceil(list.length / cols);
    const canPaginate= totalRows > INITIAL_ROWS;

    shownRows = Math.min(Math.max(shownRows, INITIAL_ROWS), totalRows);
    applyRowVisibility();

    const allVisible = (shownRows * cols) >= list.length;
    const showMoreUI = canPaginate && !allVisible;

    moreWrap.hidden = !showMoreUI;
    moreBtn.hidden  = !showMoreUI;
  }

  moreBtn?.addEventListener('click', () => {
    const cols      = getComputedColumns();
    const list      = visibleCards();
    const totalRows = Math.ceil(list.length / cols);
    shownRows = Math.min(totalRows, shownRows + STEP_ROWS);
    applyRowVisibility();

    const allVisible = (shownRows * cols) >= list.length;
    if (allVisible) { moreWrap.hidden = true; moreBtn.hidden = true; }
  });

  let rAf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(rAf);
    rAf = requestAnimationFrame(() => {
      recomputePaginator();
      prices.forEach(p => fitPrice(p.el)); // reavalia tamanhos
    });
  }, { passive:true });

  /* =================== Cabeçalho / Filtros (lupa) =================== */
  const head       = root.querySelector('[data-head]');
  const toggleBtn  = root.querySelector('[data-filter-toggle]') || root.querySelector('.bp-filters__toggle');
  const filters    = root.querySelector('[data-filters]');
  const chipsWrap  = root.querySelector('[data-filter-chips]');
  const clearBtn   = root.querySelector('[data-filter-clear]');
  const countBadge = root.querySelector('[data-count]');
  const selected   = new Set();

  const FAV_FILTER_SLUG = '__fav__';

  const hideBadge = () => {
    if (!countBadge) return;
    countBadge.textContent = '';
    countBadge.hidden = true;
    countBadge.style.display = 'none';
  };
  const showBadge = (n) => {
    if (!countBadge) return;
    countBadge.textContent = String(n);
    countBadge.hidden = n <= 0;
    countBadge.style.display = n > 0 ? '' : 'none';
  };

  const allTags = (() => {
    const map = new Map(); // slug -> label
    cards.forEach(card => {
      const badges = Array.from(card.querySelectorAll('[data-badges] .bp-chip'))
        .map(n => n.textContent.trim()).filter(Boolean);
      badges.forEach(label => { const s = slugify(label); if (!map.has(s)) map.set(s,label); });
      card.dataset.tags = badges.map(t => slugify(t)).join('|');
    });
    return map;
  })();

  if (allTags.size === 0) {
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (filters)   filters.hidden = true;
  }

  function renderFilterChips(){
    if (!chipsWrap) return;
    chipsWrap.innerHTML = '';

    [...allTags.entries()].forEach(([slug,label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bp-filterchip';
      btn.setAttribute('role','checkbox');
      btn.setAttribute('aria-checked','false');
      btn.dataset.slug = slug;
      btn.innerHTML = `<span class="t">${label}</span><span class="x" aria-hidden="true">×</span>`;
      btn.addEventListener('click', () => toggleTag(slug));
      chipsWrap.appendChild(btn);
    });

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'bp-filterchip';
    favBtn.setAttribute('role','checkbox');
    favBtn.setAttribute('aria-checked','false');
    favBtn.dataset.slug = FAV_FILTER_SLUG;
    favBtn.innerHTML = `<span class="t">❤ Favoritos</span><span class="x" aria-hidden="true">×</span>`;
    favBtn.addEventListener('click', () => toggleTag(FAV_FILTER_SLUG));
    chipsWrap.appendChild(favBtn);
  }

  function toggleTag(slug){
    if (selected.has(slug)) selected.delete(slug); else selected.add(slug);
    updateFilterUI(); applyFilter();
  }

  function updateFilterUI(){
    chipsWrap?.querySelectorAll('.bp-filterchip').forEach(el => {
      const on = selected.has(el.dataset.slug);
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    const count = selected.size;
    if (count > 0) showBadge(count); else hideBadge();
    if (clearBtn) clearBtn.hidden = selected.size === 0;
  }

  function applyFilter(){
    const wantTags = [...selected].filter(s => s !== FAV_FILTER_SLUG);
    const favOnly  = selected.has(FAV_FILTER_SLUG);

    if (wantTags.length === 0 && !favOnly){
      cards.forEach(c => { c.style.display = ''; });
      recomputePaginator();
      return;
    }

    cards.forEach(c => {
      const tags = (c.dataset.tags || '').split('|').filter(Boolean);
      const matchTags = (wantTags.length === 0) ? true : wantTags.some(s => tags.includes(s));
      const matchFav  = !favOnly ? true : !!favs[c.dataset.favid];
      c.style.display = (matchTags && matchFav) ? '' : 'none';
    });

    recomputePaginator();
  }

  function openFilters(){
    if (!filters) return;
    filters.hidden = false;
    toggleBtn?.setAttribute('aria-expanded','true');
    updateFilterUI();
    document.addEventListener('keydown', onEsc, { passive:true });
    document.addEventListener('click', onClickOutside, true);
  }
  function closeFilters(){
    if (!filters) return;
    filters.hidden = true;
    toggleBtn?.setAttribute('aria-expanded','false');
    updateFilterUI();
    document.removeEventListener('keydown', onEsc, { passive:true });
    document.removeEventListener('click', onClickOutside, true);
  }
  function onEsc(e){ if (e.key === 'Escape') closeFilters(); }
  function onClickOutside(e){
    if (!filters || filters.hidden) return;
    const within = filters.contains(e.target) || head?.contains(e.target);
    if (!within) closeFilters();
  }

  toggleBtn?.addEventListener('click', () => {
    if (!filters) return;
    (filters.hidden ? openFilters : closeFilters)();
  });
  clearBtn?.addEventListener('click', () => {
    selected.clear();
    updateFilterUI();
    applyFilter();
  });

  renderFilterChips();
  updateFilterUI();
  hideBadge();

  /* ============ Carrossel + Preço + Favorito por cartão ============ */
  const prices = [];
  cards.forEach((card) => {
    const media = card.querySelector('[data-media]');
    const track = card.querySelector('[data-track]');
    const slidesEls = Array.from(track?.querySelectorAll('.bp-card__slide') || []);
    const slides = slidesEls.length;
    const prev = card.querySelector('[data-prev]');
    const next = card.querySelector('[data-next]');
    const dotsC = card.querySelector('[data-dots]');
    if (!track) return;

    const ytFrames = Array.from(track.querySelectorAll('iframe'));
    const pauseAllVideos = () => {
      ytFrames.forEach(fr => {
        try { fr.contentWindow?.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:[]}), '*'); } catch {}
      });
    };

    const applyVideoSlideClass = (i) => {
      const isVideo = !!slidesEls[i]?.querySelector('iframe');
      if (media) media.classList.toggle('is-video-slide', !!isVideo);
    };

    if (slides <= 1){
      track.style.transform = 'translateX(0%)';
      applyVideoSlideClass(0);
    } else {
      let i = 0;
      const clamp = n => (n + slides) % slides;

      let dots = [];
      if (dotsC){
        dotsC.innerHTML = '';
        for (let k=0;k<slides;k++){
          const b = document.createElement('button');
          if (k===0) b.classList.add('is-active');
          b.addEventListener('click', e => { e.stopPropagation(); i = k; update(true); });
          dotsC.appendChild(b);
        }
        dots = Array.from(dotsC.children);
      }

      function update(shouldPause){
        track.style.transform = `translateX(${-i*100}%)`;
        dots.forEach((d,idx2)=>d.classList.toggle('is-active', idx2===i));
        applyVideoSlideClass(i);
        if (shouldPause) pauseAllVideos();
      }
      function nextS(){ i = clamp(i+1); update(true); }
      function prevS(){ i = clamp(i-1); update(true); }

      prev && prev.addEventListener('click', e => { e.stopPropagation(); prevS(); });
      next && next.addEventListener('click', e => { e.stopPropagation(); nextS(); });

      const SWIPE = 40; let x0=null,y0=null, axisLocked=null, used=false;
      const onDown = (e)=>{ x0=e.clientX; y0=e.clientY; axisLocked=null; used=false; try{ track.setPointerCapture?.(e.pointerId);}catch{} };
      const onMove = (e)=>{
        if (x0==null || y0==null) return;
        const dx=e.clientX-x0, dy=e.clientY-y0;
        if (!axisLocked && (Math.abs(dx)>8 || Math.abs(dy)>8)) axisLocked = Math.abs(dx)>Math.abs(dy)?'x':'y';
        if (axisLocked==='x' && Math.abs(dx)>SWIPE && !used){ used=true; dx<0?nextS():prevS(); }
      };
      const onUpOrCancel = (e)=>{ x0=y0=null; axisLocked=null; used=false; try{ track.releasePointerCapture?.(e.pointerId);}catch{} };

      track.addEventListener('pointerdown', onDown, { passive:true });
      track.addEventListener('pointermove', onMove, { passive:true });
      track.addEventListener('pointerup', onUpOrCancel, { passive:true });
      track.addEventListener('pointercancel', onUpOrCancel, { passive:true });

      update(false);
    }

    // === Preço: formata numérico; classifica modo numeric|text e registra ===
    const priceEl = card.querySelector('.bp-card__price');
    if (priceEl){
      const raw = priceEl.getAttribute('data-price') ?? '';
      const looksNumeric = /^[\s\d.,\-R$\u00A0]+$/.test(raw);
      if (looksNumeric) {
        const formatted = formatBRL(raw);
        priceEl.textContent = formatted || raw;
        priceEl.dataset.mode = 'numeric';
      } else {
        priceEl.textContent = raw;
        priceEl.dataset.mode = 'text';
      }
      prices.push({ el: priceEl });
    }

    // === Favorito ===
    const favBtn = card.querySelector('[data-fav]');
    const favId  = card.dataset.favid;
    const title  = card.getAttribute('data-title') || '';

    if (favBtn){
      applyFavState(favBtn, !!favs[favId]);
      favBtn.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        toggleFavorite(favId, title, favBtn);
        if (selected.has('__fav__')) applyFilter();
      });
    }
  });

  // Ajusta o preço — inicial, em resize e quando o footer variar
  prices.forEach(p => fitPrice(p.el));
  const ro = ('ResizeObserver' in window) ? new ResizeObserver(() => prices.forEach(p => fitPrice(p.el))) : null;
  if (ro) {
    cards.forEach(c => {
      const f = c.querySelector('.bp-card__footer');
      if (f) ro.observe(f);
    });
  }

  // inicializa paginador
  recomputePaginator();
})();

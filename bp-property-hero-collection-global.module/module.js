// bp-property-hero-collection / module.js
(() => {
  const norm = (v) => String(v || '').trim().toLowerCase();
  const normCode = (v) => norm(v).replace(/[^a-z0-9]/g, '');

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

  const getQS = (name) => {
    try { return new URLSearchParams(window.location.search).get(name) || ''; }
    catch { return ''; }
  };

  /* ===== Favoritos (Fase 1) =====
     - ID = codigo_imovel (normalizado)
     - LocalStorage novo
     - GTM favorite_toggle
  */
  const FAV_KEY = 'bp_fav_codigo_imovel_v1';
  const FAV_TAG = '__fav__';

  const readFavSet = () => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      const arr = JSON.parse(raw || '[]');
      return new Set((Array.isArray(arr) ? arr : []).map(normCode).filter(Boolean));
    } catch { return new Set(); }
  };

  const writeFavSet = (set) => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...set])); } catch {}
  };

  const pushFavGtm = (code, title, favorited) => {
    try {
      const dl = (window.dataLayer = window.dataLayer || []);
      dl.push({ event:'favorite_toggle', propertyId: code || '', propertyTitle: title || '', favorited: !!favorited });
    } catch {}
  };

  /* Lightbox: atalho global único (ESC/←/→) para a instância aberta */
  const __BP_LB_ACTIVE_KEY = '__bpPropHeroActiveLbV1';
  const __BP_LB_KEYDOWN_KEY = '__bpPropHeroKeydownBoundV1';

  const setActiveLb = (ctx) => { try { window[__BP_LB_ACTIVE_KEY] = ctx; } catch {} };
  const clearActiveLb = (lb) => {
    try {
      const cur = window[__BP_LB_ACTIVE_KEY];
      if (cur && cur.lb === lb) window[__BP_LB_ACTIVE_KEY] = null;
    } catch {}
  };

  const bindGlobalLbKeys = () => {
    try {
      if (window[__BP_LB_KEYDOWN_KEY]) return;
      window[__BP_LB_KEYDOWN_KEY] = true;

      window.addEventListener('keydown', (e) => {
        const ctx = window[__BP_LB_ACTIVE_KEY];
        const lb = ctx?.lb;
        if (!lb || lb.hidden) return;

        if (e.key === 'Escape') ctx.close?.();
        if (e.key === 'ArrowRight') ctx.step?.(1);
        if (e.key === 'ArrowLeft')  ctx.step?.(-1);
      });
    } catch {}
  };

  /* ===== Shuffle por sessão (isOrder_Alter) ===== */
  const SHUFFLE_SEED_KEY = 'bp_shuffle_seed_v1';

  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function getSessionSeed() {
    try {
      const stored = sessionStorage.getItem(SHUFFLE_SEED_KEY);
      if (stored) return parseInt(stored, 10);
      const seed = Math.floor(Math.random() * 2147483647) + 1;
      sessionStorage.setItem(SHUFFLE_SEED_KEY, String(seed));
      return seed;
    } catch { return Math.floor(Math.random() * 2147483647) + 1; }
  }

  function fisherYatesShuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function extractVideoSrc(raw) {
    if (!raw) return '';
    const t = String(raw).trim();
    if (t.startsWith('<iframe')) {
      const m = t.match(/\ssrc=(['"])(.*?)\1/i);
      return m ? m[2] : '';
    }
    return t;
  }

  function toEmbedUrl(input) {
    const raw = extractVideoSrc(input);
    if (!raw) return '';
    try {
      const u = new URL(raw, window.location.origin);
      const host = u.hostname.replace('www.', '');

      if (host.includes('youtube.com') && u.searchParams.get('v')) {
        const id = u.searchParams.get('v');
        return `https://www.youtube.com/embed/${id}?rel=0&autoplay=1&mute=1`;
      }
      if (host.includes('youtu.be')) {
        const id = u.pathname.replace('/', '');
        return `https://www.youtube.com/embed/${id}?rel=0&autoplay=1&mute=1`;
      }
      if (host.includes('youtube.com') && u.pathname.startsWith('/embed/')) {
        const sep = u.search ? '&' : '?';
        return `${u.origin}${u.pathname}${u.search || ''}${sep}autoplay=1&mute=1`;
      }
      return raw + (raw.includes('?') ? '&' : '?') + 'autoplay=1&mute=1';
    } catch { return ''; }
  }

  function cleanUnidades(root){
    root.querySelectorAll('.bp-prop-hero__info table.bp-unidades:not([data-cleaned])').forEach(tbl => {
      tbl.setAttribute('data-cleaned', '1');

      tbl.querySelectorAll('td').forEach(td => {
        const text = (td.textContent || '').replace(/\u00A0/g, ' ').trim();
        const hasMeaningful =
          /\S/.test(text) ||
          td.querySelector('a, img, video, iframe, ul li, ol li, p, span, strong, em, h1, h2, h3, h4, h5, h6');

        if (!hasMeaningful) td.remove();
      });

      tbl.querySelectorAll('tr').forEach(tr => {
        if (!tr.querySelector('td')) tr.remove();
      });
    });
  }

  function initHero(root){
    if (!root || root.dataset.bpInited === '1') return;
    root.dataset.bpInited = '1';

    bindGlobalLbKeys();

    const track     = root.querySelector('[data-track]');
    const slides    = Array.from(track?.querySelectorAll('[data-slide]') || []);
    const thumbsBar = root.querySelector('[data-thumbs]');
    const thumbs    = Array.from(thumbsBar?.querySelectorAll('.bp-prop-hero__thumb') || []);
    const prev      = root.querySelector('[data-prev]');
    const next      = root.querySelector('[data-next]');

    const lb      = root.querySelector('[data-lightbox]');
    const stage   = lb?.querySelector('[data-stage]');
    const lbPrev  = lb?.querySelector('[data-lightbox-prev]');
    const lbNext  = lb?.querySelector('[data-lightbox-next]');
    const lbClose = lb?.querySelector('[data-lightbox-close]');
    const lbDots  = lb?.querySelector('[data-lightbox-dots]');

    const carousel = root.querySelector('.bp-prop-hero__carousel');
    const infoBox  = root.querySelector('.bp-prop-hero__info');

    let i = 0;
    const clamp = (n, len) => (n + len) % len;

    slides.forEach(slide => {
      const raw = slide.dataset.embed;
      if (!raw) return;
      const src = toEmbedUrl(raw);
      if (!src) { slide.removeAttribute('data-embed'); return; }
      if (slide.querySelector('iframe')) return;
      const ifr = document.createElement('iframe');
      ifr.src = src;
      ifr.allow = 'autoplay; encrypted-media; picture-in-picture';
      ifr.frameBorder = '0';
      ifr.referrerPolicy = 'no-referrer-when-downgrade';
      ifr.allowFullscreen = true;
      slide.appendChild(ifr);
    });

    const update = () => {
      if (!track || !slides.length) return;
      track.style.transform = `translateX(${-i * 100}%)`;
      thumbs.forEach(t => t.classList.toggle('is-active', Number(t.dataset.go || -1) === i));
    };

    const goto  = idx => { if (!slides.length) return; i = clamp(idx, slides.length); update(); };
    const nextS = () => goto(i + 1);
    const prevS = () => goto(i - 1);

    if (track && slides.length) {
      /* Mostra setas/thumbs somente com 2+ slides */
      if (slides.length > 1) {
        if (prev) prev.hidden = false;
        if (next) next.hidden = false;
        if (thumbsBar) thumbsBar.hidden = false;
      }

      prev?.addEventListener('click', prevS);
      next?.addEventListener('click', nextS);
      thumbs.forEach(btn => btn.addEventListener('click', () => goto(+btn.dataset.go)));

      track.addEventListener('click', () => {
        const slide = slides[i];
        if (slide?.querySelector('img')) openLb(i);
      });

      (() => {
        const SWIPE = 40;
        let x0=null, y0=null, axis=null, used=false;

        const onDown = (e)=>{ x0=e.clientX; y0=e.clientY; axis=null; used=false; try{track.setPointerCapture?.(e.pointerId);}catch{} };
        const onMove = (e)=>{
          if (x0==null || y0==null) return;
          const dx=e.clientX-x0, dy=e.clientY-y0;
          if (!axis && (Math.abs(dx)>8 || Math.abs(dy)>8)) axis = Math.abs(dx)>Math.abs(dy)?'x':'y';
          if (axis==='x' && Math.abs(dx)>SWIPE && !used){ used=true; dx<0?nextS():prevS(); }
        };
        const onUp = (e)=>{ x0=y0=null; axis=null; used=false; try{track.releasePointerCapture?.(e.pointerId);}catch{} };

        track.addEventListener('pointerdown', onDown, { passive:true });
        track.addEventListener('pointermove', onMove, { passive:true });
        track.addEventListener('pointerup', onUp, { passive:true });
        track.addEventListener('pointercancel', onUp, { passive:true });
      })();

      update();
    }

    function mountDots(){
      if (!lbDots || !slides.length) return;
      lbDots.innerHTML = '';
      slides.forEach((slide, idx) => {
        const img = slide.querySelector('img');
        if (!img) return;
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.idx = String(idx);
        const t = document.createElement('img');
        t.src = img.getAttribute('data-lightbox-src') || img.src;
        t.alt = img.alt || `Imagem ${idx+1}`;
        b.appendChild(t);
        b.addEventListener('click', () => { i = idx; syncLb(); });
        lbDots.appendChild(b);
      });
    }

    function renderStageFor(slide){
      if (!stage) return;
      stage.innerHTML = '';
      const img = slide?.querySelector?.('img');
      if (img){
        const el = document.createElement('img');
        el.src = img.getAttribute('data-lightbox-src') || img.src;
        el.alt = img.alt || '';
        stage.appendChild(el);
        return;
      }
      const rawData = slide?.dataset?.embed || slide?.querySelector?.('iframe')?.src || '';
      const src = toEmbedUrl(rawData);
      if (!src) return;
      const ifr = document.createElement('iframe');
      ifr.src = src;
      ifr.allow = 'autoplay; encrypted-media; picture-in-picture';
      ifr.frameBorder = '0';
      ifr.referrerPolicy = 'no-referrer-when-downgrade';
      ifr.allowFullscreen = true;
      stage.appendChild(ifr);
    }

    function openLb(idx){
      if (!lb) return;
      i = clamp(idx, slides.length);
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      if (lbDots && !lbDots.children.length) mountDots();
      syncLb();
      setActiveLb({ lb, close: closeLb, step: stepLb });
    }

    function closeLb(){
      if (!lb) return;
      lb.hidden = true;
      document.body.style.overflow = '';
      const ifr = stage?.querySelector('iframe');
      if (ifr) ifr.src = ifr.src;
      clearActiveLb(lb);
    }

    function stepLb(delta){ i = clamp(i + delta, slides.length); syncLb(); }

    function syncLb(){
      renderStageFor(slides[i]);
      if (lbDots){
        Array.from(lbDots.children).forEach(d => d.classList.toggle('is-active', Number(d.dataset.idx||-1) === i));
      }
      update();
    }

    lbPrev?.addEventListener('click', () => stepLb(-1));
    lbNext?.addEventListener('click', () => stepLb(1));
    lbClose?.addEventListener('click', closeLb);

    const RATIO_STACK=1.8, DELTA_STACK=560, RATIO_UNSTACK=1.5, DELTA_UNSTACK=420;
    let stacked=false, raf=0;

    function readHeights() {
      const leftH  = carousel?.getBoundingClientRect?.().height || 0;
      const rightH = infoBox ? Math.max(infoBox.scrollHeight, infoBox.getBoundingClientRect().height) : 0;
      return { leftH, rightH };
    }

    function decideStack() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { leftH, rightH } = readHeights();
        if (!leftH || !rightH) return;
        const ratio = rightH / leftH;
        const delta = rightH - leftH;

        if (!stacked && (ratio > RATIO_STACK || delta > DELTA_STACK)) {
          root.classList.add('is-stack'); stacked = true;
        } else if (stacked && (ratio < RATIO_UNSTACK && delta < DELTA_UNSTACK)) {
          root.classList.remove('is-stack'); stacked = false;
        }
      });
    }

    const ro = ('ResizeObserver' in window) ? new ResizeObserver(decideStack) : null;
    ro?.observe(root);
    ro?.observe(carousel || root);
    ro?.observe(infoBox || root);

    slides.forEach(s => {
      const img = s.querySelector('img');
      if (img && !img.complete) img.addEventListener('load', decideStack, { once:true });
    });

    let timer;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(decideStack, 120); }, { passive:true });
    requestAnimationFrame(() => setTimeout(decideStack, 0));

    cleanUnidades(root);
  }

  function setupLazyMaps(collection){
    const maps = Array.from(collection.querySelectorAll('[data-map][data-map-src]'));
    if (!maps.length) return;

    const load = (el) => {
      if (el.dataset.loaded === '1') return;
      const src = el.dataset.mapSrc;
      const title = el.dataset.mapTitle || 'Mapa';
      if (!src) return;

      const ifr = document.createElement('iframe');
      ifr.src = src;
      ifr.title = title;
      ifr.setAttribute('aria-label', title);
      ifr.loading = 'lazy';
      ifr.referrerPolicy = 'no-referrer-when-downgrade';
      ifr.allowFullscreen = true;

      el.appendChild(ifr);
      el.classList.add('is-loaded');
      el.dataset.loaded = '1';
    };

    if (!('IntersectionObserver' in window)) {
      maps.forEach(load);
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          load(e.target);
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '200px' });

    maps.forEach(m => {
      const wrap = m.closest('[data-mapwrap]');
      if (wrap?.hidden) return;
      io.observe(m);
    });
  }

  function setupLazyHeroes(collection){
    const heroes = Array.from(collection.querySelectorAll('.bp-prop-hero[data-imovel]')).filter(h => !h.hidden);
    if (!heroes.length) return;

    if (!('IntersectionObserver' in window)) {
      heroes.forEach(initHero);
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          initHero(e.target);
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '200px' });

    heroes.forEach(h => io.observe(h));
  }

  function applyFilter(collection){
    const qparam = collection.dataset.qparam || 'codigo';

    const raw =
      getQS(qparam) ||
      getQS('codigo') ||
      getQS('codigo_imovel') ||
      getQS('codigo_imovel_interesse');

    const want = normCode(raw);
    const empty = collection.querySelector('[data-empty]');
    const items = Array.from(collection.querySelectorAll('[data-imovel]'));
    const maps  = Array.from(collection.querySelectorAll('[data-mapwrap]'));

    if (!want) {
      if (empty) empty.hidden = true;
      items.forEach(el => el.hidden = false);
      maps.forEach(el => el.hidden = false);
      return { filtered: false, want: '' };
    }

    let found = false;
    items.forEach(el => {
      const has = normCode(el.dataset.code);
      const show = has && has === want;
      el.hidden = !show;
      found = found || show;
    });

    maps.forEach(el => {
      const has = normCode(el.dataset.code);
      el.hidden = !(has && has === want);
    });

    if (empty) empty.hidden = found;
    return { filtered: true, want, found };
  }

  function detectTypeFrom(text){
    const t = slugify(text || '');
    if (!t) return '';
    const has = (k) => t.includes(k);

    if (has('apartamento') || has('apto')) return 'Apartamento';
    if (has('cobertura')) return 'Cobertura';
    if (has('casa') || has('sobrado')) return 'Casa';
    if (has('terreno') || has('lote')) return 'Terreno';
    if (has('studio') || has('loft') || has('kitnet') || has('kit-net')) return 'Studio';
    if (has('comercial') || has('sala') || has('loja')) return 'Comercial';
    if (has('chacara') || has('sitio')) return 'Chácara/Sítio';
    return '';
  }

  function setupListing(collection){
    const searchRoot = collection.querySelector('[data-prop-search]');
    const grid = collection.querySelector('[data-prop-grid]');
    const cards = Array.from(collection.querySelectorAll('[data-prop-card]'));
    if (!searchRoot || !grid || !cards.length) return;

    const form     = searchRoot.querySelector('[data-prop-form]');
    const qInput   = searchRoot.querySelector('[data-q]');
    const citySel  = searchRoot.querySelector('[data-city]');
    const neighSel = searchRoot.querySelector('[data-neighborhood]');
    const typeSel  = searchRoot.querySelector('[data-type]');
    const bedsSel  = searchRoot.querySelector('[data-min-beds]');
    const bathsSel = searchRoot.querySelector('[data-min-baths]');
    const parkSel  = searchRoot.querySelector('[data-min-parking]');
    const minPIn   = searchRoot.querySelector('[data-min-price]');
    const maxPIn   = searchRoot.querySelector('[data-max-price]');
    const minAIn   = searchRoot.querySelector('[data-min-area]');
    const sortSel  = searchRoot.querySelector('[data-sort]');
    const clearBtn = searchRoot.querySelector('[data-clear]');
    const resultsEl= searchRoot.querySelector('[data-results]');
    const chipsWrap= searchRoot.querySelector('[data-tag-chips]');
    const listEmpty= collection.querySelector('[data-list-empty]');

    const moreWrap = collection.querySelector('[data-more]');
    const moreBtn  = searchRoot.querySelector('[data-more-btn]') || collection.querySelector('[data-more-btn]');

    let favSet = readFavSet();

    const buildDetailHref = (code) => {
      try {
        if (!code) return '';
        const cur = new URL(window.location.href);
        const next = new URL(cur.origin + cur.pathname);

        cur.searchParams.forEach((v,k) => {
          const kk = String(k || '');
          if (kk.startsWith('utm_') || kk === 'gclid' || kk === 'fbclid') next.searchParams.set(k, v);
        });

        next.searchParams.set('codigo_imovel', code);
        return next.toString();
      } catch { return ''; }
    };

    const cmpNum = (a,b,dir) => {
      const na = isFinite(a), nb = isFinite(b);
      if (na && nb) return dir * (a - b);
      if (na && !nb) return -1;
      if (!na && nb) return 1;
      return 0;
    };

    const cmpStr = (a,b,dir) => {
      const sa = String(a||'').trim();
      const sb = String(b||'').trim();
      if (sa && sb) return dir * sa.localeCompare(sb, 'pt-BR', { sensitivity:'base' });
      if (sa && !sb) return -1;
      if (!sa && sb) return 1;
      return 0;
    };

    const syncFavButton = (btn, code) => {
      if (!btn) return;
      const key = normCode(code);
      const on = !!key && favSet.has(key);

      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');

      if (on) {
        btn.title = 'Remover do favorito';
        btn.setAttribute('aria-label', `Remover do favorito: ${(code || '').trim()}`);
      } else {
        btn.title = 'Clique para salvar como favorito';
        btn.setAttribute('aria-label', `Clique para salvar como favorito: ${(code || '').trim()}`);
      }
    };

    const syncFavChipCount = () => {
      if (!chipsWrap) return;
      const el = chipsWrap.querySelector('[data-fav-count]');
      if (!el) return;
      const n = favSet.size;
      el.textContent = String(n);
      el.hidden = n <= 0;
    };

    const meta = cards.map((card, __i) => {
      const code   = (card.dataset.code || '').trim();
      const title  = (card.dataset.title || '').trim();
      const city   = (card.dataset.city || '').trim();
      const bairro = (card.dataset.neighborhood || '').trim();
      const tags   = (card.dataset.tags || '').split(',').map(s => s.trim()).filter(Boolean);

      const priceRaw = card.dataset.price || '';
      const priceN   = parseNumber(priceRaw);

      const bedsN  = parseInt(String(card.dataset.beds||'').replace(/[^\d]/g,''), 10);
      const bathsN = parseInt(String(card.dataset.baths||'').replace(/[^\d]/g,''), 10);
      const parkN  = parseInt(String(card.dataset.parking||'').replace(/[^\d]/g,''), 10);
      const areaN  = parseNumber(card.dataset.area || '');

      const type = detectTypeFrom([title, tags.join(' ')].join(' '));
      const idx = slugify([code, title, city, bairro, tags.join(' ')].join(' '));

      const priceTextEl = card.querySelector('[data-price-text]');
      if (priceTextEl && priceRaw) {
        const looksNumeric = /^[\s\d.,\-R$\u00A0]+$/.test(priceRaw);
        if (looksNumeric) priceTextEl.textContent = formatBRL(priceRaw) || priceRaw;
      }

      const link = card.querySelector('.bp-prop-card__link');
      const cta  = card.querySelector('[data-cta]');

      const detailHref = buildDetailHref(code);
      if (detailHref) {
        if (link) link.href = detailHref;
        if (cta)  cta.href  = detailHref;

        card.addEventListener('click', (ev) => {
          if (!detailHref) return;
          if (ev.defaultPrevented) return;

          if (ev.button !== 0) return;
          if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

          const sel = (window.getSelection && window.getSelection()) ? String(window.getSelection()) : '';
          if (sel && sel.trim().length) return;

          if (ev.target && ev.target.closest('a,button,input,select,textarea,label')) return;

          window.location.href = detailHref;
        });
      }

      // Fase 1: bind favorito no card
      const favBtn = card.querySelector('[data-fav]');
      if (favBtn && code) {
        syncFavButton(favBtn, code);

        favBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          const key = normCode(code);
          if (!key) return;

          const willFav = !favSet.has(key);
          if (willFav) favSet.add(key);
          else favSet.delete(key);

          writeFavSet(favSet);
          syncFavButton(favBtn, code);
          syncFavChipCount();
          pushFavGtm(code, title, willFav);

          // se estiver filtrando por favoritos, re-aplica
          if (selectedTags.has(FAV_TAG)) applyListFilter(true);
        });
      }

      return {
        __i,
        card,
        code,
        codeNorm: normCode(code),
        title,
        city,
        bairro,
        citySlug: slugify(city),
        bairroSlug: slugify(bairro),
        tags,
        tagSlugs: tags.map(slugify),
        priceN,
        bedsN,
        bathsN,
        parkN,
        areaN,
        type,
        typeSlug: slugify(type),
        idx
      };
    });

    /* Shuffle por sessão — reordena cards na abertura se data-shuffle presente */
    const shuffleEnabled = collection.hasAttribute('data-shuffle');
    if (shuffleEnabled && meta.length > 1) {
      const seed = getSessionSeed();
      const rng = mulberry32(seed);
      const indices = meta.map((_, i) => i);
      fisherYatesShuffle(indices, rng);
      indices.forEach((origIdx, newPos) => { meta[origIdx].__shuffleIdx = newPos; });
      meta.slice().sort((a, b) => a.__shuffleIdx - b.__shuffleIdx).forEach(m => grid.appendChild(m.card));
    } else {
      meta.forEach((m, i) => { m.__shuffleIdx = i; });
    }

    function applySort(sortKey){
      const remember = meta.map(m => m.card);
      const key = String(sortKey || '').trim();
      const list = meta.slice();

      let comparator = (a,b) => a.__shuffleIdx - b.__shuffleIdx;

      if (key === 'price_asc')  comparator = (a,b) => (cmpNum(a.priceN, b.priceN,  1) || (a.__i - b.__i));
      if (key === 'price_desc') comparator = (a,b) => (cmpNum(a.priceN, b.priceN, -1) || (a.__i - b.__i));
      if (key === 'area_asc')   comparator = (a,b) => (cmpNum(a.areaN,  b.areaN,   1) || (a.__i - b.__i));
      if (key === 'area_desc')  comparator = (a,b) => (cmpNum(a.areaN,  b.areaN,  -1) || (a.__i - b.__i));

      if (key === 'city_asc')   comparator = (a,b) => (cmpStr(a.city,  b.city,   1) || (a.__i - b.__i));
      if (key === 'city_desc')  comparator = (a,b) => (cmpStr(a.city,  b.city,  -1) || (a.__i - b.__i));

      if (key === 'beds_desc')  comparator = (a,b) => (cmpNum(a.bedsN,  b.bedsN, -1) || (a.__i - b.__i));
      if (key === 'baths_desc') comparator = (a,b) => (cmpNum(a.bathsN, b.bathsN,-1) || (a.__i - b.__i));

      if (key === 'title_asc')  comparator = (a,b) => (cmpStr(a.title, b.title,  1) || (a.__i - b.__i));

      list.sort(comparator);

      if (remember.length !== list.length) return;
      list.forEach(m => grid.appendChild(m.card));
    }

    const cityMap = new Map();
    meta.forEach(m => { if (m.city) cityMap.set(m.citySlug, m.city); });
    const cities = [...cityMap.entries()].sort((a,b) => a[1].localeCompare(b[1], 'pt-BR'));
    if (citySel) {
      const keep = citySel.value;
      citySel.innerHTML = '<option value="">Cidade (todas)</option>' + cities.map(([slug,label]) => (
        `<option value="${slug}">${label}</option>`
      )).join('');
      if (keep) citySel.value = keep;
    }

    const neighborhoodByCity = new Map();
    meta.forEach(m => {
      if (!m.citySlug || !m.bairro || !m.bairroSlug) return;
      const map = neighborhoodByCity.get(m.citySlug) || new Map();
      if (!map.has(m.bairroSlug)) map.set(m.bairroSlug, m.bairro);
      neighborhoodByCity.set(m.citySlug, map);
    });

    function refreshNeighborhoodSelect(citySlug, desiredSlug){
      if (!neighSel) return;

      const c = String(citySlug || '').trim();
      if (!c){
        neighSel.disabled = true;
        neighSel.innerHTML = `<option value="">Bairro (selecione a cidade)</option>`;
        neighSel.value = '';
        return;
      }

      const map = neighborhoodByCity.get(c);
      if (!map || map.size === 0){
        neighSel.disabled = true;
        neighSel.innerHTML = `<option value="">Bairro (indisponível)</option>`;
        neighSel.value = '';
        return;
      }

      neighSel.disabled = false;
      const opts = [...map.entries()].sort((a,b) => a[1].localeCompare(b[1], 'pt-BR', { sensitivity:'base' }));
      neighSel.innerHTML =
        `<option value="">Bairro (todos)</option>` +
        opts.map(([slug,label]) => `<option value="${slug}">${label}</option>`).join('');

      if (desiredSlug && map.has(desiredSlug)) neighSel.value = desiredSlug;
      else neighSel.value = '';
    }

    const typeMap = new Map();
    meta.forEach(m => { if (m.type) typeMap.set(m.typeSlug, m.type); });
    const types = [...typeMap.entries()].sort((a,b) => a[1].localeCompare(b[1], 'pt-BR'));
    if (typeSel) {
      if (types.length >= 2) {
        typeSel.hidden = false;
        const keep = typeSel.value;
        typeSel.innerHTML = '<option value="">Tipo (todos)</option>' + types.map(([slug,label]) => (
          `<option value="${slug}">${label}</option>`
        )).join('');
        if (keep) typeSel.value = keep;
      } else {
        typeSel.hidden = true;
      }
    }

    const selectedTags = new Set();

    const tagFreq = new Map();
    meta.forEach(m => {
      m.tags.forEach(label => {
        const s = slugify(label);
        if (!s) return;
        const cur = tagFreq.get(s) || { label, count: 0 };
        cur.count += 1;
        tagFreq.set(s, cur);
      });
    });
    const tagsSorted = [...tagFreq.entries()]
      .sort((a,b) => (b[1].count - a[1].count) || a[1].label.localeCompare(b[1].label, 'pt-BR'))
      .slice(0, 24);

    // Chips: Favoritos + badges
    if (chipsWrap) {
      chipsWrap.hidden = false;

      const favCount = favSet.size;
      const favChip =
        `<button type="button" class="bp-filterchip" data-tag="${FAV_TAG}" role="checkbox" aria-checked="false">❤ Favoritos` +
        ` <span class="bp-filterchip__count" data-fav-count ${favCount>0?'':'hidden'}>${favCount}</span></button>`;

      const tagChips = tagsSorted.length
        ? tagsSorted.map(([slug, obj]) =>
            `<button type="button" class="bp-filterchip" data-tag="${slug}" role="checkbox" aria-checked="false">${obj.label}</button>`
          ).join('')
        : '';

      chipsWrap.innerHTML = favChip + tagChips;

      chipsWrap.querySelectorAll('[data-tag]').forEach(btn => {
        btn.addEventListener('click', () => {
          const s = btn.dataset.tag;
          if (selectedTags.has(s)) selectedTags.delete(s); else selectedTags.add(s);
          syncChipUI();
          applyListFilter(true);
        });
      });
    }

    function syncChipUI(){
      if (!chipsWrap) return;
      chipsWrap.querySelectorAll('[data-tag]').forEach(btn => {
        const on = selectedTags.has(btn.dataset.tag);
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      syncFavChipCount();
    }

    const INITIAL_ROWS = 6;
    const STEP_ROWS    = 4;
    let shownRows = INITIAL_ROWS;

    const getComputedColumns = () => {
      try {
        const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
        return Math.max(1, cols);
      } catch { return 1; }
    };

    const visibleCards = () =>
      Array.from(grid.querySelectorAll('[data-prop-card]')).filter(c => !c.classList.contains('is-hidden'));

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

      shownRows = Math.min(Math.max(shownRows, INITIAL_ROWS), totalRows || INITIAL_ROWS);
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

    function readStateFromUrl(){
      const sp = new URLSearchParams(window.location.search);
      return {
        q: sp.get('q') || '',
        city: sp.get('city') || '',
        neighborhood: sp.get('neighborhood') || '',
        type: sp.get('type') || '',
        min_price: sp.get('min_price') || '',
        max_price: sp.get('max_price') || '',
        min_beds: sp.get('min_beds') || '',
        min_baths: sp.get('min_baths') || '',
        min_parking: sp.get('min_parking') || '',
        min_area: sp.get('min_area') || '',
        sort: sp.get('sort') || '',
        tags: (sp.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean)
      };
    }

    function writeStateToUrl(st){
      try {
        const url = new URL(window.location.href);
        const keys = ['q','city','neighborhood','type','min_price','max_price','min_beds','min_baths','min_parking','min_area','sort','tags'];
        keys.forEach(k => url.searchParams.delete(k));

        url.searchParams.delete('codigo');
        url.searchParams.delete('codigo_imovel');
        url.searchParams.delete('codigo_imovel_interesse');

        if (st.q) url.searchParams.set('q', st.q);
        if (st.city) url.searchParams.set('city', st.city);
        if (st.city && st.neighborhood) url.searchParams.set('neighborhood', st.neighborhood);
        if (st.type) url.searchParams.set('type', st.type);
        if (st.min_price) url.searchParams.set('min_price', st.min_price);
        if (st.max_price) url.searchParams.set('max_price', st.max_price);
        if (st.min_beds) url.searchParams.set('min_beds', st.min_beds);
        if (st.min_baths) url.searchParams.set('min_baths', st.min_baths);
        if (st.min_parking) url.searchParams.set('min_parking', st.min_parking);
        if (st.min_area) url.searchParams.set('min_area', st.min_area);
        if (st.sort) url.searchParams.set('sort', st.sort);
        if (st.tags && st.tags.length) url.searchParams.set('tags', st.tags.join(','));

        history.replaceState(null, '', url.toString());
      } catch {}
    }

    function setUIFromState(st){
      if (qInput) qInput.value = st.q || '';
      if (citySel) citySel.value = st.city || '';
      refreshNeighborhoodSelect((citySel?.value || '').trim(), (st.neighborhood || '').trim());

      if (typeSel && !typeSel.hidden) typeSel.value = st.type || '';
      if (bedsSel) bedsSel.value = st.min_beds || '';
      if (bathsSel) bathsSel.value = st.min_baths || '';
      if (parkSel) parkSel.value = st.min_parking || '';
      if (minPIn)  minPIn.value = st.min_price || '';
      if (maxPIn)  maxPIn.value = st.max_price || '';
      if (minAIn)  minAIn.value = st.min_area || '';
      if (sortSel) sortSel.value = st.sort || '';

      selectedTags.clear();
      (st.tags || []).forEach(t => selectedTags.add(t));
      syncChipUI();
    }

    function currentState(){
      return {
        q: (qInput?.value || '').trim(),
        city: (citySel?.value || '').trim(),
        neighborhood: (neighSel && !neighSel.disabled) ? (neighSel.value || '').trim() : '',
        type: (typeSel && !typeSel.hidden) ? (typeSel.value || '').trim() : '',
        min_price: (minPIn?.value || '').trim(),
        max_price: (maxPIn?.value || '').trim(),
        min_beds: (bedsSel?.value || '').trim(),
        min_baths: (bathsSel?.value || '').trim(),
        min_parking: (parkSel?.value || '').trim(),
        min_area: (minAIn?.value || '').trim(),
        sort: (sortSel?.value || '').trim(),
        tags: [...selectedTags]
      };
    }

    function isClearNeeded(st){
      return !!(
        st.q || st.city || st.neighborhood || st.type ||
        st.min_price || st.max_price || st.min_beds || st.min_baths ||
        st.min_parking || st.min_area || st.sort ||
        (st.tags && st.tags.length)
      );
    }

    function applyListFilter(resetPager){
      if (resetPager) shownRows = INITIAL_ROWS;

      favSet = readFavSet(); // garante estado atualizado
      syncFavChipCount();

      // re-sincroniza UI de botões (sem custo alto)
      meta.forEach(m => {
        const btn = m.card.querySelector('[data-fav]');
        if (btn && m.code) syncFavButton(btn, m.code);
      });

      const st = currentState();

      const q = slugify(st.q);
      const city = st.city;
      const neighborhood = st.neighborhood;
      const type = st.type;

      const minPrice = parseNumber(st.min_price);
      const maxPrice = parseNumber(st.max_price);
      const minBeds  = parseInt(st.min_beds || '', 10);
      const minBaths = parseInt(st.min_baths || '', 10);
      const minPark  = parseInt(st.min_parking || '', 10);
      const minArea  = parseNumber(st.min_area);

      const favOnly = selectedTags.has(FAV_TAG);
      const wantTags = [...selectedTags].filter(t => t !== FAV_TAG);

      let visible = 0;

      meta.forEach(m => {
        let okQ = true;
        if (q) {
          const qCode = normCode(st.q);
          if (qCode && qCode.length >= 4 && (qCode.startsWith('bp') || /\d/.test(qCode))) {
            okQ = m.codeNorm.includes(qCode);
          } else {
            const parts = q.split('-').filter(Boolean);
            okQ = parts.every(p => m.idx.includes(p));
          }
        }

        const okCity = !city || m.citySlug === city;
        const okNeighborhood = !neighborhood || (!!city && m.bairroSlug === neighborhood);
        const okType = !type || m.typeSlug === type;

        const okPriceMin = !isFinite(minPrice) || (isFinite(m.priceN) && m.priceN >= minPrice);
        const okPriceMax = !isFinite(maxPrice) || (isFinite(m.priceN) && m.priceN <= maxPrice);

        const okBeds  = !minBeds  || (isFinite(m.bedsN)  && m.bedsN  >= minBeds);
        const okBaths = !minBaths || (isFinite(m.bathsN) && m.bathsN >= minBaths);
        const okPark  = !minPark  || (isFinite(m.parkN)  && m.parkN  >= minPark);
        const okArea  = !isFinite(minArea) || (isFinite(m.areaN) && m.areaN >= minArea);

        const okTags = (wantTags.length === 0) ? true : wantTags.some(t => m.tagSlugs.includes(t));
        const okFav  = !favOnly || (!!m.codeNorm && favSet.has(m.codeNorm));

        const show = okQ && okCity && okNeighborhood && okType && okPriceMin && okPriceMax && okBeds && okBaths && okPark && okArea && okTags && okFav;

        m.card.classList.toggle('is-hidden', !show);
        if (show) visible += 1;
      });

      applySort(st.sort);

      meta.forEach(m => { if (m.card.classList.contains('is-hidden')) m.card.dataset.pgHidden = '1'; });

      if (resultsEl) {
        const label = (visible === 1) ? 'Imóvel' : 'Imóveis';
        resultsEl.textContent = `Mostrando ${visible} ${label}`;
      }

      if (listEmpty) listEmpty.hidden = visible !== 0;

      if (clearBtn) clearBtn.hidden = !isClearNeeded(st);

      writeStateToUrl(st);

      recomputePaginator();
    }

    const initState = readStateFromUrl();
    setUIFromState(initState);
    applyListFilter(true);

    const onChange = () => applyListFilter(true);

    qInput?.addEventListener('input', (() => {
      let t;
      return () => { clearTimeout(t); t = setTimeout(onChange, 140); };
    })());

    citySel?.addEventListener('change', () => {
      refreshNeighborhoodSelect((citySel.value || '').trim(), '');
      onChange();
    });

    neighSel?.addEventListener('change', onChange);

    typeSel?.addEventListener('change', onChange);
    bedsSel?.addEventListener('change', onChange);
    bathsSel?.addEventListener('change', onChange);
    parkSel?.addEventListener('change', onChange);
    sortSel?.addEventListener('change', onChange);

    minPIn?.addEventListener('input', (() => {
      let t;
      return () => { clearTimeout(t); t = setTimeout(onChange, 160); };
    })());
    maxPIn?.addEventListener('input', (() => {
      let t;
      return () => { clearTimeout(t); t = setTimeout(onChange, 160); };
    })());
    minAIn?.addEventListener('input', (() => {
      let t;
      return () => { clearTimeout(t); t = setTimeout(onChange, 160); };
    })());

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      applyListFilter(true);
    });

    clearBtn?.addEventListener('click', () => {
      if (qInput) qInput.value = '';
      if (citySel) citySel.value = '';

      if (neighSel) {
        neighSel.disabled = true;
        neighSel.innerHTML = `<option value="">Bairro (selecione a cidade)</option>`;
        neighSel.value = '';
      }

      if (typeSel && !typeSel.hidden) typeSel.value = '';
      if (bedsSel) bedsSel.value = '';
      if (bathsSel) bathsSel.value = '';
      if (parkSel) parkSel.value = '';
      if (minPIn) minPIn.value = '';
      if (maxPIn) maxPIn.value = '';
      if (minAIn) minAIn.value = '';
      if (sortSel) sortSel.value = '';
      selectedTags.clear();
      syncChipUI();
      applyListFilter(true);
    });

    let raf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => recomputePaginator());
    }, { passive:true });

    /* ========= Carrossel por card (até 4 mídias, lazy init) ========= */

    function mountVideoIframe(slide){
      if (!slide || slide.querySelector('iframe')) return;
      const raw = slide.dataset.embed;
      if (!raw) return;
      const sep = raw.includes('?') ? '&' : '?';
      const src = raw + sep + 'rel=0&playsinline=1&modestbranding=1&enablejsapi=1';
      const ifr = document.createElement('iframe');
      ifr.src = src;
      ifr.title = 'Vídeo do imóvel';
      ifr.loading = 'lazy';
      ifr.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      ifr.allowFullscreen = true;
      ifr.setAttribute('frameborder', '0');
      slide.appendChild(ifr);
      const ph = slide.querySelector('.bp-prop-card__play');
      if (ph) ph.remove();
    }

    function unmountVideoIframe(slide){
      if (!slide) return;
      const ifr = slide.querySelector('iframe');
      if (!ifr) return;
      try { ifr.contentWindow?.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:[]}), '*'); } catch {}
      ifr.remove();
      if (slide.dataset.embed && !slide.querySelector('.bp-prop-card__play')){
        const ph = document.createElement('div');
        ph.className = 'bp-prop-card__play';
        ph.setAttribute('aria-hidden', 'true');
        ph.textContent = '▶';
        slide.appendChild(ph);
      }
    }

    function initCardCarousel(card){
      if (!card || card.dataset.carouselInited === '1') return;
      card.dataset.carouselInited = '1';

      const track = card.querySelector('[data-track]');
      if (!track) return;

      const slidesEls = Array.from(track.querySelectorAll('.bp-prop-card__slide'));
      const total = slidesEls.length;

      const prevBtn = card.querySelector('[data-prev]');
      const nextBtn = card.querySelector('[data-next]');
      const dotsC   = card.querySelector('[data-dots]');

      if (total <= 1){
        track.style.transform = 'translateX(0%)';
        if (slidesEls[0]?.dataset.embed) mountVideoIframe(slidesEls[0]);
        return;
      }

      /* Mostra setas/dots com 2+ slides */
      if (prevBtn) prevBtn.hidden = false;
      if (nextBtn) nextBtn.hidden = false;
      if (dotsC) dotsC.hidden = false;
      let idx = 0;
      const wrap = n => (n + total) % total;

      let dots = [];
      if (dotsC){
        for (let k = 0; k < total; k++){
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', 'Mídia ' + (k + 1));
          if (k === 0) b.classList.add('is-active');
          b.addEventListener('click', e => { e.stopPropagation(); idx = k; update(true); });
          dotsC.appendChild(b);
        }
        dots = Array.from(dotsC.children);
      }

      function pauseVideos(){
        slidesEls.forEach(s => {
          const ifr = s.querySelector('iframe');
          if (ifr){
            try { ifr.contentWindow?.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:[]}), '*'); } catch {}
          }
        });
      }

      function update(shouldPause){
        track.style.transform = 'translateX(' + (-idx * 100) + '%)';
        dots.forEach((d, k) => d.classList.toggle('is-active', k === idx));
        if (shouldPause) pauseVideos();

        const active = slidesEls[idx];
        if (active?.dataset.embed) mountVideoIframe(active);

        slidesEls.forEach((s, k) => {
          if (k !== idx && s.dataset.embed && s.querySelector('iframe')) unmountVideoIframe(s);
        });
      }

      function nextS(){ idx = wrap(idx + 1); update(true); }
      function prevS(){ idx = wrap(idx - 1); update(true); }

      prevBtn?.addEventListener('click', e => { e.stopPropagation(); prevS(); });
      nextBtn?.addEventListener('click', e => { e.stopPropagation(); nextS(); });

      const SWIPE = 40;
      let x0 = null, y0 = null, axis = null, used = false;
      const onDown = e => { x0 = e.clientX; y0 = e.clientY; axis = null; used = false; try { track.setPointerCapture?.(e.pointerId); } catch {} };
      const onMove = e => {
        if (x0 == null || y0 == null) return;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis === 'x' && Math.abs(dx) > SWIPE && !used){ used = true; dx < 0 ? nextS() : prevS(); }
      };
      const onUp = e => { x0 = y0 = null; axis = null; used = false; try { track.releasePointerCapture?.(e.pointerId); } catch {} };

      track.addEventListener('pointerdown', onDown, { passive: true });
      track.addEventListener('pointermove', onMove, { passive: true });
      track.addEventListener('pointerup', onUp, { passive: true });
      track.addEventListener('pointercancel', onUp, { passive: true });

      update(false);
    }

    /* Lazy-init carrosséis via IntersectionObserver */
    (function initCardCarousels(){
      const mediaEls = Array.from(grid.querySelectorAll('[data-prop-card] [data-media]'));
      if (!mediaEls.length) return;

      if (!('IntersectionObserver' in window)){
        mediaEls.forEach(m => { const c = m.closest('[data-prop-card]'); if (c) initCardCarousel(c); });
        return;
      }

      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting){
            const c = e.target.closest('[data-prop-card]');
            if (c) initCardCarousel(c);
            io.unobserve(e.target);
          }
        });
      }, { rootMargin: '200px' });

      mediaEls.forEach(m => io.observe(m));
    })();
  }

  function boot(){
    const collections = Array.from(document.querySelectorAll('.bp-prop-hero-collection'));
    collections.forEach(col => {
      const res = applyFilter(col);

      if (res.filtered) {
        Array.from(col.querySelectorAll('.bp-prop-hero[data-imovel]')).forEach(hero => {
          if (!hero.hidden) initHero(hero);
        });
      } else {
        setupLazyHeroes(col);
      }

      setupLazyMaps(col);
      setupListing(col);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();

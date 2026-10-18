/*! Lythumb-viewer v1.0.0 — dependency-free image viewer | Copyright 2026 Lycolia Rizzim | AGPL-3.0 */
(function (global) {
  'use strict';
  /*! Icons: Material Symbols | Copyright Google LLC | Apache-2.0 | https://www.apache.org/licenses/LICENSE-2.0 */
  const icons = {"close": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24px\" viewBox=\"0 -960 960 960\" width=\"24px\" fill=\"currentColor\"><path d=\"m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z\"/></svg>", "list": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24px\" viewBox=\"0 -960 960 960\" width=\"24px\" fill=\"currentColor\"><path d=\"M480-400 40-640l440-240 440 240-440 240Zm0 160L63-467l84-46 333 182 333-182 84 46-417 227Zm0 160L63-307l84-46 333 182 333-182 84 46L480-80Zm0-411 273-149-273-149-273 149 273 149Zm0-149Z\"/></svg>", "zoom-in": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24px\" viewBox=\"0 -960 960 960\" width=\"24px\" fill=\"currentColor\"><path d=\"M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Zm-40-60v-80h-80v-80h80v-80h80v80h80v80h-80v80h-80Z\"/></svg>", "zoom-out": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24px\" viewBox=\"0 -960 960 960\" width=\"24px\" fill=\"currentColor\"><path d=\"M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400ZM280-540v-80h200v80H280Z\"/></svg>", "prev": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24px\" viewBox=\"0 -960 960 960\" width=\"24px\" fill=\"currentColor\"><path d=\"M400-240 160-480l240-240 56 58-142 142h486v80H314l142 142-56 58Z\"/></svg>", "next": "<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" height=\"24px\" viewBox=\"0 -960 960 960\" width=\"24px\" fill=\"currentColor\"><path d=\"m560-240-56-58 142-142H160v-80h486L504-662l56-58 240 240-240 240Z\"/></svg>"};
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const touchUI = () => !matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Fractional offsets put pixels between device pixels and blur the image, so land on whole device pixels.
  const snap = (n, origin=0) => { const d = devicePixelRatio || 1; return Math.round((n+origin)*d)/d - origin; };
  const TAP_DELAY = 300, IDLE_SECONDS = 3, DURATION = 366, GUTTER = 50, SWIPE_DURATION = 300;
  class Viewer {
    constructor() {
      this.root = null; this.points = new Map(); this.serial = 0;
      this.boundClick = e => {
        const a = e.target.closest?.('a[data-lythumb][href]');
        if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        if (!this.safe(a.href)) return;
        e.preventDefault(); this.open(a);
      };
      this.boundHash = () => this.hashChanged();
      this.boundResize = () => { cancelAnimationFrame(this.resizeFrame); this.resizeFrame = requestAnimationFrame(() => this.refit()); };
      this.boundOrientation = () => { clearTimeout(this.resizeTimer); this.resizeTimer = setTimeout(() => this.refit(), touchUI() ? 600 : 250); };
    }
    safe(src) { try { return ['http:', 'https:', 'file:', 'blob:'].includes(new URL(src, document.baseURI).protocol) || /^data:image\//i.test(src); } catch { return false; } }
    init() {
      if (this.initialized) return this;
      this.initialized = true;
      document.addEventListener('click', this.boundClick);
      window.addEventListener('popstate', this.boundHash);
      window.addEventListener('hashchange', this.boundHash);
      this.fromHash(); return this;
    }
    links() { return [...document.querySelectorAll('a[data-lythumb][href]')].filter(a => this.safe(a.href)); }
    parseHash() {
      let h; try { h = decodeURIComponent(location.hash.slice(1)); } catch { return null; }
      const parts = h.split('-'); let n = 1;
      if (parts.length > 1 && /^\+?\d+$/.test(parts.at(-1))) n = parseInt(parts.pop(), 10) || 1;
      const key = parts.join('-'); if (!key) return null;
      const a = this.links().filter(x => x.dataset.lythumb === key)[n-1];
      return a ? { a, index: n-1 } : null;
    }
    fromHash() { const match = this.parseHash(); if (match) this.open(match.a, true); }
    hashChanged() {
      // A hash navigation fires both popstate and hashchange; handle it once.
      if (location.href === this.handledURL) return;
      this.handledURL = location.href;
      if (!this.root) { this.fromHash(); return; }
      if (this.closing || !this.key) return;
      if (this.parseHash()?.a !== this.current) this.close(false);
    }
    open(a, fromHash = false) {
      if (this.root || !a?.matches?.('a[data-lythumb][href]') || !this.safe(a.href)) return;
      this.trigger = a; this.key = a.dataset.lythumb || '';
      this.items = this.key ? this.links().filter(x => x.dataset.lythumb === this.key) : [a];
      this.index = this.items.indexOf(a); this.closing = false; this.createdHistory = false;
      this.directHash = fromHash; this.originalURL = fromHash ? location.pathname + location.search : location.href; this.thumbsOpen = false; this.points.clear(); this.gesture = null;
      this.controlsHidden = false; this.isIdle = false; this.idleCount = 0; this.tapTimer = null;
      this.abort = new AbortController(); const signal = this.abort.signal;
      this.root = document.createElement('div'); this.root.className = 'lythumb';
      this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true');
      this.root.setAttribute('aria-label', '画像ビューアー'); this.root.tabIndex = -1;
      this.root.innerHTML = `<div class="lythumb-bg"></div><div class="lythumb-count"></div><div class="lythumb-toolbar"><button type="button" data-action="zoom" aria-label="原寸表示へ切り替え" title="原寸表示へ切り替え"><span class="lythumb-zoom-in">${icons['zoom-in']}</span><span class="lythumb-zoom-out" hidden>${icons['zoom-out']}</span></button><button type="button" data-action="thumbs" aria-label="サムネイル一覧" aria-expanded="false" title="サムネイル一覧">${icons.list}</button><button type="button" data-action="close" aria-label="閉じる" title="閉じる">${icons.close}</button></div><div class="lythumb-stage"><div class="lythumb-track"></div><div class="lythumb-status" role="status"></div></div><button type="button" class="lythumb-prev" data-action="prev" aria-label="前の画像">${icons.prev}</button><button type="button" class="lythumb-next" data-action="next" aria-label="次の画像">${icons.next}</button><div class="lythumb-caption"></div><div class="lythumb-thumbs" hidden></div><div class="lythumb-sr" aria-live="polite" aria-atomic="true"></div>`;
      this.bg = this.root.querySelector('.lythumb-bg');
      this.stage = this.root.querySelector('.lythumb-stage'); this.track = this.root.querySelector('.lythumb-track'); this.peers = new Map(); this.trackOffset = 0; this.status = this.root.querySelector('.lythumb-status');
      this.caption = this.root.querySelector('.lythumb-caption'); this.thumbs = this.root.querySelector('.lythumb-thumbs');
      this.zoomButton = this.root.querySelector('[data-action=zoom]');
      this.prev = this.root.querySelector('[data-action=prev]'); this.next = this.root.querySelector('[data-action=next]');
      this.background = [...document.body.children].map(el => ({el, inert: el.inert}));
      this.background.forEach(x => { x.el.inert = true; });
      this.bodyStyle = { overflow: document.body.style.overflow, marginRight: document.body.style.marginRight };
      this.scroll = [scrollX, scrollY];
      const gap = innerWidth - document.documentElement.clientWidth;
      if (gap > 0 && !touchUI() && document.body.scrollHeight > innerHeight) document.body.style.marginRight = `${parseFloat(getComputedStyle(document.body).marginRight) + gap}px`;
      document.body.style.overflow = 'hidden'; document.body.append(this.root);
      this.root.addEventListener('click', e => this.click(e), {signal});
      this.root.addEventListener('pointerdown', e => this.down(e), {signal});
      this.root.addEventListener('pointermove', e => this.move(e), {signal});
      this.root.addEventListener('pointerup', e => this.up(e), {signal});
      this.root.addEventListener('pointercancel', e => this.up(e, true), {signal});
      this.stage.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = e.deltaY || e.deltaX;
        if (!delta || this.points.size || performance.now() - (this.lastWheel || 0) < 250) return;
        this.lastWheel = performance.now(); this.show(this.index + (delta > 0 ? 1 : -1));
      }, {passive:false,signal});
      if (!touchUI()) {
        const activity = () => { this.idleCount = 0; if (this.isIdle) { this.isIdle = false; this.showControls(); } };
        ['mousemove','mouseleave','mousedown','touchstart','touchmove','scroll','keydown'].forEach(type => document.addEventListener(type, activity, {passive:true,signal}));
        this.idleTimer = setInterval(() => { if (++this.idleCount >= IDLE_SECONDS && !this.points.size) { this.isIdle = true; this.idleCount = 0; this.hideControls(); } }, 1000);
      }
      document.addEventListener('keydown', e => this.keydown(e), {signal});
      window.addEventListener('resize', this.boundResize, {signal});
      window.addEventListener('orientationchange', this.boundOrientation, {signal});
      this.buildThumbs(); this.show(this.index, !fromHash);
      requestAnimationFrame(() => { if (this.root && !this.closing) this.root.classList.add('is-open'); });
      // Focus the dialog itself so arrow-key paging does not light up a button.
      this.root.focus({preventScroll:true});
    }
    buildThumbs() {
      const multi = this.items.length > 1;
      this.prev.hidden = this.next.hidden = !multi;
      this.root.querySelector('.lythumb-count').hidden = !multi;
      this.root.querySelector('[data-action=thumbs]').hidden = !multi;
      this.items.forEach((a, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'lythumb-thumb'; b.dataset.index = i;
        b.setAttribute('aria-label', `${i+1}枚目を表示`);
        const original = a.querySelector('img');
        if (original) { const img = document.createElement('img'); img.src = original.currentSrc || original.src; img.alt = ''; img.loading = 'lazy'; b.append(img); }
        else b.textContent = String(i+1);
        this.thumbs.append(b);
      });
    }
    show(index, historyUpdate = true, slide = null) {
      if (!this.root || this.closing || index < 0 || index >= this.items.length) return;
      if (this.current && this.index === index) return;
      if (!slide) { this.finishSlide(); this.setTrack(0); this.clearPeers(); }
      const firstImage = !this.current, incoming = slide && this.peers.get(slide.dir);
      this.index = index; this.current = this.items[index]; const token = ++this.serial;
      this.points.clear(); this.gesture = null; this.root.classList.remove('is-dragging');
      clearTimeout(this.loadingTimer); if (slide) this.carry(slide); else this.retire(); this.ready = false; this.image = null;
      this.zoomButton.disabled = true; this.setStatus('');
      this.caption.textContent = this.current.dataset.caption ?? this.current.querySelector('img')?.getAttribute('alt') ?? ''; this.caption.hidden = !this.caption.textContent;
      this.root.querySelector('.lythumb-count').textContent = `${index+1} / ${this.items.length}`;
      this.prev.disabled = index === 0; this.next.disabled = index === this.items.length-1;
      [...this.thumbs.children].forEach((b,i) => b.setAttribute('aria-current', String(i===index)));
      if (this.thumbsOpen) this.thumbs.children[index].scrollIntoView({block:'nearest'});
      if (this.root.contains(document.activeElement) && document.activeElement.disabled) this.root.focus({preventScroll:true});
      this.layout();
      const alt = this.current.querySelector('img')?.getAttribute('alt') || this.caption.textContent;
      const reveal = (img, animate) => {
        clearTimeout(this.loadingTimer); this.ready = true; this.setStatus('');
        img.onload = img.onerror = null; img.className = 'lythumb-image'; img.alt = alt; img.style.pointerEvents = '';
        this.image = img; this.width = img.naturalWidth; this.height = img.naturalHeight;
        if (!img.isConnected) this.track.prepend(img);
        this.layout(); this.fitImage(); if (animate) this.animateImage(firstImage);
        this.root.querySelector('[aria-live]').textContent = `${index+1} / ${this.items.length} ${alt}`;
        this.preload();
      };
      // A swiped-in neighbour that has already loaded becomes the current image without a fade.
      if (incoming?.isConnected && incoming.naturalWidth) { reveal(incoming, false); if (historyUpdate) this.scheduleHistory(); return; }
      incoming?.remove();
      const img = new Image(); img.className = 'lythumb-image'; img.alt = alt; img.draggable = false;
      this.image = img;
      this.loadingTimer = setTimeout(() => { if (token === this.serial && !this.ready && this.root) this.setStatus('読み込み中…', 'is-loading'); },50);
      img.onload = () => { if (token === this.serial && !this.closing && this.root) reveal(img, true); };
      img.onerror = () => {
        if (token !== this.serial || this.closing || !this.root) return;
        clearTimeout(this.loadingTimer); this.setStatus('画像を読み込めませんでした。', 'is-error');
        this.root.querySelector('[aria-live]').textContent = `${index+1}枚目の画像を読み込めませんでした。`;
      };
      img.src = this.current.href;
      if (historyUpdate) this.scheduleHistory();
    }
    setStatus(text, state) { this.status.textContent = text; this.status.className = `lythumb-status${state ? ' '+state : ''}`; }
    retire() {
      const old = this.image; if (!old) return;
      if (!this.ready || reduced() || !old.animate) { old.remove(); return; }
      old.style.pointerEvents = 'none';
      old.animate([{opacity:1},{opacity:0}],{duration:DURATION,easing:'cubic-bezier(.19,1,.22,1)',fill:'forwards'}).onfinish = () => old.remove();
    }
    // Swipes move a track holding the current image and its neighbours, spaced GUTTER px apart.
    setTrack(offset, duration=0) {
      this.trackOffset = offset;
      this.track.style.transition = duration && !reduced() ? `transform ${duration}ms ease` : 'none';
      this.track.style.transform = offset ? `translateX(${offset}px)` : '';
    }
    slideTrack(offset, duration, done) {
      clearTimeout(this.trackTimer); this.trackDone = done;
      void this.track.offsetWidth; this.setTrack(offset, duration);
      this.trackTimer = setTimeout(() => this.finishSlide(), reduced() ? 0 : duration);
    }
    finishSlide() {
      if (!this.trackTimer) return;
      clearTimeout(this.trackTimer); this.trackTimer = null;
      const done = this.trackDone; this.trackDone = null; this.setTrack(0); done?.();
    }
    makePeers() {
      this.clearPeers();
      [-1, 1].forEach(slot => {
        const item = this.items[this.index+slot]; if (!item) return;
        const img = new Image(); img.className = 'lythumb-image lythumb-peer'; img.alt = ''; img.draggable = false; img.style.visibility = 'hidden';
        img.onload = () => { if (this.peers.get(slot) === img) this.placePeer(img, slot); };
        this.peers.set(slot, img); this.track.append(img); img.src = item.href;
        if (img.complete && img.naturalWidth) this.placePeer(img, slot);
      });
    }
    placePeer(img, slot) {
      const w = img.naturalWidth, h = img.naturalHeight, fit = Math.min(1, this.area.w/w, this.area.h/h);
      img.style.width = `${w*fit}px`; img.style.height = `${h*fit}px`; img.style.transition = 'none'; img.style.visibility = '';
      img.style.transform = `translate(${snap(slot*(this.area.w+GUTTER)+(this.area.w-w*fit)/2,this.area.left)}px,${snap((this.area.h-h*fit)/2,this.area.top)}px)`;
    }
    clearPeers() { this.peers?.forEach(img => { if (img !== this.image) img.remove(); }); this.peers = new Map(); }
    carry(slide) {
      // Re-anchor the track on the incoming image so nothing jumps, then glide it home.
      const old = this.image, incoming = this.peers.get(slide.dir);
      this.peers.forEach(img => { if (img !== incoming) img.remove(); });
      this.peers = new Map(incoming ? [[slide.dir, incoming]] : []);
      if (old && this.ready) { old.classList.add('lythumb-peer'); old.style.pointerEvents = 'none'; this.placePeer(old, -slide.dir); this.peers.set(-slide.dir, old); } else old?.remove();
      this.setTrack(slide.offset + slide.dir*(this.area.w+GUTTER));
      this.slideTrack(0, SWIPE_DURATION, () => this.clearPeers());
    }
    thumbRect() {
      const t = this.current?.querySelector('img'); if (!t?.isConnected) return null;
      const r = t.getBoundingClientRect(), s = getComputedStyle(t), b = side => parseFloat(s[`border${side}Width`]) || 0;
      const box = {left:r.left+b('Left'), top:r.top+b('Top'), width:r.width-b('Left')-b('Right'), height:r.height-b('Top')-b('Bottom')};
      return box.width > 0 && box.height > 0 && r.bottom > 0 && r.top < innerHeight ? box : null;
    }
    thumbTransform(r) { return `translate(${r.left-this.area.left}px,${r.top-this.area.top}px) scale(${r.width/(this.width*this.box)},${r.height/(this.height*this.box)})`; }
    ratioDiffers(r) { return Math.abs(this.width/this.height - r.width/r.height) > .1; }
    animateImage(first) {
      if (reduced() || !this.image.animate) return;
      const r = first && this.thumbRect();
      if (r) {
        const fade = this.ratioDiffers(r);
        this.image.animate([{transform:this.thumbTransform(r),opacity:fade?.1:1},{transform:this.image.style.transform,opacity:1}],{duration:DURATION,easing:'ease'});
      } else this.image.animate([{opacity:0},{opacity:1}],{duration:DURATION,easing:'cubic-bezier(0,0,.25,1)'});
    }
    refit() { if (this.root && !this.closing) { this.finishSlide(); this.setTrack(0); this.clearPeers(); this.points.clear(); this.gesture = null; this.layout(); this.fitImage(); } }
    layout() {
      if (!this.root) return;
      const sidebarWidth = this.thumbsOpen ? this.thumbs.offsetWidth : 0;
      this.stage.style.right = `${sidebarWidth}px`;
      this.next.style.right = `${sidebarWidth}px`;
      this.caption.style.right = `${sidebarWidth}px`;
      this.root.querySelector('.lythumb-toolbar').style.right = `${sidebarWidth}px`;
      // Desktop keeps the image clear of the caption; touch layouts let the caption overlap.
      this.stage.style.bottom = !touchUI() && !this.caption.hidden ? `${this.caption.offsetHeight - 50}px` : '';
      const r = this.stage.getBoundingClientRect(); this.area = {w:r.width,h:r.height,left:r.left,top:r.top};
      if (this.ready) this.fit = Math.min(1,this.area.w/this.width,this.area.h/this.height);
    }
    fitImage() { if (!this.ready) return; this.scale = this.fit; this.x = (this.area.w-this.width*this.scale)/2; this.y = (this.area.h-this.height*this.scale)/2; this.render(0); }
    position(x,y,scale) {
      const w = this.width*scale, h = this.height*scale;
      return {x:w<=this.area.w?(this.area.w-w)/2:clamp(x,this.area.w-w,0), y:h<=this.area.h?(this.area.h-h)/2:clamp(y,this.area.h-h,0)};
    }
    // resting image is laid out at its displayed size; scale() only bridges animations and pinches.
    transformAt(x,y,scale) { const s = scale/this.box; return `translate(${snap(x,this.area.left)}px,${snap(y,this.area.top)}px)${s === 1 ? '' : ` scale(${s})`}`; }
    commit() {
      clearTimeout(this.renderTimer); if (!this.ready || !this.image) return;
      this.box = this.scale; this.image.style.width = `${this.width*this.box}px`; this.image.style.height = `${this.height*this.box}px`;
      this.image.style.transition = 'none'; this.image.style.transform = this.transformAt(this.x,this.y,this.scale);
    }
    render(duration=0, live=false) {
      if (!this.ready || !this.image) return;
      if (duration && !reduced()) {
        clearTimeout(this.renderTimer);
        this.image.style.transition = `transform ${duration}ms ease`; this.image.style.transform = this.transformAt(this.x,this.y,this.scale);
        this.renderTimer = setTimeout(() => this.commit(), duration);
      } else if (live) { clearTimeout(this.renderTimer); this.image.style.transition = 'none'; this.image.style.transform = this.transformAt(this.x,this.y,this.scale); }
      else this.commit();
      const zoomed = this.scale > this.fit + .0001;
      this.root.classList.toggle('is-zoomed',zoomed); this.zoomButton.disabled = this.fit >= 1;
      this.zoomButton.querySelector('.lythumb-zoom-in').hidden = zoomed;
      this.zoomButton.querySelector('.lythumb-zoom-out').hidden = !zoomed;
      this.zoomButton.setAttribute('aria-label',zoomed?'画面内に収める':'原寸表示へ切り替え');
      this.zoomButton.title = this.zoomButton.getAttribute('aria-label');
    }
    zoom(cx=this.area?.w/2,cy=this.area?.h/2) {
      if (!this.ready || this.fit >= 1) return;
      const target = this.scale > this.fit+.0001 ? this.fit : 1, ratio = target/this.scale;
      const p = this.position(cx-(cx-this.x)*ratio,cy-(cy-this.y)*ratio,target);
      this.scale=target; this.x=p.x; this.y=p.y; this.render(DURATION);
    }
    hideControls(all=false) {
      this.controlsHidden = true; this.root.classList.add('is-controls-hidden');
      if (all || touchUI()) this.root.classList.add('is-caption-hidden');
    }
    showControls() { this.controlsHidden = false; this.idleCount = 0; this.root.classList.remove('is-controls-hidden','is-caption-hidden'); }
    toggleControls() { if (this.controlsHidden) this.showControls(); else this.hideControls(); }
    toggleThumbs() {
      if (this.items.length<2) return;
      this.thumbsOpen = !this.thumbsOpen; this.thumbs.hidden = !this.thumbsOpen;
      this.root.querySelector('[data-action=thumbs]').setAttribute('aria-expanded',String(this.thumbsOpen));
      if (!this.thumbsOpen && this.thumbs.contains(document.activeElement)) this.root.querySelector('[data-action=thumbs]').focus();
      this.layout(); this.fitImage();
      if (this.thumbsOpen) this.thumbs.children[this.index].scrollIntoView({block:'nearest'});
    }
    click(e) {
      if (this.closing || performance.now() < (this.suppressUntil || 0)) return;
      const b=e.target.closest('button');
      if (b && this.root.contains(b)) {
        const action=b.dataset.action;
        if(action==='close') this.close(); else if(action==='prev') this.show(this.index-1); else if(action==='next') this.show(this.index+1);
        else if(action==='zoom') this.zoom(); else if(action==='thumbs') this.toggleThumbs(); else if(b.dataset.index!==undefined) this.show(Number(b.dataset.index));
      } else { const kind=this.kind(e.target), r=this.stage.getBoundingClientRect(); if(kind) this.tap(kind,e.clientX-r.left,e.clientY-r.top); }
    }
    kind(target) { return target===this.image?'content':target===this.stage||target===this.track?'slide':target===this.root||target===this.bg?'outside':null; }
    tap(kind,x,y) {
      // Touch layouts wait for a possible second tap, as single and double taps do different things there.
      const touch=touchUI(), single=kind==='content'?(touch?'toggle':'zoom'):'close', double=touch&&kind!=='outside'?'zoom':null;
      const run=action=>{ if(action==='close') this.close(); else if(action==='toggle') this.toggleControls(); else if(action==='zoom') this.zoom(x,y); };
      if(this.tapTimer) { clearTimeout(this.tapTimer); this.tapTimer=null; if(Math.abs(x-this.tapX)<=50&&Math.abs(y-this.tapY)<=50) run(double); return; }
      this.tapX=x; this.tapY=y;
      if(double) this.tapTimer=setTimeout(()=>{ this.tapTimer=null; if(this.root&&!this.closing) run(single); },TAP_DELAY);
      else run(single);
    }
    down(e) {
      if (this.closing || !this.stage.contains(e.target) || e.button!==0 || e.target===this.status) return;
      e.preventDefault(); if (this.trackTimer) return;
      if (this.trackOffset) { this.setTrack(0); this.clearPeers(); } this.root.focus({preventScroll:true}); this.tapTarget=e.target; this.root.setPointerCapture(e.pointerId); this.points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      this.beginGesture();
    }
    beginGesture() {
      const pts=[...this.points.values()]; if (!pts.length) { this.gesture=null; return; }
      const mode=pts.length>1?(this.ready?'pinch':null):this.ready&&this.scale>this.fit+.0001?'pan':'swipe';
      this.gesture={mode,real:pts[0],start:pts[0],time:performance.now(),scale:this.scale,x:this.x,y:this.y,moved:pts.length>1,axis:null,dx:0,dy:0};
      if(mode==='pinch') Object.assign(this.gesture,{mid:{x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2},distance:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)});
    }
    move(e) {
      if(!this.points.has(e.pointerId)) return;
      this.points.set(e.pointerId,{x:e.clientX,y:e.clientY}); const g=this.gesture,pts=[...this.points.values()];
      if(!g?.mode) return;
      if(g.mode==='pinch') {
        if(pts.length<2) return;
        const mid={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
        const ratio=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)/Math.max(1,g.distance);
        this.scale=Math.max(.01,g.scale*ratio);
        this.x=mid.x-this.area.left-(g.mid.x-this.area.left-g.x)*ratio;
        this.y=mid.y-this.area.top-(g.mid.y-this.area.top-g.y)*ratio;
        this.render(0,true); return;
      }
      const p=pts[0];
      if(g.mode==='pan') {
        if(!g.moved) { if(Math.hypot(p.x-g.real.x,p.y-g.real.y)<(touchUI()?10:5)) { g.start=p; return; } g.moved=true; this.root.classList.add('is-dragging'); }
        g.dx=p.x-g.start.x; g.dy=p.y-g.start.y;
        const q=this.limitMovement(g); this.x=q.x; this.y=q.y; this.render(); return;
      }
      if(!g.axis) {
        if(Math.hypot(p.x-g.start.x,p.y-g.start.y)<=10) return;
        const angle=Math.abs(Math.atan2(p.y-g.start.y,p.x-g.start.x)*180/Math.PI);
        g.axis=this.items.length<2||(angle>45&&angle<135)?'y':'x'; g.start=p; g.moved=true; this.root.classList.add('is-dragging');
        if(g.axis==='x') this.makePeers(); return;
      }
      g.dx=p.x-g.start.x; g.dy=p.y-g.start.y;
      let offset=g.dx;
      const atStart=this.items.length<2||this.index===0, atEnd=this.items.length<2||this.index===this.items.length-1;
      if(g.dx>0&&atStart) offset=Math.pow(g.dx,.8); else if(g.dx<0&&atEnd) offset=-Math.pow(-g.dx,.8);
      if(g.axis==='x') this.setTrack(offset); else if(this.ready) { this.y=g.y+g.dy; this.render(); }
    }
    limitMovement(g) {
      const W=this.area.w,H=this.area.h,w=this.width*this.scale,h=this.height*this.scale,{dx,dy}=g;
      let x=w>W?g.x+dx:g.x, y=g.y+dy;
      const hiX=Math.max(0,W/2-w/2), hiY=Math.max(0,H/2-h/2), loX=Math.min(W-w,W/2-w/2), loY=Math.min(H-h,H/2-h/2);
      if(dx>0&&x>hiX) x=hiX-1+Math.pow(-hiX+g.x+dx,.8)||0;
      if(dx<0&&x<loX) x=loX+1-Math.pow(loX-g.x-dx,.8)||0;
      if(dy>0&&y>hiY) y=hiY-1+Math.pow(-hiY+g.y+dy,.8)||0;
      if(dy<0&&y<loY) y=loY+1-Math.pow(loY-g.y-dy,.8)||0;
      return {x,y};
    }
    up(e,cancel=false) {
      if(!this.points.has(e.pointerId)) return;
      const g=this.gesture;
      this.points.delete(e.pointerId); if(this.root?.hasPointerCapture(e.pointerId)) this.root.releasePointerCapture(e.pointerId);
      this.suppressUntil=performance.now()+400;
      this.root?.classList.remove('is-dragging');
      // Lifting any finger ends the gesture; remaining fingers stay inert until a new touch starts.
      this.gesture=this.points.size?{mode:null}:null;
      if(!g?.mode) return;
      if(cancel) { if(g.axis==='x') this.snapBack(); else this.settle(150); return; }
      const dMs=Math.max(1,performance.now()-g.time);
      if(!g.moved) { if(dMs<500) { const kind=this.kind(this.tapTarget); if(kind) this.tap(kind,e.clientX-this.area.left,e.clientY-this.area.top); } return; }
      if(g.mode==='pinch') { this.endPinch(g); return; }
      const vx=g.dx/dMs*.5, vy=g.dy/dMs*.5;
      if(g.mode==='pan') { if(dMs<=350) { this.x+=500*vx; this.y+=500*vy; } this.settle(DURATION); }
      else if(g.axis==='y'&&Math.abs(g.dy)>50) this.swipeClose(vy);
      else if(g.axis==='x'&&this.items.length>1&&(dMs>130&&Math.abs(g.dx)>10||Math.abs(g.dx)>50)) {
        const dir=g.dx<0?1:-1, next=this.index+dir; if(next>=0&&next<this.items.length) this.show(next,true,{dir,offset:this.trackOffset}); else this.snapBack();
      } else if(g.axis==='x') this.snapBack();
      else this.settle(200);
    }
    snapBack() { this.slideTrack(0,200,()=>this.clearPeers()); }
    endPinch(g) {
      if(!this.ready) return;
      const w=this.width*this.scale,h=this.height*this.scale;
      if(w<this.area.w&&h<this.area.h) this.scale=this.fit;
      else if(this.scale>1) { const cx=g.mid.x-this.area.left,cy=g.mid.y-this.area.top,ratio=1/this.scale; this.x=cx-(cx-this.x)*ratio; this.y=cy-(cy-this.y)*ratio; this.scale=1; }
      const p=this.position(this.x,this.y,this.scale); this.x=p.x; this.y=p.y; this.render(150);
    }
    swipeClose(vy) {
      if(this.ready&&this.image.animate&&!reduced()) this.image.animate([{transform:this.image.style.transform,opacity:1},{transform:this.transformAt(this.x,this.y+150*vy,this.scale),opacity:0}],{duration:200,easing:'ease',fill:'forwards'});
      this.close(true,false,true);
    }
    settle(duration) { if(!this.ready)return;this.scale=clamp(this.scale,this.fit,1);const p=this.position(this.x,this.y,this.scale);this.x=p.x;this.y=p.y;this.render(duration); }
    keydown(e) {
      if(!this.root||this.closing)return;
      if(e.key==='Tab') {
        const f=[...this.root.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(x=>x.getClientRects().length&&getComputedStyle(x).visibility!=='hidden');
        const i=f.indexOf(document.activeElement); if(!f.length){e.preventDefault();this.root.focus();}
        else if(e.shiftKey&&(i<=0)){e.preventDefault();f.at(-1).focus();}else if(!e.shiftKey&&(i===f.length-1||i<0)){e.preventDefault();f[0].focus();}return;
      }
      if(e.ctrlKey||e.altKey||e.shiftKey||e.metaKey||e.isComposing||e.target.closest('input,textarea,select,video,audio,[contenteditable]:not([contenteditable=false])'))return;
      const key=e.key.toLowerCase();
      if(['escape','backspace'].includes(key)){e.preventDefault();this.close();}
      else if(['arrowleft','arrowup','arrowright','arrowdown'].includes(key)){e.preventDefault();if(!this.points.size)this.show(this.index+(['arrowleft','arrowup'].includes(key)?-1:1));}
      else if(key==='g'){e.preventDefault();this.toggleThumbs();}
      else if(key==='f'){e.preventDefault();this.fullscreen();}
    }
    async fullscreen() {
      try {if(document.fullscreenElement===this.root)await document.exitFullscreen();else if(this.root.requestFullscreen)await this.root.requestFullscreen();}catch{/* Unsupported or denied: keep viewer usable. */}
    }
    preload() {this.preloaded=[this.index-1,this.index+1].filter(i=>i>=0&&i<this.items.length).map(i=>{const img=new Image();img.src=this.items[i].href;return img;});}
    hash() { return '#'+encodeURIComponent(this.key)+(this.items.length>1?'-'+(this.index+1):''); }
    scheduleHistory() {
      clearTimeout(this.historyTimer); if(!this.key)return;
      this.historyTimer=setTimeout(()=>{
        if(!this.root||this.closing)return;
        const url=location.pathname+location.search+this.hash();this.handledURL=null;
        if(this.createdHistory || this.directHash)history.replaceState(history.state,'',url);
        else {history.pushState(history.state,'',url);this.createdHistory=true;}
      },300);
    }
    close(updateHistory=true, immediate=false, swiped=false) {
      if(!this.root||this.closing)return;
      this.closing=true;++this.serial;clearTimeout(this.historyTimer);clearTimeout(this.renderTimer);clearTimeout(this.loadingTimer);clearTimeout(this.tapTimer);clearTimeout(this.resizeTimer);clearInterval(this.idleTimer);cancelAnimationFrame(this.resizeFrame);
      this.abort.abort();this.points.clear();
      if(document.fullscreenElement===this.root)document.exitFullscreen?.().catch(()=>{});
      this.finishSlide();
      const root=this.root,duration=swiped?250:DURATION;
      this.hideControls(true);this.bg.style.transitionDuration=`${duration}ms`;root.classList.remove('is-open');
      const thumb=this.thumbRect();
      if(!immediate && !swiped && this.ready && this.image.animate && !reduced()) {
        if(thumb) this.image.animate([{transform:this.image.style.transform,opacity:1},{transform:this.thumbTransform(thumb),opacity:this.ratioDiffers(thumb)?0:1}],{duration,easing:'ease',fill:'forwards'});
        else this.image.animate([{opacity:1},{opacity:0}],{duration,easing:'cubic-bezier(.19,1,.22,1)',fill:'forwards'});
      }
      // Return focus to the link of the image shown last, falling back to the opener.
      const back=this.current?.isConnected&&this.current.getClientRects().length?this.current:this.trigger;
      const finish=()=>{
        if(this.root!==root)return; clearTimeout(this.closeTimer);
        root.remove();this.root=null;this.current=null;this.image=null;this.ready=false;this.preloaded=[];
        this.background.forEach(x=>{x.el.inert=x.inert;});
        document.body.style.overflow=this.bodyStyle.overflow;document.body.style.marginRight=this.bodyStyle.marginRight;
        window.scrollTo(...this.scroll);
        if(back?.isConnected)back.focus({preventScroll:true});else document.body.focus({preventScroll:true});
        this.closing=false;
        if(updateHistory&&this.createdHistory)this.back(this.scroll);
        else if(updateHistory&&location.href!==this.originalURL)history.replaceState(history.state,'',this.originalURL);
      };
      this.finishClose=finish;
      if(immediate||reduced())finish();else this.closeTimer=setTimeout(finish,duration);
    }
    back(scroll) {
      // Going back to an entry with an in-page anchor can jump to that anchor, so restore the reader's position afterwards too.
      const restore=()=>{window.scrollTo(...scroll);requestAnimationFrame(()=>window.scrollTo(...scroll));};
      const stop=()=>{window.removeEventListener('popstate',restore);window.removeEventListener('hashchange',restore);};
      window.addEventListener('popstate',restore);window.addEventListener('hashchange',restore);
      setTimeout(stop,1000);history.back();
    }
    destroy() {
      if(this.closing)this.finishClose?.();else this.close(false,true);document.removeEventListener('click',this.boundClick);window.removeEventListener('popstate',this.boundHash);window.removeEventListener('hashchange',this.boundHash);this.initialized=false;
    }
  }
  const viewer=new Viewer();
  global.Lythumb={init:()=>viewer.init(),open:a=>{viewer.init();viewer.open(a);},close:()=>viewer.close(),destroy:()=>viewer.destroy()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>viewer.init(),{once:true});else viewer.init();
})(window);

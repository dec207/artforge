/* artforge 에셋 스토어 — 렌더러
 *
 * index.json 하나만 읽는다. 필터 축은 사람이 붙인 태그가 아니라
 * PNG 메타데이터에서 기계가 뽑은 패싯이다 — 모델·LoRA·크기·생성일·상태.
 *
 * 같은 파일이 로컬과 공개본 양쪽을 그린다. 공개본 인덱스는 `public: true` 를
 * 달고 오고, 그 경우 플래그 토글과 경로 복사가 사라진다(로컬 절대경로는
 * 애초에 실려 오지도 않는다).
 */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const short = (s) => (s || '').replace(/\.safetensors$/, '');
  const DAY = 86400000;

  const state = {
    assets: [], pub: false, q: '', sort: 'new',
    facet: null,     // { key, value }
  };

  const SORTS = [
    ['new', '최신순', (a, b) => (b.created_at || '').localeCompare(a.created_at || '')],
    ['old', '오래된순', (a, b) => (a.created_at || '').localeCompare(b.created_at || '')],
    ['big', '큰 것부터', (a, b) => b.width * b.height - a.width * a.height],
  ];

  // ── 패싯 ───────────────────────────────────────────────
  // 각 축은 자산 하나가 그 값을 갖는지 판정하는 함수다. 태깅이 필요 없다.
  const AXES = [
    { key: 'model', label: '모델', of: (a) => [short(a.recipe?.checkpoint) || '기록 없음'] },
    { key: 'lora', label: 'LORA', of: (a) => [short(a.recipe?.lora) || '없음'] },
    { key: 'size', label: '크기', of: (a) => [`${a.width}×${a.height}`] },
    {
      key: 'when', label: '생성일', of: (a) => {
        const age = Date.now() - Date.parse(a.created_at || 0);
        const out = [];
        if (age < DAY) out.push('오늘');
        if (age < 7 * DAY) out.push('최근 7일');
        if (age < 30 * DAY) out.push('최근 30일');
        return out;
      },
    },
    {
      key: 'status', label: '상태', of: (a) => {
        const out = [];
        if (a.flagged) out.push('공개 플래그');
        if (a.expires_at && Date.parse(a.expires_at) - Date.now() < 7 * DAY) out.push('만료 임박');
        if (a.original === null) out.push('원본 만료됨');
        if (a.recipe?.post?.length) out.push('후처리 있음');
        out.push(a.recipe?.controlnet ? '포즈 고정(ControlNet)' : '프롬프트만');
        return out;
      },
    },
  ];

  const matchesFacet = (a) => {
    if (!state.facet) return true;
    const axis = AXES.find((x) => x.key === state.facet.key);
    return axis ? axis.of(a).includes(state.facet.value) : true;
  };

  const matchesQuery = (a) => {
    if (!state.q) return true;
    const r = a.recipe || {};
    const hay = [a.id, r.prompt, r.negative, r.checkpoint, r.lora, r.sampler,
      `${a.width}×${a.height}`, (r.post || []).join(' ')].join(' ').toLowerCase();
    return state.q.toLowerCase().split(/\s+/).every((t) => hay.includes(t));
  };

  const visible = () => {
    const cmp = SORTS.find((s) => s[0] === state.sort)[2];
    return state.assets.filter((a) => matchesQuery(a) && matchesFacet(a)).sort(cmp);
  };

  // ── 렌더 ───────────────────────────────────────────────
  function renderSorts() {
    const nav = $('sorts');
    nav.replaceChildren(...SORTS.map(([key, label]) => {
      const b = el('button', null, label);
      b.setAttribute('aria-pressed', String(state.sort === key));
      b.onclick = () => { state.sort = key; render(); };
      return b;
    }));
  }

  function renderFacets() {
    // 개수는 "검색어는 적용하되 이 축은 빼고" 센다. itch 와 같은 셈법이다.
    const box = $('facets');
    box.replaceChildren(...AXES.map((axis) => {
      const pool = state.assets.filter((a) => matchesQuery(a)
        && (state.facet?.key === axis.key || matchesFacet(a)));
      const counts = new Map();
      for (const a of pool) for (const v of axis.of(a)) counts.set(v, (counts.get(v) || 0) + 1);
      if (!counts.size) return document.createComment(axis.key);

      const sec = el('section', 'facet');
      sec.append(el('h2', null, axis.label));
      for (const [value, n] of [...counts].sort((x, y) => y[1] - x[1])) {
        const on = state.facet?.key === axis.key && state.facet.value === value;
        const b = el('button');
        b.setAttribute('aria-pressed', String(on));
        b.append(el('span', null, value), el('span', 'n', String(n)));
        b.onclick = () => { state.facet = on ? null : { key: axis.key, value }; render(); };
        sec.append(b);
      }
      return sec;
    }));
  }

  function card(a) {
    const b = el('button', 'card');
    b.type = 'button';
    const shot = el('span', 'shot');
    const img = el('img');
    img.src = a.thumb;
    img.alt = '';
    img.loading = 'lazy';
    shot.append(img);
    if (a.flagged) shot.append(el('i', 'flag'));
    if (a.original === null) shot.append(el('i', 'dead'));
    else if (a.expires_at && Date.parse(a.expires_at) - Date.now() < 7 * DAY) shot.append(el('i', 'soon'));

    const tags = el('span', 'tags');
    const r = a.recipe || {};
    const list = [`${a.width}×${a.height}`, short(r.checkpoint) || '기록 없음'];
    if (r.lora) list.push('+ ' + short(r.lora));
    for (const t of list) tags.append(el('i', 'tag', t));

    b.append(shot, el('span', 'name', a.id),
      el('span', 'desc', r.prompt || '생성 기록이 없다'), tags);
    b.onclick = () => openPanel(a);
    return b;
  }

  function render() {
    renderSorts();
    renderFacets();
    const rows = visible();
    $('count').textContent = `${rows.length}개`;
    $('grid').replaceChildren(...rows.map(card));

    const nothing = rows.length === 0;
    $('empty').hidden = !nothing;
    $('grid').hidden = nothing;
    if (nothing) {
      const filtered = state.q || state.facet;
      $('empty-h').textContent = filtered ? '조건에 맞는 것이 없다' : '아직 아무것도 없다';
      $('empty-b').textContent = filtered
        ? '검색어나 필터를 지우면 전체가 다시 보인다.'
        : state.pub
          ? '공개된 에셋이 아직 없다. 스토어에서 플래그를 켠 것만 여기 올라온다.'
          : 'ComfyUI로 이미지를 만들면 스토어를 열 때 자동으로 들어온다. 따로 옮기지 않아도 된다.';
      $('empty-c').hidden = filtered || state.pub;
    }
  }

  // ── 상세 패널 ──────────────────────────────────────────
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 1800);
  }

  const copy = (text, msg) => navigator.clipboard.writeText(text)
    .then(() => toast(msg)).catch(() => toast('복사하지 못했다'));

  function openPanel(a) {
    const dlg = $('panel');
    const r = a.recipe || {};
    const dead = a.original === null;

    const head = el('div', 'panel-h');
    head.append(el('span', 'name', a.id));
    const right = el('span', 'right');
    if (a.flagged) right.append(el('i', 'flag', ''));
    const x = el('button', 'panel-x', '닫기');
    x.onclick = () => dlg.close();
    right.append(x);
    head.append(right);

    const shot = el('div', 'panel-shot');
    const img = el('img');
    img.src = (!dead && (a.asset || a.original)) || a.thumb;
    img.alt = a.id;
    shot.append(img);

    const rows = [
      ['PROMPT', r.prompt], ['NEGATIVE', r.negative],
      ['MODEL', r.checkpoint], ['LORA', r.lora],
      ['SEED', r.seed], ['SAMPLER', [r.sampler, r.scheduler].filter(Boolean).join(' · ')],
      ['STEPS', [r.steps && r.steps + ' steps', r.cfg != null && 'cfg ' + r.cfg].filter(Boolean).join(' · ')],
      ['LATENT', r.latent], ['CONTROLNET', short(r.controlnet)],
      ['POST', (r.post || []).join(' → ')],
      ['만료', dead ? '만료됨' : (a.expires_at ? a.expires_at.slice(0, 10) : '면제 (플래그)')],
    ].filter(([, v]) => v !== undefined && v !== null && v !== '');

    const spec = el('dl', 'spec');
    for (const [k, v] of rows) { spec.append(el('dt', null, k), el('dd', null, String(v))); }

    const acts = el('div', 'acts');
    const add = (label, fn, cls) => { const b = el('button', cls, label); b.onclick = fn; acts.append(b); };

    if (r.prompt) add('프롬프트 복사', () => copy(r.prompt, '프롬프트 복사됨'));
    add('레시피 복사', () => copy(JSON.stringify(r, null, 1), '레시피 복사됨'));

    if (!state.pub) {
      if (a.source) add('경로 복사', () => copy(a.source, '경로 복사됨'));
      add('replay 명령', () => copy(`./forge replay ${a.id}`, 'replay 명령 복사됨'));
      add(a.flagged ? '플래그 해제' : '공개 플래그', async () => {
        try {
          const res = await fetch('/api/flag', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: a.id, flagged: !a.flagged }),
          });
          if (!res.ok) throw new Error(res.status);
          a.flagged = !a.flagged;
          a.expires_at = a.flagged ? null : a.expires_at;
          toast(a.flagged ? '플래그 켬 — 만료 면제' : '플래그 끔');
          dlg.close(); render();
        } catch (e) { toast('플래그를 바꾸지 못했다'); }
      }, a.flagged ? 'on' : null);
    }

    dlg.replaceChildren(head, shot);
    if (dead) dlg.append(el('p', 'panel-note', '원본은 만료됐다. 레시피가 남아 있어 replay 로 다시 만들 수 있다.'));
    dlg.append(spec, acts);
    dlg.showModal();
  }

  // ── 시작 ───────────────────────────────────────────────
  fetch('index.json', { cache: 'no-store' })
    .then((r) => r.json())
    .then((data) => {
      state.assets = data.assets || [];
      state.pub = data.public === true;
      if (state.pub) document.title = 'artforge — studio_d 에셋';
      $('q').addEventListener('input', (e) => { state.q = e.target.value.trim(); render(); });
      render();
    })
    .catch(() => {
      $('count').textContent = '';
      $('grid').hidden = true;
      $('empty').hidden = false;
      $('empty-h').textContent = '목록을 읽지 못했다';
      $('empty-b').textContent = 'index.json 이 없다. ./forge ingest 를 먼저 돌린다.';
    });
})();

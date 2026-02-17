(() => {
  "use strict";

  const APP_VERSION = "3.0.0";
  const STORAGE_KEY = "codex_v3_data";

  /** =========================
   *  Utilitários
   *  ========================= */
  const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
  const nowISO = () => new Date().toISOString();

  const escapeHtml = (str="") =>
    String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
               .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const parseTags = (s="") => {
    // aceita "tag1, tag2  tag3" e limpa
    return s.split(/[,]+|\s{2,}/g).map(t => t.trim()).filter(Boolean)
      .map(t => t.replace(/^#/, ""));
  };

  const downloadText = (filename, text) => {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /** =========================
   *  Dados
   *  ========================= */
  function defaultData() {
    return {
      meta: { version: APP_VERSION, createdAt: nowISO(), updatedAt: nowISO() },
      // catálogos opcionais (tu pode usar ou ignorar)
      continents: [
        "Varyon","Brelgorn","Kaelyra","Zathari","Solvarya","Sythra","Noctharra"
      ],
      clans: ["Arcanyth","Alfanor","Quinq"],
      characters: [],
      relations: [] // { id, fromId, toId, type, note, createdAt }
    };
  }

  function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    try {
      const data = JSON.parse(raw);
      // migração simples: garante campos
      if (!data.meta) data.meta = { version: APP_VERSION, createdAt: nowISO(), updatedAt: nowISO() };
      if (!Array.isArray(data.characters)) data.characters = [];
      if (!Array.isArray(data.relations)) data.relations = [];
      if (!Array.isArray(data.continents)) data.continents = defaultData().continents;
      if (!Array.isArray(data.clans)) data.clans = defaultData().clans;
      return data;
    } catch {
      return defaultData();
    }
  }

  function saveData() {
    state.data.meta.updatedAt = nowISO();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  /** =========================
   *  Estado
   *  ========================= */
  const state = {
    data: loadData(),
    selectedId: null,
    q: "",
    tagFilter: "",
    view: "characters" // "characters" | "world" | "backup"
  };

  /** =========================
   *  CRUD Personagem
   *  ========================= */
  function createCharacter() {
    const id = uid();
    const c = {
      id,
      name: "Novo personagem",
      alias: "",
      race: "",
      age: "",
      status: "vivo",
      continent: "",
      clan: "",
      tags: [],
      appearance: "",
      personality: "",
      lore: "",
      powers: "",
      weaknesses: "",
      notes: "",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      favorite: false
    };
    state.data.characters.unshift(c);
    state.selectedId = id;
    saveData();
    render();
  }

  function updateCharacter(id, patch) {
    const c = state.data.characters.find(x => x.id === id);
    if (!c) return;
    Object.assign(c, patch);
    c.updatedAt = nowISO();
    saveData();
    render();
  }

  function deleteCharacter(id) {
    // remove relações associadas também
    state.data.relations = state.data.relations.filter(r => r.fromId !== id && r.toId !== id);
    state.data.characters = state.data.characters.filter(x => x.id !== id);
    if (state.selectedId === id) state.selectedId = null;
    saveData();
    render();
  }

  function getSelected() {
    return state.data.characters.find(x => x.id === state.selectedId) || null;
  }

  /** =========================
   *  Relações
   *  ========================= */
  function addRelation(fromId, toId, type, note="") {
    if (!fromId || !toId || fromId === toId) return;
    const exists = state.data.relations.some(r => r.fromId === fromId && r.toId === toId && r.type === type);
    if (exists) return;
    state.data.relations.unshift({
      id: uid(),
      fromId, toId,
      type: type || "aliado",
      note,
      createdAt: nowISO()
    });
    saveData();
    render();
  }

  function removeRelation(relId) {
    state.data.relations = state.data.relations.filter(r => r.id !== relId);
    saveData();
    render();
  }

  function relationsFor(id) {
    const rels = state.data.relations.filter(r => r.fromId === id);
    const byId = new Map(state.data.characters.map(c => [c.id, c]));
    return rels.map(r => ({
      ...r,
      to: byId.get(r.toId) || { name: "Desconhecido (apagado)" }
    }));
  }

  /** =========================
   *  Filtros e busca
   *  ========================= */
  function filteredCharacters() {
    const q = state.q.trim().toLowerCase();
    const tag = state.tagFilter.trim().toLowerCase();

    let list = [...state.data.characters];

    // favoritos primeiro
    list.sort((a,b) => Number(b.favorite) - Number(a.favorite));

    if (tag) {
      list = list.filter(c => (c.tags || []).some(t => t.toLowerCase() === tag));
    }

    if (!q) return list;

    return list.filter(c => {
      const blob = [
        c.name, c.alias, c.race, c.age, c.status,
        c.continent, c.clan,
        (c.tags || []).join(" "),
        c.appearance, c.personality, c.lore, c.powers, c.weaknesses, c.notes
      ].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }

  function allTags() {
    const set = new Set();
    state.data.characters.forEach(c => (c.tags || []).forEach(t => set.add(t)));
    return [...set].sort((a,b) => a.localeCompare(b, "pt-BR"));
  }

  /** =========================
   *  Backup / Import
   *  ========================= */
  function exportBackup() {
    const payload = JSON.stringify(state.data, null, 2);
    const filename = `codex-backup-v3-${new Date().toISOString().slice(0,10)}.json`;
    downloadText(filename, payload);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(String(reader.result || ""));
        if (!incoming || typeof incoming !== "object") throw new Error("Arquivo inválido");
        // valida o mínimo
        if (!Array.isArray(incoming.characters)) throw new Error("Backup sem characters[]");
        if (!Array.isArray(incoming.relations)) incoming.relations = [];
        if (!incoming.meta) incoming.meta = { version: APP_VERSION, createdAt: nowISO(), updatedAt: nowISO() };
        state.data = incoming;
        state.selectedId = null;
        state.q = "";
        state.tagFilter = "";
        saveData();
        render();
        toast("Backup importado. Tua biblioteca tá de volta.");
      } catch (e) {
        toast("Não consegui importar. Esse JSON não parece um backup do Codex.", true);
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    state.data = defaultData();
    state.selectedId = null;
    state.q = "";
    state.tagFilter = "";
    saveData();
    render();
  }

  /** =========================
   *  UI (render)
   *  ========================= */
  const $app = document.getElementById("app");

  function toast(msg, isBad=false){
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "18px";
    el.style.transform = "translateX(-50%)";
    el.style.padding = "10px 14px";
    el.style.borderRadius = "14px";
    el.style.border = "1px solid rgba(255,255,255,.12)";
    el.style.background = isBad ? "rgba(251,113,133,.15)" : "rgba(52,211,153,.12)";
    el.style.color = "white";
    el.style.boxShadow = "0 12px 30px rgba(0,0,0,.35)";
    el.style.zIndex = "9999";
    document.body.appendChild(el);
    setTimeout(()=> el.remove(), 2200);
  }

  function renderTopbar() {
    const count = state.data.characters.length;
    return `
      <div class="topbar">
        <div class="brand">
          <div class="dot"></div>
          <div>
            <h1>Codex 3.0</h1>
            <small>personagens: ${count} • versão: ${escapeHtml(APP_VERSION)}</small>
          </div>
        </div>
        <div class="actions">
          <button class="btn" data-act="view-characters">Personagens</button>
          <button class="btn" data-act="view-world">Mundo</button>
          <button class="btn" data-act="view-backup">Backup</button>
          <button class="btn primary" data-act="new">+ Novo</button>
        </div>
      </div>
    `;
  }

  function renderLeft() {
    const tags = allTags();
    const list = filteredCharacters();

    const tagsOptions = [`<option value="">(sem filtro)</option>`]
      .concat(tags.map(t => `<option value="${escapeHtml(t)}" ${state.tagFilter===t?"selected":""}>${escapeHtml(t)}</option>`))
      .join("");

    const items = list.map(c => {
      const meta = [
        c.race ? `raça: ${escapeHtml(c.race)}` : null,
        c.continent ? `continente: ${escapeHtml(c.continent)}` : null,
        c.clan ? `clã: ${escapeHtml(c.clan)}` : null,
        c.status ? `status: ${escapeHtml(c.status)}` : null
      ].filter(Boolean).join(" • ");

      const badges = (c.tags || []).slice(0, 6).map(t => `<span class="badge">${escapeHtml(t)}</span>`).join("");
      const fav = c.favorite ? "★ " : "";

      return `
        <div class="item" data-act="select" data-id="${c.id}">
          <div class="title">${fav}${escapeHtml(c.name)}</div>
          <div class="meta">${meta || `<span class="hint">sem meta ainda</span>`}</div>
          ${badges ? `<div class="badges">${badges}</div>` : ""}
        </div>
      `;
    }).join("");

    return `
      <div class="card">
        <div class="head">
          <h2>Biblioteca</h2>
          <div class="hint">dica: <span class="kbd">Ctrl</span> + <span class="kbd">K</span> foca na busca</div>
        </div>
        <div class="body">
          <div class="row">
            <div>
              <div class="label">Buscar</div>
              <input class="input" id="q" placeholder="nome, tags, clã, lore…"
                value="${escapeHtml(state.q)}" />
            </div>
            <div style="max-width:240px">
              <div class="label">Filtrar por tag</div>
              <select class="select" id="tagFilter">${tagsOptions}</select>
            </div>
          </div>

          <div class="hr"></div>

          <div class="list">
            ${items || `<div class="empty">Nenhum personagem encontrado.</div>`}
          </div>

          <div class="footerNote">
            Tudo é salvo localmente no teu aparelho. Exporta backup pra dormir tranquilo.
          </div>
        </div>
      </div>
    `;
  }

  function renderEditor(c) {
    if (!c) {
      return `
        <div class="card">
          <div class="head">
            <h2>Ficha</h2>
            <div class="hint">seleciona alguém na lista</div>
          </div>
          <div class="body">
            <div class="empty">Sem personagem selecionado.</div>
          </div>
        </div>
      `;
    }

    const continentOptions = [`<option value="">(vazio)</option>`]
      .concat(state.data.continents.map(x => `<option value="${escapeHtml(x)}" ${c.continent===x?"selected":""}>${escapeHtml(x)}</option>`))
      .join("");

    const clanOptions = [`<option value="">(vazio)</option>`]
      .concat(state.data.clans.map(x => `<option value="${escapeHtml(x)}" ${c.clan===x?"selected":""}>${escapeHtml(x)}</option>`))
      .join("");

    const rels = relationsFor(c.id);
    const relItems = rels.map(r => `
      <div class="item" style="cursor:default">
        <div class="title">${escapeHtml(r.type)} → ${escapeHtml(r.to.name)}</div>
        <div class="meta">${r.note ? escapeHtml(r.note) : "sem observação"}</div>
        <div class="badges">
          <button class="btn danger" data-act="rel-del" data-rel="${r.id}">remover</button>
        </div>
      </div>
    `).join("");

    const allOthers = state.data.characters.filter(x => x.id !== c.id);
    const relTargets = [`<option value="">(escolhe alguém)</option>`]
      .concat(allOthers.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`))
      .join("");

    return `
      <div class="card">
        <div class="head">
          <h2>Ficha • ${escapeHtml(c.name)}</h2>
          <div class="actions">
            <button class="btn" data-act="fav">${c.favorite ? "★ Favorito" : "☆ Favoritar"}</button>
            <button class="btn danger" data-act="del">Apagar</button>
          </div>
        </div>
        <div class="body">
          <div class="row">
            <div>
              <div class="label">Nome</div>
              <input class="input" data-field="name" value="${escapeHtml(c.name)}" />
            </div>
            <div>
              <div class="label">Apelido/Título</div>
              <input class="input" data-field="alias" value="${escapeHtml(c.alias)}" />
            </div>
          </div>

          <div class="row">
            <div>
              <div class="label">Raça</div>
              <input class="input" data-field="race" value="${escapeHtml(c.race)}" />
            </div>
            <div>
              <div class="label">Idade</div>
              <input class="input" data-field="age" value="${escapeHtml(c.age)}" />
            </div>
          </div>

          <div class="row">
            <div>
              <div class="label">Status</div>
              <select class="select" data-field="status">
                ${["vivo","morto","desaparecido","desconhecido"].map(s => `<option value="${s}" ${c.status===s?"selected":""}>${s}</option>`).join("")}
              </select>
            </div>
            <div>
              <div class="label">Continente</div>
              <select class="select" data-field="continent">${continentOptions}</select>
            </div>
            <div>
              <div class="label">Clã/Família</div>
              <select class="select" data-field="clan">${clanOptions}</select>
            </div>
          </div>

          <div class="label">Tags (separa com vírgula)</div>
          <input class="input" data-field="tagsRaw" value="${escapeHtml((c.tags||[]).join(", "))}" placeholder="Arcanyth, Ordem Real, Luxúria…" />

          <div class="hr"></div>

          <div class="row">
            <div>
              <div class="label">Aparência</div>
              <textarea class="textarea" data-field="appearance">${escapeHtml(c.appearance)}</textarea>
            </div>
            <div>
              <div class="label">Personalidade</div>
              <textarea class="textarea" data-field="personality">${escapeHtml(c.personality)}</textarea>
            </div>
          </div>

          <div class="label">Lore / História</div>
          <textarea class="textarea" data-field="lore">${escapeHtml(c.lore)}</textarea>

          <div class="row">
            <div>
              <div class="label">Poderes</div>
              <textarea class="textarea" data-field="powers">${escapeHtml(c.powers)}</textarea>
            </div>
            <div>
              <div class="label">Fraquezas</div>
              <textarea class="textarea" data-field="weaknesses">${escapeHtml(c.weaknesses)}</textarea>
            </div>
          </div>

          <div class="label">Notas soltas</div>
          <textarea class="textarea" data-field="notes">${escapeHtml(c.notes)}</textarea>

          <div class="hr"></div>

          <div class="label">Relações</div>
          <div class="row">
            <div style="max-width:320px">
              <select class="select" id="relTarget">${relTargets}</select>
            </div>
            <div style="max-width:220px">
              <select class="select" id="relType">
                ${["aliado","inimigo","família","romance","mentor","discípulo","rival","subordinado","superior"].map(t => `<option value="${t}">${t}</option>`).join("")}
              </select>
            </div>
            <div>
              <input class="input" id="relNote" placeholder="obs (opcional)" />
            </div>
            <div style="max-width:160px">
              <button class="btn ok" data-act="rel-add">+ Vincular</button>
            </div>
          </div>

          <div class="list" style="margin-top:10px">
            ${relItems || `<div class="empty">Sem relações ainda.</div>`}
          </div>

          <div class="footerNote">
            criado: ${escapeHtml(c.createdAt.slice(0,19).replace("T"," "))} • atualizado: ${escapeHtml(c.updatedAt.slice(0,19).replace("T"," "))}
          </div>
        </div>
      </div>
    `;
  }

  function renderWorld() {
    const cont = state.data.continents.map(x => `<span class="badge">${escapeHtml(x)}</span>`).join("");
    const clans = state.data.clans.map(x => `<span class="badge">${escapeHtml(x)}</span>`).join("");

    return `
      <div class="card">
        <div class="head">
          <h2>Mundo</h2>
          <div class="hint">catálogo simples (tu pode editar aqui)</div>
        </div>
        <div class="body">
          <div class="label">Continentes (um por linha)</div>
          <textarea class="textarea" id="continents">${escapeHtml(state.data.continents.join("\n"))}</textarea>

          <div class="label">Clãs/Famílias (um por linha)</div>
          <textarea class="textarea" id="clans">${escapeHtml(state.data.clans.join("\n"))}</textarea>

          <div class="row" style="margin-top:10px">
            <button class="btn ok" data-act="world-save">Salvar catálogos</button>
          </div>

          <div class="hr"></div>
          <div class="label">Preview</div>
          <div class="badges">${cont}</div>
          <div class="badges" style="margin-top:8px">${clans}</div>
        </div>
      </div>
    `;
  }

  function renderBackup() {
    return `
      <div class="card">
        <div class="head">
          <h2>Backup</h2>
          <div class="hint">exporta / importa teu universo</div>
        </div>
        <div class="body">
          <div class="row">
            <button class="btn ok" data-act="export">Exportar backup (.json)</button>
            <label class="btn" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;">
              Importar backup
              <input type="file" id="importFile" accept="application/json" style="display:none" />
            </label>
            <button class="btn danger" data-act="reset">Zerar tudo</button>
          </div>

          <div class="hr"></div>

          <div class="footerNote">
            Dica de velho sábio: faz backup antes de mexer pesado. História boa não merece sumir por besteira.
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    const selected = getSelected();

    let rightPane = "";
    if (state.view === "characters") rightPane = renderEditor(selected);
    if (state.view === "world") rightPane = renderWorld();
    if (state.view === "backup") rightPane = renderBackup();

    $app.innerHTML = `
      <div class="container">
        ${renderTopbar()}
        <div class="grid">
          <div>${renderLeft()}</div>
          <div>${rightPane}</div>
        </div>
      </div>
    `;

    bindEvents();
  }

  /** =========================
   *  Eventos
   *  ========================= */
  function bindEvents() {
    // busca
    const q = document.getElementById("q");
    if (q) {
      q.addEventListener("input", (e) => {
        state.q = e.target.value;
        render();
      });
    }

    const tagFilter = document.getElementById("tagFilter");
    if (tagFilter) {
      tagFilter.addEventListener("change", (e) => {
        state.tagFilter = e.target.value;
        render();
      });
    }

    // editor fields
    const selected = getSelected();
    if (selected) {
      document.querySelectorAll("[data-field]").forEach(el => {
        const field = el.getAttribute("data-field");
        const handler = () => {
          if (field === "tagsRaw") {
            updateCharacter(selected.id, { tags: parseTags(el.value) });
            return;
          }
          updateCharacter(selected.id, { [field]: el.value });
        };
        el.addEventListener(el.tagName === "TEXTAREA" ? "input" : "change", handler);
        if (el.tagName === "INPUT") el.addEventListener("input", handler);
      });

      // relações
      const relAddBtn = document.querySelector('[data-act="rel-add"]');
      if (relAddBtn) {
        relAddBtn.addEventListener("click", () => {
          const toId = document.getElementById("relTarget").value;
          const type = document.getElementById("relType").value;
          const note = document.getElementById("relNote").value.trim();
          addRelation(selected.id, toId, type, note);
        });
      }

      document.querySelectorAll('[data-act="rel-del"]').forEach(btn => {
        btn.addEventListener("click", () => removeRelation(btn.getAttribute("data-rel")));
      });
    }

    // buttons gerais por data-act
    document.querySelectorAll("[data-act]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");

        if (act === "select") {
          state.selectedId = id;
          state.view = "characters";
          render();
          return;
        }

        if (act === "new") {
          state.view = "characters";
          createCharacter();
          return;
        }

        if (act === "del") {
          const c = getSelected();
          if (!c) return;
          if (confirm(`Apagar "${c.name}"? Isso remove as relações também.`)) deleteCharacter(c.id);
          return;
        }

        if (act === "fav") {
          const c = getSelected();
          if (!c) return;
          updateCharacter(c.id, { favorite: !c.favorite });
          return;
        }

        if (act === "view-characters") { state.view = "characters"; render(); return; }
        if (act === "view-world") { state.view = "world"; render(); return; }
        if (act === "view-backup") { state.view = "backup"; render(); return; }

        if (act === "export") { exportBackup(); return; }
        if (act === "reset") {
          if (confirm("Zerar tudo mesmo? Isso apaga a biblioteca local.")) resetAll();
          return;
        }

        if (act === "world-save") {
          const continents = document.getElementById("continents").value
            .split("\n").map(x => x.trim()).filter(Boolean);
          const clans = document.getElementById("clans").value
            .split("\n").map(x => x.trim()).filter(Boolean);
          state.data.continents = continents;
          state.data.clans = clans;
          saveData();
          toast("Catálogos salvos.");
          render();
          return;
        }
      });
    });

    // import
    const importFile = document.getElementById("importFile");
    if (importFile) {
      importFile.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) importBackup(file);
        importFile.value = "";
      });
    }
  }

  // Atalho: Ctrl+K foca na busca
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const q = document.getElementById("q");
      if (q) q.focus();
    }
  });

  /** =========================
   *  Boot
   *  ========================= */
  render();

})();

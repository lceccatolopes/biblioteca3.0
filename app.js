(() => {
  "use strict";

  const STORAGE_KEY = "codex_data_v3";

  const state = {
    characters: [],
    selectedId: null,
    search: ""
  };

  function load() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) state.characters = JSON.parse(data);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.characters));
  }

  function createCharacter() {
    const c = {
      id: Date.now().toString(),
      name: "Novo Personagem",
      notes: ""
    };
    state.characters.unshift(c);
    state.selectedId = c.id;
    save();
    render();
  }

  function deleteCharacter(id) {
    state.characters = state.characters.filter(c => c.id !== id);
    if (state.selectedId === id) state.selectedId = null;
    save();
    render();
  }

  function updateCharacter(id, data) {
    const c = state.characters.find(c => c.id === id);
    if (!c) return;
    Object.assign(c, data);
    save();
    // Renderiza apenas a lista para atualizar o nome no menu lateral
    renderLeftList();
  }

  function render() {
    const app = document.getElementById("app");
    app.innerHTML = `
      <div class="container">
        <div class="topbar">
          <h2>Codex 3.0</h2>
          <button class="btn primary" id="newBtn">+ Novo</button>
        </div>
        <div class="grid">
          <div id="left">
            <input id="search" placeholder="Buscar..." value="${state.search}" />
            <div id="list-container"></div>
          </div>
          <div id="right"></div>
        </div>
      </div>
    `;

    document.getElementById("newBtn").onclick = createCharacter;
    document.getElementById("search").oninput = (e) => {
      state.search = e.target.value;
      renderLeftList();
    };

    renderLeftList();
    renderRight();
  }

  function renderLeftList() {
    const container = document.getElementById("list-container");
    const filtered = state.characters.filter(c => 
      c.name.toLowerCase().includes(state.search.toLowerCase())
    );

    container.innerHTML = filtered.map(c => `
      <div class="item ${c.id === state.selectedId ? 'active' : ''}" data-id="${c.id}">
        ${c.name || "Sem nome"}
      </div>
    `).join("");

    container.querySelectorAll(".item").forEach(el => {
      el.onclick = () => {
        state.selectedId = el.dataset.id;
        render(); 
      };
    });
  }

  function renderRight() {
    const right = document.getElementById("right");
    const c = state.characters.find(char => char.id === state.selectedId);

    if (!c) {
      right.innerHTML = `<div class="empty">Selecione ou crie um personagem</div>`;
      return;
    }

    right.innerHTML = `
      <input id="edit-name" value="${c.name}" placeholder="Nome do personagem..." />
      <textarea id="edit-notes" placeholder="História, habilidades...">${c.notes}</textarea>
      <button class="btn danger" id="deleteBtn">Apagar Personagem</button>
    `;

    document.getElementById("edit-name").oninput = (e) => {
      updateCharacter(c.id, { name: e.target.value });
    };

    document.getElementById("edit-notes").oninput = (e) => {
      updateCharacter(c.id, { notes: e.target.value });
    };

    document.getElementById("deleteBtn").onclick = () => {
      if (confirm("Deseja mesmo apagar este personagem?")) {
        deleteCharacter(c.id);
      }
    };
  }

  load();
  render();
})();

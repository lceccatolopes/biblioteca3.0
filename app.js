(() => {
  "use strict";

  const STORAGE_KEY = "codex_data";

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
      name: "Novo personagem",
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
  }

  function getSelected() {
    return state.characters.find(c => c.id === state.selectedId);
  }

  function render() {
    const app = document.getElementById("app");

    app.innerHTML = `
      <div class="container">
        <div class="topbar">
          <h2>Codex</h2>
          <button class="btn primary" id="newBtn">+ Novo</button>
        </div>

        <div class="grid">
          <div id="left"></div>
          <div id="right"></div>
        </div>
      </div>
    `;

    renderLeft();
    renderRight();

    document.getElementById("newBtn").onclick = createCharacter;
  }

  function renderLeft() {
    const left = document.getElementById("left");

    const list = state.characters
      .filter(c => c.name.toLowerCase().includes(state.search.toLowerCase()))
      .map(c => `
        <div class="item" data-id="${c.id}">
          ${c.name}
        </div>
      `).join("");

    left.innerHTML = `
      <input id="search" placeholder="Buscar..." />
      ${list}
    `;

    document.getElementById("search").oninput = (e) => {
      state.search = e.target.value;
      renderLeft();
    };

    document.querySelectorAll(".item").forEach(el => {
      el.onclick = () => {
        state.selectedId = el.dataset.id;
        renderRight();
      };
    });
  }

  function renderRight() {
    const right = document.getElementById("right");
    const c = getSelected();

    if (!c) {
      right.innerHTML = `<div class="empty">Selecione um personagem</div>`;
      return;
    }

    right.innerHTML = `
      <input id="name" value="${c.name}" />
      <textarea id="notes">${c.notes}</textarea>
      <button class="btn danger" id="deleteBtn">Apagar</button>
    `;

    document.getElementById("name").oninput = (e) => {
      updateCharacter(c.id, { name: e.target.value });
      renderLeft();
    };

    document.getElementById("notes").oninput = (e) => {
      updateCharacter(c.id, { notes: e.target.value });
    };

    document.getElementById("deleteBtn").onclick = () => {
      if (confirm("Tem certeza?")) {
        deleteCharacter(c.id);
      }
    };
  }

  load();
  render();

})();

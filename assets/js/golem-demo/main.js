const statusEl = document.getElementById("golem-status");

function setStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
}

async function boot() {
  try {
    setStatus("Loading wasm...");
    const wasmUrl = window.__GOLEM_WASM_URL__ || "/assets/wasm/golem-demo/golem_demo.js";
    const wasm = await import(wasmUrl);
    await wasm.default();
    setStatus("");
  } catch (error) {
    console.error("Failed to load golem demo wasm", error);
    setStatus("Failed to load wasm. Build with wasm-pack and refresh.");
  }
}

boot();

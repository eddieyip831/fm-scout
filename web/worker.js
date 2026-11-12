// Reads a Football Manager save inside this worker with Pyodide and fmsave.
// The save is mounted read-only from the File the page hands over; it never
// leaves the computer. Network requests fetch only Pyodide (pinned, jsDelivr)
// and this site's own files.

const PYODIDE_VERSION = "314.0.7"; // Python 3.14: zstd is in the standard library
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const WHEEL = "fmsave-0.12.2-py3-none-any.whl";
const WHEEL_SHA256 = "f10e7589b0524262e04b0bbae021b6f544b77af62f31f1016d186722f3c4d99f";

let pyodide = null;
let reader = null;
let nationsJson = "{}";

const progress = text => postMessage({ type: "progress", text });

async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res;
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function boot() {
  progress("Loading the save reader…");
  const { loadPyodide } = await import(PYODIDE_URL + "pyodide.mjs");
  pyodide = await loadPyodide({ indexURL: PYODIDE_URL });

  // A read of a file that changed on disk after it was picked (the game saving
  // over it) throws a browser error that would kill Pyodide. Give Python an
  // I/O error instead, which fmsave reports cleanly.
  const ops = pyodide.FS.filesystems.WORKERFS.stream_ops;
  const read = ops.read;
  ops.read = function (...args) {
    try {
      return read.apply(this, args);
    } catch (error) {
      if (error instanceof pyodide.FS.ErrnoError) throw error;
      throw new pyodide.FS.ErrnoError(29);
    }
  };

  const [wheel, readerSource, nations] = await Promise.all([
    fetchOk(new URL(`vendor/${WHEEL}`, self.location.href)).then(r => r.arrayBuffer()),
    fetchOk(new URL("reader.py", self.location.href)).then(r => r.text()),
    fetchOk(new URL("nations.json", self.location.href)).then(r => r.text()),
  ]);
  const digest = await sha256Hex(wheel);
  if (digest !== WHEEL_SHA256) throw new Error("The bundled save reader failed its integrity check.");
  nationsJson = nations;

  await pyodide.loadPackage("micropip");
  pyodide.FS.writeFile(`/tmp/${WHEEL}`, new Uint8Array(wheel));
  await pyodide.pyimport("micropip").install(`emfs:/tmp/${WHEEL}`);
  pyodide.FS.writeFile("/home/pyodide/reader.py", readerSource);
  reader = pyodide.pyimport("reader");
}

const ready = boot();
ready.then(() => postMessage({ type: "ready" }), error => postMessage({ type: "boot-error", error: String(error.message || error) }));

function parse(file) {
  try { pyodide.FS.unmount("/save"); } catch { /* nothing mounted */ }
  pyodide.FS.mkdirTree("/save");
  pyodide.FS.mount(pyodide.FS.filesystems.WORKERFS, { files: [file] }, "/save");
  try {
    return reader.build_json(`/save/${file.name}`, nationsJson);
  } finally {
    try { pyodide.FS.unmount("/save"); } catch { /* already gone */ }
  }
}

self.onmessage = async ({ data }) => {
  if (data.type !== "parse") return;
  try {
    await ready;
    progress(`Reading ${data.file.name}…`);
    postMessage({ type: "result", id: data.id, json: parse(data.file) });
  } catch (error) {
    // Python errors carry a long traceback; the last line is the message a person can act on.
    const lines = String(error.message || error).trim().split("\n");
    const message = lines[lines.length - 1].replace(/^[\w.]+(Error|Exception): /, "");
    postMessage({ type: "error", id: data.id, error: message });
  }
};

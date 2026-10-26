let stream = null;
let lastScan = "";
let lastT = 0;
let ct;

function kiosk() {
  return `<div class="card">
    <div class="clock" id="clk">${new Date().toLocaleTimeString()}</div>
    <h2 style="margin-top:0">Tap RFID / Scan QR Code</h2>
    <p class="mut">USB RFID readers type the ID automatically. Or type the ID, or use the camera to scan a QR code.</p>
    <div class="row">
      <input id="sid" placeholder="Student ID" onkeydown="if(event.key==='Enter')scanIn()">
      <button class="p" onclick="scanIn()">Submit</button>
      <button onclick="startCam()">Use camera</button>
    </div>
    <video id="vid" playsinline hidden></video>
    <canvas id="cv" hidden></canvas>
    <div id="kres"></div>
  </div>`;
}

function scanIn() {
  const v = $("sid").value;
  $("sid").value = "";
  handleScan(v);
}

async function startCam() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    const v = $("vid");
    v.srcObject = stream;
    v.hidden = false;
    await v.play();
    tick();
  } catch (e) {
    $("kres").innerHTML =
      '<div class="res er">Camera unavailable here. Use typed ID or an RFID reader.</div>';
  }
}

function tick() {
  if (!stream) return;
  const v = $("vid"),
    c = $("cv");
  if (v && v.videoWidth) {
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const x = c.getContext("2d");
    x.drawImage(v, 0, 0);
    const im = x.getImageData(0, 0, c.width, c.height);
    const q = window.jsQR && jsQR(im.data, im.width, im.height);
    if (q && q.data) handleScan(q.data, true);
  }
  requestAnimationFrame(tick);
}

function handleScan(raw, viaQR) {
  reload();
  const id = raw.trim();
  if (!id) return;
  if (id === lastScan && Date.now() - lastT < 4000) return;

  lastScan = id;
  lastT = Date.now();

  const s = S.students.find((x) =>
      viaQR ? ((s2) => (s2.qr ? s2.qr === id : s2.id === id))(x) : x.id === id,
    ),
    r = $("kres");

  if (!s) {
    r.innerHTML = `<div class="res er">
      <h2>ID Not Found</h2>
      <div>${esc(id)}</div>
      <div class="mut">Please try again.</div>
    </div>`;
    beep(false);
    clearLater();
    return;
  }

  const today = dk(Date.now());
  const mine = S.logs.filter((l) => l.sid === s.id && dk(l.ts) === today);
  const type =
    mine.length && mine[mine.length - 1].type === "IN" ? "OUT" : "IN";
  const ts = new Date().toISOString();
  const late = type === "IN" && !mine.length && tm24(ts) > S.cfg.start;

  S.logs.push({ id: uid(), sid: s.id, type, ts, late });

  const msg = `${s.name} time-${type.toLowerCase()} at ${tm(ts)}${
    late ? " (LATE)" : ""
  }`;
  S.notes.push({
    id: uid(),
    sid: s.id,
    to: s.parent,
    channel: "SMS / Email",
    msg,
    ts,
  });
  save();

  r.innerHTML = `<div class="res ok">
    ${av(s)}
    <h2 style="margin:4px 0">${esc(s.name)}</h2>
    <div>${esc(s.section)} · Time-${type} · ${tm(ts)}${
      late ? ' · <b class="late">LATE</b>' : ""
    }</div>
    <div class="mut">SMS / Email sent to parent: ${esc(s.parent)}</div>
  </div>`;

  beep(true);
  clearLater();
}

setInterval(() => {
  const c = $("clk");
  if (c) c.textContent = new Date().toLocaleTimeString();
}, 1000);

function beep(ok) {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    const o = a.createOscillator();
    o.frequency.value = ok ? 880 : 220;
    o.connect(a.destination);
    o.start();
    setTimeout(() => o.stop(), ok ? 150 : 400);
  } catch (e) {}
}

function clearLater() {
  clearTimeout(ct);
  ct = setTimeout(() => {
    const r = $("kres");
    if (r) r.innerHTML = "";
    const i = $("sid");
    i && i.focus();
  }, 5000);
}

function render() {
  $("app").innerHTML = kiosk();
  setTimeout(() => $("sid") && $("sid").focus(), 50);
}

render();

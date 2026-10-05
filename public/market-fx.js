(function () {
  "use strict";
  if (document.querySelector("#market-atmosphere")) return;

  const layer = document.createElement("div");
  layer.id = "market-atmosphere";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = '<canvas></canvas><div class="market-scan"></div><div class="market-vignette"></div>';
  document.body.prepend(layer);
  document.body.classList.add("fx-ready");

  const canvas = layer.querySelector("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let running = true;

  const nodes = Array.from({ length: 38 }, (_, index) => ({
    x: ((index * 73) % 101) / 100,
    y: ((index * 47) % 97) / 100,
    size: 0.7 + (index % 4) * 0.45,
    speed: 0.000018 + (index % 7) * 0.000004,
    phase: index * 0.83,
  }));

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function curveY(x, t, variant) {
    const center = height * (variant === 0 ? 0.43 : variant === 1 ? 0.62 : 0.31);
    const wave = Math.sin(x * 0.008 + t * (variant === 1 ? 0.00024 : 0.00017) + variant * 2.4) * (34 + variant * 13);
    const micro = Math.sin(x * 0.025 - t * 0.00012 + variant) * 14;
    const trend = (x / Math.max(width, 1) - 0.5) * (variant === 1 ? -90 : 72);
    return center + wave + micro + trend;
  }

  function drawGrid(t) {
    const spacing = Math.max(54, Math.min(88, width / 18));
    const drift = (t * 0.006) % spacing;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(86, 196, 255, .055)";
    ctx.beginPath();
    for (let x = -spacing + drift; x < width + spacing; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = -spacing + drift * 0.45; y < height + spacing; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    const horizon = height * 0.72;
    ctx.strokeStyle = "rgba(148, 102, 255, .045)";
    ctx.beginPath();
    for (let x = 0; x <= width; x += Math.max(70, width / 12)) {
      ctx.moveTo(width / 2, horizon);
      ctx.lineTo(x, height);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawCurve(t, variant, color) {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.17, color);
    gradient.addColorStop(0.82, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.lineWidth = variant === 0 ? 1.7 : 1.1;
    ctx.strokeStyle = gradient;
    ctx.shadowColor = color;
    ctx.shadowBlur = variant === 0 ? 18 : 10;
    ctx.beginPath();
    for (let x = -20; x <= width + 20; x += 9) {
      const y = curveY(x, t, variant);
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawCandles(t) {
    const gap = width < 720 ? 52 : 68;
    const offset = (t * 0.012) % gap;
    ctx.save();
    for (let x = -gap + offset, index = 0; x < width + gap; x += gap, index++) {
      const phase = index * 1.43 + t * 0.00019;
      const base = curveY(x, t, 2);
      const body = 8 + (Math.sin(phase * 1.7) + 1) * 12;
      const wick = body + 13 + (Math.cos(phase) + 1) * 8;
      const up = Math.sin(phase) > -0.08;
      const color = up ? "rgba(54, 246, 212, .23)" : "rgba(255, 86, 164, .2)";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, base - wick / 2);
      ctx.lineTo(x, base + wick / 2);
      ctx.stroke();
      ctx.fillRect(x - 3.5, base - body / 2, 7, body);
    }
    ctx.restore();
  }

  function drawNodes(t) {
    ctx.save();
    for (const node of nodes) {
      const y = (node.y - t * node.speed + 2) % 1;
      const pulse = 0.35 + (Math.sin(t * 0.0012 + node.phase) + 1) * 0.22;
      const x = node.x * width;
      const py = y * height;
      ctx.fillStyle = `rgba(113, 224, 255, ${pulse})`;
      ctx.shadowColor = "rgba(113, 224, 255, .9)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, py, node.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function render(time) {
    if (!running) return;
    const t = reducedMotion.matches ? 0 : time;
    ctx.clearRect(0, 0, width, height);
    drawGrid(t);
    drawCurve(t, 0, "rgba(48, 230, 255, .28)");
    drawCurve(t, 1, "rgba(166, 92, 255, .2)");
    drawCandles(t);
    drawNodes(t);
    frame = reducedMotion.matches ? 0 : requestAnimationFrame(render);
  }

  function restart() {
    cancelAnimationFrame(frame);
    running = !document.hidden && document.body.classList.contains('auth-locked');
    if (running) frame = requestAnimationFrame(render);
  }

  resize();
  addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", restart);
  reducedMotion.addEventListener?.("change", restart);
  addEventListener("pointermove", (event) => {
    if(!running)return;
    document.documentElement.style.setProperty("--pointer-x", `${(event.clientX / Math.max(width, 1)) * 100}%`);
    document.documentElement.style.setProperty("--pointer-y", `${(event.clientY / Math.max(height, 1)) * 100}%`);
  }, { passive: true });
  new MutationObserver(restart).observe(document.body,{attributes:true,attributeFilter:['class']});
  restart();
})();

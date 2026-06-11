/** Минимальное конфетти на канвасе — без зависимостей. */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vr: number;
  life: number;
}

const COLORS = ['#ff5c7a', '#ffb03a', '#ffe14d', '#5ce07a', '#4dc9ff', '#b18cff', '#ff8cd9'];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let running = false;

function ensureCanvas(): void {
  if (canvas) return;
  canvas = document.getElementById('confetti') as HTMLCanvasElement;
  ctx = canvas.getContext('2d');
  const resize = () => {
    canvas!.width = window.innerWidth * devicePixelRatio;
    canvas!.height = window.innerHeight * devicePixelRatio;
  };
  resize();
  window.addEventListener('resize', resize);
}

function frame(): void {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter((p) => p.life > 0 && p.y < canvas!.height + 20);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.25 * devicePixelRatio;
    p.vx *= 0.99;
    p.rotation += p.vr;
    p.life -= 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  }
  if (particles.length > 0) {
    requestAnimationFrame(frame);
  } else {
    running = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/** Залп конфетти в точке экрана (CSS-пиксели). */
export function burst(cssX: number, cssY: number, count = 18): void {
  ensureCanvas();
  const x = cssX * devicePixelRatio;
  const y = cssY * devicePixelRatio;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (2 + Math.random() * 5) * devicePixelRatio;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3 * devicePixelRatio,
      size: (4 + Math.random() * 5) * devicePixelRatio,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      rotation: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 50 + Math.random() * 30,
    });
  }
  if (!running) {
    running = true;
    requestAnimationFrame(frame);
  }
}

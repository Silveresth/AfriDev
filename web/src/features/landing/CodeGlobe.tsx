'use client';

import { useEffect, useRef } from 'react';

/**
 * Globe terrestre en points, dessiné sur un canvas (aucune image téléchargée) :
 * l'Afrique est tracée en caractères de code, des « piques » lumineuses marquent les villes
 * où vivent les devs de la communauté, et des arcs relient ces villes.
 * Le globe oscille autour de l'Afrique, se met en pause hors de l'écran et reste fixe
 * si l'utilisateur a demandé moins d'animations.
 */

type LonLat = [number, number];

// Contours simplifiés (longitude, latitude), suffisants à la résolution d'un point tous les ~2°.
const AFRICA: LonLat[] = [
  [-5.9, 35.8], [-1.9, 35.1], [3, 36.8], [9.8, 37.3], [11.1, 36.9], [10.2, 34.3], [11.1, 33.2], [15.2, 32.3],
  [19, 30.3], [20.1, 32], [23, 32.6], [25.1, 31.6], [29.9, 31.2], [32.3, 31.3], [32.6, 29.9], [33.9, 27.2],
  [35.6, 23.9], [37.2, 19.6], [38.6, 18], [39.7, 15.6], [41.7, 13.4], [43.3, 12], [44, 10.4], [51.3, 11.8],
  [51, 10.4], [49.5, 6.8], [47.9, 4.5], [45.3, 2], [42.6, -0.6], [40.2, -2.8], [39.7, -4], [39.3, -6.8],
  [40.5, -10.5], [40.6, -14.5], [39, -16.5], [34.8, -19.8], [35.5, -22], [35.4, -23.9], [32.6, -25.9],
  [32, -28.8], [31, -29.9], [28, -32.7], [25.6, -33.9], [22.1, -34.2], [20, -34.8], [18.4, -34.3], [18, -32],
  [16.5, -28.6], [15.2, -26.6], [14.5, -22.9], [11.8, -17.3], [13.4, -12.6], [13.2, -8.8], [12.3, -6.1],
  [11.8, -4.8], [9.3, -1], [9.4, 0.4], [9.7, 4], [8.5, 4.5], [6, 4.3], [3.4, 6.4], [1.2, 6.1], [-2.1, 4.7],
  [-4, 5.2], [-7.5, 4.4], [-11.5, 6.9], [-13.2, 8.5], [-15, 10.8], [-16.7, 12.5], [-17.5, 14.7], [-16.5, 16.5],
  [-16.3, 19.5], [-17, 21], [-15.9, 23.7], [-12.9, 27.9], [-9.6, 30.4], [-9.8, 31.5], [-7.6, 33.6], [-6.8, 34],
];
const MADAGASCAR: LonLat[] = [
  [49.3, -12], [50.5, -15.5], [49.5, -17.5], [47, -25], [45, -25.5], [43.7, -23.5], [43.3, -21.5], [44.4, -19.5],
  [44, -17], [46.3, -15.7], [48, -13.5],
];
const OTHER_LAND: LonLat[][] = [
  // Eurasie
  [
    [-9.5, 37], [-8.9, 43.2], [-1.5, 43.4], [-1.2, 46.2], [-4.5, 48.4], [1.6, 50.9], [4.5, 52.8], [8.6, 53.9],
    [8, 57], [5, 58.5], [5, 62], [10, 64.4], [14.5, 68], [19, 70], [25.6, 71.1], [33, 69.4], [41, 67.5],
    [44, 68.5], [54, 68.8], [60, 69.8], [68, 69], [73, 72.5], [80, 73.5], [88, 75.5], [100, 76.5], [113, 73.6],
    [128, 72.5], [140, 72.4], [150, 71.5], [160, 70], [170, 69.8], [180, 69], [180, 65], [178, 64.5], [170, 60],
    [163, 59.8], [162, 56], [156.5, 51], [155.5, 55.5], [155, 59], [143, 59.3], [137, 54], [141, 52], [140, 48],
    [135, 43.5], [132, 43], [129.5, 41], [129.4, 36], [126.5, 34.4], [126.1, 37.7], [124.5, 40], [121.5, 40.9],
    [121.6, 39], [117.8, 39.2], [119, 37.2], [122.5, 37], [120.3, 34.6], [121.9, 31], [121.5, 28.5], [119.6, 25.5],
    [116.7, 23], [113.5, 22.2], [110.4, 21], [108, 21.5], [106, 19.5], [106.5, 17.5], [109.3, 13], [109, 11.5],
    [106.7, 10.4], [105, 8.7], [103.5, 10.5], [101, 13.3], [100.2, 12], [99.2, 9.2], [100.3, 6.5], [101.3, 2.8],
    [103.5, 1.3], [104.2, 1.5], [103.4, 4.5], [102, 6.2], [100.6, 7], [99, 10], [98.4, 13], [97.6, 16.5],
    [94.5, 16], [94, 19], [92, 21.5], [90, 22], [88.3, 21.6], [86.8, 20.3], [85, 19.3], [82.3, 16.6], [80.3, 15.6],
    [80.2, 13], [79.9, 10.3], [77.5, 8.1], [76.3, 9.7], [74.8, 12.8], [73.4, 16], [72.8, 19], [72.6, 21.5],
    [70.2, 20.8], [68.7, 23.3], [66.7, 25.3], [61.6, 25.2], [57.3, 25.7], [56.4, 27.1], [54, 26.6], [51.5, 27.9],
    [50.2, 29.9], [48, 30], [48.5, 28], [50.1, 26.2], [51.5, 24.3], [54, 24.1], [56.2, 26.2], [56.4, 24.9],
    [58.8, 23.5], [59.8, 22.4], [57.8, 19], [55.4, 17.6], [52.2, 15.7], [49.3, 14.6], [45, 12.8], [43.4, 12.7],
    [42.7, 15.5], [42.4, 17.8], [41.2, 19.5], [39.1, 21.5], [38.1, 24.1], [36.7, 26], [35, 28], [34.6, 29.5],
    [34.3, 31.3], [35, 33], [35.9, 35.5], [36.2, 36.6], [34.7, 36.8], [32.5, 36.1], [30.6, 36.7], [28, 36.7],
    [27.3, 37.8], [26.5, 39.5], [26.2, 40.6], [24, 40.8], [22.9, 40.5], [23.5, 38.5], [22.5, 36.5], [21.1, 37.8],
    [19.4, 40.4], [19.4, 41.8], [15.9, 43.6], [13.7, 45.1], [12.3, 45.4], [12.4, 44.2], [13.7, 43.5], [16, 41.4],
    [18.5, 40.2], [16.6, 38.4], [15.7, 38], [15.8, 40], [12.6, 41.4], [10.5, 42.9], [8.8, 44.4], [6.6, 43.1],
    [3.2, 43.2], [3.2, 41.9], [0.6, 40.5], [-0.3, 39.4], [0, 38.7], [-1.6, 37.2], [-5.6, 36], [-6.5, 36.9],
    [-8.9, 37],
  ],
  // Grande-Bretagne, Irlande
  [[-5.7, 50.1], [1.7, 51.2], [1.7, 52.7], [-0.2, 54], [-1.8, 55.8], [-3, 58.6], [-5, 58.6], [-6.2, 56.5], [-4.9, 54.8], [-3.2, 53.4], [-5.2, 51.7]],
  [[-10, 51.6], [-6, 52.2], [-6, 54], [-8, 55.2], [-10, 54.2]],
  // Amérique du Nord, Groenland
  [
    [-168, 65.5], [-162, 70], [-156, 71.3], [-141, 69.6], [-128, 70], [-115, 68.6], [-95, 68], [-90, 68.9],
    [-82, 66], [-80, 62], [-77, 58], [-79, 52], [-70, 58.5], [-65, 60.3], [-61, 56], [-56, 52], [-60, 47],
    [-66, 44.5], [-70.5, 41.8], [-74, 40.5], [-76, 37], [-75.5, 35.2], [-81, 31.5], [-80, 27], [-80.4, 25.2],
    [-82.7, 27.8], [-84, 30], [-89, 30.3], [-94, 29.5], [-97.4, 27.5], [-97.7, 21.5], [-95, 18.7], [-91, 19],
    [-90.4, 21], [-87, 21.5], [-88, 16], [-83.2, 15], [-83.5, 11], [-79.5, 9.3], [-77.4, 8.6], [-79.8, 7.5],
    [-83, 8.3], [-86, 11], [-91.5, 14], [-96, 15.7], [-105.5, 20], [-105.7, 23], [-112, 29], [-114.8, 31.8],
    [-117.1, 32.5], [-120.6, 34.5], [-124.2, 40.4], [-124.1, 46.5], [-124.7, 48.4], [-127.5, 50.5], [-131, 54],
    [-135, 57.5], [-140, 59.8], [-146, 60.5], [-152, 59], [-158, 57], [-164, 54.6], [-158, 58.5], [-162, 60],
    [-166, 61.5], [-165, 63.2],
  ],
  [[-73, 78], [-60, 82], [-30, 83.5], [-20, 82], [-18, 76], [-22, 70], [-32, 68], [-40, 65], [-43, 60], [-48, 61], [-53, 66], [-55, 71], [-60, 76]],
  // Amérique du Sud
  [
    [-77.4, 8.6], [-75.5, 10.6], [-71.5, 12.4], [-68, 10.6], [-62, 10.7], [-57, 6], [-51, 4.4], [-50, 1.7],
    [-48.5, -1.2], [-44.3, -2.5], [-39, -3.4], [-35.2, -5.5], [-34.8, -7.5], [-37, -11], [-39, -15], [-39.6, -19],
    [-41, -22], [-44.5, -23.3], [-48.5, -26.2], [-48.8, -28.6], [-52, -31.8], [-53.4, -33.7], [-56, -34.9],
    [-58.4, -34.5], [-57.5, -38], [-62.2, -38.8], [-65, -41], [-65.2, -44.6], [-67.6, -46.3], [-65.8, -47.8],
    [-68.4, -50.2], [-68.6, -52.6], [-71, -53.9], [-74.5, -50.5], [-75.5, -46], [-73.6, -42], [-73.5, -37],
    [-71.5, -32.5], [-71.5, -28], [-70.4, -23.5], [-70.3, -18.4], [-75.2, -15.3], [-77.6, -11], [-81.3, -5.8],
    [-80.5, -3.5], [-80.1, -0.7], [-78.8, 1.7], [-77.6, 4], [-77.3, 7],
  ],
  // Océanie et Asie du Sud-Est insulaire
  [
    [113.5, -22], [114, -26.5], [115, -34], [118, -35], [123, -33.9], [129, -31.7], [134, -32.8], [137.8, -35.6],
    [140, -37.8], [146, -39], [150, -37.5], [153.2, -30], [153.1, -25.2], [150.8, -22.6], [146.3, -19], [145.3, -15],
    [142.5, -10.7], [141.6, -13], [141.6, -17], [139.5, -17.5], [136.8, -15.9], [136.8, -12.2], [132.5, -11.4],
    [129.5, -14.9], [126, -14], [122.2, -17.4], [121, -19.6], [116.8, -20.6],
  ],
  [[95.3, 5.6], [98.3, 4.3], [104, -2], [106, -5.9], [102, -4], [98.6, -1], [95.2, 3]],
  [[109, 1.5], [110, -2.9], [114.5, -4], [116.5, -1.5], [117.8, 1], [119, 5.2], [116.7, 7], [115, 4.8], [111, 1.5]],
  [[105.2, -6.8], [114.5, -7.8], [114.4, -8.7], [106, -7.4]],
  [[131, -1], [141, -2.6], [150, -6.3], [147.5, -8], [143, -9], [138, -8.2], [134, -3.5]],
  [[130, 31.2], [131.4, 34.2], [135, 33.5], [140, 35], [141.5, 38.5], [141.5, 41.4], [139.8, 40], [139, 38], [136.8, 37.1], [133, 35.5], [130.8, 34]],
];

/** Villes tech : [longitude, latitude, hauteur relative de la pique]. */
const CITIES: [number, number, number][] = [
  [3.4, 6.5, 1], // Lagos
  [36.8, -1.3, 0.92], // Nairobi
  [31.2, 30, 0.86], // Le Caire
  [28, -26.2, 0.82], // Johannesburg
  [-17.45, 14.7, 0.78], // Dakar
  [-4, 5.35, 0.74], // Abidjan
  [-0.2, 5.6, 0.68], // Accra
  [-7.6, 33.6, 0.64], // Casablanca
  [15.3, -4.3, 0.6], // Kinshasa
  [30.06, -1.95, 0.58], // Kigali
  [2.4, 6.37, 0.54], // Cotonou
  [9.7, 4.05, 0.52], // Douala
  [38.75, 9, 0.56], // Addis-Abeba
  [10.2, 36.8, 0.5], // Tunis
  [3.05, 36.75, 0.46], // Alger
  [18.4, -33.9, 0.6], // Le Cap
  [-8, 12.6, 0.44], // Bamako
  [-1.5, 12.37, 0.42], // Ouagadougou
  [39.3, -6.8, 0.46], // Dar es Salaam
  [32.6, 0.35, 0.44], // Kampala
  [13.2, -8.8, 0.4], // Luanda
  [47.5, -18.9, 0.38], // Antananarivo
  [11.5, 3.87, 0.42], // Yaoundé
  [1.2, 6.13, 0.4], // Lomé
  [28.3, -15.4, 0.36], // Lusaka
];
const ARCS: [number, number][] = [
  [4, 1], [0, 2], [5, 3], [8, 7], [1, 3], [4, 0], [9, 12], [6, 15], [13, 0], [10, 18],
];

const GLYPHS = ['{', '}', '<', '>', '/', ';', '=', '0', '1', '(', ')', '[', ']', '*', '#'];
const RAD = Math.PI / 180;

function inside([x, y]: LonLat, poly: LonLat[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

type Vec = [number, number, number];
const toVec = (lon: number, lat: number): Vec => [
  Math.cos(lat * RAD) * Math.sin(lon * RAD),
  Math.sin(lat * RAD),
  Math.cos(lat * RAD) * Math.cos(lon * RAD),
];

interface Dot {
  v: Vec;
  africa: boolean;
  glyph: number;
}

/** Points de terre répartis uniformément (spirale de Fibonacci), calculés une seule fois. */
let cachedDots: Dot[] | null = null;
function landDots(): Dot[] {
  if (cachedDots) return cachedDots;
  const dots: Dot[] = [];
  const total = 11000;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < total; i++) {
    const y = 1 - (2 * (i + 0.5)) / total;
    const lat = Math.asin(y) / RAD;
    let lon = ((i * golden) / RAD) % 360;
    if (lon > 180) lon -= 360;
    const p: LonLat = [lon, lat];
    const africa = inside(p, AFRICA) || inside(p, MADAGASCAR);
    if (!africa && !OTHER_LAND.some((poly) => inside(p, poly))) continue;
    dots.push({ v: toVec(lon, lat), africa, glyph: (i * 7) % GLYPHS.length });
  }
  cachedDots = dots;
  return dots;
}

function slerp(a: Vec, b: Vec, t: number): Vec {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return a;
  const s = Math.sin(omega);
  const k1 = Math.sin((1 - t) * omega) / s;
  const k2 = Math.sin(t * omega) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

/** « #c84b20 » + opacité → « rgba(…) » (color-mix n'est pas accepté partout par le canvas). */
function rgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return hex;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function readColors() {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    primary: get('--primary', '#c84b20'),
    secondary: get('--secondary', '#1a7f4b'),
    land: get('--ink-faint', '#75757e'),
    rim: get('--line-strong', '#d0d0d6'),
    dark: document.documentElement.dataset.theme === 'dark',
  };
}

export function CodeGlobe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dots = landDots();
    const cities = CITIES.map(([lon, lat, h], index) => ({ v: toVec(lon, lat), h, phase: index * 0.83 }));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let colors = readColors();
    let size = 0;
    let dpr = 1;
    let sprites: HTMLCanvasElement[] = [];

    // Caractères pré-rendus une fois (drawImage est bien plus rapide que fillText à chaque image).
    const buildSprites = (fontPx: number) => {
      sprites = GLYPHS.map((char) => {
        const sprite = document.createElement('canvas');
        const box = Math.ceil(fontPx * 1.4);
        sprite.width = box;
        sprite.height = box;
        const sctx = sprite.getContext('2d')!;
        sctx.font = `600 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        sctx.textAlign = 'center';
        sctx.textBaseline = 'middle';
        sctx.fillStyle = colors.primary;
        sctx.fillText(char, box / 2, box / 2);
        return sprite;
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = Math.max(1, Math.round(rect.width));
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      buildSprites(Math.max(7, size / 60) * dpr);
    };

    const draw = (time: number) => {
      const w = canvas.width;
      const cx = w / 2;
      const cy = w / 2;
      const r = w * 0.39;
      // Centre du globe : l'Afrique, avec une lente oscillation est-ouest.
      const lon0 = (17 + Math.sin(time * 0.00009) * 13) * RAD;
      // Inclinaison = latitude placée au centre (l'Afrique s'étend de 35° S à 37° N).
      const tilt = 4 * RAD;
      const cosL = Math.cos(lon0);
      const sinL = Math.sin(lon0);
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);
      // Rotation (longitude puis inclinaison) → x écran, y écran, z profondeur.
      const project = (v: Vec, scale = 1) => {
        const x1 = v[0] * cosL - v[2] * sinL;
        const z1 = v[0] * sinL + v[2] * cosL;
        const y2 = v[1] * cosT - z1 * sinT;
        const z2 = v[1] * sinT + z1 * cosT;
        return { x: cx + x1 * r * scale, y: cy - y2 * r * scale, z: z2 };
      };

      ctx.clearRect(0, 0, w, w);

      // Halo et disque.
      const halo = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.32);
      halo.addColorStop(0, rgba(colors.primary, 0.12));
      halo.addColorStop(1, rgba(colors.primary, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, w);
      const disc = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      disc.addColorStop(0, colors.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.95)');
      disc.addColorStop(1, colors.dark ? 'rgba(255,255,255,0.015)' : 'rgba(240,240,242,0.85)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = disc;
      ctx.fill();
      ctx.lineWidth = 1 * dpr;
      ctx.strokeStyle = colors.rim;
      ctx.globalAlpha = 0.7;
      ctx.stroke();

      // Terres : points discrets, Afrique en caractères de code.
      const dotR = Math.max(0.9, r / 210);
      ctx.fillStyle = colors.land;
      for (const dot of dots) {
        const p = project(dot.v);
        if (p.z <= 0.02) continue;
        if (dot.africa) {
          const sprite = sprites[dot.glyph];
          if (!sprite) continue;
          const s = sprite.width * (0.55 + p.z * 0.45);
          ctx.globalAlpha = 0.35 + p.z * 0.65;
          ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
        } else {
          ctx.globalAlpha = 0.12 + p.z * 0.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, dotR * (0.6 + p.z * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Arcs entre villes, parcourus par un trait lumineux.
      ctx.lineCap = 'round';
      ARCS.forEach(([from, to], index) => {
        const a = cities[from]!.v;
        const b = cities[to]!.v;
        const steps = 36;
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        let started = false;
        const pts: { x: number; y: number; z: number }[] = [];
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const p = project(slerp(a, b, t), 1 + Math.sin(Math.PI * t) * 0.16);
          pts.push(p);
          if (p.z < 0) {
            started = false;
            continue;
          }
          if (started) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
          started = true;
        }
        ctx.stroke();
        // Tracé lumineux qui voyage le long de l'arc.
        const head = ((time * 0.00022 + index * 0.37) % 1.4) * steps;
        ctx.strokeStyle = colors.secondary;
        ctx.lineWidth = 2 * dpr;
        for (let s = Math.max(1, Math.floor(head - 7)); s <= Math.min(steps, Math.floor(head)); s++) {
          const p0 = pts[s - 1];
          const p1 = pts[s];
          if (!p0 || !p1 || p0.z < 0 || p1.z < 0) continue;
          ctx.globalAlpha = Math.max(0, 1 - (head - s) / 7);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      });

      // Piques : une par ville, hauteur selon l'activité, pointe qui pulse.
      for (const city of cities) {
        const base = project(city.v);
        if (base.z <= 0.05) continue;
        const pulse = reduced ? 0.5 : (Math.sin(time * 0.0025 + city.phase) + 1) / 2;
        const tip = project(city.v, 1 + city.h * (0.2 + pulse * 0.05));
        const grad = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
        grad.addColorStop(0, rgba(colors.primary, 0.15));
        grad.addColorStop(1, colors.primary);
        ctx.globalAlpha = 0.4 + base.z * 0.6;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.2 * dpr;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();

        const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 9 * dpr);
        glow.addColorStop(0, rgba(colors.primary, 0.5 + pulse * 0.4));
        glow.addColorStop(1, rgba(colors.primary, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 9 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors.dark ? '#ffffff' : colors.primary;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 2.2 * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Onde au pied de la pique.
        const ring = (time * 0.0006 + city.phase) % 1;
        ctx.globalAlpha = (1 - ring) * 0.5 * base.z;
        ctx.strokeStyle = colors.secondary;
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, (3 + ring * 12) * dpr, (3 + ring * 12) * dpr * Math.max(0.35, base.z), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    let running = false;
    let onScreen = true;
    const loop = (time: number) => {
      draw(time);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduced || !onScreen || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    draw(performance.now());
    start();

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    resizeObserver.observe(canvas);
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      if (onScreen) start();
      else stop();
    });
    visibility.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    // Thème clair/sombre : on relit les couleurs et on redessine les caractères.
    const themeObserver = new MutationObserver(() => {
      colors = readColors();
      buildSprites(Math.max(7, size / 60) * dpr);
      draw(performance.now());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      stop();
      resizeObserver.disconnect();
      visibility.disconnect();
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}

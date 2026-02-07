import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { Configuration } from '../types';
import { convexHullIndices, isCollinear } from '../services/perimeter';

interface DiskPlotProps {
  config: Configuration;
  showHull?: boolean;
  showContacts?: boolean;
}

/**
 * Generate points along a circle arc from angle a1 to a2 (CCW).
 */
function arcPoints(
  cx: number, cy: number, r: number,
  a1: number, a2: number, nPoints: number = 40
): { x: number[]; y: number[] } {
  // Normalize so that a2 > a1 and we go CCW
  while (a2 < a1) a2 += 2 * Math.PI;
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= nPoints; i++) {
    const t = a1 + (a2 - a1) * i / nPoints;
    x.push(cx + r * Math.cos(t));
    y.push(cy + r * Math.sin(t));
  }
  return { x, y };
}

/**
 * Generate points along a full circle.
 */
function circlePoints(cx: number, cy: number, r: number, nPoints: number = 60): { x: number[]; y: number[] } {
  return arcPoints(cx, cy, r, 0, 2 * Math.PI, nPoints);
}

/**
 * Compute the Minkowski sum boundary: convex hull of centers offset by radius.
 * For each hull edge, draw a tangent line offset outward by r.
 * At each hull vertex, draw an arc of the disk.
 *
 * Hull vertices are in CCW order.
 * For edge k→k+1 with outward normal n_k, the tangent line goes from
 *   center[k] + r*n_k  to  center[k+1] + r*n_k
 * At vertex k, draw arc from direction n_{k-1} to n_k (CCW).
 */
function computeDiskHullBoundary(
  positions: [number, number][],
  hullIndices: number[],
  r: number
): { x: number[]; y: number[] } {
  const n = hullIndices.length;
  if (n < 2) return { x: [], y: [] };

  // Precompute outward normals for each edge
  const normals: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const i = hullIndices[k];
    const j = hullIndices[(k + 1) % n];
    const dx = positions[j][0] - positions[i][0];
    const dy = positions[j][1] - positions[i][1];
    const len = Math.sqrt(dx * dx + dy * dy);
    // Outward normal for CCW hull: rotate edge direction 90° clockwise
    // Edge direction = (dx, dy), outward = (dy, -dx) / len
    // Wait — for CCW hull, the outward normal is to the RIGHT of the edge direction
    // Edge from i to j: direction (dx, dy). Right normal = (dy, -dx).
    // But we need OUTWARD. For a CCW polygon, outward is to the right.
    normals.push([dy / len, -dx / len]);
  }

  const hx: number[] = [];
  const hy: number[] = [];

  for (let k = 0; k < n; k++) {
    const curr = hullIndices[k];
    const next = hullIndices[(k + 1) % n];
    const [cx, cy] = positions[curr];

    // Previous edge normal
    const prevK = (k - 1 + n) % n;
    const [pnx, pny] = normals[prevK];
    // Current edge normal
    const [cnx, cny] = normals[k];

    // Arc at vertex curr: from angle of prev normal to angle of curr normal (CCW)
    const angleStart = Math.atan2(pny, pnx);
    const angleEnd = Math.atan2(cny, cnx);

    // The arc should go CCW from angleStart to angleEnd
    // For a convex hull, the exterior angle is always ≤ π
    let a1 = angleStart;
    let a2 = angleEnd;
    while (a2 < a1) a2 += 2 * Math.PI;
    // If arc > 2π somehow, fix
    if (a2 - a1 > 2 * Math.PI) a2 -= 2 * Math.PI;

    const arc = arcPoints(cx, cy, r, a1, a2, Math.max(8, Math.ceil(20 * (a2 - a1) / Math.PI)));
    hx.push(...arc.x);
    hy.push(...arc.y);

    // Tangent segment from curr to next along current edge normal
    const t1x = cx + r * cnx;
    const t1y = cy + r * cny;
    const t2x = positions[next][0] + r * cnx;
    const t2y = positions[next][1] + r * cny;
    hx.push(t1x, t2x);
    hy.push(t1y, t2y);
  }

  // Close
  if (hx.length > 0) {
    hx.push(hx[0]);
    hy.push(hy[0]);
  }

  return { x: hx, y: hy };
}

/**
 * Normalize angle to [-π, π].
 */
function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Check if angle 'test' lies within the CCW arc from a1 to a2.
 * Assumes a2 > a1 (already normalized).
 */
function angleInArc(test: number, a1: number, a2: number): boolean {
  // Normalize test into [a1, a1 + 2π)
  let t = test;
  while (t < a1) t += 2 * Math.PI;
  while (t >= a1 + 2 * Math.PI) t -= 2 * Math.PI;
  return t <= a2 + 1e-9;
}

/**
 * Compute the hull boundary for collinear disk centers (stadium shape).
 * Two semicircles at the endpoints + two parallel tangent lines.
 */
function computeCollinearHullBoundary(
  positions: [number, number][],
  hullIndices: number[],
  r: number
): { x: number[]; y: number[] } {
  if (hullIndices.length < 2) return { x: [], y: [] };

  let maxDist = 0, endA = 0, endB = 1;
  for (let i = 0; i < hullIndices.length; i++) {
    for (let j = i + 1; j < hullIndices.length; j++) {
      const pi = positions[hullIndices[i]];
      const pj = positions[hullIndices[j]];
      const d = Math.sqrt((pj[0] - pi[0]) ** 2 + (pj[1] - pi[1]) ** 2);
      if (d > maxDist) {
        maxDist = d;
        endA = hullIndices[i];
        endB = hullIndices[j];
      }
    }
  }

  const [ax, ay] = positions[endA];
  const [bx, by] = positions[endB];

  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-15) return { x: [], y: [] };

  // Use exact angles — no atan2 roundtrips on computed points
  const dirAngle = Math.atan2(dy, dx);       // A→B direction
  const perpAngle = dirAngle + Math.PI / 2;  // left perpendicular

  const hx: number[] = [];
  const hy: number[] = [];

  // Build continuous path using angles directly:
  // topA, topB are at perpAngle from A and B
  // botB, botA are at perpAngle + π from B and A

  // 1. Top tangent: from A+perp to B+perp
  hx.push(ax + r * Math.cos(perpAngle), bx + r * Math.cos(perpAngle));
  hy.push(ay + r * Math.sin(perpAngle), by + r * Math.sin(perpAngle));

  // 2. Semicircle at B: CCW from perpAngle down through dirAngle to perpAngle - π
  //    = CCW from perpAngle to perpAngle - π, but arcPoints needs a2 > a1
  //    Going outward means sweeping through dirAngle.
  //    CCW from (perpAngle - π) to perpAngle sweeps through (dirAngle + π) = inward. Wrong.
  //    So we want: from perpAngle, sweep CCW by π, ending at perpAngle + π = -perpAngle + 2π
  //    But perpAngle + π = dirAngle + π/2 + π = dirAngle + 3π/2 ... that goes inward.
  //    
  //    Actually: at B, outward = dirAngle. perpAngle = dirAngle + π/2.
  //    From perpAngle, going CLOCKWISE through dirAngle to (dirAngle - π/2) = perpAngle - π.
  //    Clockwise = CW. arcPoints does CCW. So do CCW from (perpAngle - π) to perpAngle,
  //    but reversed — NO. Just generate the points manually.

  // Generate semicircle at B going from perpAngle CLOCKWISE to perpAngle - π
  // (through dirAngle, which is outward)
  const nArc = 40;
  for (let i = 1; i <= nArc; i++) {
    const t = perpAngle - (Math.PI * i) / nArc;  // clockwise sweep
    hx.push(bx + r * Math.cos(t));
    hy.push(by + r * Math.sin(t));
  }

  // 3. Bottom tangent: from B-perp to A-perp
  // Last arc point should already be at perpAngle - π = botB
  hx.push(ax + r * Math.cos(perpAngle - Math.PI));
  hy.push(ay + r * Math.sin(perpAngle - Math.PI));

  // 4. Semicircle at A: from (perpAngle - π) CLOCKWISE to perpAngle
  // (through dirAngle + π, which is outward from A)
  for (let i = 1; i <= nArc; i++) {
    const t = (perpAngle - Math.PI) - (Math.PI * i) / nArc;  // clockwise sweep
    hx.push(ax + r * Math.cos(t));
    hy.push(ay + r * Math.sin(t));
  }

  // 5. Close — last point should be at perpAngle - 2π = perpAngle, matching first point
  hx.push(hx[0]);
  hy.push(hy[0]);

  return { x: hx, y: hy };
}

// Color palette for contact edges (matching target: cyan, green, orange, ...)
const CONTACT_COLORS = [
  '#17becf', // cyan
  '#2ca02c', // green
  '#ff7f0e', // orange
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#bcbd22', // olive
  '#1f77b4', // blue
  '#7f7f7f', // gray
];

const DiskPlot: React.FC<DiskPlotProps> = ({
  config,
  showHull = true,
  showContacts = true,
}) => {
  const traces = useMemo(() => {
    const data: any[] = [];
    const r = config.radii[0];

    // 1. Draw each disk as a circle (thin gray outline, light gray fill) — FIRST so hull is on top
    for (let i = 0; i < config.n; i++) {
      const [cx, cy] = config.positions[i];
      const circle = circlePoints(cx, cy, r);
      data.push({
        x: circle.x,
        y: circle.y,
        mode: 'lines',
        type: 'scatter',
        line: { color: '#aaa', width: 1 },
        fill: 'toself',
        fillcolor: 'rgba(230,230,230,0.4)',
        name: 'Discos',
        legendgroup: 'discos',
        showlegend: i === 0,
        hoverinfo: 'skip',
      });
    }

    // 2. Contact edges (solid colored lines between centers)
    if (showContacts) {
      config.contacts.forEach(([i, j], idx) => {
        const color = CONTACT_COLORS[idx % CONTACT_COLORS.length];
        data.push({
          x: [config.positions[i][0], config.positions[j][0]],
          y: [config.positions[i][1], config.positions[j][1]],
          mode: 'lines',
          type: 'scatter',
          line: { color, width: 2 },
          name: 'Aristas de contacto',
          legendgroup: 'aristas',
          showlegend: idx === 0,
          hoverinfo: 'text',
          hovertext: `Contacto (${i}, ${j})`,
        });
      });
    }

    // 3. Hull boundary (thick dark outline) — drawn LAST so it's on top
    if (showHull) {
      const hull = convexHullIndices(config.positions);
      const collinear = isCollinear(config.positions, hull);

      let boundary: { x: number[]; y: number[] } | null = null;

      if (hull.length >= 3 && !collinear) {
        boundary = computeDiskHullBoundary(config.positions, hull, r);
      } else if (hull.length >= 2 && collinear) {
        boundary = computeCollinearHullBoundary(config.positions, hull, r);
      }

      if (boundary && boundary.x.length > 0) {
        data.push({
          x: boundary.x,
          y: boundary.y,
          mode: 'lines',
          type: 'scatter',
          line: { color: '#222', width: 2.5 },
          name: 'Hull de discos',
          legendgroup: 'hull',
          showlegend: true,
          hoverinfo: 'skip',
        });
      }
    }

    // 4. Centers as small black dots with number labels — on top of everything
    data.push({
      x: config.positions.map((p) => p[0]),
      y: config.positions.map((p) => p[1]),
      mode: 'markers+text',
      type: 'scatter',
      marker: { color: '#000', size: 5 },
      text: config.positions.map((_, i) => `${i}`),
      textposition: 'bottom left',
      textfont: { size: 11, color: '#333' },
      name: 'Centros',
      legendgroup: 'centros',
      showlegend: true,
      hoverinfo: 'text',
      hovertext: config.positions.map(
        (p, i) => `Disco ${i}: (${p[0].toFixed(4)}, ${p[1].toFixed(4)})`
      ),
    });

    return data;
  }, [config, showHull, showContacts]);

  return (
    <Plot
      data={traces}
      layout={{
        autosize: true,
        height: 600,
        margin: { t: 50, b: 50, l: 60, r: 20 },
        xaxis: {
          scaleanchor: 'y',
          scaleratio: 1,
          showgrid: true,
          gridcolor: '#e8e8e8',
          zeroline: false,
          dtick: 1,
        },
        yaxis: {
          showgrid: true,
          gridcolor: '#e8e8e8',
          zeroline: false,
          dtick: 0.5,
        },
        showlegend: true,
        legend: {
          x: 1,
          y: 0.9,
          xanchor: 'right',
          yanchor: 'top',
          bgcolor: 'rgba(255,255,255,0.9)',
          bordercolor: '#ddd',
          borderwidth: 1,
          font: { size: 12 },
        },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
      }}
      config={{
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false,
      }}
      style={{ width: '100%' }}
    />
  );
};

export default DiskPlot;

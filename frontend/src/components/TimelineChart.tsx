import type { Data, Shape } from 'plotly.js';

import type { Schedule } from '../api/types';
import { ACTIVITY_COLORS, PLOT_LAYOUT_BASE } from '../theme';
import Plot, { PLOT_CONFIG } from './Plot';

const ORDER = ['sleep', 'work', 'exercise', 'eva', 'meal', 'comms'];

/** 24 h Gantt: one row per astronaut, bars per activity, SAA passes as red bands. */
export function TimelineChart({ schedule, nowIso }: { schedule: Schedule; nowIso?: string }) {
  const rows = schedule.crew.map((c) => c.callsign);
  const data: Data[] = ORDER.map((act) => {
    const blocks = schedule.crew.flatMap((c) =>
      c.blocks.filter((b) => b.activity === act).map((b) => ({ ...b, callsign: c.callsign })));
    return {
      type: 'bar', orientation: 'h', name: act.toUpperCase(),
      y: blocks.map((b) => b.callsign),
      base: blocks.map((b) => b.start),
      x: blocks.map((b) => new Date(b.end).getTime() - new Date(b.start).getTime()),
      marker: {
        color: ACTIVITY_COLORS[act],
        line: { color: blocks.map((b) => (b.is_replanned ? '#22d3ee' : 'rgba(0,0,0,0.3)')),
                width: blocks.map((b) => (b.is_replanned ? 2.5 : 1)) },
      },
      customdata: blocks.map((b) => [b.start.slice(11, 16), b.end.slice(11, 16), b.reason ?? '']),
      hovertemplate: `<b>${act.toUpperCase()}</b> %{customdata[0]}-%{customdata[1]} UTC<br>%{customdata[2]}<extra>%{y}</extra>`,
    } as Data;
  });
  const shapes: Partial<Shape>[] = schedule.saa_passes.map((p) => ({
    type: 'rect', xref: 'x', yref: 'paper', x0: p.start, x1: p.end, y0: 0, y1: 1,
    fillcolor: 'rgba(211,47,47,0.28)', line: { width: 0 }, layer: 'above',
  }));
  if (nowIso) {
    shapes.push({ type: 'line', xref: 'x', yref: 'paper', x0: nowIso, x1: nowIso, y0: 0, y1: 1,
                  line: { color: '#22d3ee', width: 2, dash: 'dot' } });
  }
  return (
    <Plot
      data={data}
      layout={{
        ...PLOT_LAYOUT_BASE, barmode: 'overlay', height: 140 + rows.length * 70, shapes,
        margin: { l: 100, r: 20, t: 10, b: 60 },
        xaxis: { ...PLOT_LAYOUT_BASE.xaxis, type: 'date', tickformat: '%H:%M', title: { text: 'UTC' } },
        yaxis: { ...PLOT_LAYOUT_BASE.yaxis, categoryorder: 'array', categoryarray: [...rows].reverse() },
        bargap: 0.35,
      }}
      config={PLOT_CONFIG}
      style={{ width: '100%' }}
      useResizeHandler
    />
  );
}

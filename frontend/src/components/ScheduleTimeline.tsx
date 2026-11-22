import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';

import type { DiffEntry, Schedule, ScheduleBlock, Status } from '../api/types';
import { ACTIVITY_COLORS, ACTIVITY_LABEL, STATUS_TEXT, T, crewColor } from '../theme';
import { Label, fmtTime } from './ui';

export interface Selected { callsign: string; block: ScheduleBlock }

const ROW_H = 46;
const NAME_W = 132;

function hrs(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600e3;
}

/**
 * Custom 24 h crew timeline. SAA passes are vertical bands across all rows; re-planned
 * blocks carry an accent outline; when ``ghosts`` is on, each moved block's original
 * position is drawn as a dashed outline so the change is visible in place.
 */
export function ScheduleTimeline({ schedule, diff = [], nowIso, ghosts = true, status = {}, selected, onSelect }: {
  schedule: Schedule; diff?: DiffEntry[]; nowIso?: string; ghosts?: boolean; status?: Record<string, Status>;
  selected?: Selected | null; onSelect?: (s: Selected | null) => void;
}) {
  const all = schedule.crew.flatMap((c) => c.blocks);
  if (!all.length) return null;
  const t0 = Math.min(...all.map((b) => new Date(b.start).getTime()));
  const span = 24 * 3600e3;
  const x = (iso: string) => ((new Date(iso).getTime() - t0) / span) * 100;
  const w = (a: string, b: string) => ((new Date(b).getTime() - new Date(a).getTime()) / span) * 100;
  const ticks = Array.from({ length: 13 }, (_, i) => i * 2);
  const nowPos = nowIso ? x(nowIso) : -1;

  const ghostList = ghosts ? diff.filter((d) => d.from_start && d.from_end && (d.change === 'moved' || d.change === 'reassigned' || d.change === 'deferred')) : [];

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ minWidth: 760 }}>
        {/* hour axis */}
        <Box sx={{ display: 'grid', gridTemplateColumns: `${NAME_W}px 1fr`, mb: 0.5 }}>
          <Box />
          <Box sx={{ position: 'relative', height: 18 }}>
            {ticks.map((h) => (
              <Box key={h} className="mono" sx={{ position: 'absolute', left: `${(h / 24) * 100}%`, fontSize: 10.5, color: T.muted,
                                                  transform: h === 0 ? 'none' : h === 24 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
                {fmtTime(new Date(t0 + h * 3600e3).toISOString())}
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: `${NAME_W}px 1fr`, border: `1px solid ${T.line}`, borderRadius: 1, overflow: 'hidden' }}>
          {/* names */}
          <Box sx={{ borderRight: `1px solid ${T.line}`, bgcolor: T.panel }}>
            <Box sx={{ height: 24, borderBottom: `1px solid ${T.hairline}`, px: 1.5, display: 'flex', alignItems: 'center' }}>
              <Label>SAA passes</Label>
            </Box>
            {schedule.crew.map((c) => (
              <Box key={c.callsign} sx={{ height: ROW_H, display: 'flex', alignItems: 'center', gap: 1, px: 1.5,
                                         borderBottom: `1px solid ${T.hairline}` }}>
                <Box sx={{ width: 3, height: 22, bgcolor: crewColor(c.callsign), borderRadius: 0.5 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ fontSize: 12.5, fontWeight: 600 }}>{c.callsign}</Box>
                  {status[c.callsign] && (
                    <Box sx={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, color: STATUS_TEXT[status[c.callsign]] }}>
                      {status[c.callsign].toUpperCase()}
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Box>

          {/* lanes */}
          <Box sx={{ position: 'relative', bgcolor: T.bg }} onClick={() => onSelect?.(null)}>
            {/* grid */}
            {ticks.map((h) => (
              <Box key={h} sx={{ position: 'absolute', top: 0, bottom: 0, left: `${(h / 24) * 100}%`, width: '1px', bgcolor: T.hairline }} />
            ))}
            {/* SAA bands */}
            {schedule.saa_passes.map((p) => (
              <Tooltip key={p.start} arrow title={`SAA pass ${fmtTime(p.start)}-${fmtTime(p.end)}Z · peak ${p.peak_intensity.toFixed(2)}`}>
                <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `${x(p.start)}%`, width: `${Math.max(0.35, w(p.start, p.end))}%`,
                           bgcolor: `rgba(211,47,47,${0.1 + p.peak_intensity * 0.18})`,
                           borderLeft: '1px solid rgba(255,107,102,.45)', borderRight: '1px solid rgba(255,107,102,.45)', zIndex: 1 }} />
              </Tooltip>
            ))}
            <Box sx={{ height: 24, borderBottom: `1px solid ${T.hairline}`, position: 'relative' }}>
              {schedule.saa_passes.map((p) => (
                <Box key={p.start} className="mono" sx={{ position: 'absolute', left: `${x(p.start)}%`, top: 5, fontSize: 9.5,
                                                          color: STATUS_TEXT.red, zIndex: 2, pl: 0.4 }}>
                  {p.peak_intensity.toFixed(1)}
                </Box>
              ))}
            </Box>

            {schedule.crew.map((c) => (
              <Box key={c.callsign} sx={{ position: 'relative', height: ROW_H, borderBottom: `1px solid ${T.hairline}` }}>
                {/* ghosts: original positions of moved blocks */}
                {ghostList.filter((g) => (g.from_callsign ?? g.callsign) === c.callsign).map((g, i) => (
                  <Tooltip key={`g${i}`} arrow title={`Originally: ${ACTIVITY_LABEL[g.activity]} ${fmtTime(g.from_start)}-${fmtTime(g.from_end)}Z (${g.change})`}>
                    <Box sx={{ position: 'absolute', top: 6, height: ROW_H - 12, left: `${x(g.from_start!)}%`, width: `${w(g.from_start!, g.from_end!)}%`,
                               border: `1.5px dashed ${ACTIVITY_COLORS[g.activity]}`, borderRadius: 0.75, zIndex: 4,
                               display: 'flex', alignItems: 'center', px: 0.75, overflow: 'hidden', bgcolor: 'rgba(10,12,15,.55)' }}>
                      <Box sx={{ fontSize: 10.5, color: ACTIVITY_COLORS[g.activity], fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {ACTIVITY_LABEL[g.activity]} was here
                      </Box>
                    </Box>
                  </Tooltip>
                ))}
                {c.blocks.map((b) => {
                  const isSel = selected?.callsign === c.callsign && selected.block.start === b.start && selected.block.activity === b.activity;
                  const width = w(b.start, b.end);
                  const isEva = b.activity === 'eva';
                  return (
                    <Tooltip key={b.start + b.activity} arrow placement="top" title={
                      <Box>
                        <Box sx={{ fontWeight: 600 }}>{ACTIVITY_LABEL[b.activity]} · {c.callsign}</Box>
                        <Box className="mono" sx={{ color: T.text2 }}>{fmtTime(b.start)}-{fmtTime(b.end)}Z · {hrs(b.start, b.end).toFixed(1)} h</Box>
                        {b.reason && <Box sx={{ mt: 0.5, color: T.text2 }}>{b.reason}</Box>}
                      </Box>
                    }>
                      <Box onClick={(e) => { e.stopPropagation(); onSelect?.({ callsign: c.callsign, block: b }); }}
                           data-testid={isEva ? 'eva-block' : undefined}
                           sx={{
                             position: 'absolute', top: 6, height: ROW_H - 12, left: `calc(${x(b.start)}% + 1px)`,
                             width: `calc(${width}% - 2px)`, bgcolor: ACTIVITY_COLORS[b.activity], borderRadius: 0.75,
                             zIndex: isEva ? 3 : 2, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', px: 0.75,
                             outline: isSel ? `2px solid ${T.text}` : b.is_replanned ? `1.5px solid ${T.accent}` : 'none',
                             outlineOffset: -1, transition: 'filter 120ms', '&:hover': { filter: 'brightness(1.35)' },
                             boxShadow: isEva ? '0 0 0 1px rgba(0,0,0,.4), 0 0 18px rgba(201,133,0,.35)' : 'none',
                           }}>
                        {width > 4 && (
                          <Box sx={{ fontSize: 11, fontWeight: isEva ? 700 : 500, whiteSpace: 'nowrap',
                                     color: isEva ? '#1a1200' : 'rgba(230,232,235,.82)' }}>
                            {ACTIVITY_LABEL[b.activity]}{width > 9 && <Box component="span" className="mono" sx={{ opacity: 0.7, ml: 0.75, fontSize: 10 }}>{fmtTime(b.start)}</Box>}
                          </Box>
                        )}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            ))}

            {nowPos >= 0 && nowPos <= 100 && (
              <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `${nowPos}%`, width: '2px', bgcolor: T.accent, zIndex: 6, pointerEvents: 'none' }}>
                <Box className="mono" sx={{ position: 'absolute', top: 3, left: 4, fontSize: 9.5, color: T.accent, fontWeight: 600 }}>NOW</Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * DEV-206: reusable form stepper in the site style — a "road" that zig-zags between the steps
 * (thick navy track with 45° bends, on a dotted background), inspired by a winding-path diagram.
 *  - The orange lane inside the track grows smoothly up to the current step.
 *  - Done steps: orange dots. Current step: white ring with a soft orange pulse. Upcoming: white dots.
 *  - The last step is a large circle that fills orange when every step is done.
 *  - Labels "01 …" sit above the upper stops and below the lower ones; the road runs with the page
 *    direction (AR/EN). Animations are switched off for people who prefer reduced motion.
 *
 * @param {{ id: string, label: string }[]} steps
 * @param {number} current      index of the current step; steps.length means every step is done
 * @param {(index: number) => void} [onStepClick]  optional: reached steps become buttons
 * @param {string} [label]       accessible name
 */


const LABEL_H = 22; // label line height
const GAP = 8; // space between a label and its stop

function geometry(width, count, rtl) {
  const narrow = width < 480;
  const amp = narrow ? 22 : 32; // height difference between upper and lower stops
  const pad = narrow ? 22 : 34;
  const bigR = narrow ? 15 : 19; // last stop
  // Room kept between a label and its stop, so the text never touches the circle.
  const clearOf = (i) => (i === count - 1 ? bigR + 2 : 16);
  const yTop = LABEL_H + GAP + bigR + 2;
  const yBottom = yTop + amp;
  const height = yBottom + bigR + 2 + GAP + LABEL_H + 2;
  const span = Math.max(width - pad * 2, 1);
  const pts = Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = rtl ? width - pad - t * span : pad + t * span;
    return { x, y: i % 2 === 0 ? yTop : yBottom };
  });
  // Each leg: flat, a 45° bend in the middle, flat.
  let d = `M ${pts[0].x} ${pts[0].y}`;
  const cum = [0];
  for (let i = 1; i < count; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const dir = Math.sign(b.x - a.x) || 1;
    const mid = (a.x + b.x) / 2;
    const half = Math.abs(b.y - a.y) / 2;
    d += ` L ${mid - dir * half} ${a.y} L ${mid + dir * half} ${b.y} L ${b.x} ${b.y}`;
    const flat = Math.abs(b.x - a.x) - 2 * half;
    cum.push(cum[i - 1] + flat + Math.hypot(2 * half, b.y - a.y));
  }
  // road and orange lane widths
  return { pts, d, cum, height, narrow, bigR, clearOf, track: narrow ? 14 : 18, lane: narrow ? 4 : 5 };
}

const PULSE = { transformBox: 'fill-box', transformOrigin: 'center' };

export function Stepper({ steps, current, onStepClick, label, className = '' }) {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language?.startsWith('ar');
  const boxRef = useRef(null);
  const [width, setWidth] = useState(600);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width) || 600);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = steps.length;
  const allDone = current >= total;
  const shown = Math.min(current, total - 1);
  const { pts, d, cum, height, narrow, bigR, clearOf, track, lane } = geometry(width, total, rtl);
  const fullLen = cum[cum.length - 1] || 1;
  const progress = allDone ? 1 : cum[shown] / fullLen;
  const statusOf = (i) => (i < current ? 'complete' : i === current ? 'current' : 'upcoming');

  return (
    <nav aria-label={label || t('stepper.label')} className={className} data-testid="stepper">
      {/* Spoken summary for screen readers */}
      <p className="sr-only" aria-live="polite">
        {allDone ? t('stepper.done') : `${t('stepper.stepOf', { current: shown + 1, total })}: ${steps[shown].label}`}
      </p>

      <div
        ref={boxRef}
        className="relative w-full select-none"
        style={{
          height,
          backgroundImage: 'radial-gradient(hsl(var(--border)) 1px, transparent 1.3px)',
          backgroundSize: '14px 14px',
          backgroundPosition: 'center',
        }}
      >
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {/* road */}
          <path d={d} fill="none" stroke="currentColor" className="text-brand-navy" strokeWidth={track} strokeLinecap="round" strokeLinejoin="miter" />
          {/* orange lane, drawn up to the current stop */}
          <path
            d={d}
            fill="none"
            stroke="currentColor"
            className="text-brand-orange transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
            strokeWidth={lane}
            strokeLinecap="round"
            strokeLinejoin="miter"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - progress}
          />
          {pts.map((p, i) => {
            const status = statusOf(i);
            if (i === total - 1) {
              const r = bigR;
              return (
                <g key={steps[i].id}>
                  {status === 'current' && (
                    <circle cx={p.x} cy={p.y} r={r + 4} className="fill-brand-orange/30 animate-ping motion-reduce:animate-none" style={PULSE} />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    strokeWidth={4}
                    className={`transition-colors duration-500 ${
                      status === 'complete'
                        ? 'fill-brand-orange stroke-brand-orange'
                        : status === 'current'
                        ? 'fill-white stroke-brand-orange'
                        : 'fill-white stroke-brand-navy'
                    }`}
                  />
                </g>
              );
            }
            if (status === 'current') {
              return (
                <g key={steps[i].id}>
                  <circle cx={p.x} cy={p.y} r={16} className="fill-brand-orange/30 animate-ping motion-reduce:animate-none" style={PULSE} />
                  <circle cx={p.x} cy={p.y} r={13} strokeWidth={6} className="fill-white stroke-brand-navy" />
                  <circle cx={p.x} cy={p.y} r={4} className="fill-brand-orange" />
                </g>
              );
            }
            return (
              <circle
                key={steps[i].id}
                cx={p.x}
                cy={p.y}
                r={status === 'complete' ? 6.5 : 5}
                strokeWidth={status === 'complete' ? 2 : 0}
                className={`transition-all duration-500 ${status === 'complete' ? 'fill-brand-orange stroke-white' : 'fill-white'}`}
              />
            );
          })}
        </svg>

        {/* Labels (buttons for reached steps), placed on their stops */}
        <ol className="absolute inset-0">
          {steps.map((step, i) => {
            const status = statusOf(i);
            const p = pts[i];
            const upper = p.y < height / 2;
            const edge = i === 0 ? 'first' : i === total - 1 ? 'last' : 'mid';
            // Middle labels are centred on their stop; the first and last stay inside the box.
            const shift = edge === 'mid' ? '-50%' : (edge === 'first') !== rtl ? '-22px' : 'calc(-100% + 22px)';
            const clear = clearOf(i);
            const style = {
              left: p.x,
              top: upper ? 0 : p.y - clear,
              height: upper ? p.y + clear : height - (p.y - clear),
              transform: `translateX(${shift})`,
            };
            const cls = `absolute flex ${upper ? 'flex-col' : 'flex-col-reverse'} justify-between items-center rounded-xl px-1`;
            const body = (
              <>
                <span
                  className={`inline-flex items-baseline gap-1.5 whitespace-nowrap rounded-md bg-background px-1.5 ${narrow ? 'text-[11px]' : 'text-xs'} font-semibold transition-colors duration-500 ${
                    status === 'current' ? 'text-brand-orange-700' : status === 'complete' ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span className="font-mono text-brand-orange-700" dir="ltr">{String(i + 1).padStart(2, '0')}</span>
                  {step.label}
                  <span className="sr-only"> ({t(`stepper.status.${status}`)})</span>
                </span>
                {/* covers the stop so it can be clicked too */}
                <span aria-hidden="true" className="block shrink-0" style={{ width: clear * 2, height: clear * 2 + GAP }} />
              </>
            );
            const clickable = Boolean(onStepClick) && status !== 'upcoming';
            return (
              <li key={step.id} data-status={status} aria-current={status === 'current' ? 'step' : undefined}>
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => onStepClick(i)}
                    className={`${cls} cursor-pointer hover:opacity-80 focus-visible:outline-2 focus-visible:outline-brand-orange`}
                    style={style}
                  >
                    {body}
                  </button>
                ) : (
                  <div className={cls} style={style}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

export default Stepper;

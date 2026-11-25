import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * DEV-206: reusable form stepper in the site style.
 * Shows where the visitor is in a multi-step form: done steps in navy with a check, the current step in
 * brand orange, upcoming steps muted. Works in AR/EN (follows the page direction).
 *  - sm and up: numbered circles with labels, joined by a line that fills as steps are done.
 *  - phones: a compact "Step 2 of 3 · label" with a progress bar.
 *
 * @param {{ id: string, label: string }[]} steps
 * @param {number} current      index of the current step; steps.length means every step is done
 * @param {(index: number) => void} [onStepClick]  optional: lets the visitor jump to a step (e.g. scroll)
 * @param {string} [label]       accessible name of the list
 */
export function Stepper({ steps, current, onStepClick, label, className = '' }) {
  const { t } = useTranslation();
  const total = steps.length;
  const allDone = current >= total;
  const shown = Math.min(current, total - 1);
  // Bar shows the current step as started: 3 steps → 25% / 50% / 75%, 100% when all are done.
  const percent = allDone ? 100 : Math.round(((current + 1) / (total + 1)) * 100);

  return (
    <nav aria-label={label || t('stepper.label')} className={className} data-testid="stepper">
      {/* Phones: compact summary */}
      <div className="sm:hidden space-y-2" aria-hidden="true">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-brand-orange">
            {allDone ? t('stepper.done') : t('stepper.stepOf', { current: shown + 1, total })}
          </span>
          <span className="text-foreground">{steps[shown].label}</span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-brand-orange transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {/* Full list (visible from sm; kept for screen readers on phones) */}
      <ol className="sr-only sm:not-sr-only sm:flex items-start">
        {steps.map((step, i) => {
          const status = i < current ? 'complete' : i === current ? 'current' : 'upcoming';
          const clickable = Boolean(onStepClick) && status !== 'upcoming';
          const circle = (
            <span
              className={`flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-bold shrink-0 transition-colors ${
                status === 'complete'
                  ? 'bg-brand-navy border-brand-navy text-white'
                  : status === 'current'
                  ? 'bg-brand-orange border-brand-orange text-black shadow-md shadow-brand-orange/30'
                  : 'bg-background border-border text-muted-foreground'
              }`}
            >
              {status === 'complete' ? <Check className="w-4 h-4" aria-hidden="true" /> : i + 1}
            </span>
          );
          const text = (
            <span
              className={`mt-2 text-xs font-semibold text-center leading-snug ${
                status === 'current' ? 'text-brand-orange' : status === 'complete' ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {step.label}
              <span className="sr-only">
                {' '}({t(`stepper.status.${status}`)})
              </span>
            </span>
          );
          return (
            <li
              key={step.id}
              data-status={status}
              aria-current={status === 'current' ? 'step' : undefined}
              className="relative flex-1 flex flex-col items-center min-w-0"
            >
              {/* connector to the previous step */}
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-[18px] end-1/2 w-full h-0.5 ${i <= current ? 'bg-brand-navy' : 'bg-border'}`}
                  style={{ marginInlineEnd: '18px', width: 'calc(100% - 36px)' }}
                />
              )}
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick(i)}
                  className="relative z-10 flex flex-col items-center rounded-xl px-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-orange"
                >
                  {circle}
                  {text}
                </button>
              ) : (
                <div className="relative z-10 flex flex-col items-center px-2">
                  {circle}
                  {text}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Stepper;

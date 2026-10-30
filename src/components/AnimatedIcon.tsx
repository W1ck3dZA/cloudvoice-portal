import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import './motion.css';

/**
 * A Lucide icon with one of our approved motions. Pass the icon component itself, so only the icons you import
 * are bundled:
 *
 *   import { Phone } from 'lucide-react';
 *   <button className="iconbtn" aria-label="Call"><AnimatedIcon icon={Phone} animation="wiggle" /></button>
 *
 * Do NOT use the `name="..."` API of the motion-icons-react package: it pulls the whole Lucide library
 * (about 840 KB minified) into the bundle. This component does the same job with our own motion.css.
 *
 * Rules (full list in references/motion-icons.md):
 *  - Decorative by default (aria-hidden); the control around it carries the accessible name. Pass `label` only
 *    when the icon stands alone and means something.
 *  - One-shot motions play on hover (mouse only), keyboard focus-visible, or click, listening on the nearest
 *    button or link, so the whole control reacts, not just the glyph.
 *  - Loops (spin, pulse, ping) are for loading and live states. Drive them with `active`.
 *  - Stroke is 1.8px like our other icons. Reduced motion is handled in motion.css.
 */
export type IconAnimation =
  | 'nudge'
  | 'press'
  | 'pop'
  | 'success'
  | 'wiggle'
  | 'swing'
  | 'shake'
  | 'turn'
  | 'spin'
  | 'pulse'
  | 'ping';
export type IconTrigger = 'hover' | 'click' | 'focus' | 'always' | 'none';

const LOOPS: ReadonlySet<IconAnimation> = new Set(['spin', 'pulse', 'ping']);

export type AnimatedIconProps = {
  icon: LucideIcon;
  size?: number;
  animation?: IconAnimation;
  /** Default: 'always' for loops, 'hover' for everything else. */
  trigger?: IconTrigger;
  /** Controlled mode: play (or stop) the animation from state, e.g. `animation="spin" active={loading}`. */
  active?: boolean;
  /** Accessible name when the icon stands alone. Leave out when a button or link around it already has one. */
  label?: string;
  className?: string;
};

export function AnimatedIcon({
  icon: Icon,
  size = 22,
  animation,
  trigger,
  active,
  label,
  className,
}: AnimatedIconProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);
  const loop = animation ? LOOPS.has(animation) : false;
  const mode: IconTrigger = trigger ?? (loop ? 'always' : 'hover');

  useEffect(() => {
    const el = ref.current;
    if (
      !animation ||
      !el ||
      active !== undefined ||
      mode === 'always' ||
      mode === 'none'
    )
      return;
    const host =
      el.closest<HTMLElement>('button, a, [role="button"], label') ?? el;
    const play = () => setPlaying(true);
    const onFocus = () => {
      if (host.matches(':focus-visible')) play();
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') play();
    };
    if (mode === 'hover') {
      host.addEventListener('pointerenter', onEnter);
      host.addEventListener('focusin', onFocus);
    }
    if (mode === 'focus') host.addEventListener('focusin', onFocus);
    if (mode === 'click') host.addEventListener('click', play);
    return () => {
      host.removeEventListener('pointerenter', onEnter);
      host.removeEventListener('focusin', onFocus);
      host.removeEventListener('click', play);
    };
  }, [animation, mode, active]);

  const on = !!animation && (active ?? (mode === 'always' || playing));
  const cls = ['mi', on ? `mi-${animation}` : '', className]
    .filter(Boolean)
    .join(' ');
  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const };

  return (
    <span
      ref={ref}
      className={cls}
      onAnimationEnd={() => {
        if (!loop) setPlaying(false);
      }}
      {...a11y}
    >
      <Icon size={size} strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}

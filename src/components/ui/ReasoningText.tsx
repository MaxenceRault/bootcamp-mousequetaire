"use client";

// Adapté de beui.dev (components/agents/loading-states) : variante « cascade », loader ASCII et reflet réécrits ici.
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useEffect, useId, useState, useSyncExternalStore } from "react";

const CASCADE_STAGGER = 0.025;
const SPRING = {
  type: "spring",
  stiffness: 520,
  damping: 34,
  mass: 0.6,
} as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const LOADER_FRAMES = ["|", "/", "-", "\\"];
const LOADER_INTERVAL_MS = 120;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Préférence « réduire les animations ». Côté serveur : false, puis mise à jour après l'hydratation (pas d'incohérence).
function useReducedMotionPreference() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

// Reflet qui balaie le texte (animation text-shimmer de globals.css), couleurs des tokens.
const SHIMMER_CLASS_NAME =
  "bg-[linear-gradient(90deg,var(--color-ink-soft)_35%,var(--color-ink)_50%,var(--color-ink-soft)_65%)] bg-size-[250%_100%] bg-clip-text text-transparent motion-safe:animate-text-shimmer";

function AsciiLoader({ reduce }: { reduce: boolean }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timer = window.setInterval(
      () => setFrame((current) => (current + 1) % LOADER_FRAMES.length),
      LOADER_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [reduce]);

  return <span className="font-mono text-label-md text-ink-soft">{LOADER_FRAMES[frame]}</span>;
}

function CascadePhrase({ phrase, reduce }: { phrase: string; reduce: boolean }) {
  const text = `${phrase}…`;

  if (reduce) {
    return (
      <span className={`col-start-1 row-start-1 self-center justify-self-start ${SHIMMER_CLASS_NAME}`}>{text}</span>
    );
  }

  // Lettres animées une par une, regroupées par mot : le retour à la ligne (mobile) ne coupe jamais un mot.
  const words = text.split(" ");
  const wordStarts = words.map((_, wordIndex) => words.slice(0, wordIndex).join(" ").length + (wordIndex > 0 ? 1 : 0));

  return (
    <AnimatePresence initial={false}>
      <motion.span
        key={phrase}
        className="col-start-1 row-start-1 self-center justify-self-start"
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {words.map((word, wordIndex) => (
          <Fragment key={wordIndex}>
            {wordIndex > 0 && " "}
            <span className="inline-block whitespace-nowrap">
              {word.split("").map((character, letterIndex) => (
                <motion.span
                  // La position du caractère est son identité stable dans la cascade.
                  key={letterIndex}
                  custom={(wordStarts[wordIndex] + letterIndex) * CASCADE_STAGGER}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={{
                    initial: { opacity: 0, y: "100%" },
                    animate: (delay: number) => ({
                      opacity: 1,
                      y: "0%",
                      transition: { ...SPRING, delay },
                    }),
                    exit: (delay: number) => ({
                      opacity: 0,
                      y: "-100%",
                      transition: {
                        duration: 0.14,
                        ease: EASE_OUT,
                        delay: delay * 0.45,
                      },
                    }),
                  }}
                  className={`inline-block whitespace-pre will-change-[opacity,transform] ${SHIMMER_CLASS_NAME}`}
                >
                  {character}
                </motion.span>
              ))}
            </span>
          </Fragment>
        ))}
      </motion.span>
    </AnimatePresence>
  );
}

function shuffled(items: number[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// L'IA travaille : phrases qui défilent en cascade, avec un reflet. Phrases traduites (messages/fr.json).
// shuffle : la 1re phrase reste fixe, les suivantes sont tirées au hasard.
export function ReasoningText({
  phrases,
  interval = 1800,
  shuffle = true,
  className = "",
}: {
  phrases: string[];
  interval?: number;
  shuffle?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotionPreference();
  const [index, setIndex] = useState(0);
  const statusId = useId();
  const phrase = phrases[index] ?? "";
  const longestPhrase = phrases.reduce((longest, current) => (current.length > longest.length ? current : longest), "");

  useEffect(() => {
    if (phrases.length < 2) return;
    // Hasard tiré ici (navigateur, après l'affichage) : le rendu serveur reste identique au client (hydratation).
    const rest = phrases.slice(1).map((_, i) => i + 1);
    const order = [0, ...(shuffle ? shuffled(rest) : rest)];
    let position = 0;
    const timer = window.setInterval(
      () => {
        position = (position + 1) % order.length;
        setIndex(order[position]);
      },
      Math.max(600, interval),
    );
    return () => window.clearInterval(timer);
  }, [interval, phrases, shuffle]);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-labelledby={statusId}
      className={`inline-flex max-w-full items-center gap-2 text-body-sm font-medium text-ink-soft ${className}`}
    >
      {/* Phrase centrée dans la place réservée (self-center) et loader centré : alignés, et centrés dans la bulle. */}
      <span aria-hidden="true" className="inline-flex h-[1lh] w-3 shrink-0 items-center justify-center">
        <AsciiLoader reduce={reduce} />
      </span>

      {/* La phrase la plus longue, invisible, réserve la place : rien ne bouge autour pendant le défilement. */}
      <span aria-hidden="true" className="grid min-w-0 overflow-hidden text-left">
        <span className="invisible col-start-1 row-start-1">{`${longestPhrase}…`}</span>
        <CascadePhrase phrase={phrase} reduce={reduce} />
      </span>

      <span id={statusId} className="sr-only">
        {phrase}
      </span>
    </span>
  );
}

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Item {
  num: string;
  title: string;
  text: string;
}

interface Props {
  items: Item[];
}

export default function ProgramAccordion({ items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <ol className="space-y-px overflow-hidden rounded-2xl border border-ink/10 bg-cream">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <li key={i} className="relative bg-cream transition-colors hover:bg-white">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full cursor-pointer items-center gap-6 px-8 py-7 text-left md:gap-10 md:px-10 md:py-8"
              aria-expanded={isOpen}
            >
              <span className="font-display text-xl text-gold-deep md:text-2xl">{item.num}</span>
              <span className="flex-1 font-display text-xl leading-tight md:text-2xl">
                {item.title}
              </span>
              <motion.span
                animate={{
                  rotate: isOpen ? 45 : 0,
                  backgroundColor: isOpen ? 'rgb(232, 201, 135)' : 'transparent',
                  borderColor: isOpen ? 'rgb(201, 162, 90)' : 'rgba(11, 10, 18, 0.2)',
                }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.3, ease: 'easeOut' },
                  }}
                  className="overflow-hidden"
                >
                  <motion.div
                    initial={{ y: -10 }}
                    animate={{ y: 0 }}
                    exit={{ y: -10 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="border-t border-ink/5 bg-cream-soft px-8 py-7 text-ink-muted md:px-10"
                  >
                    <p className="max-w-2xl leading-relaxed">{item.text}</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ol>
  );
}

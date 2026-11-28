import React, { useEffect, useMemo, useRef, useState } from 'react';

interface TraitTextProps {
  text: string;
  extraNote?: string;
  className?: string;
  style?: React.CSSProperties;
}

function splitTraitText(raw: string): { base: string; notes: string[] } {
  const notes: string[] = [];
  const cleaned = raw
    .replace(/\s*\(([^)]+)\)/g, (_m, inner: string) => {
      const trimmed = inner.trim();
      if (trimmed) notes.push(trimmed);
      return '';
    })
    .replace(/\s*\[([^\]]+)\]/g, (_m, inner: string) => {
      const trimmed = inner.trim();
      if (trimmed) notes.push(trimmed);
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    base: cleaned || raw,
    notes,
  };
}

export const TraitText: React.FC<TraitTextProps> = ({
  text,
  extraNote,
  className,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  const { base, allNotes } = useMemo(() => {
    const parsed = splitTraitText(text);
    const list = [...parsed.notes];
    if (extraNote?.trim()) {
      list.push(extraNote.trim());
    }
    return { base: parsed.base, allNotes: list };
  }, [text, extraNote]);

  useEffect(() => {
    if (!open && !pinned) return;

    const handleDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, pinned]);

  if (allNotes.length === 0) {
    return (
      <span className={className} style={style}>
        {base}
      </span>
    );
  }

  return (
    <span
      ref={wrapRef}
      className={`trait-hint-wrap ${className ?? ''}`.trim()}
      style={style}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
    >
      <span>{base}</span>
      <button
        type="button"
        className="trait-hint-btn"
        aria-label="Показать пояснение"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((prev) => {
            const next = !prev;
            setOpen(next);
            return next;
          });
        }}
      >
        !
      </button>
      {open && (
        <span
          className="trait-hint-popover"
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
        >
          {allNotes.map((note, idx) => (
            <div key={idx} style={{ marginTop: idx > 0 ? 4 : 0 }}>
              {note}
            </div>
          ))}
        </span>
      )}
    </span>
  );
};

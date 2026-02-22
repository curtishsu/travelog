'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ParagraphDraft = {
  id: string;
  text: string;
  isStory: boolean;
};

type JournalParagraphEditorProps = {
  paragraphs: ParagraphDraft[];
  onChange: (next: ParagraphDraft[]) => void;
};

function createParagraphId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `paragraph-${Math.random().toString(36).slice(2, 10)}`;
}

function hasStoryCommandPrefix(text: string) {
  return /^\s*(\/story|\[story\])\s+/i.test(text);
}

function stripStoryCommandPrefix(text: string) {
  return text.replace(/^(\s*)(\/story|\[story\])\s+/i, '$1');
}

export function splitJournalEntryToParagraphs(journalEntry: string | null | undefined): ParagraphDraft[] {
  const text = journalEntry?.replace(/\r\n/g, '\n').trim();
  if (!text) {
    return [];
  }

  return text
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => ({
      id: createParagraphId(),
      text: value,
      isStory: false
    }));
}

export function joinParagraphsToJournalEntry(paragraphs: ParagraphDraft[]): string {
  return paragraphs
    .map((paragraph) => paragraph.text)
    .filter((paragraph) => paragraph.length > 0)
    .join('\n\n');
}

export function normalizeServerParagraphs(
  paragraphs: Array<{ id: string; position: number; text: string; is_story: boolean }> | undefined,
  journalEntry: string | null | undefined
): ParagraphDraft[] {
  if (paragraphs?.length) {
    return [...paragraphs]
      .sort((a, b) => a.position - b.position)
      .map((paragraph) => ({
        id: paragraph.id,
        text: stripStoryCommandPrefix(paragraph.text),
        isStory: paragraph.is_story || hasStoryCommandPrefix(paragraph.text)
      }));
  }
  return splitJournalEntryToParagraphs(journalEntry);
}

export function JournalParagraphEditor({ paragraphs, onChange }: JournalParagraphEditorProps) {
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; caret: number } | null>(null);
  const inputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    const node = inputRefs.current[focusRequest.id];
    if (!node) {
      return;
    }
    node.focus();
    node.setSelectionRange(focusRequest.caret, focusRequest.caret);
    setFocusRequest(null);
  }, [focusRequest, paragraphs]);

  const activeParagraph = useMemo(
    () => paragraphs.find((paragraph) => paragraph.id === activeParagraphId) ?? null,
    [paragraphs, activeParagraphId]
  );

  function setParagraphText(id: string, text: string) {
    onChange(paragraphs.map((paragraph) => (paragraph.id === id ? { ...paragraph, text } : paragraph)));
  }

  function toggleParagraphStory(id: string) {
    onChange(
      paragraphs.map((paragraph) =>
        paragraph.id === id ? { ...paragraph, isStory: !paragraph.isStory } : paragraph
      )
    );
  }

  function addParagraphAfter(index: number) {
    const paragraph: ParagraphDraft = { id: createParagraphId(), text: '', isStory: false };
    const next = [...paragraphs];
    next.splice(index + 1, 0, paragraph);
    onChange(next);
    setFocusRequest({ id: paragraph.id, caret: 0 });
  }

  function handleParagraphKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    paragraph: ParagraphDraft,
    index: number
  ) {
    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? 0;

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const before = paragraph.text.slice(0, selectionStart);
      const after = paragraph.text.slice(selectionEnd);
      const first = { ...paragraph, text: before };
      const second: ParagraphDraft = { id: createParagraphId(), text: after, isStory: false };
      const next = [...paragraphs];
      next.splice(index, 1, first, second);
      onChange(next);
      setFocusRequest({ id: second.id, caret: 0 });
      return;
    }

    if (event.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0 && index > 0) {
      event.preventDefault();
      const previous = paragraphs[index - 1];
      const mergedText = `${previous.text}${paragraph.text}`;
      const merged = {
        ...previous,
        text: mergedText,
        isStory: previous.isStory || paragraph.isStory
      };
      const next = [...paragraphs];
      next.splice(index - 1, 2, merged);
      onChange(next);
      setFocusRequest({ id: merged.id, caret: previous.text.length });
      return;
    }

    if (
      event.key === 'Delete' &&
      selectionStart === paragraph.text.length &&
      selectionEnd === paragraph.text.length &&
      index < paragraphs.length - 1
    ) {
      event.preventDefault();
      const nextParagraph = paragraphs[index + 1];
      const mergedText = `${paragraph.text}${nextParagraph.text}`;
      const merged = {
        ...paragraph,
        text: mergedText,
        isStory: paragraph.isStory || nextParagraph.isStory
      };
      const next = [...paragraphs];
      next.splice(index, 2, merged);
      onChange(next);
      setFocusRequest({ id: merged.id, caret: paragraph.text.length });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Press Enter to split paragraphs. Backspace/Delete at boundaries merges paragraphs.
        </p>
        <button
          type="button"
          className="text-xs font-medium text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
          onClick={() => addParagraphAfter(paragraphs.length - 1)}
        >
          Add paragraph
        </button>
      </div>
      {paragraphs.map((paragraph, index) => (
        <div
          key={paragraph.id}
          className={`rounded-2xl border p-3 transition ${
            paragraph.isStory
              ? 'border-brand/70 bg-brand/5 shadow-[inset_3px_0_0_rgba(78,172,255,0.8)]'
              : 'border-slate-800 bg-slate-950'
          }`}
        >
          <textarea
            ref={(node) => {
              inputRefs.current[paragraph.id] = node;
            }}
            value={paragraph.text}
            onChange={(event) => setParagraphText(paragraph.id, event.target.value)}
            onKeyDown={(event) => handleParagraphKeyDown(event, paragraph, index)}
            onMouseUp={(event) => {
              if (event.currentTarget.selectionStart !== event.currentTarget.selectionEnd) {
                setActiveParagraphId(paragraph.id);
              }
            }}
            onTouchEnd={() => {
              setActiveParagraphId(paragraph.id);
            }}
            onClick={() => setActiveParagraphId(paragraph.id)}
            rows={Math.max(3, paragraph.text.split('\n').length)}
            className="w-full resize-none border-none bg-transparent text-sm leading-relaxed text-white outline-none"
            placeholder={index === 0 ? 'Write everything you want to remember.' : 'Continue your journal...'}
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              className="text-xs font-medium text-slate-400 underline-offset-4 transition hover:text-white hover:underline"
              onClick={() => toggleParagraphStory(paragraph.id)}
            >
              {paragraph.isStory ? 'Unmark' : 'Mark as Story'}
            </button>
            <button
              type="button"
              className="text-xs font-medium text-slate-500 underline-offset-4 transition hover:text-slate-300 hover:underline"
              onClick={() => addParagraphAfter(index)}
            >
              Split below
            </button>
          </div>
        </div>
      ))}
      {activeParagraph ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
          Active paragraph action:{' '}
          <button
            type="button"
            className="font-medium text-white underline-offset-4 hover:underline"
            onClick={() => toggleParagraphStory(activeParagraph.id)}
          >
            {activeParagraph.isStory ? 'Unmark' : 'Mark as Story'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

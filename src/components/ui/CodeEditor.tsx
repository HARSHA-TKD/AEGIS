import { useState, type KeyboardEvent } from "react";
import clsx from "clsx";
import { highlightCode } from "../../lib/highlight";

interface CodeEditorProps {
  code: string;
  language: string;
  onChange: (code: string) => void;
  findingLines?: Set<number>;
  ariaLabel?: string;
}

export function CodeEditor({ code, language, onChange, findingLines, ariaLabel }: CodeEditorProps) {
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const lines = code.split("\n");
  const highlighted = highlightCode(code || " ", language);

  const handleTab = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const next = `${code.slice(0, start)}  ${code.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = start + 2;
    });
  };

  return (
    <div className="code-editor" onMouseDown={(event) => {
      const target = event.target as HTMLElement;
      if (target.closest(".code-gutter")) {
        event.preventDefault();
        target.closest(".code-editor")?.querySelector("textarea")?.focus();
      }
    }}>
      <div className="code-gutter" aria-hidden="true">
        <div style={{ transform: `translateY(-${scroll.top}px)` }}>
          {lines.map((_, index) => (
            <span key={index} className={clsx(findingLines?.has(index + 1) && "has-finding")}>
              {index + 1}
            </span>
          ))}
        </div>
      </div>
      <div className="code-stage">
        <pre
          className="code-highlight"
          aria-hidden="true"
          style={{ transform: `translate(${-scroll.left}px, ${-scroll.top}px)` }}
        >
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
        <textarea
          className="code-textarea"
          value={code}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleTab}
          onScroll={(event) =>
            setScroll({ top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft })
          }
          spellCheck={false}
          wrap="off"
          aria-label={ariaLabel ?? "Code to review"}
        />
      </div>
    </div>
  );
}

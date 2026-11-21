import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Loader2,
  Quote,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { api, errorMessage, type ApiAssistantStatus } from "../lib/api";

type ChatRole = "user" | "assistant";

interface AssistantActionData {
  label: string;
  href: string;
  tone: string;
}

interface AssistantCitationData {
  label: string;
  href: string;
  snippet: string;
}

interface ChatEntry {
  id: string;
  role: ChatRole;
  content: string;
  actions?: AssistantActionData[];
  citations?: AssistantCitationData[];
}

const STORAGE_KEY = "aegis-assistant-chat";

const suggestions = [
  "What can Aegis do?",
  "Summarise my security posture",
  "How do I fix a critical finding?",
  "Is this message a phishing attempt?",
];

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadMessages(): ChatEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ChatEntry =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as ChatEntry).id === "string" &&
        ((item as ChatEntry).role === "user" || (item as ChatEntry).role === "assistant") &&
        typeof (item as ChatEntry).content === "string",
    );
  } catch {
    return [];
  }
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

function RichText({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <>
      {blocks.map((block, blockIndex) => {
        if (blockIndex % 2 === 1) {
          const body = block.replace(/^[a-zA-Z0-9+-]*\n/, "").replace(/\n$/, "");
          return (
            <pre className="assistant-code" key={blockIndex}>
              <code>{body}</code>
            </pre>
          );
        }

        const lines = block.split("\n");
        return (
          <div className="assistant-rich" key={blockIndex}>
            {lines.map((line, lineIndex) => {
              const trimmed = line.trim();
              if (!trimmed) return <span className="assistant-gap" key={lineIndex} />;
              if (/^#{1,6}\s+/.test(trimmed)) {
                return (
                  <p className="assistant-heading" key={lineIndex}>
                    {renderInline(trimmed.replace(/^#{1,6}\s+/, ""))}
                  </p>
                );
              }
              if (/^[-*]\s+/.test(trimmed)) {
                return (
                  <div className="assistant-bullet" key={lineIndex}>
                    <span aria-hidden="true">•</span>
                    <span>{renderInline(trimmed.replace(/^[-*]\s+/, ""))}</span>
                  </div>
                );
              }
              if (/^\d+[.)]\s+/.test(trimmed)) {
                const [marker, ...rest] = trimmed.split(/\s+/);
                return (
                  <div className="assistant-bullet" key={lineIndex}>
                    <span aria-hidden="true">{marker}</span>
                    <span>{renderInline(rest.join(" "))}</span>
                  </div>
                );
              }
              return <p key={lineIndex}>{renderInline(trimmed)}</p>;
            })}
          </div>
        );
      })}
    </>
  );
}

export function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>(loadMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ApiAssistantStatus | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const providerLabel = useMemo(() => {
    if (!status) return "Aegis AI";
    if (status.provider === "ollama") return "Local AI";
    if (status.provider === "openai") return "OpenAI";
    return status.provider;
  }, [status]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    api
      .assistantStatus(controller.signal)
      .then(setStatus)
      .catch(() => undefined);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, sending, error, open]);

  async function requestReply(history: ChatEntry[]) {
    setError(null);
    setSending(true);
    try {
      const response = await api.assistantChat({
        messages: history.map(({ role, content }) => ({ role, content })),
        page: location.pathname,
      });
      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "assistant",
          content: response.reply,
          actions: response.actions,
          citations: response.citations,
        },
      ]);
      setStatus((current) =>
        current
          ? {
              ...current,
              model: response.model,
              provider: response.provider,
              available: true,
              detail: `Ready with ${response.model}.`,
            }
          : current,
      );
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSending(false);
    }
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || sending) return;

    const entry: ChatEntry = { id: makeId(), role: "user", content: text };
    const history = [...messages, entry];
    setMessages(history);
    setInput("");
    setLastPrompt(text);
    await requestReply(history);
  }

  function retry() {
    if (!lastPrompt || sending) return;
    if (messages[messages.length - 1]?.role !== "user") return;
    void requestReply(messages);
  }

  function resetConversation() {
    setMessages([]);
    setError(null);
    setInput("");
    setLastPrompt(null);
    sessionStorage.removeItem(STORAGE_KEY);
    inputRef.current?.focus();
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.section
            className="assistant-panel"
            role="dialog"
            aria-label="Aegis Assistant"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
          >
            <header className="assistant-head">
              <span className="assistant-avatar">
                <Bot size={19} />
              </span>
              <div className="assistant-title">
                <strong>Aegis Assistant</strong>
                <span className={status && !status.available ? "is-offline" : undefined}>
                  <span className="assistant-dot" aria-hidden="true" />
                  {status ? providerLabel : "Connecting…"}
                  {status?.model ? ` · ${status.model}` : ""}
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                <X size={17} />
              </button>
            </header>

            {status && !status.available && (
              <div className="assistant-banner">
                <AlertTriangle size={15} />
                <span>{status.detail}</span>
              </div>
            )}

            <div className="assistant-body" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="assistant-welcome">
                  <span className="assistant-welcome-icon">
                    <Sparkles size={22} />
                  </span>
                  <h3>How can I help?</h3>
                  <p>
                    Ask me about Aegis, your scan findings, secure coding, or a suspicious
                    message. I can use your workspace summary to answer questions about your
                    own projects.
                  </p>
                  <div className="assistant-suggestions">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="assistant-chip"
                        onClick={() => void send(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`assistant-msg assistant-msg-${message.role}`}>
                    {message.role === "assistant" && (
                      <span className="assistant-msg-avatar">
                        <Bot size={15} />
                      </span>
                    )}
                    <div className="assistant-bubble">
                      <RichText text={message.content} />
                      {Boolean(message.actions?.length) && (
                        <div className="assistant-actions">
                          {message.actions?.map((action) => (
                            <button
                              key={`${action.label}-${action.href}`}
                              type="button"
                              className={`assistant-action ${action.tone === "primary" ? "is-primary" : ""}`}
                              onClick={() => {
                                setOpen(false);
                                navigate(action.href);
                              }}
                            >
                              {action.label}
                              <ArrowUpRight size={14} />
                            </button>
                          ))}
                        </div>
                      )}
                      {Boolean(message.citations?.length) && (
                        <div className="assistant-citations">
                          <span className="assistant-citations-label">
                            <Quote size={13} /> Sources
                          </span>
                          {message.citations?.map((citation) => (
                            <button
                              key={`${citation.label}-${citation.href}`}
                              type="button"
                              className="assistant-citation"
                              onClick={() => {
                                setOpen(false);
                                navigate(citation.href);
                              }}
                            >
                              <strong>{citation.label}</strong>
                              <span>{citation.snippet}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {sending && (
                <div className="assistant-msg assistant-msg-assistant">
                  <span className="assistant-msg-avatar">
                    <Bot size={15} />
                  </span>
                  <div className="assistant-bubble assistant-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}

              {error && (
                <div className="assistant-error">
                  <AlertTriangle size={15} />
                  <div>
                    <span>{error}</span>
                    {lastPrompt && (
                      <button
                        type="button"
                        className="assistant-retry"
                        onClick={retry}
                        disabled={sending}
                      >
                        <RotateCcw size={13} /> Retry
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <form
              className="assistant-compose"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="Ask Aegis anything…"
                aria-label="Message Aegis Assistant"
              />
              <button
                type="submit"
                className="assistant-send"
                disabled={!input.trim() || sending}
                aria-label="Send message"
              >
                {sending ? <Loader2 size={17} className="assistant-spin" /> : <Send size={17} />}
              </button>
            </form>

            <footer className="assistant-foot">
              <span>AI can make mistakes. Verify security advice.</span>
              <button
                type="button"
                onClick={resetConversation}
                disabled={messages.length === 0 || sending}
              >
                New chat
              </button>
            </footer>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            className="assistant-launcher"
            onClick={() => setOpen(true)}
            aria-label="Open Aegis Assistant"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            <Sparkles size={20} />
            <span>Ask Aegis</span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

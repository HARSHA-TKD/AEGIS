const KEYWORDS = new Set(
  `as async await break case catch class const continue crate def default defer del delete do elif else end enum except export extends false finally fn for from func function go if impl import in interface lambda let loop match mod mut new nil None not null or package pass private protected pub public raise require return self static struct super switch this throw true try type typeof use var void where while with yield`.split(
    /\s+/,
  ),
);

const COMMENT_LANGS = new Set(["python", "php", "ruby", "shell", "bash", "yaml"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function span(className: string, value: string): string {
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

export function highlightCode(code: string, language: string): string {
  const lang = language.toLowerCase();
  const comment = COMMENT_LANGS.has(lang)
    ? String.raw`#[^\n]*|\/\*[\s\S]*?\*\/|\/\/[^\n]*`
    : String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`;
  const pattern = new RegExp(
    `(${comment})|("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\`(?:\\\\.|[^\`\\\\])*\`)|\\b(\\d+(?:\\.\\d+)?)\\b|\\b([A-Za-z_$][\\w$]*)\\b`,
    "g",
  );

  let output = "";
  let lastIndex = 0;
  for (const match of code.matchAll(pattern)) {
    const index = match.index ?? 0;
    output += escapeHtml(code.slice(lastIndex, index));
    const [token, commentToken, stringToken, numberToken, wordToken] = match;
    if (commentToken) output += span("tok-comment", token);
    else if (stringToken) output += span("tok-string", token);
    else if (numberToken) output += span("tok-number", token);
    else if (wordToken && KEYWORDS.has(wordToken)) output += span("tok-keyword", token);
    else output += escapeHtml(token);
    lastIndex = index + token.length;
  }
  output += escapeHtml(code.slice(lastIndex));
  return output;
}

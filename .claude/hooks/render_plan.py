#!/usr/bin/env python3
"""
render_plan.py

Claude Code PostToolUse hook for the ExitPlanMode tool.

Reads the hook's JSON payload from stdin, pulls the plan markdown out of
tool_input.plan, converts it to a self-contained HTML page (with Mermaid
diagrams auto-rendered from ```mermaid code blocks), saves it, and opens
it in the default browser.

This hook never blocks or changes the normal plan-approval flow — it just
produces a nicer artifact alongside it. Exits 0 always so it can never
interfere with Claude Code.
"""

import json
import sys
import os
import re
import html
import subprocess
import platform
import datetime

# ---------------------------------------------------------------------------
# Brand tokens (8th Light) — edit these to re-skin the output
# ---------------------------------------------------------------------------
BRAND = {
    "bg": "#FFFFFF",
    "text": "#141414",
    "muted": "#3C3C3C",
    "border": "#DEDEDE",
    "panel": "#F4F4F4",
    "accent": "#0071CE",   # Branded Blue
    "font": "'GT Flexa', 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif",
}

OUTPUT_DIR = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
PLANS_DIR = os.path.join(OUTPUT_DIR, ".claude", "plans")


def read_hook_input():
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def extract_plan_markdown(payload):
    tool_input = payload.get("tool_input") or {}
    plan = tool_input.get("plan")
    if not plan:
        # Fallback: sometimes plan-like content shows up elsewhere; bail
        # out quietly rather than guessing.
        return None
    return plan


# ---------------------------------------------------------------------------
# Extremely small markdown -> HTML converter (no external deps).
# Handles: headings, bold/italic/code spans, fenced code blocks (incl.
# ```mermaid), unordered/ordered lists, and paragraphs. Good enough for
# Claude Code plan text, which is fairly regular in structure.
# ---------------------------------------------------------------------------
def markdown_to_html(md_text):
    lines = md_text.replace("\r\n", "\n").split("\n")
    out = []
    i = 0
    in_ul = False
    in_ol = False

    def close_lists():
        nonlocal in_ul, in_ol
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    def inline(text):
        text = html.escape(text)
        text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
        text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
        text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", text)
        return text

    while i < len(lines):
        line = lines[i]

        # Fenced code block
        fence_match = re.match(r"^```(\w*)\s*$", line)
        if fence_match:
            lang = fence_match.group(1).lower()
            body = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                body.append(lines[i])
                i += 1
            i += 1  # skip closing fence
            close_lists()
            code = "\n".join(body)
            if lang == "mermaid":
                out.append(f'<div class="mermaid">{html.escape(code)}</div>')
            else:
                out.append(
                    f'<pre><code class="lang-{html.escape(lang)}">'
                    f"{html.escape(code)}</code></pre>"
                )
            continue

        heading_match = re.match(r"^(#{1,4})\s+(.*)$", line)
        if heading_match:
            close_lists()
            level = len(heading_match.group(1))
            out.append(f"<h{level}>{inline(heading_match.group(2))}</h{level}>")
            i += 1
            continue

        ul_match = re.match(r"^\s*[-*]\s+(.*)$", line)
        ol_match = re.match(r"^\s*\d+\.\s+(.*)$", line)

        if ul_match:
            if not in_ul:
                close_lists()
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{inline(ul_match.group(1))}</li>")
            i += 1
            continue

        if ol_match:
            if not in_ol:
                close_lists()
                out.append("<ol>")
                in_ol = True
            out.append(f"<li>{inline(ol_match.group(1))}</li>")
            i += 1
            continue

        if line.strip() == "":
            close_lists()
            i += 1
            continue

        close_lists()
        out.append(f"<p>{inline(line.strip())}</p>")
        i += 1

    close_lists()
    return "\n".join(out)


PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.0/mermaid.min.js"></script>
<style>
  :root {{
    --bg: {bg}; --text: {text}; --muted: {muted};
    --border: {border}; --panel: {panel}; --accent: {accent};
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--bg); color: var(--text);
    font-family: {font};
    line-height: 1.55;
  }}
  header {{
    padding: 28px 40px; border-bottom: 3px solid var(--accent);
    display: flex; align-items: baseline; justify-content: space-between;
  }}
  header .brand {{ font-weight: 700; letter-spacing: 0.02em; color: var(--accent); }}
  header .stamp {{ color: var(--muted); font-size: 13px; }}
  main {{ max-width: 860px; margin: 0 auto; padding: 40px; }}
  h1 {{ font-size: 30px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }}
  h2 {{ font-size: 22px; margin-top: 36px; color: var(--accent); }}
  h3 {{ font-size: 17px; margin-top: 26px; }}
  p {{ margin: 10px 0; }}
  ul, ol {{ padding-left: 22px; }}
  li {{ margin: 4px 0; }}
  code {{
    background: var(--panel); padding: 1px 6px; border-radius: 4px;
    font-size: 0.9em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }}
  pre {{
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
    padding: 16px; overflow-x: auto;
  }}
  pre code {{ background: none; padding: 0; }}
  .mermaid {{
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
    padding: 20px; margin: 20px 0; display: flex; justify-content: center;
  }}
  footer {{ text-align: center; color: var(--muted); font-size: 12px; padding: 24px; }}
</style>
</head>
<body>
<header>
  <span class="brand">8TH LIGHT</span>
  <span class="stamp">Plan generated {stamp}</span>
</header>
<main>
{body}
</main>
<footer>Rendered automatically from Claude Code plan mode</footer>
<script>
  mermaid.initialize({{ startOnLoad: true, theme: 'neutral' }});
</script>
</body>
</html>
"""


def build_html(plan_md):
    body_html = markdown_to_html(plan_md)
    title_match = re.search(r"^#\s+(.*)$", plan_md, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else "Implementation Plan"
    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    return PAGE_TEMPLATE.format(
        title=html.escape(title),
        body=body_html,
        stamp=stamp,
        **BRAND,
    )


def open_in_browser(path):
    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.run(["open", path], check=False)
        elif system == "Windows":
            os.startfile(path)  # type: ignore[attr-defined]
        else:
            subprocess.run(["xdg-open", path], check=False)
    except Exception:
        pass  # never fail the hook over a browser-launch problem


def main():
    payload = read_hook_input()
    plan_md = extract_plan_markdown(payload)
    if not plan_md:
        sys.exit(0)  # nothing to render; don't disrupt the session

    os.makedirs(PLANS_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    out_path = os.path.join(PLANS_DIR, f"plan-{ts}.html")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(build_html(plan_md))

    open_in_browser(out_path)
    sys.exit(0)


if __name__ == "__main__":
    main()

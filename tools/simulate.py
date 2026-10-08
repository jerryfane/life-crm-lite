#!/usr/bin/env python3
"""Simulate skill/SKILL.md against the example transcripts, through the OpenAI Responses API.

    python3 tools/simulate.py                       # all cases below
    python3 tools/simulate.py maya-claude-pro       # one case
    python3 tools/simulate.py --out DIR             # where results go
    python3 tools/simulate.py --summary-only        # rebuild summary.md from saved results, no API

One model plays the assistant with SKILL.md as its instructions. A second model plays the
person: it answers from examples/<name>/transcript.md (the dictation, the assumed follow-up
answers, the Google account) and also labels each assistant message (plan question, talk
prompt, follow-up, matrix check, Drive check, done). There are no real tool calls: the
assistant is told that the Google Drive and Google Sheets connectors are on, and writes markers
for the folder, the sheet (with the data block it would save), GUIDE.md and the dashboard.

Checks per case: number of follow-up questions (3-6), one question per message, options
present, the data block valid (`tools/convert.py check`), matrix placement against the
example's data.json, the folder plan (folder name, one subfolder per area), GUIDE.md saved, and
that the dashboard step is reached (a Pro run without it is invalid). For a plan other than
Pro/Max: the "needs Claude Pro or Max" message, the viewer link, and no setup. Tokens are summed
per case. Each case's result.json and summary.md are written as soon as the case finishes.

The API goes through the local keyring relay (no key in this file). Python 3.10+, openpyxl.
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "http://127.0.0.1:7700/life-crm/openai/v1/responses"
ASSISTANT_MODEL = "gpt-6-sol"
USER_MODEL = "gpt-5.3-codex"
TODAY = "2026-10-11"
MAX_TURNS = 16
DEFAULT_OUT = Path("/root/fleet-tools/state/life-crm-lite/skill")
DASH_RE = re.compile(r"\[DASHBOARD\b|DASHBOARD_LINK|claude\.ai/public/artifacts|<script id=\"data\"|<!doctype html", re.I)
FOLDER_RE = re.compile(r"\[FOLDER:\s*([^\]]*)\]")
PRO_PLANS = ("Claude Pro", "Claude Max")

CASES = {
    "maya-claude-pro": ("maya", "Claude Pro"),
    "elena-claude-pro": ("elena", "Claude Pro"),
    "daniel-claude-pro": ("daniel", "Claude Pro"),
    "elena-claude-free": ("elena", "Claude Free"),
}

HARNESS_FULL = f"""

---
SIMULATION NOTE (from the test harness, not from the person): today is {TODAY}. You have no real
tools in this simulation. Act as if the Google Drive and Google Sheets connectors are on and
connected to the account {{account}}, and as if the Project files GUIDE.md and dashboard.html are
here. Write markers instead of tool calls, in the message where you would do it:
"[FOLDER: <folder name>; subfolders: <name>, <name>, …]" once the folder and subfolders exist
(made by you or by the person following your clicks); the Google Drive connector has only
share_file, trash_file and update_file;
the data block holding exactly what you would write to the sheet, in one ```json code block, then
"[SHEET SAVED: <sheet name>]"; "[GUIDE SAVED]" when you save GUIDE.md. For the dashboard step,
write the message you'd send, and if you would make the artifact yourself, write
"[DASHBOARD: dashboard.html with the data block]" instead of the HTML. Treat every tool call as
successful: use https://drive.google.com/drive/folders/SIM and
https://docs.google.com/spreadsheets/d/SIM as the folder and sheet links, and
https://claude.ai/public/artifacts/SIM as the published dashboard link. Everything else as the
instructions say.
"""

USER_PROMPT = """You play {name} in a test of a chat assistant. You are not a developer.
You are using {plan}. Your Google account is {account}{drive_note}.

What you said when asked to talk (the assistant already has this if you've sent it):
<<<
{dictation}
>>>

Your answers to likely follow-up questions (use these facts; the wording of the questions may differ):
<<<
{answers}
>>>

Each turn you get the assistant's latest message. Reply as {name} would, briefly, in plain words.
- Plan question: answer "{plan}". If told the setup needs another plan, say "Okay, thanks."
- Asked to talk / dictate: reply with the single word DICTATION (the harness pastes your dictation).
- Follow-up questions: answer from your facts above. If your facts don't cover it, pick the option
  that best fits what you said, or say you're not sure. Never invent new people or dates.
- Asked to confirm a Google account: confirm {account} if it matches.
- Asked to confirm the matrix/boxes: say it looks right, unless something is clearly against
  what you said (then say what to move).
- Asked to click something or connect something: say it's done.
Also label the assistant's message:
- kind: "plan" (asks which plan), "talk" (asks you to talk/dictate), "followup" (a question about
  your areas or steps, including the tone question), "matrix" (shows the four boxes and asks to
  confirm), "drive" (connectors / Google account / folder step), "done" (gives a result: folder,
  sheet, dashboard, or a message that your plan can't do it, and asks nothing essential), "other".
- questions: how many separate questions it asks you to answer (0 if none).
- options: true if it offers numbered or listed choices to pick from.
Return only JSON: {{"kind": ..., "questions": n, "options": true/false, "reply": "..."}}"""


def call(model: str, instructions: str, messages: list[dict], usage: dict, json_out: bool = False,
         effort: str | None = None) -> str:
    body = {"model": model, "instructions": instructions,
            "input": [{"role": m["role"], "content": m["content"]} for m in messages], "store": False}
    if effort:
        body["reasoning"] = {"effort": effort}
    if json_out:
        body["text"] = {"format": {"type": "json_object"}}
    req = urllib.request.Request(API, data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                res = json.load(r)
            break
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == 2:
                raise SystemExit(f"API error {e.code}: {e.read().decode(errors='replace')[:500]}")
            print(f"  retry after {e}", file=sys.stderr)
            time.sleep(5)
            continue
        except OSError as e:  # network: retry twice
            if attempt == 2:
                raise
            print(f"  retry after {e}", file=sys.stderr)
            time.sleep(5)
    u = res.get("usage") or {}
    bucket = usage.setdefault(model, {"input": 0, "output": 0, "calls": 0})
    bucket["input"] += u.get("input_tokens", 0)
    bucket["output"] += u.get("output_tokens", 0)
    bucket["calls"] += 1
    return "".join(c.get("text", "") for o in res.get("output", []) if o.get("type") == "message"
                   for c in o.get("content", []))


def section(md: str, title: str) -> str:
    m = re.search(rf"^## {re.escape(title)}[^\n]*\n(.*?)(?=^## |\Z)", md, re.S | re.M)
    return m.group(1).strip() if m else ""


def load_case(name: str) -> dict:
    md = (ROOT / "examples" / name / "transcript.md").read_text()
    said = section(md, "What he says") or section(md, "What she says")
    dictation = "\n".join(line.lstrip("> ").rstrip() for line in said.splitlines()).strip()
    answers = section(md, "Follow-up questions")
    expected = json.loads((ROOT / "examples" / name / "data.json").read_text())
    return {"name": expected["owner"], "dictation": dictation, "answers": answers,
            "account": expected["sheet"]["account"], "expected": expected}


def json_blocks(text: str) -> list[dict]:
    out = []
    for block in re.findall(r"```(?:json)?\s*\n(.*?)```", text, re.S):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            if '"lite"' in block:
                out.append({"_invalid_json": block})
            continue
        if isinstance(data, dict) and "lite" in data:
            out.append(data)
    return out


def heuristic(text: str) -> dict:
    """Question marks outside option lines, and option lines, counted from the text itself."""
    lines = [line for line in text.splitlines() if line.strip()]
    option_re = re.compile(r"^\s*(\*\*)?(\d+[.)]|[-*•]|[A-D][.)])\s")
    opt_lines = [line for line in lines if option_re.match(line)]
    inline_opts = len(re.findall(r"(?:^|[·|]\s*)\d+[.)]\s", text))
    prose = [line for line in lines if not option_re.match(line)]
    return {"question_marks": sum(line.count("?") for line in prose),
            "option_lines": max(len(opt_lines), inline_opts)}


def quadrant(step: dict) -> str:
    if step.get("status") == "done":
        return "done"
    imp, urg = step.get("importance") == "high", step.get("urgency") == "high"
    return {(True, True): "Do now", (True, False): "Schedule", (False, True): "Delegate",
            (False, False): "Drop"}[(imp, urg)]


STOP = {"the", "a", "an", "to", "and", "for", "of", "in", "on", "with", "my", "her", "his", "by", "up", "out"}


def similarity(a: str, b: str) -> float:
    """Shared words (ignoring small ones) plus character similarity, 0..1."""
    wa = {w for w in re.findall(r"[a-z0-9]+", a.lower()) if w not in STOP}
    wb = {w for w in re.findall(r"[a-z0-9]+", b.lower()) if w not in STOP}
    words = len(wa & wb) / max(1, min(len(wa), len(wb)))
    return 0.7 * words + 0.3 * difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()


def compare(got: dict, want: dict) -> dict:
    """Pair steps by title (best pairs first) and compare matrix boxes, status, dates."""
    got_steps, want_steps = got.get("steps", []), want["steps"]
    scored = sorted(((similarity(g.get("title", ""), w["title"]), i, j)
                     for i, g in enumerate(got_steps) for j, w in enumerate(want_steps)), reverse=True)
    used_g, used_w, pairs = set(), set(), []
    for score, i, j in scored:
        if score >= 0.4 and i not in used_g and j not in used_w:
            used_g.add(i)
            used_w.add(j)
            pairs.append((got_steps[i], want_steps[j]))
    unmatched = [g.get("title") for i, g in enumerate(got_steps) if i not in used_g]
    free = [w["title"] for j, w in enumerate(want_steps) if j not in used_w]
    diffs = []
    for s, w in pairs:
        d = []
        if quadrant(s) != quadrant(w):
            d.append(f"box {quadrant(s)} (expected {quadrant(w)})")
        if s.get("status") != w.get("status"):
            d.append(f"status {s.get('status')} (expected {w.get('status')})")
        for k in ("date", "start", "end", "repeat"):
            if (s.get(k) or None) != (w.get(k) or None):
                d.append(f"{k} {s.get(k)} (expected {w.get(k)})")
        if d:
            diffs.append(f"{s.get('title')} ~ {w['title']}: " + "; ".join(d))
    same_box = sum(quadrant(s) == quadrant(w) for s, w in pairs)
    return {"areas": [len(got.get("areas", [])), len(want["areas"])],
            "steps": [len(got.get("steps", [])), len(want["steps"])],
            "lists": [len(got.get("lists", [])), len(want["lists"])],
            "people": [len(got.get("people", [])), len(want["people"])],
            "tone": [got.get("tone"), want["tone"]],
            "matched_steps": len(pairs), "same_box": same_box,
            "extra_steps": unmatched, "missing_steps": list(free), "step_differences": diffs}


def validate(data: dict, path: Path) -> list[str]:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    r = subprocess.run([sys.executable, str(ROOT / "tools" / "convert.py"), "check", str(path)],
                       capture_output=True, text=True)
    return [] if r.returncode == 0 else (r.stdout + r.stderr).strip().splitlines()


def run_case(case: str, out: Path) -> dict:
    name, plan = CASES[case]
    c = load_case(name)
    pro = plan in PRO_PLANS
    skill = (ROOT / "skill" / "SKILL.md").read_text()
    instructions = skill + HARNESS_FULL.replace("{account}", c["account"])
    user_instr = USER_PROMPT.format(name=c["name"], plan=plan, account=c["account"], dictation=c["dictation"],
                                    answers=c["answers"],
                                    drive_note="; Google Drive and Google Sheets are already connected")
    usage: dict = {}
    convo = [{"role": "user", "content": "Hi! Let's set up my life CRM."}]
    log, data, data_at, dash_at = [], None, None, None
    for _ in range(MAX_TURNS):
        a = call(ASSISTANT_MODEL, instructions, convo, usage)
        convo.append({"role": "assistant", "content": a})
        blocks = json_blocks(a)
        label_in = [{"role": "user", "content": f"The assistant's message:\n<<<\n{a}\n>>>\nAnswer with the JSON object."}]
        try:
            lab = json.loads(call(USER_MODEL, user_instr, label_in, usage, json_out=True, effort="low"))
        except json.JSONDecodeError:
            lab = {"kind": "other", "questions": 0, "options": False, "reply": "Okay."}
        entry = {"assistant": a, "label": {k: lab.get(k) for k in ("kind", "questions", "options")},
                 "heuristic": heuristic(a)}
        log.append(entry)
        if blocks:
            data = blocks[-1]
            data_at = data_at or len(log)
        if pro and DASH_RE.search(a):
            dash_at = dash_at or len(log)
        # Pro: go on past the sheet until the dashboard step (or give up 3 turns after the data block).
        if pro and (dash_at or (data_at and len(log) >= data_at + 3)):
            break
        if not pro and ("viewer" in a.lower() or len(log) >= 3):
            break
        reply = c["dictation"] if lab.get("kind") == "talk" or "DICTATION" in str(lab.get("reply")) else lab.get("reply", "Okay.")
        entry["user"] = reply
        convo.append({"role": "user", "content": reply})

    kinds = [e["label"]["kind"] for e in log]
    followups = [e for e in log if e["label"]["kind"] == "followup"]
    res = {"case": case, "example": name, "plan": plan, "turns": len(log), "kinds": kinds,
           "followup_questions": len(followups),
           "followups_3_to_6": 3 <= len(followups) <= 6,
           "one_question_each": all((e["label"]["questions"] or 0) <= 1 for e in followups),
           "options_each": all(e["label"]["options"] for e in followups),
           "followup_texts": [e["assistant"].strip() for e in followups],
           "matrix_confirmed": "matrix" in kinds, "usage": usage}
    full = "\n\n".join(e["assistant"] for e in log)
    if not pro:
        res["other_plan"] = {
            "needs_pro_message": "needs claude pro or max" in full.lower(),
            "viewer_link": "life-crm-lite.jerryfane.com/viewer" in full,
            "no_setup": data is None and not FOLDER_RE.search(full),
        }
    else:
        folder = FOLDER_RE.search(full)
        res["folder_plan"] = folder.group(1).strip() if folder else None
        res["drive_step"] = "drive" in kinds
        res["account_confirmed"] = c["account"] in full
        res["guide_saved"] = "[GUIDE SAVED]" in full
        res["dashboard_reached"] = dash_at is not None
        res["dashboard_message"] = log[dash_at - 1]["assistant"].strip() if dash_at else None
    case_dir = out / case
    case_dir.mkdir(parents=True, exist_ok=True)
    res["skill_words"] = len(skill.split())
    res["problems"] = []
    if data is None or "_invalid_json" in data:
        res["data_block"] = "missing" if data is None else "invalid JSON"
        res["data_valid"] = False
    else:
        res["problems"] = validate(data, case_dir / "data.json")
        res["data_block"] = "present"
        res["data_valid"] = not res["problems"]
        res["compare"] = compare(data, c["expected"])
    if pro and not res["dashboard_reached"]:
        res["problems"].append("dashboard step not reached after the sheet")
    if pro:
        res["valid"] = res["data_valid"] and res["dashboard_reached"]
    else:
        res["valid"] = all(res["other_plan"].values())
    (case_dir / "result.json").write_text(json.dumps(res, ensure_ascii=False, indent=2) + "\n")
    md = [f"# {case}\n"]
    md.append(f"**User:** {convo[0]['content']}\n")
    for e in log:
        md.append(f"**Assistant** ({e['label']['kind']}):\n\n{e['assistant']}\n")
        if "user" in e:
            md.append(f"**User:** {e['user']}\n")
    (case_dir / "conversation.md").write_text("\n".join(md))
    return res


def first_line(text: str) -> str:
    """The line holding the question, else the first line; empty messages are named as such."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return "(empty message)"
    return next((line for line in lines if "?" in line), lines[0])[:160]


def summary(results: list[dict], words: int) -> str:
    total_in = sum(b["input"] for r in results for b in r["usage"].values())
    total_out = sum(b["output"] for r in results for b in r["usage"].values())
    counted = sorted({r.get("skill_words", words) for r in results}) or [words]
    lines = [f"SKILL.md: {', '.join(map(str, counted))} words. Assistant model {ASSISTANT_MODEL}, "
             f"user model {USER_MODEL}.", f"Tokens, all cases: {total_in:,} in, {total_out:,} out.", ""]
    for r in results:
        tok = sum(b["input"] + b["output"] for b in r["usage"].values())
        lines.append(f"## {r['case']}")
        lines.append(f"- follow-up questions: {r['followup_questions']} (3-6: {r['followups_3_to_6']}); "
                     f"one per message: {r['one_question_each']}; options: {r['options_each']}; "
                     f"matrix confirmed in one question: {r['matrix_confirmed']}")
        lines.append(f"- data block: {r['data_block']}, data valid: {r.get('data_valid', r['valid'])}; "
                     f"run valid: {r['valid']}" + (f" ({'; '.join(r['problems'])})" if r.get("problems") else ""))
        if "other_plan" in r:
            lines.append(f"- other plan: {r['other_plan']}")
        else:
            lines.append(f"- Drive step: {r['drive_step']}, account named: {r['account_confirmed']}, "
                         f"GUIDE.md saved: {r.get('guide_saved')}, "
                         f"dashboard step reached: {r.get('dashboard_reached', 'not checked')}")
            lines.append(f"- folder plan: {r.get('folder_plan')}")
        if "compare" in r:
            cmp = r["compare"]
            lines.append(f"- got/expected: areas {cmp['areas']}, steps {cmp['steps']}, lists {cmp['lists']}, "
                         f"people {cmp['people']}, tone {cmp['tone']}; same matrix box "
                         f"{cmp['same_box']}/{cmp['matched_steps']} matched steps")
            for d in cmp["step_differences"]:
                lines.append(f"  - {d}")
            if cmp["missing_steps"]:
                lines.append(f"  - not in the result: {', '.join(cmp['missing_steps'])}")
            if cmp["extra_steps"]:
                lines.append(f"  - not in the example: {', '.join(cmp['extra_steps'])}")
        lines.append("- questions asked:")
        for q in r["followup_texts"]:
            lines.append(f"  - {first_line(q)}")
        lines.append(f"- turns {r['turns']}: {' > '.join(r['kinds'])}; tokens {tok:,}")
        lines.append("")
    return "\n".join(lines)


def write_summary(out: Path, results: list[dict], words: int) -> str:
    text = summary(results, words)
    out.mkdir(parents=True, exist_ok=True)
    (out / "summary.md").write_text(text)
    return text


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cases", nargs="*", metavar="case", help=f"one of {', '.join(CASES)} (default: all)")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--summary-only", action="store_true",
                    help="rebuild summary.md from the saved <out>/<case>/result.json files, no API calls")
    args = ap.parse_args()
    unknown = [c for c in args.cases if c not in CASES]
    if unknown:
        ap.error(f"unknown case {', '.join(unknown)}")
    words = len((ROOT / "skill" / "SKILL.md").read_text().split())
    results = []
    if args.summary_only:
        for case in args.cases or list(CASES):
            path = args.out / case / "result.json"
            if path.exists():
                results.append(json.loads(path.read_text()))
            elif args.cases:
                ap.error(f"no saved result for {case} ({path})")
        if not results:
            ap.error(f"no saved results in {args.out}")
    else:
        for case in args.cases or list(CASES):
            print(f"running {case}…", file=sys.stderr)
            results.append(run_case(case, args.out))  # writes <out>/<case>/result.json
            write_summary(args.out, results, words)  # a later failure still leaves a summary
    text = write_summary(args.out, results, words)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())

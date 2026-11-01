"""Research report (RESEARCH section 6): python analysis/analyze.py exports

Reads the CSV files from `npm run export` and writes analysis/out/report.md and three charts. Results are
reported as they are: nothing is filled in, and a blank pre_Mxx means the form had no item for that
misconception, never that the student did not have it.
"""

import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

HERE = Path(__file__).parent
OUT = HERE / "out"
APP_COPY = HERE.parent / "lib" / "content" / "th.ts"
TABLES = ["research_wide", "assessments", "assessment_responses", "attempts", "learner_profiles", "decisions"]
CHARTS = ["pre_post.png", "misconceptions.png", "gain_hist.png"]
THAI_FONTS = ["Thonburi", "Noto Sans Thai", "Sarabun", "Tahoma"]
NAN = float("nan")

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_SECONDARY = "#52514e"
INK_MUTED = "#898781"
GRID = "#e1e0d9"
BASELINE = "#c3c2b7"
# Categorical slots 1 and 2, in that order. As a pair they pass the palette's colour-blind checks.
BLUE = "#2a78d6"
ORANGE = "#eb6834"


def normalized_gain(pre_pct, post_pct):
    """Hake (1998). Pre 40%, post 70% gives 0.5."""
    return (post_pct - pre_pct) / (100 - pre_pct)


def class_gain(pre: pd.Series, post: pd.Series) -> float:
    """From the class means. There is nothing left to gain when everyone already scored 100%."""
    return normalized_gain(pre.mean(), post.mean()) if pre.mean() < 100 else NAN


def individual_gains(pre: pd.Series, post: pd.Series) -> pd.Series:
    """One per student, leaving out whoever scored 100% before."""
    kept = pre < 100
    return normalized_gain(pre[kept], post[kept])


def paired_tests(pre: pd.Series, post: pd.Series) -> dict:
    diff = post - pre
    n = len(diff)
    sd = diff.std(ddof=1) if n > 1 else NAN
    margin = stats.t.ppf(0.975, n - 1) * sd / np.sqrt(n) if n > 1 else NAN
    no_spread = n < 2 or np.isclose(sd, 0)
    return {
        "mean_diff": diff.mean(),
        "ci_low": diff.mean() - margin,
        "ci_high": diff.mean() + margin,
        "t_p": NAN if no_spread else stats.ttest_rel(post, pre).pvalue,
        "wilcoxon_p": NAN if n < 2 or (diff == 0).all() else stats.wilcoxon(diff).pvalue,
        "cohen_dz": NAN if no_spread else diff.mean() / sd,
    }


def paired_summary(pre: pd.Series, post: pd.Series) -> dict:
    return {
        "n": len(pre),
        "pre_mean": pre.mean(),
        "pre_sd": pre.std(ddof=1),
        "post_mean": post.mean(),
        "post_sd": post.std(ddof=1),
        "tests": paired_tests(pre, post),
        "class_gain": class_gain(pre, post),
        "individual_gain": individual_gains(pre, post).mean(),
    }


def mcnemar_exact(had_before: pd.Series, has_after: pd.Series) -> dict:
    """Exact McNemar: a binomial test on the pairs that changed, among students measured both times."""
    pairs = pd.DataFrame({"pre": had_before, "post": has_after}).dropna()
    fixed = int(((pairs.pre == 1) & (pairs.post == 0)).sum())
    new = int(((pairs.pre == 0) & (pairs.post == 1)).sum())
    changed = fixed + new
    return {
        "n": len(pairs),
        "pre_pct": 100 * pairs.pre.mean() if len(pairs) else NAN,
        "post_pct": 100 * pairs.post.mean() if len(pairs) else NAN,
        "fixed": fixed,
        "new": new,
        "p": stats.binomtest(fixed, changed, 0.5).pvalue if changed else NAN,
    }


def mann_whitney(first: pd.Series, second: pd.Series) -> dict:
    """With a rank-biserial r: positive means the first group's values tend to be higher."""
    if first.empty or second.empty:
        return {"u": NAN, "p": NAN, "r": NAN}
    result = stats.mannwhitneyu(first, second)
    r = 2 * result.statistic / (len(first) * len(second)) - 1
    return {"u": result.statistic, "p": result.pvalue, "r": r}


def compare_conditions(both: pd.DataFrame) -> dict | None:
    """Only when the students were split into adaptive and fixed (RESEARCH section 2)."""
    if set(both.condition) != {"adaptive", "fixed"}:
        return None
    groups = {}
    gains = {}
    for name in ("adaptive", "fixed"):
        group = both[both.condition == name]
        gains[name] = individual_gains(group.pre_pct, group.post_pct)
        groups[name] = {
            "n": len(group),
            "pre": group.pre_pct.mean(),
            "post": group.post_pct.mean(),
            "gain": gains[name].mean(),
        }
    return {"groups": groups, **mann_whitney(gains["adaptive"], gains["fixed"])}


def reached_skills_only(assessments, responses, attempts) -> dict:
    """Scores on just the test items of skills each student practised (RESEARCH section 6, item 6)."""
    if responses.empty or attempts.empty:
        return paired_summary(pd.Series(dtype=float), pd.Series(dtype=float))
    answers = responses.assign(skill=responses.item_ref.map(lambda ref: json.loads(ref)["skill"])).merge(
        assessments[["id", "alias", "phase"]], left_on="assessment_id", right_on="id"
    )
    reached = set(zip(attempts.alias, attempts.skill))
    practised = answers[[pair in reached for pair in zip(answers.alias, answers.skill)]]
    scores = 100 * practised.groupby(["alias", "phase"]).correct.mean().unstack()
    scores = scores.reindex(columns=["pre", "post"]).dropna()
    return paired_summary(scores.pre, scores.post)


def in_app(wide, profiles, decisions) -> dict:
    states = [
        state for text in profiles.profile for state in json.loads(text).get("misconceptions", {}).values()
    ]
    confirmed = [state for state in states if state["status"] != "suspected"]
    resolved = [state for state in states if state["status"] == "resolved"]
    relapsed = [state for state in states if state.get("relapses")]
    ever_fixed = [state for state in states if state["status"] == "resolved" or state.get("relapses")]
    fixes = [state for state in states if "itemsToResolve" in state]
    # Same rule as fallback_rate in the export: a generator fallback is not the tutor failing.
    fell_back = decisions.fallback_reason.notna() & (decisions.fallback_reason != "generator")
    return {
        "minutes": wide.minutes_in_app.median(),
        "items": wide.items_done.median(),
        "suspected": len(states) - len(confirmed),
        "confirmed": len(confirmed),
        "resolved": len(resolved),
        "resolved_pct": 100 * len(resolved) / len(confirmed) if confirmed else NAN,
        "median_items": np.median([state["itemsToResolve"] for state in fixes]) if fixes else NAN,
        "median_minutes": np.median([state["msToResolve"] / 60_000 for state in fixes]) if fixes else NAN,
        "ever_fixed": len(ever_fixed),
        "relapsed": len(relapsed),
        "relapse_pct": 100 * len(relapsed) / len(ever_fixed) if ever_fixed else NAN,
        "decisions": len(decisions),
        # `decisions.mode` would be the DataFrame method.
        "llm": int((decisions["mode"] == "llm").sum()),
        "fallback_pct": 100 * fell_back.mean() if len(decisions) else NAN,
    }


def analyze(tables: dict) -> dict:
    wide = tables["research_wide"]
    both = wide.dropna(subset=["pre_pct", "post_pct"])
    misconceptions = {}
    for column in [name for name in wide.columns if name.startswith("pre_M")]:
        code = column.removeprefix("pre_")
        misconceptions[code] = mcnemar_exact(wide[column], wide[f"post_{code}"])
    return {
        "students": len(wide),
        **paired_summary(both.pre_pct, both.post_pct),
        "gains": individual_gains(both.pre_pct, both.post_pct),
        "misconceptions": misconceptions,
        "reached": reached_skills_only(tables["assessments"], tables["assessment_responses"], tables["attempts"]),
        "in_app": in_app(wide, tables["learner_profiles"], tables["decisions"]),
        "conditions": compare_conditions(both),
    }


def show(value, spec: str = ".1f") -> str:
    return "–" if pd.isna(value) else format(value, spec)


def show_p(value, places: int = 4) -> str:
    """A p value never reads as exactly zero."""
    smallest = 10**-places
    return f"< {smallest:.{places}f}" if value < smallest else f"= {show(value, f'.{places}f')}"


def score_lines(summary: dict) -> list:
    if summary["n"] == 0:
        return ["ยังไม่มีนักเรียนที่มีคะแนนครบทั้งก่อนและหลัง"]
    tests = summary["tests"]
    return [
        f"- {summary['n']} คน",
        f"- ก่อนเรียน {show(summary['pre_mean'])}% (SD {show(summary['pre_sd'])}) · "
        f"หลังเรียน {show(summary['post_mean'])}% (SD {show(summary['post_sd'])})",
        f"- ผลต่างเฉลี่ย {show(tests['mean_diff'])} จุด (95% CI {show(tests['ci_low'])} ถึง {show(tests['ci_high'])})",
        f"- paired t-test p {show_p(tests['t_p'])} · Wilcoxon p {show_p(tests['wilcoxon_p'])} · "
        f"Cohen's d_z = {show(tests['cohen_dz'], '.2f')}",
        f"- normalized gain ระดับห้อง {show(summary['class_gain'], '.2f')} · "
        f"ระดับคน {show(summary['individual_gain'], '.2f')}",
    ]


def ai_mode_line(app: dict) -> str:
    if app["decisions"] == 0:
        return "ไม่มีบันทึกการตัดสินใจของระบบในข้อมูลนี้"
    if app["llm"] == 0:
        return "ทุกการตัดสินใจเป็นโหมด rules ห้ามเขียนว่าผลมาจาก AI ที่คิดสด"
    share = show(100 * app["llm"] / app["decisions"], ".0f")
    if app["llm"] < app["decisions"]:
        return f"AI ตัดสิน {share}% ของทั้งหมด ที่เหลือเป็นโหมด rules ต้องระบุในรายงาน"
    return "AI ตัดสินทุกครั้ง"


def report(result: dict) -> str:
    app = result["in_app"]
    lines = [
        "# ผลการทดลอง",
        "",
        f"นักเรียนในข้อมูล {result['students']} คน มีคะแนนครบทั้งก่อนและหลัง {result['n']} คน",
        "",
        "## คะแนนก่อนและหลังเรียน",
        "",
        *score_lines(result),
        "",
        "## ความเข้าใจผิด",
        "",
    ]
    rows = {code: row for code, row in result["misconceptions"].items() if row["n"] > 0}
    if rows:
        lines += [
            "เฉพาะแบบที่ข้อสอบวัดได้ และนับเฉพาะคนที่วัดได้ทั้งสองครั้ง",
            "",
            "| แบบ | n | ก่อน % | หลัง % | แก้ได้ | เกิดใหม่ | McNemar exact p |",
            "|---|---|---|---|---|---|---|",
        ]
        lines += [
            f"| {code} | {row['n']} | {show(row['pre_pct'], '.0f')} | {show(row['post_pct'], '.0f')} | "
            f"{row['fixed']} | {row['new']} | {show_p(row['p'], 3).removeprefix('= ')} |"
            for code, row in rows.items()
        ]
        lines += ["", "ทดสอบหลายแบบพร้อมกัน ค่า p ของแต่ละแถวจึงอาจดูดีเกินจริง อย่าอ่านแยกทีละแถว"]
    else:
        lines.append("ยังไม่มีข้อมูลที่วัดได้ทั้งสองครั้ง")
    lines += [
        "",
        "## เฉพาะเรื่องที่เรียนถึง (เชิงสำรวจ)",
        "",
        "ต้องรายงานคู่กับผลหลักเท่านั้น คนที่เรียนถึงอาจเก่งกว่าอยู่แล้ว จึงสรุปเป็นผลของแอปไม่ได้",
        "",
        *score_lines(result["reached"]),
        "",
        "## ในแอป",
        "",
        f"- ใช้แอปค่ามัธยฐาน {show(app['minutes'])} นาที ทำ {show(app['items'], '.0f')} ข้อ",
        f"- ความเข้าใจผิดที่ยืนยันแล้ว {app['confirmed']} รายการ แก้สำเร็จ {app['resolved']} รายการ "
        f"({show(app['resolved_pct'], '.0f')}%) · ยังเป็นแค่ข้อสงสัยอีก {app['suspected']} รายการ",
        f"- ค่ามัธยฐานที่ใช้แก้ {show(app['median_items'], '.0f')} ข้อ, {show(app['median_minutes'])} นาที",
        f"- กลับมาผิดซ้ำ {app['relapsed']} จาก {app['ever_fixed']} รายการที่เคยแก้ได้ "
        f"({show(app['relapse_pct'], '.0f')}%)",
        f"- การตัดสินใจ {app['decisions']} ครั้ง: AI {app['llm']} ครั้ง, rules {app['decisions'] - app['llm']} ครั้ง, "
        f"fallback {show(app['fallback_pct'], '.0f')}%",
    ]
    if result["conditions"]:
        split = result["conditions"]
        lines += [
            "",
            "## เทียบ adaptive กับ fixed",
            "",
            "| กลุ่ม | n | ก่อน % | หลัง % | gain ระดับคน |",
            "|---|---|---|---|---|",
        ]
        lines += [
            f"| {name} | {group['n']} | {show(group['pre'])} | {show(group['post'])} | {show(group['gain'], '.2f')} |"
            for name, group in split["groups"].items()
        ]
        lines += [
            "",
            f"Mann–Whitney U = {show(split['u'])}, p {show_p(split['p'])}, "
            f"rank-biserial r = {show(split['r'], '.2f')} (ค่าบวกแปลว่า adaptive สูงกว่า)",
            "",
            "กลุ่มเล็ก power ต่ำ ถ้าไม่พบความต่างก็ไม่ได้แปลว่าไม่ต่าง",
        ]
    lines += [
        "",
        "## ข้อจำกัดที่ต้องเขียนในรายงาน",
        "",
        *([] if result["conditions"] else ["- ไม่มีกลุ่มควบคุม จึงบอกไม่ได้ว่าคะแนนที่เปลี่ยนมาจากแอปทั้งหมด"]),
        f"- กลุ่มตัวอย่าง {result['n']} คน ผลจึงคลาดเคลื่อนได้มาก",
        "- ใช้แค่ช่วงสั้น และมี testing effect จากการสอบซ้ำ",
        "- วัดเฉพาะ unit ที่เปิด",
        f"- {ai_mode_line(app)}",
        "",
    ]
    return "\n".join(lines)


def misconception_names() -> dict:
    """The short names from the app's own copy, so a chart says what the app says."""
    block = APP_COPY.read_text(encoding="utf-8").split("misconceptionShort: {", 1)[1].split("}", 1)[0]
    return dict(re.findall(r"(M\d\d)_\w+:\s*'([^']+)'", block))


def thai_font() -> str:
    from matplotlib import font_manager

    installed = {font.name for font in font_manager.fontManager.ttflist}
    for name in THAI_FONTS:
        if name in installed:
            return name
    raise SystemExit(f"The charts need a Thai font. Install one of: {', '.join(THAI_FONTS)}")


def heading(axis, title: str, subtitle: str, pad: int = 0) -> None:
    axis.annotate(
        subtitle,
        (0, 1),
        xycoords="axes fraction",
        xytext=(0, 10 + pad),
        textcoords="offset points",
        color=INK_SECONDARY,
        fontsize=9.5,
    )
    axis.annotate(
        title,
        (0, 1),
        xycoords="axes fraction",
        xytext=(0, 28 + pad),
        textcoords="offset points",
        fontsize=13,
        fontweight="bold",
    )


def pre_post_chart(plt, both, result, path) -> None:
    figure, axis = plt.subplots(figsize=(5.4, 4.6))
    for pre, post in zip(both.pre_pct, both.post_pct):
        axis.plot([0, 1], [pre, post], color=BASELINE, linewidth=1, alpha=0.7, zorder=1)
    means = [result["pre_mean"], result["post_mean"]]
    axis.plot(
        [0, 1],
        means,
        color=BLUE,
        linewidth=2.5,
        solid_capstyle="round",
        marker="o",
        markersize=9,
        markeredgecolor=SURFACE,
        markeredgewidth=1.5,
        zorder=2,
    )
    for x, mean, offset, align in ((0, means[0], -12, "right"), (1, means[1], 12, "left")):
        axis.annotate(
            f"{mean:.0f}%",
            (x, mean),
            xytext=(offset, 0),
            textcoords="offset points",
            ha=align,
            va="center",
            fontweight="bold",
        )
    axis.set(xlim=(-0.3, 1.3), ylim=(0, 100))
    axis.set_xticks([0, 1], ["ก่อนเรียน", "หลังเรียน"])
    axis.set_ylabel("คะแนน (%)")
    axis.grid(axis="y")
    heading(
        axis,
        "คะแนนก่อนและหลังเรียน",
        f"เส้นบาง = นักเรียนแต่ละคน ({result['n']} คน) · เส้นหนา = ค่าเฉลี่ย",
    )
    figure.savefig(path, dpi=200, bbox_inches="tight", pad_inches=0.2)
    plt.close(figure)


def misconception_chart(plt, rows, path) -> None:
    names = misconception_names()
    ordered = sorted(rows.items(), key=lambda pair: (-pair[1]["pre_pct"], pair[0]))
    positions = np.arange(len(ordered))[::-1]
    before = [row["pre_pct"] for _, row in ordered]
    after = [row["post_pct"] for _, row in ordered]
    figure, axis = plt.subplots(figsize=(6.4, 1.2 + 0.36 * len(ordered)))
    axis.hlines(positions, before, after, color=BASELINE, linewidth=2, zorder=1)
    for values, color, label in ((before, BLUE, "ก่อนเรียน"), (after, ORANGE, "หลังเรียน")):
        axis.scatter(
            values, positions, s=75, color=color, edgecolors=SURFACE, linewidths=1.5, label=label, zorder=2
        )
    axis.set_yticks(positions, [f"{code} {names.get(code, '')}".strip() for code, _ in ordered])
    axis.set(xlim=(-3, 103), ylim=(-0.6, len(ordered) - 0.4))
    axis.set_xlabel("นักเรียนที่พบ (%)")
    axis.grid(axis="x")
    axis.legend(loc="lower left", bbox_to_anchor=(0, 1), ncols=2, borderaxespad=0, borderpad=0.1, handletextpad=0.1)
    heading(axis, "ความเข้าใจผิดก่อนและหลังเรียน", "เฉพาะแบบที่ข้อสอบวัดได้ ตัวเลขละเอียดอยู่ในตารางของรายงาน", pad=20)
    figure.savefig(path, dpi=200, bbox_inches="tight", pad_inches=0.2)
    plt.close(figure)


def gain_chart(plt, gains, skipped, path) -> None:
    from matplotlib.ticker import MaxNLocator

    # Whole fifths, so a gain of exactly 0.6 falls in the same bin every time.
    edges = np.arange(min(int(np.floor(gains.min() * 5)), 0), 6) / 5
    figure, axis = plt.subplots(figsize=(6.2, 3.8))
    counts, _, _ = axis.hist(gains, bins=edges, color=BLUE, edgecolor=SURFACE, linewidth=1.5, zorder=2)
    axis.axvline(0, color=INK_MUTED, linewidth=1, zorder=3)
    axis.set_ylim(0, counts.max() * 1.2)
    axis.annotate(
        "0 = คะแนนไม่เปลี่ยน",
        (0, 1),
        xycoords=("data", "axes fraction"),
        xytext=(6, -4),
        textcoords="offset points",
        va="top",
        color=INK_SECONDARY,
        fontsize=9.5,
        bbox={"facecolor": SURFACE, "edgecolor": "none", "pad": 1.5},
    )
    axis.yaxis.set_major_locator(MaxNLocator(integer=True))
    axis.set_xlabel("normalized gain")
    axis.set_ylabel("จำนวนนักเรียน")
    axis.grid(axis="y")
    left_out = f" ไม่นับ {skipped} คนที่ได้เต็มตั้งแต่ก่อนเรียน" if skipped else ""
    heading(axis, "ความก้าวหน้ารายคน", f"{len(gains)} คน · ค่าเฉลี่ย {gains.mean():.2f}{left_out}")
    figure.savefig(path, dpi=200, bbox_inches="tight", pad_inches=0.2)
    plt.close(figure)


def charts(wide: pd.DataFrame, result: dict, out: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # A chart from an older run must not pass for this one when there is nothing to draw yet.
    for name in CHARTS:
        (out / name).unlink(missing_ok=True)
    plt.rcParams.update(
        {
            "font.family": thai_font(),
            "font.size": 10,
            "text.color": INK,
            "figure.facecolor": SURFACE,
            "axes.facecolor": SURFACE,
            "axes.edgecolor": BASELINE,
            "axes.labelcolor": INK_SECONDARY,
            "axes.axisbelow": True,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "axes.unicode_minus": False,
            "grid.color": GRID,
            "grid.linewidth": 0.75,
            "xtick.color": INK_SECONDARY,
            "ytick.color": INK_SECONDARY,
            "xtick.major.size": 0,
            "ytick.major.size": 0,
            "legend.frameon": False,
        }
    )
    both = wide.dropna(subset=["pre_pct", "post_pct"])
    if len(both) > 0:
        pre_post_chart(plt, both, result, out / CHARTS[0])
    rows = {code: row for code, row in result["misconceptions"].items() if row["n"] > 0}
    if rows:
        misconception_chart(plt, rows, out / CHARTS[1])
    gains = result["gains"]
    if len(gains) > 0:
        gain_chart(plt, gains, len(both) - len(gains), out / CHARTS[2])


def main(export_dir: str, out: Path = OUT) -> None:
    tables = {name: pd.read_csv(Path(export_dir) / f"{name}.csv") for name in TABLES}
    out.mkdir(exist_ok=True)
    result = analyze(tables)
    (out / "report.md").write_text(report(result), encoding="utf-8")
    charts(tables["research_wide"], result, out)
    print(f"Wrote {out / 'report.md'}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python analysis/analyze.py exports")
    main(sys.argv[1])

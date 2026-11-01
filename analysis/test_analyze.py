"""Made-up data with answers worked out by hand: python -m unittest discover analysis"""

import json
import math
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from analyze import (
    analyze,
    class_gain,
    individual_gains,
    main,
    mann_whitney,
    mcnemar_exact,
    misconception_names,
    normalized_gain,
    paired_tests,
    report,
    show_p,
)

WIDE = {
    "condition": "adaptive",
    "minutes_in_app": 30,
    "items_done": 20,
    "pre_M09": 1,
    "post_M09": 0,
    "pre_M04": None,
    "post_M04": None,
}


def ref(skill):
    return json.dumps({"gv": 2, "seed": 1, "skill": skill, "topic": "matrix", "difficulty": 1})


def tables(rows, **others):
    return {
        "research_wide": pd.DataFrame([{**WIDE, **row} for row in rows]),
        "assessments": pd.DataFrame(columns=["alias", "id", "phase"]),
        "assessment_responses": pd.DataFrame(columns=["assessment_id", "item_ref", "correct"]),
        "attempts": pd.DataFrame(columns=["alias", "skill"]),
        "learner_profiles": pd.DataFrame(columns=["alias", "profile"]),
        "decisions": pd.DataFrame(columns=["mode", "fallback_reason"]),
        **others,
    }


class Gain(unittest.TestCase):
    def test_the_documented_example(self):
        self.assertAlmostEqual(normalized_gain(40, 70), 0.5)

    def test_a_class_at_100_has_no_gain_to_report(self):
        self.assertTrue(math.isnan(class_gain(pd.Series([100.0]), pd.Series([100.0]))))

    def test_someone_who_scored_100_before_is_left_out_of_the_individual_gain(self):
        gains = individual_gains(pd.Series([40.0, 100.0]), pd.Series([70.0, 90.0]))
        self.assertEqual(list(gains), [0.5])


class Paired(unittest.TestCase):
    def test_hand_worked(self):
        # Differences 10, 20, 30: mean 20, sd 10, so d_z = 2.
        result = paired_tests(pd.Series([40.0, 50.0, 60.0]), pd.Series([50.0, 70.0, 90.0]))
        self.assertAlmostEqual(result["mean_diff"], 20)
        self.assertAlmostEqual(result["cohen_dz"], 2)
        self.assertAlmostEqual(result["ci_low"], 20 - 4.302653 * 10 / math.sqrt(3), places=3)
        self.assertAlmostEqual(result["ci_high"], 20 + 4.302653 * 10 / math.sqrt(3), places=3)

    def test_no_change_does_not_crash(self):
        result = paired_tests(pd.Series([50.0, 50.0]), pd.Series([50.0, 50.0]))
        self.assertTrue(math.isnan(result["cohen_dz"]))
        self.assertTrue(math.isnan(result["wilcoxon_p"]))

    def test_one_student_is_not_enough(self):
        result = paired_tests(pd.Series([50.0]), pd.Series([60.0]))
        self.assertTrue(math.isnan(result["t_p"]))
        self.assertTrue(math.isnan(result["ci_low"]))


class McNemar(unittest.TestCase):
    def test_exact_on_the_changed_pairs(self):
        # 4 changed, all one way: 2 × 0.5^4.
        result = mcnemar_exact(pd.Series([1, 1, 1, 1, 0]), pd.Series([0, 0, 0, 0, 0]))
        self.assertEqual((result["fixed"], result["new"]), (4, 0))
        self.assertAlmostEqual(result["p"], 0.125)
        self.assertAlmostEqual(result["pre_pct"], 80)
        self.assertAlmostEqual(result["post_pct"], 0)

    def test_blank_is_not_zero(self):
        result = mcnemar_exact(pd.Series([None, None], dtype=float), pd.Series([None, None], dtype=float))
        self.assertEqual(result["n"], 0)
        self.assertTrue(math.isnan(result["pre_pct"]))

    def test_a_student_measured_once_is_left_out(self):
        result = mcnemar_exact(pd.Series([1, None]), pd.Series([0, 1]))
        self.assertEqual(result["n"], 1)

    def test_nobody_changing_has_no_p(self):
        self.assertTrue(math.isnan(mcnemar_exact(pd.Series([1, 0]), pd.Series([1, 0]))["p"]))


class Conditions(unittest.TestCase):
    def test_hand_worked(self):
        # Every first value beats every second: U = 4 of 4, r = 1, exact p = 2 of the 6 orderings.
        result = mann_whitney(pd.Series([3.0, 4.0]), pd.Series([1.0, 2.0]))
        self.assertEqual(result["u"], 4)
        self.assertAlmostEqual(result["r"], 1)
        self.assertAlmostEqual(result["p"], 2 / 6)

    def test_the_other_way_round_is_negative(self):
        self.assertAlmostEqual(mann_whitney(pd.Series([1.0, 2.0]), pd.Series([3.0, 4.0]))["r"], -1)

    def test_an_empty_group_has_no_result(self):
        self.assertTrue(math.isnan(mann_whitney(pd.Series([1.0]), pd.Series(dtype=float))["p"]))

    def test_one_group_is_not_compared_and_says_it_has_no_control(self):
        result = analyze(tables([{"pre_pct": 40, "post_pct": 70}, {"pre_pct": 50, "post_pct": 90}]))
        self.assertIsNone(result["conditions"])
        self.assertIn("ไม่มีกลุ่มควบคุม", report(result))

    def test_a_split_is_compared(self):
        rows = [
            {"condition": "adaptive", "pre_pct": 40, "post_pct": 70},
            {"condition": "adaptive", "pre_pct": 50, "post_pct": 100},
            {"condition": "fixed", "pre_pct": 40, "post_pct": 50},
            {"condition": "fixed", "pre_pct": 50, "post_pct": 60},
        ]
        result = analyze(tables(rows))
        self.assertEqual(result["conditions"]["groups"]["adaptive"]["n"], 2)
        # Gains 0.5, 1.0 and 1/6, 0.2.
        self.assertAlmostEqual(result["conditions"]["groups"]["adaptive"]["gain"], 0.75)
        self.assertAlmostEqual(result["conditions"]["r"], 1)
        text = report(result)
        self.assertIn("Mann–Whitney", text)
        self.assertIn("power ต่ำ", text)
        self.assertNotIn("ไม่มีกลุ่มควบคุม", text)


class ReachedSkills(unittest.TestCase):
    def test_only_the_skills_each_student_practised_count(self):
        # S-1 practised dim only. On the whole test S-1 stays at 50%, but on dim goes from 0% to 100%.
        # S-2 practised nothing, so S-2 is not in this result at all.
        others = {
            "assessments": pd.DataFrame(
                [
                    {"alias": "S-1", "id": 1, "phase": "pre"},
                    {"alias": "S-1", "id": 2, "phase": "post"},
                    {"alias": "S-2", "id": 3, "phase": "pre"},
                    {"alias": "S-2", "id": 4, "phase": "post"},
                ]
            ),
            "assessment_responses": pd.DataFrame(
                [
                    {"assessment_id": 1, "item_ref": ref("dim"), "correct": False},
                    {"assessment_id": 1, "item_ref": ref("index"), "correct": True},
                    {"assessment_id": 2, "item_ref": ref("dim"), "correct": True},
                    {"assessment_id": 2, "item_ref": ref("index"), "correct": False},
                    {"assessment_id": 3, "item_ref": ref("dim"), "correct": True},
                    {"assessment_id": 4, "item_ref": ref("dim"), "correct": True},
                ]
            ),
            "attempts": pd.DataFrame([{"alias": "S-1", "skill": "dim"}, {"alias": "S-1", "skill": "dim"}]),
        }
        reached = analyze(tables([{"pre_pct": 50, "post_pct": 50}], **others))["reached"]
        self.assertEqual(reached["n"], 1)
        self.assertAlmostEqual(reached["pre_mean"], 0)
        self.assertAlmostEqual(reached["post_mean"], 100)
        self.assertAlmostEqual(reached["class_gain"], 1)


class InApp(unittest.TestCase):
    def test_hand_worked(self):
        states = {
            "M01": {"status": "suspected"},
            # Fixed once, came back, and is still open: it counts against the fix rate and as a relapse.
            "M02": {"status": "active", "relapses": 1, "itemsToResolve": 6, "msToResolve": 360_000},
            "M03": {"status": "resolved", "relapses": 2, "itemsToResolve": 2, "msToResolve": 120_000},
            "M05": {"status": "resolved", "itemsToResolve": 4, "msToResolve": 240_000},
            "M07": {"status": "active"},
        }
        others = {
            "learner_profiles": pd.DataFrame([{"alias": "S-1", "profile": json.dumps({"misconceptions": states})}]),
            "decisions": pd.DataFrame(
                [
                    {"mode": "llm", "fallback_reason": None},
                    {"mode": "rules", "fallback_reason": None},
                    {"mode": "rules", "fallback_reason": "timeout"},
                    {"mode": "rules", "fallback_reason": "generator"},
                ]
            ),
        }
        app = analyze(tables([{"pre_pct": 40, "post_pct": 70}], **others))["in_app"]
        self.assertEqual((app["suspected"], app["confirmed"], app["resolved"]), (1, 4, 2))
        self.assertAlmostEqual(app["resolved_pct"], 50)
        self.assertEqual(app["median_items"], 4)
        self.assertEqual(app["median_minutes"], 4)
        self.assertEqual((app["relapsed"], app["ever_fixed"]), (2, 3))
        self.assertEqual((app["decisions"], app["llm"]), (4, 1))
        self.assertAlmostEqual(app["fallback_pct"], 25)

    def test_a_trial_on_rules_alone_may_not_claim_ai(self):
        others = {"decisions": pd.DataFrame([{"mode": "rules", "fallback_reason": None}])}
        text = report(analyze(tables([{"pre_pct": 40, "post_pct": 70}], **others)))
        self.assertIn("ห้ามเขียนว่าผลมาจาก AI ที่คิดสด", text)

    def test_a_partly_ai_trial_says_how_much(self):
        others = {
            "decisions": pd.DataFrame(
                [{"mode": "llm", "fallback_reason": None}, {"mode": "rules", "fallback_reason": "timeout"}]
            )
        }
        text = report(analyze(tables([{"pre_pct": 40, "post_pct": 70}], **others)))
        self.assertIn("AI ตัดสิน 50%", text)


class Whole(unittest.TestCase):
    def test_a_student_at_100_is_out_of_the_individual_gain_only(self):
        result = analyze(tables([{"pre_pct": 40, "post_pct": 70}, {"pre_pct": 100, "post_pct": 100}]))
        self.assertAlmostEqual(result["individual_gain"], 0.5)
        self.assertAlmostEqual(result["class_gain"], (85 - 70) / 30)

    def test_someone_with_no_post_test_is_not_counted_as_zero(self):
        result = analyze(tables([{"pre_pct": 40, "post_pct": 70}, {"pre_pct": 10, "post_pct": None}]))
        self.assertEqual(result["students"], 2)
        self.assertEqual(result["n"], 1)
        self.assertAlmostEqual(result["pre_mean"], 40)

    def test_the_report_leaves_out_what_the_test_could_not_measure(self):
        text = report(analyze(tables([{"pre_pct": 40, "post_pct": 70}, {"pre_pct": 50, "post_pct": 90}])))
        self.assertIn("M09", text)
        self.assertNotIn("M04", text)

    def test_nothing_measured_yet_says_so_instead_of_printing_nan(self):
        result = analyze(tables([{"pre_pct": None, "post_pct": None, "pre_M09": None, "post_M09": None}]))
        text = report(result)
        self.assertIn("ยังไม่มีนักเรียนที่มีคะแนนครบ", text)
        self.assertNotIn("nan", text)

    def test_a_tiny_p_is_not_printed_as_zero(self):
        self.assertEqual(show_p(0.00001), "< 0.0001")
        self.assertEqual(show_p(0.03), "= 0.0300")
        self.assertEqual(show_p(float("nan")), "= –")

    def test_the_chart_names_come_from_the_app(self):
        self.assertEqual(misconception_names()["M09"], "คูณทีละช่อง")


class Command(unittest.TestCase):
    """From CSV files shaped like the export's, as `true`, `false` and blank cells really arrive."""

    def write_export(self, folder, wide):
        (folder / "research_wide.csv").write_text(wide, encoding="utf-8")
        (folder / "assessments.csv").write_text("alias,id,phase\nS-1,1,pre\nS-1,2,post\n", encoding="utf-8")
        (folder / "assessment_responses.csv").write_text(
            'assessment_id,item_no,item_ref,answer,correct,misconception,variant,time_ms\n'
            '1,1,"{""gv"":2,""seed"":1,""skill"":""dim""}",,false,,,250\n'
            '2,1,"{""gv"":2,""seed"":2,""skill"":""dim""}",,true,,,250\n',
            encoding="utf-8",
        )
        (folder / "attempts.csv").write_text("alias,seq,skill\nS-1,1,dim\n", encoding="utf-8")
        (folder / "learner_profiles.csv").write_text(
            'alias,profile\nS-1,"{""misconceptions"":{""M09_MULT_ELEMENTWISE"":{""status"":""resolved""}}}"\n',
            encoding="utf-8",
        )
        (folder / "decisions.csv").write_text("alias,mode,fallback_reason\nS-1,rules,\n", encoding="utf-8")

    def test_one_command_writes_the_report_and_the_charts(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            self.write_export(
                folder,
                "alias,condition,pre_pct,post_pct,minutes_in_app,items_done,pre_M09,post_M09,pre_M04,post_M04\n"
                "S-1,adaptive,40,70,30,20,1,0,,\n"
                "S-2,adaptive,50,90,40,30,1,1,,\n",
            )
            out = folder / "out"
            main(temp, out)
            text = (out / "report.md").read_text(encoding="utf-8")
            # Means 45 and 80; differences 30 and 40; class gain 35/55; individual 0.5 and 0.8.
            for shown in ("45.0%", "80.0%", "35.0 จุด", "0.64", "0.65", "| M09 | 2 | 100 | 50 | 1 | 0 | 1.000 |"):
                self.assertIn(shown, text)
            self.assertNotIn("M04", text)
            for name in ("pre_post.png", "misconceptions.png", "gain_hist.png"):
                self.assertGreater((out / name).stat().st_size, 1000)

            # A later export with nothing paired must not keep showing the older charts.
            self.write_export(
                folder,
                "alias,condition,pre_pct,post_pct,minutes_in_app,items_done,pre_M09,post_M09,pre_M04,post_M04\n"
                "S-1,adaptive,40,,30,20,1,,,\n",
            )
            main(temp, out)
            self.assertFalse((out / "pre_post.png").exists())
            self.assertFalse((out / "gain_hist.png").exists())
            self.assertNotIn("nan", (out / "report.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()

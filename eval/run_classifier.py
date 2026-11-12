"""Evaluation Runner: Safety Rule Classifier Benchmark.

Tests the pre-LLM regex/keyword safety classifier against annotated multilingual samples.
Calculates Emergency Recall, Precision, and Accuracy, and records the results into Supabase eval_runs.
"""

import csv
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Ensure core package is on python path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "core" / "src"))

load_dotenv(REPO_ROOT / ".env")
load_dotenv(REPO_ROOT / ".env.local")

from awaz_core.safety import check_safety


def get_supabase_admin():
    from supabase import create_client
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def evaluate_classifier():
    csv_path = REPO_ROOT / "eval" / "data" / "classifier_samples.csv"
    if not csv_path.exists():
        print(f"Error: {csv_path} not found.")
        return

    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        samples = list(reader)

    print(f"\n=======================================================")
    print(f"Evaluating Safety Classifier on {len(samples)} samples...")
    print(f"=======================================================")

    tp = 0
    fp = 0
    tn = 0
    fn = 0
    results_detail = []

    for row in samples:
        text = row["text"]
        lang = row["language"]
        expected_rule = row["expected_rule"]
        expected_emergency = row["is_emergency"].strip().lower() == "true"

        match = check_safety(text, lang)
        predicted_emergency = bool(match and match.matched)
        predicted_rule = (match.rule_code if match and match.matched else "none") or "none"

        is_tp = expected_emergency and predicted_emergency
        is_fp = not expected_emergency and predicted_emergency
        is_tn = not expected_emergency and not predicted_emergency
        is_fn = expected_emergency and not predicted_emergency

        if is_tp: tp += 1
        elif is_fp: fp += 1
        elif is_tn: tn += 1
        elif is_fn: fn += 1

        correct = (expected_emergency == predicted_emergency) and (expected_rule == "none" or expected_rule == predicted_rule)
        status = "✓ PASS" if correct else "✗ FAIL"

        print(f"[{status}] Lang={lang:2} | Exp: {expected_rule:14} | Got: {predicted_rule:14} | Text: {text[:40]}...")

        results_detail.append({
            "text": text,
            "lang": lang,
            "expected_emergency": expected_emergency,
            "predicted_emergency": predicted_emergency,
            "expected_rule": expected_rule,
            "predicted_rule": predicted_rule,
            "correct": correct,
        })

    total = len(samples)
    recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
    accuracy = (tp + tn) / total if total > 0 else 1.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    print(f"\n-------------------------------------------------------")
    print(f"Metrics (n = {total}):")
    print(f"  Accuracy:  {accuracy * 100:.1f}%")
    print(f"  Recall:    {recall * 100:.1f}% (Emergency safety priority)")
    print(f"  Precision: {precision * 100:.1f}%")
    print(f"  F1 Score:  {f1:.3f}")
    print(f"-------------------------------------------------------")

    # Record to Supabase eval_runs
    client = get_supabase_admin()
    if client:
        try:
            records = [
                {
                    "kind": "classifier",
                    "engine": "awaz_safety_guard",
                    "lang": "multilingual",
                    "slice": "all_trades",
                    "metric": "recall",
                    "value": float(recall),
                    "n": total,
                    "details": {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "f1": f1},
                },
                {
                    "kind": "classifier",
                    "engine": "awaz_safety_guard",
                    "lang": "multilingual",
                    "slice": "all_trades",
                    "metric": "precision",
                    "value": float(precision),
                    "n": total,
                    "details": {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "f1": f1},
                },
                {
                    "kind": "classifier",
                    "engine": "awaz_safety_guard",
                    "lang": "multilingual",
                    "slice": "all_trades",
                    "metric": "accuracy",
                    "value": float(accuracy),
                    "n": total,
                    "details": {"results": results_detail[:5]},
                },
            ]
            client.table("eval_runs").insert(records).execute()
            print("✓ Successfully saved 3 evaluation runs into Supabase eval_runs table.")
        except Exception as e:
            print(f"! Notice: Could not write to Supabase (run migration first if table missing): {e}")
    else:
        print("! Notice: Supabase env vars not configured; skipped DB write.")


if __name__ == "__main__":
    evaluate_classifier()

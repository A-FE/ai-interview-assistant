"""
Report reader tool: extract structured weak points from a historical report JSON.
"""
import json
import re
from typing import Optional


def extract_weak_points(report_json: Optional[str]) -> str:
    """Parse a historical interview report and return a summary of weak points."""
    if not report_json:
        return ""
    try:
        # If report is stored as a JSON object with a weak_points field
        data = json.loads(report_json)
        if isinstance(data, dict):
            weak = data.get("weak_points") or data.get("薄弱知识点") or data.get("weak_points_summary")
            if weak:
                return weak if isinstance(weak, str) else json.dumps(weak, ensure_ascii=False)
    except (json.JSONDecodeError, TypeError):
        pass

    # Fallback: regex extraction from raw Markdown text
    match = re.search(r"薄弱知识点[汇总列表]*[：:](.*?)(?:\n#{1,3}|\Z)", report_json, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Return the raw text (truncated) so the agent has something to work with
    return report_json[:1000]

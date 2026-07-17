"""Small in-image grade collector used by course exercise notebooks."""

import json

_grades = {}


def record_grade(question_id, correct):
    """Record one question result for the trusted Jupyter proxy to collect."""
    _grades[str(question_id)] = "correct" if correct else "incorrect"


def grades_json():
    """Return current question results as a JSON object."""
    return json.dumps(_grades)

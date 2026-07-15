// A tiny, hand-rolled `learntools` stand-in shipped into Pyodide's virtual
// filesystem so exercise notebooks can `from learntools... import *` and call
// `qN.check()`. This is NOT the real Kaggle learntools — it only grades simple
// variable comparisons. Exercise authors write checkers against THIS shim
// (see the spec's "content" caveat). Each package file is written verbatim to
// /lib/<path> in the worker; keep these as valid standalone Python modules.

export const LEARNTOOLS_FILES: Record<string, string> = {
  "learntools/__init__.py": "",

  "learntools/core.py": `import json

class _Binder:
    def __init__(self):
        self.globals = {}
    def bind(self, g):
        # Capture the notebook's global namespace so checkers can read the
        # variables the learner defines in later cells.
        self.globals = g

binder = _Binder()

# qid -> "correct" | "incorrect"; read back by the worker after each run.
_grades = {}

def _grades_json():
    return json.dumps(_grades)

class _Blank:
    """The ____ placeholder left in exercise cells. Using it unchanged is wrong."""
    def __repr__(self):
        return "____ (fill this in)"

____ = _Blank()

_MISSING = object()

class Problem:
    def __init__(self, qid, check_fn, hint="", solution=""):
        self._qid = qid
        self._check_fn = check_fn
        self._hint = hint
        self._solution = solution

    def check(self):
        g = binder.globals
        try:
            ok, msg = self._check_fn(g)
        except Exception as e:
            ok, msg = False, "your code raised an error: {!r}".format(e)
        _grades[self._qid] = "correct" if ok else "incorrect"
        if ok:
            print("Correct!" + ((" " + msg) if msg else ""))
        else:
            fallback = "not quite yet. Try {}.hint().".format(self._qid)
            print("Incorrect: " + (msg or fallback))

    def hint(self):
        print(self._hint or "No hint available for this question.")

    def solution(self):
        print(self._solution or "No solution available for this question.")
`,

  "learntools/intro_to_programming/__init__.py": "",

  "learntools/intro_to_programming/ex1.py": `from learntools.core import binder, Problem, _Blank, ____, _MISSING


def _q1(g):
    v = g.get("message", _MISSING)
    if v is _MISSING:
        return False, "define a variable named \`message\`."
    if isinstance(v, _Blank):
        return False, "replace the ____ blank with the greeting text."
    if v == "Hello, world!":
        return True, ""
    return False, "expected 'Hello, world!' but got {!r}.".format(v)


def _q2(g):
    v = g.get("pi", _MISSING)
    if v is _MISSING:
        return False, "define a variable named \`pi\`."
    if isinstance(v, _Blank):
        return False, "replace the ____ blank with a number."
    try:
        if abs(v - 3.14159) < 1e-9:
            return True, ""
    except TypeError:
        return False, "\`pi\` should be a number."
    return False, "expected 3.14159 but got {!r}.".format(v)


q1 = Problem("q1", _q1, hint='Put the text in quotes: message = "Hello, world!"')
q2 = Problem("q2", _q2, hint="Use round(3.141592653589793, 5).")

__all__ = ["binder", "q1", "q2", "____"]
`,
}

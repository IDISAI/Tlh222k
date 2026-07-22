import { TRACE_LIMITS } from "./types"

/**
 * Builds an isolated Python program which evaluates a cell and leaves its
 * JSON-serialized TraceResult as the final expression for Pyodide to return.
 */
export function createPythonTraceBootstrap(source: string): string {
  // Double encoding prevents Python's string parser from changing JSON escapes
  // in user code before json.loads receives them.
  const payload = JSON.stringify(JSON.stringify({ source }))

  return String.raw`import io
import json
import math
import sys
import types

__codex_payload = ${payload}

def __codex_run():
    MAX_STEPS = ${TRACE_LIMITS.maxSteps}
    MAX_DEPTH = ${TRACE_LIMITS.maxDepth}
    MAX_STRING_LENGTH = ${TRACE_LIMITS.maxStringLength}
    __codex_source = json.loads(__codex_payload)["source"]
    __codex_steps = []
    __codex_heap_by_id = {}
    __codex_object_ids = {}
    __codex_frame_ids = {}
    __codex_next_object_id = 1
    __codex_next_frame_id = 1
    __codex_result = {"language": "python", "steps": __codex_steps, "truncated": False}
    __codex_original_stdout = sys.stdout
    __codex_stdout = io.StringIO()

    def __codex_clip(__codex_text):
        __codex_text = str(__codex_text)
        if len(__codex_text) <= MAX_STRING_LENGTH:
            return __codex_text
        return __codex_text[:MAX_STRING_LENGTH - 1] + "…"

    def __codex_truncated(__codex_value):
        return {"kind": "truncated", "preview": __codex_clip(__codex_value)}

    def __codex_key(__codex_value, __codex_index):
        if isinstance(__codex_value, str):
            return __codex_clip(__codex_value)
        if isinstance(__codex_value, (int, float, bool)) or __codex_value is None:
            return __codex_clip(__codex_value)
        return "key-" + str(__codex_index)

    def __codex_serialize_value(__codex_value, __codex_depth):
        nonlocal __codex_next_object_id
        if __codex_value is None or isinstance(__codex_value, (bool, int)):
            return {"kind": "primitive", "value": __codex_value}
        if isinstance(__codex_value, float):
            if math.isfinite(__codex_value):
                return {"kind": "primitive", "value": __codex_value}
            return __codex_truncated("float(" + str(__codex_value) + ")")
        if isinstance(__codex_value, str):
            if len(__codex_value) <= MAX_STRING_LENGTH:
                return {"kind": "primitive", "value": __codex_value}
            return __codex_truncated(__codex_value)
        if isinstance(__codex_value, (types.ModuleType, type)) or callable(__codex_value):
            return __codex_truncated("<" + __codex_clip(type(__codex_value).__name__) + ">")
        if __codex_depth >= MAX_DEPTH:
            return __codex_truncated("<" + __codex_clip(type(__codex_value).__name__) + ">")

        __codex_identity = id(__codex_value)
        __codex_existing = __codex_object_ids.get(__codex_identity)
        if __codex_existing is not None:
            return {"kind": "reference", "id": __codex_existing, "label": __codex_clip(type(__codex_value).__name__)}

        if isinstance(__codex_value, list):
            __codex_type = "list"
        elif isinstance(__codex_value, tuple):
            __codex_type = "tuple"
        elif isinstance(__codex_value, dict):
            __codex_type = "dict"
        elif isinstance(__codex_value, set):
            __codex_type = "set"
        else:
            try:
                vars(__codex_value)
            except TypeError:
                return __codex_truncated("<" + __codex_clip(type(__codex_value).__name__) + ">")
            __codex_type = __codex_clip(type(__codex_value).__name__)

        __codex_id = "heap-" + str(__codex_next_object_id)
        __codex_next_object_id += 1
        __codex_object_ids[__codex_identity] = __codex_id
        __codex_node = {"id": __codex_id, "type": __codex_type, "fields": {}}
        __codex_heap_by_id[__codex_id] = __codex_node

        if isinstance(__codex_value, (list, tuple)):
            for __codex_index, __codex_item in enumerate(__codex_value):
                __codex_node["fields"][str(__codex_index)] = __codex_serialize_value(__codex_item, __codex_depth + 1)
        elif isinstance(__codex_value, dict):
            for __codex_index, (__codex_key_value, __codex_item) in enumerate(__codex_value.items()):
                __codex_node["fields"][__codex_key(__codex_key_value, __codex_index)] = __codex_serialize_value(__codex_item, __codex_depth + 1)
        elif isinstance(__codex_value, set):
            for __codex_index, __codex_item in enumerate(sorted(__codex_value, key=lambda __codex_item: (type(__codex_item).__name__, id(__codex_item)))):
                __codex_node["fields"][str(__codex_index)] = __codex_serialize_value(__codex_item, __codex_depth + 1)
        else:
            for __codex_name, __codex_item in vars(__codex_value).items():
                if isinstance(__codex_name, str) and not __codex_name.startswith("_"):
                    __codex_node["fields"][__codex_name] = __codex_serialize_value(__codex_item, __codex_depth + 1)

        return {"kind": "reference", "id": __codex_id, "label": __codex_type}

    def __codex_frames(__codex_frame):
        nonlocal __codex_next_frame_id
        __codex_frames = []
        while __codex_frame is not None and len(__codex_frames) < MAX_DEPTH:
            if __codex_frame.f_code.co_filename == "<cell>":
                __codex_frame_identity = id(__codex_frame)
                __codex_frame_id = __codex_frame_ids.get(__codex_frame_identity)
                if __codex_frame_id is None:
                    __codex_frame_id = "frame-" + str(__codex_next_frame_id)
                    __codex_next_frame_id += 1
                    __codex_frame_ids[__codex_frame_identity] = __codex_frame_id
                __codex_locals = {}
                for __codex_name, __codex_local in __codex_frame.f_locals.items():
                    if isinstance(__codex_name, str) and not __codex_name.startswith("_"):
                        __codex_locals[__codex_name] = __codex_serialize_value(__codex_local, 0)
                __codex_frames.append({
                    "id": __codex_frame_id,
                    "name": __codex_frame.f_code.co_name,
                    "line": max(1, __codex_frame.f_lineno),
                    "locals": __codex_locals,
                })
            __codex_frame = __codex_frame.f_back
        __codex_frames.reverse()
        return __codex_frames

    def __codex_heap_snapshot():
        return [
            {"id": __codex_node["id"], "type": __codex_node["type"], "fields": dict(__codex_node["fields"])}
            for __codex_node in __codex_heap_by_id.values()
        ]

    def __codex_append_step(__codex_frame, __codex_event, __codex_line):
        if len(__codex_steps) >= MAX_STEPS:
            __codex_result["truncated"] = True
            return False
        __codex_steps.append({
            "index": len(__codex_steps),
            "line": max(1, __codex_line),
            "event": __codex_event,
            "frames": __codex_frames(__codex_frame) if __codex_frame is not None else [],
            "heap": __codex_heap_snapshot(),
            "stdout": __codex_stdout.getvalue().splitlines(),
        })
        return True

    def __codex_trace(__codex_frame, __codex_event, __codex_arg):
        if __codex_frame.f_code.co_filename != "<cell>":
            return __codex_trace
        if __codex_event not in ("call", "line", "return", "exception"):
            return __codex_trace
        if not __codex_append_step(__codex_frame, __codex_event, __codex_frame.f_lineno):
            sys.settrace(None)
            return None
        return __codex_trace

    def __codex_error_line(__codex_exc):
        __codex_line = getattr(__codex_exc, "lineno", None)
        if isinstance(__codex_line, int) and __codex_line > 0:
            return __codex_line
        __codex_traceback = __codex_exc.__traceback__
        while __codex_traceback is not None:
            if __codex_traceback.tb_frame.f_code.co_filename == "<cell>":
                return max(1, __codex_traceback.tb_lineno)
            __codex_traceback = __codex_traceback.tb_next
        return None

    try:
        sys.stdout = __codex_stdout
        __codex_globals = {"__name__": "__main__"}
        sys.settrace(__codex_trace)
        exec(compile(__codex_source, "<cell>", "exec"), __codex_globals, __codex_globals)
    except BaseException as __codex_exc:
        __codex_line = __codex_error_line(__codex_exc)
        __codex_result["error"] = {
            "name": __codex_clip(type(__codex_exc).__name__),
            "message": __codex_clip(__codex_exc),
        }
        if __codex_line is not None:
            __codex_result["error"]["line"] = __codex_line
        if not __codex_steps or __codex_steps[-1]["event"] != "exception":
            __codex_append_step(None, "exception", __codex_line or 1)
    finally:
        sys.settrace(None)
        sys.stdout = __codex_original_stdout

    return json.dumps(__codex_result, ensure_ascii=False, separators=(",", ":"))

__codex_trace_result_json = __codex_run()
__codex_trace_result_json
`
}

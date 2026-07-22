import { TRACE_LIMITS } from "./types"

/**
 * Builds an isolated Python program which evaluates a cell and leaves its
 * JSON-serialized TraceResult as the final expression for Pyodide to return.
 */
export function createPythonTraceBootstrap(source: string): string {
  // Double encoding prevents Python's string parser from changing JSON escapes
  // in user code before json.loads receives them.
  const payload = JSON.stringify(JSON.stringify({ source }))

  return String.raw`import builtins
import json
import math
import sys
import types

__codex_payload = ${payload}

def __codex_run():
    MAX_STEPS = ${TRACE_LIMITS.maxSteps}
    MAX_DEPTH = ${TRACE_LIMITS.maxDepth}
    MAX_STRING_LENGTH = ${TRACE_LIMITS.maxStringLength}
    MAX_COLLECTION_ENTRIES = ${TRACE_LIMITS.maxCollectionEntries}
    MAX_HEAP_NODES = ${TRACE_LIMITS.maxHeapNodes}
    MAX_OUTPUT_LINES = ${TRACE_LIMITS.maxOutputLines}
    MAX_OUTPUT_BYTES = ${TRACE_LIMITS.maxOutputBytes}
    __codex_source = json.loads(__codex_payload)["source"]
    __codex_steps = []
    __codex_heap_by_id = {}
    __codex_object_ids = {}
    __codex_expanded_ids = set()
    __codex_frame_ids = {}
    __codex_next_object_id = 1
    __codex_next_frame_id = 1
    __codex_result = {"language": "python", "steps": __codex_steps, "truncated": False}
    __codex_original_stdout = sys.stdout

    class __codex_TraceLimit(BaseException):
        pass

    class __codex_OutputCapture:
        def __init__(self):
            self.__lines = []
            self.__current = []
            self.__bytes = 0
            self.__full = False

        def write(self, __codex_text):
            if not isinstance(__codex_text, str):
                raise TypeError("write() argument must be str")
            __codex_length = len(__codex_text)
            if self.__full:
                return __codex_length
            for __codex_character in __codex_text:
                __codex_encoded = __codex_character.encode("utf-8", errors="replace")
                if self.__bytes + len(__codex_encoded) > MAX_OUTPUT_BYTES:
                    self.__full = True
                    break
                self.__bytes += len(__codex_encoded)
                if __codex_character == "\n":
                    self.__lines.append("".join(self.__current))
                    self.__current = []
                    if len(self.__lines) >= MAX_OUTPUT_LINES:
                        self.__full = True
                        break
                elif __codex_character != "\r" and len(self.__current) < MAX_STRING_LENGTH:
                    self.__current.append(__codex_character)
            return __codex_length

        def flush(self):
            return None

        def snapshot(self):
            __codex_lines = list(self.__lines)
            if self.__current and len(__codex_lines) < MAX_OUTPUT_LINES:
                __codex_lines.append("".join(self.__current))
            return __codex_lines

    __codex_stdout = __codex_OutputCapture()

    class __codex_SysProxy:
        def __init__(self, __codex_capture):
            object.__setattr__(self, "_capture", __codex_capture)

        def __getattr__(self, __codex_name):
            if __codex_name == "settrace":
                return lambda __codex_trace_fn: None
            if __codex_name == "stdout":
                return object.__getattribute__(self, "_capture")
            return getattr(sys, __codex_name)

        def __setattr__(self, __codex_name, __codex_value):
            if __codex_name in ("settrace", "stdout"):
                return
            setattr(sys, __codex_name, __codex_value)

    __codex_sys_proxy = __codex_SysProxy(__codex_stdout)
    __codex_real_import = builtins.__import__

    def __codex_import(__codex_name, __codex_globals=None, __codex_locals=None, __codex_fromlist=(), __codex_level=0):
        __codex_module = __codex_real_import(
            __codex_name,
            __codex_globals,
            __codex_locals,
            __codex_fromlist,
            __codex_level,
        )
        if __codex_name == "sys":
            return __codex_sys_proxy
        return __codex_module

    def __codex_clip(__codex_value, __codex_fallback="<unavailable>"):
        try:
            __codex_text = str(__codex_value)
        except BaseException:
            __codex_text = __codex_fallback
        if len(__codex_text) <= MAX_STRING_LENGTH:
            return __codex_text
        return __codex_text[:MAX_STRING_LENGTH - 1] + "…"

    def __codex_attributes(__codex_value):
        try:
            __codex_attrs = vars(__codex_value)
        except BaseException:
            return None
        return __codex_attrs if isinstance(__codex_attrs, dict) else None

    def __codex_truncated(__codex_value):
        return {"kind": "truncated", "preview": __codex_clip(__codex_value)}

    def __codex_key(__codex_value, __codex_index):
        if isinstance(__codex_value, str):
            return __codex_clip(__codex_value)
        if isinstance(__codex_value, (int, float, bool)) or __codex_value is None:
            return __codex_clip(__codex_value)
        return "key-" + str(__codex_index)

    def __codex_unique_key(__codex_fields, __codex_base):
        __codex_base = __codex_clip(__codex_base)
        if __codex_base not in __codex_fields:
            return __codex_base
        __codex_suffix_index = 2
        while True:
            __codex_suffix = "#" + str(__codex_suffix_index)
            __codex_candidate = __codex_base[:MAX_STRING_LENGTH - len(__codex_suffix)] + __codex_suffix
            if __codex_candidate not in __codex_fields:
                return __codex_candidate
            __codex_suffix_index += 1

    def __codex_order_key(__codex_value, __codex_depth=0):
        try:
            if __codex_value is None:
                return ("none", "")
            if isinstance(__codex_value, bool):
                return ("bool", "1" if __codex_value else "0")
            if isinstance(__codex_value, int):
                return ("int", str(__codex_value))
            if isinstance(__codex_value, float):
                return ("float", repr(__codex_value))
            if isinstance(__codex_value, str):
                return ("str", __codex_value[:MAX_STRING_LENGTH])
            if isinstance(__codex_value, bytes):
                return ("bytes", __codex_value[:MAX_STRING_LENGTH].hex())
            if isinstance(__codex_value, tuple) and __codex_depth < MAX_DEPTH:
                return (
                    "tuple",
                    json.dumps(
                        [
                            __codex_order_key(__codex_item, __codex_depth + 1)
                            for __codex_item in __codex_value[:MAX_COLLECTION_ENTRIES]
                        ],
                        ensure_ascii=False,
                        separators=(",", ":"),
                    ),
                )
            __codex_type_key = (
                type(__codex_value).__module__ + "." + type(__codex_value).__qualname__
            )
            if __codex_depth >= MAX_DEPTH:
                return ("object", __codex_type_key)
            __codex_attrs = __codex_attributes(__codex_value)
            if __codex_attrs is None:
                return ("object", __codex_type_key)
            __codex_public_attrs = []
            for __codex_index, (__codex_name, __codex_item) in enumerate(dict.items(__codex_attrs)):
                if __codex_index >= MAX_COLLECTION_ENTRIES:
                    break
                if isinstance(__codex_name, str) and not __codex_name.startswith("_"):
                    __codex_public_attrs.append((
                        __codex_clip(__codex_name),
                        __codex_order_key(__codex_item, __codex_depth + 1),
                    ))
            __codex_public_attrs.sort(key=lambda __codex_item: __codex_item[0])
            return (
                "object",
                __codex_type_key + json.dumps(
                    __codex_public_attrs,
                    ensure_ascii=False,
                    separators=(",", ":"),
                ),
            )
        except BaseException:
            return ("unavailable", "")

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
        if __codex_existing in __codex_expanded_ids:
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
            __codex_attrs = __codex_attributes(__codex_value)
            if __codex_attrs is None:
                return __codex_truncated("<" + __codex_clip(type(__codex_value).__name__) + ">")
            __codex_type = __codex_clip(type(__codex_value).__name__)

        if __codex_existing is None:
            if len(__codex_object_ids) >= MAX_HEAP_NODES:
                return __codex_truncated("<heap limit>")
            __codex_id = "heap-" + str(__codex_next_object_id)
            __codex_next_object_id += 1
            __codex_object_ids[__codex_identity] = __codex_id
        else:
            __codex_id = __codex_existing
        __codex_expanded_ids.add(__codex_id)
        __codex_node = {"id": __codex_id, "type": __codex_type, "fields": {}}
        __codex_heap_by_id[__codex_id] = __codex_node

        if isinstance(__codex_value, list):
            for __codex_index, __codex_item in enumerate(list.__iter__(__codex_value)):
                if __codex_index >= MAX_COLLECTION_ENTRIES:
                    break
                __codex_node["fields"][str(__codex_index)] = __codex_serialize_value(__codex_item, __codex_depth + 1)
        elif isinstance(__codex_value, tuple):
            for __codex_index, __codex_item in enumerate(tuple.__iter__(__codex_value)):
                if __codex_index >= MAX_COLLECTION_ENTRIES:
                    break
                __codex_node["fields"][str(__codex_index)] = __codex_serialize_value(__codex_item, __codex_depth + 1)
        elif isinstance(__codex_value, dict):
            for __codex_index, (__codex_key_value, __codex_item) in enumerate(dict.items(__codex_value)):
                if __codex_index >= MAX_COLLECTION_ENTRIES:
                    break
                __codex_field = __codex_unique_key(
                    __codex_node["fields"],
                    __codex_key(__codex_key_value, __codex_index),
                )
                __codex_node["fields"][__codex_field] = __codex_serialize_value(__codex_item, __codex_depth + 1)
        elif isinstance(__codex_value, set):
            if set.__len__(__codex_value) <= MAX_COLLECTION_ENTRIES:
                __codex_items = sorted(set.__iter__(__codex_value), key=__codex_order_key)
                for __codex_index, __codex_item in enumerate(__codex_items):
                    __codex_node["fields"][str(__codex_index)] = __codex_serialize_value(__codex_item, __codex_depth + 1)
        else:
            for __codex_index, (__codex_name, __codex_item) in enumerate(dict.items(__codex_attrs)):
                if __codex_index >= MAX_COLLECTION_ENTRIES:
                    break
                if isinstance(__codex_name, str) and not __codex_name.startswith("_"):
                    __codex_field = __codex_unique_key(__codex_node["fields"], __codex_name)
                    __codex_node["fields"][__codex_field] = __codex_serialize_value(__codex_item, __codex_depth + 1)

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
                for __codex_index, (__codex_name, __codex_local) in enumerate(__codex_frame.f_locals.items()):
                    if __codex_index >= MAX_COLLECTION_ENTRIES:
                        break
                    if isinstance(__codex_name, str) and not __codex_name.startswith("_"):
                        __codex_local_name = __codex_unique_key(__codex_locals, __codex_name)
                        __codex_locals[__codex_local_name] = __codex_serialize_value(__codex_local, 0)
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
            raise __codex_TraceLimit()
        __codex_expanded_ids.clear()
        __codex_steps.append({
            "index": len(__codex_steps),
            "line": max(1, __codex_line),
            "event": __codex_event,
            "frames": __codex_frames(__codex_frame) if __codex_frame is not None else [],
            "heap": __codex_heap_snapshot(),
            "stdout": __codex_stdout.snapshot(),
        })
        return True

    def __codex_trace(__codex_frame, __codex_event, __codex_arg):
        if __codex_frame.f_code.co_filename != "<cell>":
            return __codex_trace
        if __codex_event not in ("call", "line", "return", "exception"):
            return __codex_trace
        sys.stdout = __codex_stdout
        __codex_append_step(__codex_frame, __codex_event, __codex_frame.f_lineno)
        return __codex_trace

    def __codex_error_line(__codex_exc):
        try:
            __codex_line = getattr(__codex_exc, "lineno", None)
        except BaseException:
            __codex_line = None
        if isinstance(__codex_line, int) and __codex_line > 0:
            return __codex_line
        try:
            __codex_traceback = object.__getattribute__(__codex_exc, "__traceback__")
        except BaseException:
            __codex_traceback = None
        while __codex_traceback is not None:
            if __codex_traceback.tb_frame.f_code.co_filename == "<cell>":
                return max(1, __codex_traceback.tb_lineno)
            __codex_traceback = __codex_traceback.tb_next
        return None

    try:
        sys.stdout = __codex_stdout
        __codex_globals = {"__name__": "__main__"}
        __codex_user_builtins = dict(vars(builtins))
        __codex_user_builtins["__import__"] = __codex_import
        __codex_globals["__builtins__"] = __codex_user_builtins
        sys.settrace(__codex_trace)
        exec(compile(__codex_source, "<cell>", "exec"), __codex_globals, __codex_globals)
    except __codex_TraceLimit:
        __codex_result["truncated"] = True
    except BaseException as __codex_exc:
        __codex_line = __codex_error_line(__codex_exc)
        __codex_result["error"] = {
            "name": __codex_clip(type(__codex_exc).__name__),
            "message": __codex_clip(
                __codex_exc,
                "<unprintable " + __codex_clip(type(__codex_exc).__name__) + ">",
            ),
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

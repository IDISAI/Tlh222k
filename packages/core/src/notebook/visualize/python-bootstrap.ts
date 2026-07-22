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
import importlib
import json
import math
import sys
import types

# Bound before user code runs: a traced cell may mutate the real json/math
# modules, and the tracer must keep working on the originals.
__codex_json_dumps = json.dumps
__codex_json_loads = json.loads
__codex_isfinite = math.isfinite

__codex_payload = ${payload}

def __codex_run():
    MAX_STEPS = ${TRACE_LIMITS.maxSteps}
    MAX_DEPTH = ${TRACE_LIMITS.maxDepth}
    MAX_STRING_LENGTH = ${TRACE_LIMITS.maxStringLength}
    MAX_COLLECTION_ENTRIES = ${TRACE_LIMITS.maxCollectionEntries}
    MAX_INSPECTED_ENTRIES = MAX_COLLECTION_ENTRIES * 4
    MAX_HEAP_NODES = ${TRACE_LIMITS.maxHeapNodes}
    MAX_OUTPUT_LINES = ${TRACE_LIMITS.maxOutputLines}
    MAX_OUTPUT_BYTES = ${TRACE_LIMITS.maxOutputBytes}
    MAX_SAFE_INTEGER_BITS = 53
    __codex_source = __codex_json_loads(__codex_payload)["source"]
    __codex_steps = []
    __codex_heap_by_id = {}
    __codex_current_objects = {}
    __codex_previous_objects = {}
    __codex_expanded_ids = set()
    __codex_active_frames = {}
    __codex_next_object_id = 1
    __codex_next_frame_id = 1
    __codex_result = {"language": "python", "steps": __codex_steps, "truncated": False}
    __codex_original_stdout = sys.stdout

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

    __codex_real_import = builtins.__import__
    __codex_safe_builtins = types.ModuleType("builtins")
    vars(__codex_safe_builtins).update(vars(builtins))
    __codex_safe_builtins.__import__ = __codex_real_import

    __codex_helper_globals = {"__builtins__": {"__import__": __codex_real_import}}
    exec(
        "def import_module(name, package=None):\n"
        "    if package is not None and name.startswith('.'):\n"
        "        raise ImportError('relative imports are unavailable in traced cells')\n"
        "    return __import__(name, fromlist=['*'])\n"
        "def ignore_settrace(trace_fn):\n"
        "    return None\n",
        __codex_helper_globals,
    )

    __codex_safe_importlib = types.ModuleType("importlib")
    __codex_safe_importlib.import_module = __codex_helper_globals["import_module"]

    __codex_safe_sys = types.ModuleType("sys")
    for __codex_name in (
        "api_version",
        "base_exec_prefix",
        "base_prefix",
        "byteorder",
        "dont_write_bytecode",
        "exec_prefix",
        "executable",
        "flags",
        "float_info",
        "hash_info",
        "hexversion",
        "implementation",
        "int_info",
        "maxsize",
        "path",
        "platform",
        "prefix",
        "pycache_prefix",
        "thread_info",
        "version",
        "version_info",
        "warnoptions",
    ):
        if hasattr(sys, __codex_name):
            __codex_value = getattr(sys, __codex_name)
            if isinstance(__codex_value, list):
                __codex_value = list(__codex_value)
            setattr(__codex_safe_sys, __codex_name, __codex_value)
    __codex_safe_sys.settrace = __codex_helper_globals["ignore_settrace"]
    __codex_safe_sys.stdout = __codex_stdout
    __codex_safe_sys.modules = {
        "builtins": __codex_safe_builtins,
        "importlib": __codex_safe_importlib,
        "sys": __codex_safe_sys,
    }
    __codex_guarded_modules = {
        "builtins": __codex_safe_builtins,
        "importlib": __codex_safe_importlib,
        "sys": __codex_safe_sys,
    }
    __codex_original_modules = {
        __codex_name: sys.modules.get(__codex_name)
        for __codex_name in __codex_guarded_modules
    }

    def __codex_clip(__codex_value, __codex_fallback="<unavailable>"):
        try:
            __codex_text = str(__codex_value)
        except BaseException:
            __codex_text = __codex_fallback
        if len(__codex_text) <= MAX_STRING_LENGTH:
            return __codex_text
        return __codex_text[:MAX_STRING_LENGTH - 3] + "..."

    def __codex_type_name(__codex_value):
        # A hostile metaclass can make type(x).__name__ raise. Tracing must
        # never propagate that into the user's own execution.
        try:
            return __codex_clip(type(__codex_value).__name__)
        except BaseException:
            return "object"

    def __codex_attributes(__codex_value):
        try:
            __codex_attrs = vars(__codex_value)
        except BaseException:
            return None
        return __codex_attrs if isinstance(__codex_attrs, dict) else None

    def __codex_truncated(__codex_value):
        return {"kind": "truncated", "preview": __codex_clip(__codex_value)}

    def __codex_mark_scan_limit(__codex_fields, __codex_label):
        if len(__codex_fields) >= MAX_COLLECTION_ENTRIES:
            __codex_fields.popitem()
        __codex_field = __codex_unique_key(__codex_fields, "<truncated>")
        __codex_fields[__codex_field] = __codex_truncated(__codex_label)

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
                return ("none",)
            if isinstance(__codex_value, bool):
                return ("bool", __codex_value)
            if isinstance(__codex_value, int):
                return ("int", __codex_value)
            if isinstance(__codex_value, float):
                return ("float", float.hex(__codex_value))
            if isinstance(__codex_value, str):
                return ("str", __codex_value)
            if isinstance(__codex_value, bytes):
                return ("bytes", __codex_value)
            if isinstance(__codex_value, tuple):
                if __codex_depth >= MAX_DEPTH:
                    return ("tuple", "<depth limit>")
                return (
                    "tuple",
                    tuple(
                        __codex_order_key(__codex_item, __codex_depth + 1)
                        for __codex_item in __codex_value[:MAX_COLLECTION_ENTRIES]
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
                if __codex_index >= MAX_INSPECTED_ENTRIES:
                    break
                if isinstance(__codex_name, str) and not __codex_name.startswith("_"):
                    if len(__codex_public_attrs) >= MAX_COLLECTION_ENTRIES:
                        break
                    __codex_public_attrs.append((
                        __codex_name,
                        __codex_order_key(__codex_item, __codex_depth + 1),
                    ))
            __codex_public_attrs.sort(key=lambda __codex_item: __codex_item[0])
            return (
                "object",
                __codex_type_key,
                tuple(__codex_public_attrs),
            )
        except BaseException:
            return ("unavailable",)

    def __codex_serialize_value(__codex_value, __codex_depth):
        nonlocal __codex_next_object_id
        if __codex_value is None or isinstance(__codex_value, bool):
            return {"kind": "primitive", "value": __codex_value}
        if isinstance(__codex_value, int):
            # Unbound int methods only: an int subclass may override comparison
            # operators, __str__, and __int__ to lie about its magnitude.
            __codex_bits = int.bit_length(__codex_value)
            if __codex_bits <= MAX_SAFE_INTEGER_BITS:
                return {"kind": "primitive", "value": __codex_value}
            if __codex_bits > MAX_STRING_LENGTH * 4:
                return __codex_truncated("<int " + str(__codex_bits) + " bits>")
            return __codex_truncated(int.__repr__(__codex_value))
        if isinstance(__codex_value, float):
            if __codex_isfinite(__codex_value):
                return {"kind": "primitive", "value": __codex_value}
            return __codex_truncated("float(" + str(__codex_value) + ")")
        if isinstance(__codex_value, str):
            if len(__codex_value) <= MAX_STRING_LENGTH:
                return {"kind": "primitive", "value": __codex_value}
            return __codex_truncated(__codex_value)
        if isinstance(__codex_value, (types.ModuleType, type)) or callable(__codex_value):
            return __codex_truncated("<" + __codex_type_name(__codex_value) + ">")
        if __codex_depth >= MAX_DEPTH:
            return __codex_truncated("<" + __codex_type_name(__codex_value) + ">")

        __codex_identity = id(__codex_value)
        __codex_entry = __codex_current_objects.get(__codex_identity)
        if __codex_entry is None or __codex_entry[0] is not __codex_value:
            __codex_entry = __codex_previous_objects.get(__codex_identity)
        __codex_existing = (
            __codex_entry[1]
            if __codex_entry is not None and __codex_entry[0] is __codex_value
            else None
        )
        if __codex_existing in __codex_expanded_ids:
            return {"kind": "reference", "id": __codex_existing, "label": __codex_type_name(__codex_value)}

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
                return __codex_truncated("<" + __codex_type_name(__codex_value) + ">")
            __codex_type = __codex_type_name(__codex_value)

        if __codex_existing is None:
            if len(__codex_heap_by_id) >= MAX_HEAP_NODES:
                return __codex_truncated("<heap limit>")
            __codex_id = "heap-" + str(__codex_next_object_id)
            __codex_next_object_id += 1
        else:
            __codex_id = __codex_existing
        __codex_current_objects[__codex_identity] = (__codex_value, __codex_id)
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
            __codex_set_size = set.__len__(__codex_value)
            if __codex_set_size > MAX_COLLECTION_ENTRIES:
                __codex_node["fields"]["<truncated>"] = __codex_truncated(
                    str(__codex_set_size) + " set items"
                )
            else:
                __codex_items = [
                    (__codex_order_key(__codex_item), __codex_item)
                    for __codex_item in set.__iter__(__codex_value)
                ]
                __codex_items.sort(key=lambda __codex_pair: __codex_pair[0])
                __codex_has_tie = any(
                    __codex_items[__codex_index - 1][0] == __codex_items[__codex_index][0]
                    for __codex_index in range(1, len(__codex_items))
                )
                if __codex_has_tie:
                    __codex_node["fields"]["<truncated>"] = __codex_truncated("set ordering tie")
                else:
                    for __codex_index, (_, __codex_item) in enumerate(__codex_items):
                        __codex_node["fields"][str(__codex_index)] = __codex_serialize_value(__codex_item, __codex_depth + 1)
        else:
            __codex_scan_truncated = False
            for __codex_index, (__codex_name, __codex_item) in enumerate(dict.items(__codex_attrs)):
                if __codex_index >= MAX_INSPECTED_ENTRIES:
                    __codex_scan_truncated = True
                    break
                if isinstance(__codex_name, str) and not __codex_name.startswith("_"):
                    if len(__codex_node["fields"]) >= MAX_COLLECTION_ENTRIES:
                        __codex_scan_truncated = True
                        break
                    __codex_field = __codex_unique_key(__codex_node["fields"], __codex_name)
                    __codex_node["fields"][__codex_field] = __codex_serialize_value(__codex_item, __codex_depth + 1)
            if __codex_scan_truncated:
                __codex_mark_scan_limit(
                    __codex_node["fields"],
                    "attribute scan limit",
                )

        return {"kind": "reference", "id": __codex_id, "label": __codex_type}

    def __codex_frames(__codex_frame):
        nonlocal __codex_next_frame_id
        __codex_frames = []
        while __codex_frame is not None and len(__codex_frames) < MAX_DEPTH:
            if __codex_frame.f_code.co_filename == "<cell>":
                __codex_frame_identity = id(__codex_frame)
                __codex_frame_entry = __codex_active_frames.get(__codex_frame_identity)
                if __codex_frame_entry is None or __codex_frame_entry[0] is not __codex_frame:
                    __codex_frame_id = "frame-" + str(__codex_next_frame_id)
                    __codex_next_frame_id += 1
                    __codex_active_frames[__codex_frame_identity] = (
                        __codex_frame,
                        __codex_frame_id,
                    )
                else:
                    __codex_frame_id = __codex_frame_entry[1]
                __codex_locals = {}
                __codex_scan_truncated = False
                for __codex_index, (__codex_name, __codex_local) in enumerate(__codex_frame.f_locals.items()):
                    if __codex_index >= MAX_INSPECTED_ENTRIES:
                        __codex_scan_truncated = True
                        break
                    if isinstance(__codex_name, str) and not __codex_name.startswith("_"):
                        if len(__codex_locals) >= MAX_COLLECTION_ENTRIES:
                            __codex_scan_truncated = True
                            break
                        __codex_local_name = __codex_unique_key(__codex_locals, __codex_name)
                        __codex_locals[__codex_local_name] = __codex_serialize_value(__codex_local, 0)
                if __codex_scan_truncated:
                    __codex_mark_scan_limit(__codex_locals, "local scan limit")
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
        nonlocal __codex_current_objects, __codex_previous_objects
        if len(__codex_steps) >= MAX_STEPS:
            __codex_result["truncated"] = True
            return False
        __codex_previous_objects = __codex_current_objects
        __codex_current_objects = {}
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

    def __codex_stop_tracing():
        __codex_result["truncated"] = True
        try:
            sys.settrace(None)
        except BaseException:
            pass
        __codex_active_frames.clear()

    def __codex_trace(__codex_frame, __codex_event, __codex_arg):
        try:
            if __codex_frame.f_code.co_filename != "<cell>":
                return __codex_trace
            if __codex_event not in ("call", "line", "return", "exception"):
                return __codex_trace
            if len(__codex_steps) >= MAX_STEPS:
                # Capture cap reached. Stop tracing instead of raising, so a
                # bare except in the cell cannot fabricate a trace, and the
                # rest of the cell still runs at full speed.
                __codex_stop_tracing()
                return None
            sys.stdout = __codex_stdout
            __codex_append_step(__codex_frame, __codex_event, __codex_frame.f_lineno)
            if __codex_event == "return":
                __codex_frame_identity = id(__codex_frame)
                __codex_frame_entry = __codex_active_frames.get(__codex_frame_identity)
                if __codex_frame_entry is not None and __codex_frame_entry[0] is __codex_frame:
                    __codex_active_frames.pop(__codex_frame_identity, None)
        except BaseException:
            # A tracer failure must degrade to a truncated trace, never surface
            # inside the user's cell as their own exception.
            __codex_stop_tracing()
            return None
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
        __codex_user_builtins = dict(vars(__codex_safe_builtins))
        __codex_globals["__builtins__"] = __codex_user_builtins
        for __codex_name, __codex_module in __codex_guarded_modules.items():
            sys.modules[__codex_name] = __codex_module
        sys.settrace(__codex_trace)
        exec(compile(__codex_source, "<cell>", "exec"), __codex_globals, __codex_globals)
    except BaseException as __codex_exc:
        __codex_line = __codex_error_line(__codex_exc)
        __codex_result["error"] = {
            "name": __codex_type_name(__codex_exc),
            "message": __codex_clip(
                __codex_exc,
                "<unprintable " + __codex_type_name(__codex_exc) + ">",
            ),
        }
        if __codex_line is not None:
            __codex_result["error"]["line"] = __codex_line
        if not __codex_steps or __codex_steps[-1]["event"] != "exception":
            __codex_append_step(None, "exception", __codex_line or 1)
    finally:
        sys.settrace(None)
        if __codex_result["truncated"] and __codex_steps:
            __codex_steps[-1]["stdout"] = __codex_stdout.snapshot()
        sys.stdout = __codex_original_stdout
        for __codex_name, __codex_module in __codex_original_modules.items():
            if __codex_module is None:
                sys.modules.pop(__codex_name, None)
            else:
                sys.modules[__codex_name] = __codex_module

    return __codex_json_dumps(__codex_result, ensure_ascii=False, separators=(",", ":"))

__codex_trace_result_json = __codex_run()
__codex_trace_result_json
`
}

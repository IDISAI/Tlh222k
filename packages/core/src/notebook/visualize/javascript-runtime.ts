// JavaScript execution tracer (C4). Pure and synchronous: parses a cell with
// acorn and walks the AST itself, emitting the same TraceResult schema the
// Python engine produces, so the panel stays language-agnostic.
//
// User code never reaches host `eval`/`Function`. It sees only the globals this
// file installs and, on host arrays/strings/numbers, only allow-listed members —
// so `[].constructor.constructor("...")` cannot reach the host realm.
//
// Deliberately outside the package barrel: it belongs to the worker graph.

import * as acorn from "acorn"

import {
  TRACE_LIMITS,
  type TraceFrame,
  type TraceHeapNode,
  type TraceResult,
  type TraceStep,
  type TraceValue,
} from "./types"

/** Host recursion budget; the interpreter runs on the host call stack. */
const MAX_CALL_DEPTH = 64
const MAX_SAFE_INTEGER_BITS = 53

type AnyNode = acorn.Node & Record<string, unknown>

// ── values ───────────────────────────────────────────────────────────────────

class InterpretedFunction {
  constructor(
    readonly name: string,
    readonly params: AnyNode[],
    readonly body: AnyNode,
    readonly scope: Scope,
    /** Arrow functions have no own `this` and no implicit block body. */
    readonly isArrow: boolean,
    readonly isExpressionBody: boolean
  ) {}
}

/** A host function the interpreter exposes deliberately (console.log, Math.max). */
class NativeFunction {
  constructor(
    readonly name: string,
    readonly call: (args: unknown[]) => unknown
  ) {}
}

class Scope {
  private readonly values = new Map<string, unknown>()
  private readonly constants = new Set<string>()

  constructor(
    readonly parent: Scope | null,
    /** True for the scope a `var` declaration hoists to. */
    readonly isFunctionScope: boolean,
    /** The interpreter's own globals; never reported as user variables. */
    readonly isBuiltins = false
  ) {}

  declare(name: string, value: unknown, kind: "var" | "let" | "const"): void {
    if (kind === "var") {
      this.functionScope().values.set(name, value)
      return
    }
    this.values.set(name, value)
    if (kind === "const") this.constants.add(name)
  }

  has(name: string): boolean {
    return this.values.has(name) || (this.parent?.has(name) ?? false)
  }

  get(name: string): unknown {
    if (this.values.has(name)) return this.values.get(name)
    if (this.parent) return this.parent.get(name)
    throw new TraceRuntimeError("ReferenceError", `${name} is not defined`)
  }

  set(name: string, value: unknown): void {
    if (this.values.has(name)) {
      if (this.constants.has(name)) {
        throw new TraceRuntimeError(
          "TypeError",
          "Assignment to constant variable."
        )
      }
      this.values.set(name, value)
      return
    }
    if (this.parent) {
      this.parent.set(name, value)
      return
    }
    throw new TraceRuntimeError("ReferenceError", `${name} is not defined`)
  }

  /** Own bindings, in declaration order — what the panel shows as locals. */
  ownEntries(): [string, unknown][] {
    return [...this.values.entries()]
  }

  private functionScope(): Scope {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let scope: Scope = this
    while (!scope.isFunctionScope && scope.parent) scope = scope.parent
    return scope
  }
}

interface Frame {
  id: string
  name: string
  /** Scope the frame's own bindings start at; locals stop climbing here. */
  root: Scope
  current: Scope
  line: number
}

// ── control flow and errors ──────────────────────────────────────────────────

class BreakSignal {
  constructor(readonly label: string | null) {}
}
class ContinueSignal {
  constructor(readonly label: string | null) {}
}
class ReturnSignal {
  constructor(readonly value: unknown) {}
}
/**
 * Raised once the step cap is reached. Unlike the Python engine — which cannot
 * stop CPython and leaves the hard cut to worker termination — this interpreter
 * owns the loop, so it aborts deterministically. User `catch`/`finally` cannot
 * swallow it, so a bare `catch` can never fabricate a trace.
 */
class TraceCapSignal {}

/** An error the traced program can observe (and catch). */
class TraceRuntimeError extends Error {
  constructor(
    name: string,
    message: string,
    readonly line?: number
  ) {
    super(message)
    this.name = name
  }
}

/** A thrown user value that is not an Error (e.g. `throw 42`). */
class ThrownValue {
  constructor(readonly value: unknown) {}
}

// ── member access allow-list ─────────────────────────────────────────────────

const ARRAY_METHODS = new Set([
  "at",
  "concat",
  "every",
  "fill",
  "filter",
  "find",
  "findIndex",
  "flat",
  "forEach",
  "includes",
  "indexOf",
  "join",
  "lastIndexOf",
  "map",
  "pop",
  "push",
  "reduce",
  "reduceRight",
  "reverse",
  "shift",
  "slice",
  "some",
  "sort",
  "splice",
  "unshift",
])

const STRING_METHODS = new Set([
  "at",
  "charAt",
  "charCodeAt",
  "codePointAt",
  "concat",
  "endsWith",
  "includes",
  "indexOf",
  "lastIndexOf",
  "normalize",
  "padEnd",
  "padStart",
  "repeat",
  "replace",
  "replaceAll",
  "slice",
  "split",
  "startsWith",
  "substring",
  "toLowerCase",
  "toUpperCase",
  "trim",
  "trimEnd",
  "trimStart",
])

const NUMBER_METHODS = new Set([
  "toExponential",
  "toFixed",
  "toPrecision",
  "toString",
])

/** Never readable, on any receiver: these are the realm-escape hatches. */
const FORBIDDEN_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
])

// ── entry point ──────────────────────────────────────────────────────────────

export function traceJavaScript(source: string): TraceResult {
  const interpreter = new Interpreter()
  return interpreter.run(source)
}

class Interpreter {
  private readonly steps: TraceStep[] = []
  private readonly frames: Frame[] = []
  private readonly stdout: OutputCapture = new OutputCapture()
  private readonly heapIds = new Map<object, string>()
  private truncated = false
  private capped = false
  private nextHeapId = 1
  private nextFrameId = 1
  private depth = 0

  run(source: string): TraceResult {
    const result: TraceResult = {
      language: "javascript",
      steps: this.steps,
      truncated: false,
    }

    let program: AnyNode
    try {
      program = acorn.parse(source, {
        ecmaVersion: 2022,
        sourceType: "script",
        locations: true,
      }) as unknown as AnyNode
    } catch (error) {
      const syntax = error as { message?: string; loc?: { line?: number } }
      result.error = {
        name: "SyntaxError",
        message: clip(syntax.message ?? "invalid syntax"),
      }
      if (typeof syntax.loc?.line === "number")
        result.error.line = syntax.loc.line
      this.pushStep(1, "exception")
      result.truncated = this.truncated
      return result
    }

    // Builtins live in a scope *above* the module scope. Locals stop climbing
    // at the frame root, so console/Math/JSON stay out of the variables panel
    // and never consume heap-node budget the user's own data needs.
    const builtinScope = new Scope(null, true, true)
    installGlobals(builtinScope, this.stdout)
    const moduleScope = new Scope(builtinScope, true)
    this.frames.push({
      id: `frame-${this.nextFrameId++}`,
      name: "<module>",
      root: moduleScope,
      current: moduleScope,
      line: 1,
    })

    try {
      this.hoist(program.body as AnyNode[], moduleScope)
      this.execBlockBody(program.body as AnyNode[], moduleScope)
      // Final state: every `line` step is captured before its statement runs,
      // so without this the last statement's effect would never be visible.
      this.pushStep(this.currentLine(), "return")
    } catch (thrown) {
      if (!(thrown instanceof TraceCapSignal)) {
        const described = describeThrown(thrown)
        result.error = described
        if (
          !this.steps.length ||
          this.steps[this.steps.length - 1]!.event !== "exception"
        ) {
          try {
            this.pushStep(described.line ?? this.currentLine(), "exception")
          } catch {
            // Already at the cap; the collected steps stand as the trace.
          }
        }
      }
    }

    result.truncated = this.truncated
    if (this.truncated && this.steps.length) {
      this.steps[this.steps.length - 1]!.stdout = this.stdout.snapshot()
    }
    return result
  }

  // ── stepping ───────────────────────────────────────────────────────────────

  private currentLine(): number {
    return this.frames[this.frames.length - 1]?.line ?? 1
  }

  private pushStep(line: number, event: TraceStep["event"]): void {
    if (this.capped) throw new TraceCapSignal()
    if (this.steps.length >= TRACE_LIMITS.maxSteps) {
      this.capped = true
      this.truncated = true
      throw new TraceCapSignal()
    }
    const serializer = new HeapSerializer(this.heapIds, () => this.nextHeapId++)
    const frames: TraceFrame[] = this.frames.map((frame) => ({
      id: frame.id,
      name: frame.name,
      line: frame.line,
      locals: serializer.locals(collectLocals(frame)),
    }))
    this.steps.push({
      index: this.steps.length,
      line: Math.max(1, line),
      event,
      frames,
      heap: serializer.heap(),
      stdout: this.stdout.snapshot(),
    })
  }

  private atLine(node: AnyNode): number {
    const loc = node.loc as { start?: { line?: number } } | undefined
    return loc?.start?.line ?? this.currentLine()
  }

  private markStatement(node: AnyNode): void {
    const line = this.atLine(node)
    const frame = this.frames[this.frames.length - 1]
    if (frame) frame.line = line
    this.pushStep(line, "line")
  }

  // ── declarations ───────────────────────────────────────────────────────────

  /** Function declarations and `var` bindings are visible before their line. */
  private hoist(body: AnyNode[], scope: Scope): void {
    for (const statement of body) {
      if (statement.type === "FunctionDeclaration") {
        const id = statement.id as AnyNode
        scope.declare(
          id.name as string,
          this.makeFunction(statement, scope),
          "var"
        )
      } else if (
        statement.type === "VariableDeclaration" &&
        statement.kind === "var"
      ) {
        for (const declarator of statement.declarations as AnyNode[]) {
          const id = declarator.id as AnyNode
          if (id.type === "Identifier") {
            scope.declare(id.name as string, undefined, "var")
          }
        }
      }
    }
  }

  private makeFunction(node: AnyNode, scope: Scope): InterpretedFunction {
    const id = node.id as AnyNode | null
    const isArrow = node.type === "ArrowFunctionExpression"
    const body = node.body as AnyNode
    return new InterpretedFunction(
      (id?.name as string | undefined) ?? "<anonymous>",
      node.params as AnyNode[],
      body,
      scope,
      isArrow,
      isArrow && body.type !== "BlockStatement"
    )
  }

  // ── statements ─────────────────────────────────────────────────────────────

  private execBlockBody(body: AnyNode[], scope: Scope): void {
    for (const statement of body) this.execStatement(statement, scope)
  }

  private execStatement(node: AnyNode, scope: Scope): void {
    switch (node.type) {
      case "FunctionDeclaration":
        return // hoisted
      case "VariableDeclaration": {
        this.markStatement(node)
        const kind = node.kind as "var" | "let" | "const"
        for (const declarator of node.declarations as AnyNode[]) {
          const init =
            declarator.init === null || declarator.init === undefined
              ? undefined
              : this.evaluate(declarator.init as AnyNode, scope)
          this.bindPattern(declarator.id as AnyNode, init, scope, kind)
        }
        return
      }
      case "ExpressionStatement":
        this.markStatement(node)
        this.evaluate(node.expression as AnyNode, scope)
        return
      case "BlockStatement": {
        const block = new Scope(scope, false)
        this.hoist(node.body as AnyNode[], block)
        this.withScope(block, () =>
          this.execBlockBody(node.body as AnyNode[], block)
        )
        return
      }
      case "IfStatement": {
        this.markStatement(node)
        if (truthy(this.evaluate(node.test as AnyNode, scope))) {
          this.execStatement(node.consequent as AnyNode, scope)
        } else if (node.alternate) {
          this.execStatement(node.alternate as AnyNode, scope)
        }
        return
      }
      case "WhileStatement": {
        while (true) {
          this.markStatement(node)
          if (!truthy(this.evaluate(node.test as AnyNode, scope))) break
          if (this.runLoopBody(node.body as AnyNode, scope)) break
        }
        return
      }
      case "DoWhileStatement": {
        do {
          this.markStatement(node)
          if (this.runLoopBody(node.body as AnyNode, scope)) break
        } while (truthy(this.evaluate(node.test as AnyNode, scope)))
        return
      }
      case "ForStatement": {
        const loopScope = new Scope(scope, false)
        this.withScope(loopScope, () => {
          this.markStatement(node)
          if (node.init) {
            const init = node.init as AnyNode
            if (init.type === "VariableDeclaration")
              this.execStatement(init, loopScope)
            else this.evaluate(init, loopScope)
          }
          while (true) {
            if (
              node.test &&
              !truthy(this.evaluate(node.test as AnyNode, loopScope))
            )
              break
            if (this.runLoopBody(node.body as AnyNode, loopScope)) break
            if (node.update) this.evaluate(node.update as AnyNode, loopScope)
            this.markStatement(node)
          }
        })
        return
      }
      case "ForOfStatement":
      case "ForInStatement": {
        this.markStatement(node)
        const iterable = this.evaluate(node.right as AnyNode, scope)
        const values =
          node.type === "ForOfStatement"
            ? iterableValues(iterable)
            : enumerableKeys(iterable)
        for (const value of values) {
          const iterationScope = new Scope(scope, false)
          const left = node.left as AnyNode
          if (left.type === "VariableDeclaration") {
            const declarator = (left.declarations as AnyNode[])[0]!
            this.bindPattern(
              declarator.id as AnyNode,
              value,
              iterationScope,
              left.kind as "var" | "let" | "const"
            )
          } else {
            this.assignTo(left, value, scope)
          }
          if (
            this.withScope(iterationScope, () =>
              this.runLoopBody(node.body as AnyNode, iterationScope)
            )
          ) {
            break
          }
        }
        return
      }
      case "ReturnStatement": {
        this.markStatement(node)
        const value = node.argument
          ? this.evaluate(node.argument as AnyNode, scope)
          : undefined
        throw new ReturnSignal(value)
      }
      case "BreakStatement":
        this.markStatement(node)
        throw new BreakSignal(
          ((node.label as AnyNode | null)?.name as string) ?? null
        )
      case "ContinueStatement":
        this.markStatement(node)
        throw new ContinueSignal(
          ((node.label as AnyNode | null)?.name as string) ?? null
        )
      case "ThrowStatement": {
        this.markStatement(node)
        const value = this.evaluate(node.argument as AnyNode, scope)
        this.pushStep(this.atLine(node), "exception")
        throw value instanceof TraceRuntimeError
          ? value
          : new ThrownValue(value)
      }
      case "TryStatement": {
        this.markStatement(node)
        try {
          this.execStatement(node.block as AnyNode, scope)
        } catch (thrown) {
          if (isSignal(thrown)) throw thrown
          const handler = node.handler as AnyNode | null
          if (!handler) throw thrown
          const catchScope = new Scope(scope, false)
          if (handler.param) {
            this.bindPattern(
              handler.param as AnyNode,
              thrownToValue(thrown),
              catchScope,
              "let"
            )
          }
          this.withScope(catchScope, () =>
            this.execBlockBody(
              (handler.body as AnyNode).body as AnyNode[],
              catchScope
            )
          )
        } finally {
          if (node.finalizer)
            this.execStatement(node.finalizer as AnyNode, scope)
        }
        return
      }
      case "EmptyStatement":
        return
      default:
        throw new TraceRuntimeError(
          "UnsupportedSyntaxError",
          `${String(node.type)} is not supported by the JavaScript visualizer`,
          this.atLine(node)
        )
    }
  }

  /** Returns true when the loop should break. */
  private runLoopBody(body: AnyNode, scope: Scope): boolean {
    try {
      this.execStatement(body, scope)
    } catch (signal) {
      if (signal instanceof BreakSignal) return true
      if (signal instanceof ContinueSignal) return false
      throw signal
    }
    return false
  }

  private withScope<T>(scope: Scope, run: () => T): T {
    const frame = this.frames[this.frames.length - 1]
    const previous = frame?.current
    if (frame) frame.current = scope
    try {
      return run()
    } finally {
      if (frame && previous) frame.current = previous
    }
  }

  private bindPattern(
    pattern: AnyNode,
    value: unknown,
    scope: Scope,
    kind: "var" | "let" | "const"
  ): void {
    switch (pattern.type) {
      case "Identifier":
        scope.declare(pattern.name as string, value, kind)
        return
      case "ArrayPattern": {
        const items = iterableValues(value)
        ;(pattern.elements as (AnyNode | null)[]).forEach((element, index) => {
          if (element) this.bindPattern(element, items[index], scope, kind)
        })
        return
      }
      case "ObjectPattern": {
        for (const property of pattern.properties as AnyNode[]) {
          if (property.type !== "Property") {
            throw new TraceRuntimeError(
              "UnsupportedSyntaxError",
              "Rest properties are not supported by the JavaScript visualizer",
              this.atLine(pattern)
            )
          }
          const key = (property.key as AnyNode).name as string
          this.bindPattern(
            property.value as AnyNode,
            this.readMember(value, key, this.atLine(pattern)),
            scope,
            kind
          )
        }
        return
      }
      case "AssignmentPattern":
        this.bindPattern(
          pattern.left as AnyNode,
          value === undefined
            ? this.evaluate(pattern.right as AnyNode, scope)
            : value,
          scope,
          kind
        )
        return
      default:
        throw new TraceRuntimeError(
          "UnsupportedSyntaxError",
          `${String(pattern.type)} bindings are not supported`,
          this.atLine(pattern)
        )
    }
  }

  // ── expressions ────────────────────────────────────────────────────────────

  private evaluate(node: AnyNode, scope: Scope): unknown {
    switch (node.type) {
      case "Literal":
        return node.value as unknown
      case "Identifier":
        if (node.name === "undefined") return undefined
        return scope.get(node.name as string)
      case "TemplateLiteral": {
        const quasis = node.quasis as AnyNode[]
        const expressions = node.expressions as AnyNode[]
        let text = ""
        quasis.forEach((quasi, index) => {
          text += (quasi.value as { cooked?: string }).cooked ?? ""
          if (index < expressions.length) {
            text += stringify(this.evaluate(expressions[index]!, scope))
          }
        })
        return text
      }
      case "ArrayExpression":
        return (node.elements as (AnyNode | null)[]).map((element) =>
          element ? this.evaluate(element, scope) : undefined
        )
      case "ObjectExpression": {
        const object: Record<string, unknown> = Object.create(null) as Record<
          string,
          unknown
        >
        for (const property of node.properties as AnyNode[]) {
          if (property.type !== "Property") {
            throw new TraceRuntimeError(
              "UnsupportedSyntaxError",
              "Object spread is not supported by the JavaScript visualizer",
              this.atLine(node)
            )
          }
          const key = property.computed
            ? stringify(this.evaluate(property.key as AnyNode, scope))
            : (((property.key as AnyNode).name as string) ??
              String((property.key as AnyNode).value))
          assertWritableKey(key, this.atLine(node))
          object[key] = this.evaluate(property.value as AnyNode, scope)
        }
        return object
      }
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        return this.makeFunction(node, scope)
      case "UnaryExpression": {
        if (node.operator === "typeof") {
          const argument = node.argument as AnyNode
          if (
            argument.type === "Identifier" &&
            !scope.has(argument.name as string)
          ) {
            return "undefined"
          }
          return typeOf(this.evaluate(argument, scope))
        }
        const value = this.evaluate(node.argument as AnyNode, scope)
        switch (node.operator) {
          case "-":
            return -toNumber(value)
          case "+":
            return toNumber(value)
          case "!":
            return !truthy(value)
          case "void":
            return undefined
          default:
            throw new TraceRuntimeError(
              "UnsupportedSyntaxError",
              `Unary ${String(node.operator)} is not supported`,
              this.atLine(node)
            )
        }
      }
      case "BinaryExpression":
        return this.binary(
          node.operator as string,
          this.evaluate(node.left as AnyNode, scope),
          this.evaluate(node.right as AnyNode, scope),
          this.atLine(node)
        )
      case "LogicalExpression": {
        const left = this.evaluate(node.left as AnyNode, scope)
        switch (node.operator) {
          case "&&":
            return truthy(left)
              ? this.evaluate(node.right as AnyNode, scope)
              : left
          case "||":
            return truthy(left)
              ? left
              : this.evaluate(node.right as AnyNode, scope)
          default:
            return left === null || left === undefined
              ? this.evaluate(node.right as AnyNode, scope)
              : left
        }
      }
      case "ConditionalExpression":
        return truthy(this.evaluate(node.test as AnyNode, scope))
          ? this.evaluate(node.consequent as AnyNode, scope)
          : this.evaluate(node.alternate as AnyNode, scope)
      case "AssignmentExpression": {
        const left = node.left as AnyNode
        const operator = node.operator as string
        const right = this.evaluate(node.right as AnyNode, scope)
        const value =
          operator === "="
            ? right
            : this.binary(
                operator.slice(0, -1),
                this.readReference(left, scope),
                right,
                this.atLine(node)
              )
        this.assignTo(left, value, scope)
        return value
      }
      case "UpdateExpression": {
        const argument = node.argument as AnyNode
        const before = toNumber(this.readReference(argument, scope))
        const after = node.operator === "++" ? before + 1 : before - 1
        this.assignTo(argument, after, scope)
        return node.prefix ? after : before
      }
      case "MemberExpression": {
        const object = this.evaluate(node.object as AnyNode, scope)
        return this.readMember(
          object,
          this.memberKey(node, scope),
          this.atLine(node)
        )
      }
      case "CallExpression":
        return this.call(node, scope)
      case "SequenceExpression": {
        let last: unknown
        for (const expression of node.expressions as AnyNode[]) {
          last = this.evaluate(expression, scope)
        }
        return last
      }
      case "ThisExpression":
        return undefined
      default:
        throw new TraceRuntimeError(
          "UnsupportedSyntaxError",
          `${String(node.type)} is not supported by the JavaScript visualizer`,
          this.atLine(node)
        )
    }
  }

  private memberKey(node: AnyNode, scope: Scope): string {
    return node.computed
      ? stringify(this.evaluate(node.property as AnyNode, scope))
      : ((node.property as AnyNode).name as string)
  }

  private readReference(node: AnyNode, scope: Scope): unknown {
    if (node.type === "Identifier") return scope.get(node.name as string)
    if (node.type === "MemberExpression") return this.evaluate(node, scope)
    throw new TraceRuntimeError(
      "UnsupportedSyntaxError",
      "Unsupported assignment target",
      this.atLine(node)
    )
  }

  private assignTo(node: AnyNode, value: unknown, scope: Scope): void {
    if (node.type === "Identifier") {
      scope.set(node.name as string, value)
      return
    }
    if (node.type === "MemberExpression") {
      const object = this.evaluate(node.object as AnyNode, scope)
      const key = this.memberKey(node, scope)
      assertWritableKey(key, this.atLine(node))
      if (Array.isArray(object)) {
        const index = Number(key)
        if (Number.isInteger(index) && index >= 0) {
          object[index] = value
          return
        }
        if (key === "length") {
          object.length = toNumber(value)
          return
        }
        throw new TraceRuntimeError(
          "TypeError",
          `Cannot set property ${key} on an array`,
          this.atLine(node)
        )
      }
      if (isPlainRecord(object)) {
        object[key] = value
        return
      }
      throw new TraceRuntimeError(
        "TypeError",
        `Cannot set property ${key} of ${describeValue(object)}`,
        this.atLine(node)
      )
    }
    throw new TraceRuntimeError(
      "UnsupportedSyntaxError",
      "Unsupported assignment target",
      this.atLine(node)
    )
  }

  private readMember(object: unknown, key: string, line: number): unknown {
    if (object === null || object === undefined) {
      throw new TraceRuntimeError(
        "TypeError",
        `Cannot read properties of ${String(object)} (reading '${key}')`,
        line
      )
    }
    if (FORBIDDEN_KEYS.has(key)) {
      throw new TraceRuntimeError(
        "TypeError",
        `Access to '${key}' is blocked in the JavaScript visualizer`,
        line
      )
    }
    if (typeof object === "string") {
      if (key === "length") return object.length
      const index = Number(key)
      if (Number.isInteger(index)) return object[index]
      if (STRING_METHODS.has(key)) {
        return new NativeFunction(key, (args) =>
          (
            Reflect.get(String.prototype, key) as (...a: unknown[]) => unknown
          ).apply(object, args)
        )
      }
      throw unsupportedMember("string", key, line)
    }
    if (typeof object === "number") {
      if (NUMBER_METHODS.has(key)) {
        return new NativeFunction(key, (args) =>
          (
            Reflect.get(Number.prototype, key) as (...a: unknown[]) => unknown
          ).apply(object, args)
        )
      }
      throw unsupportedMember("number", key, line)
    }
    if (Array.isArray(object)) {
      if (key === "length") return object.length
      const index = Number(key)
      if (Number.isInteger(index)) return object[index]
      if (ARRAY_METHODS.has(key)) {
        return new NativeFunction(key, (args) =>
          (
            Reflect.get(Array.prototype, key) as (...a: unknown[]) => unknown
          ).apply(
            object,
            args.map((arg) => this.toHostCallback(arg))
          )
        )
      }
      throw unsupportedMember("array", key, line)
    }
    if (
      object instanceof NativeFunction ||
      object instanceof InterpretedFunction
    ) {
      if (key === "name") return object.name
      throw unsupportedMember("function", key, line)
    }
    if (isPlainRecord(object)) {
      // Own properties only: no prototype chain, so no host reachability.
      return Object.prototype.hasOwnProperty.call(object, key)
        ? object[key]
        : undefined
    }
    throw unsupportedMember(describeValue(object), key, line)
  }

  /** Lets array methods invoke interpreted callbacks (map, filter, reduce). */
  private toHostCallback(value: unknown): unknown {
    if (value instanceof InterpretedFunction) {
      return (...args: unknown[]) =>
        this.invoke(value, args, this.currentLine())
    }
    if (value instanceof NativeFunction) {
      return (...args: unknown[]) => value.call(args)
    }
    return value
  }

  private call(node: AnyNode, scope: Scope): unknown {
    const callee = node.callee as AnyNode
    const args = (node.arguments as AnyNode[]).map((argument) => {
      if (argument.type === "SpreadElement") {
        throw new TraceRuntimeError(
          "UnsupportedSyntaxError",
          "Spread arguments are not supported by the JavaScript visualizer",
          this.atLine(node)
        )
      }
      return this.evaluate(argument, scope)
    })

    const target =
      callee.type === "MemberExpression"
        ? this.readMember(
            this.evaluate(callee.object as AnyNode, scope),
            this.memberKey(callee, scope),
            this.atLine(node)
          )
        : this.evaluate(callee, scope)

    if (target instanceof NativeFunction) return target.call(args)
    if (target instanceof InterpretedFunction) {
      return this.invoke(target, args, this.atLine(node))
    }
    throw new TraceRuntimeError(
      "TypeError",
      `${describeCallee(callee)} is not a function`,
      this.atLine(node)
    )
  }

  private invoke(
    fn: InterpretedFunction,
    args: unknown[],
    line: number
  ): unknown {
    if (this.depth >= MAX_CALL_DEPTH) {
      throw new TraceRuntimeError(
        "RangeError",
        "Maximum call stack size exceeded",
        line
      )
    }
    const callScope = new Scope(fn.scope, true)
    fn.params.forEach((param, index) => {
      this.bindPattern(param, args[index], callScope, "let")
    })

    const frame: Frame = {
      id: `frame-${this.nextFrameId++}`,
      name: fn.name,
      root: callScope,
      current: callScope,
      line:
        (fn.body.loc as { start?: { line?: number } } | undefined)?.start
          ?.line ?? line,
    }
    this.frames.push(frame)
    this.depth += 1
    this.pushStep(frame.line, "call")
    try {
      if (fn.isExpressionBody) {
        const value = this.evaluate(fn.body, callScope)
        this.pushStep(frame.line, "return")
        return value
      }
      this.hoist((fn.body.body as AnyNode[]) ?? [], callScope)
      this.execBlockBody((fn.body.body as AnyNode[]) ?? [], callScope)
      this.pushStep(frame.line, "return")
      return undefined
    } catch (signal) {
      if (signal instanceof ReturnSignal) {
        this.pushStep(frame.line, "return")
        return signal.value
      }
      throw signal
    } finally {
      this.depth -= 1
      this.frames.pop()
    }
  }

  private binary(
    operator: string,
    left: unknown,
    right: unknown,
    line: number
  ): unknown {
    switch (operator) {
      case "+":
        return typeof left === "string" || typeof right === "string"
          ? stringify(left) + stringify(right)
          : toNumber(left) + toNumber(right)
      case "-":
        return toNumber(left) - toNumber(right)
      case "*":
        return toNumber(left) * toNumber(right)
      case "/":
        return toNumber(left) / toNumber(right)
      case "%":
        return toNumber(left) % toNumber(right)
      case "**":
        return toNumber(left) ** toNumber(right)
      case "===":
        return left === right
      case "!==":
        return left !== right
      case "==":
        return looseEquals(left, right)
      case "!=":
        return !looseEquals(left, right)
      case "<":
        return compare(left, right) < 0
      case "<=":
        return compare(left, right) <= 0
      case ">":
        return compare(left, right) > 0
      case ">=":
        return compare(left, right) >= 0
      case "&":
        return toNumber(left) & toNumber(right)
      case "|":
        return toNumber(left) | toNumber(right)
      case "^":
        return toNumber(left) ^ toNumber(right)
      case "<<":
        return toNumber(left) << toNumber(right)
      case ">>":
        return toNumber(left) >> toNumber(right)
      case ">>>":
        return toNumber(left) >>> toNumber(right)
      default:
        throw new TraceRuntimeError(
          "UnsupportedSyntaxError",
          `Operator ${operator} is not supported`,
          line
        )
    }
  }
}

// ── locals + heap serialization ──────────────────────────────────────────────

function collectLocals(frame: Frame): [string, unknown][] {
  const entries: [string, unknown][] = []
  const seen = new Set<string>()
  // Walks the block scopes the frame opened, stops at the frame's own root, and
  // never reaches the interpreter's builtins.
  let scope: Scope | null = frame.current
  while (scope && !scope.isBuiltins) {
    for (const [name, value] of scope.ownEntries()) {
      if (!seen.has(name)) {
        seen.add(name)
        entries.push([name, value])
      }
    }
    if (scope === frame.root) break
    scope = scope.parent
  }
  return entries
}

/**
 * Serializes one step's reachable state. Heap ids are stable across steps
 * (identity-keyed), and every node is re-expanded per step so mutations show.
 */
class HeapSerializer {
  private readonly nodes = new Map<string, TraceHeapNode>()
  private readonly expanded = new Set<string>()

  constructor(
    private readonly ids: Map<object, string>,
    private readonly nextId: () => number
  ) {}

  locals(entries: [string, unknown][]): Record<string, TraceValue> {
    const locals: Record<string, TraceValue> = {}
    // The marker occupies one of the capped slots, so total width never exceeds
    // maxCollectionEntries.
    const limit = widthLimit(entries.length)
    for (const [name, value] of entries.slice(0, limit)) {
      locals[uniqueKey(locals, name)] = this.value(value, 0)
    }
    if (limit < entries.length) {
      locals["<truncated>"] = { kind: "truncated", preview: "local scan limit" }
    }
    return locals
  }

  heap(): TraceHeapNode[] {
    return [...this.nodes.values()]
  }

  value(value: unknown, depth: number): TraceValue {
    if (value === null) return { kind: "primitive", value: null }
    switch (typeof value) {
      case "undefined":
        return { kind: "truncated", preview: "undefined" }
      case "boolean":
        return { kind: "primitive", value }
      case "number":
        return Number.isFinite(value)
          ? { kind: "primitive", value }
          : { kind: "truncated", preview: String(value) }
      case "bigint":
        return {
          kind: "truncated",
          preview:
            bitLength(value) <= MAX_SAFE_INTEGER_BITS
              ? `${value}n`
              : `<bigint ${bitLength(value)} bits>`,
        }
      case "string":
        return value.length <= TRACE_LIMITS.maxStringLength
          ? { kind: "primitive", value }
          : { kind: "truncated", preview: clip(value) }
      case "symbol":
      case "function":
        return { kind: "truncated", preview: "<function>" }
      default:
        break
    }
    if (
      value instanceof NativeFunction ||
      value instanceof InterpretedFunction
    ) {
      return { kind: "truncated", preview: `<function ${clip(value.name)}>` }
    }

    const object = value as object
    const existing = this.ids.get(object)
    if (existing !== undefined && this.expanded.has(existing)) {
      return { kind: "reference", id: existing, label: labelOf(object) }
    }
    if (depth >= TRACE_LIMITS.maxDepth) {
      return { kind: "truncated", preview: `<${labelOf(object)}>` }
    }
    if (existing === undefined && this.ids.size >= TRACE_LIMITS.maxHeapNodes) {
      return { kind: "truncated", preview: "<heap limit>" }
    }

    const id = existing ?? `heap-${this.nextId()}`
    this.ids.set(object, id)
    this.expanded.add(id)
    const node: TraceHeapNode = { id, type: labelOf(object), fields: {} }
    this.nodes.set(id, node)

    if (Array.isArray(object)) {
      const limit = widthLimit(object.length)
      for (let index = 0; index < limit; index += 1) {
        node.fields[String(index)] = this.value(object[index], depth + 1)
      }
      if (limit < object.length) {
        node.fields["<truncated>"] = {
          kind: "truncated",
          preview: `${object.length} items`,
        }
      }
    } else {
      const record = object as Record<string, unknown>
      const keys = Object.keys(record)
      const limit = widthLimit(keys.length)
      for (const key of keys.slice(0, limit)) {
        node.fields[uniqueKey(node.fields, clip(key))] = this.value(
          record[key],
          depth + 1
        )
      }
      if (limit < keys.length) {
        node.fields["<truncated>"] = {
          kind: "truncated",
          preview: "property scan limit",
        }
      }
    }
    return { kind: "reference", id, label: node.type }
  }
}

// ── stdout ───────────────────────────────────────────────────────────────────

class OutputCapture {
  private readonly lines: string[] = []
  private bytes = 0
  private full = false

  write(text: string): void {
    if (this.full) return
    for (const line of text.split("\n")) {
      if (this.lines.length >= TRACE_LIMITS.maxOutputLines) {
        this.full = true
        return
      }
      const clipped = line.slice(0, TRACE_LIMITS.maxStringLength)
      const size = byteLength(clipped)
      if (this.bytes + size > TRACE_LIMITS.maxOutputBytes) {
        this.full = true
        return
      }
      this.bytes += size
      this.lines.push(clipped)
    }
  }

  snapshot(): string[] {
    return [...this.lines]
  }
}

// ── globals ──────────────────────────────────────────────────────────────────

function installGlobals(scope: Scope, stdout: OutputCapture): void {
  const console_: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >
  const log = new NativeFunction("log", (args) => {
    stdout.write(args.map((arg) => display(arg, 0)).join(" "))
    return undefined
  })
  console_.log = log
  console_.info = log
  console_.warn = log
  console_.error = log
  scope.declare("console", console_, "const")

  const math: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >
  for (const name of [
    "abs",
    "ceil",
    "floor",
    "round",
    "trunc",
    "sqrt",
    "cbrt",
    "sign",
    "max",
    "min",
    "pow",
    "log",
    "log2",
    "log10",
    "exp",
    "sin",
    "cos",
    "tan",
    "hypot",
  ] as const) {
    math[name] = new NativeFunction(name, (args) =>
      (Math[name] as (...a: number[]) => number)(...args.map(toNumber))
    )
  }
  math.PI = Math.PI
  math.E = Math.E
  scope.declare("Math", math, "const")

  const json: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >
  json.stringify = new NativeFunction("stringify", (args) => {
    try {
      return JSON.stringify(args[0], null, toNumber(args[1] ?? 0) || undefined)
    } catch {
      throw new TraceRuntimeError(
        "TypeError",
        "Converting circular structure to JSON"
      )
    }
  })
  json.parse = new NativeFunction("parse", (args) => {
    try {
      return JSON.parse(stringify(args[0])) as unknown
    } catch (error) {
      throw new TraceRuntimeError("SyntaxError", (error as Error).message)
    }
  })
  scope.declare("JSON", json, "const")

  const objectStatics: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >
  objectStatics.keys = new NativeFunction("keys", (args) =>
    isPlainRecord(args[0]) ? Object.keys(args[0]) : []
  )
  objectStatics.values = new NativeFunction("values", (args) =>
    isPlainRecord(args[0]) ? Object.values(args[0]) : []
  )
  objectStatics.entries = new NativeFunction("entries", (args) =>
    isPlainRecord(args[0]) ? Object.entries(args[0]) : []
  )
  scope.declare("Object", objectStatics, "const")

  const arrayStatics: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >
  arrayStatics.isArray = new NativeFunction("isArray", (args) =>
    Array.isArray(args[0])
  )
  arrayStatics.from = new NativeFunction("from", (args) =>
    iterableValues(args[0])
  )
  scope.declare("Array", arrayStatics, "const")

  scope.declare(
    "Number",
    Object.assign(
      new NativeFunction("Number", (args) => toNumber(args[0])),
      {}
    ),
    "const"
  )
  scope.declare(
    "String",
    new NativeFunction("String", (args) => stringify(args[0])),
    "const"
  )
  scope.declare(
    "Boolean",
    new NativeFunction("Boolean", (args) => truthy(args[0])),
    "const"
  )
  scope.declare(
    "parseInt",
    new NativeFunction("parseInt", (args) =>
      Number.parseInt(
        stringify(args[0]),
        args[1] === undefined ? 10 : toNumber(args[1])
      )
    ),
    "const"
  )
  scope.declare(
    "parseFloat",
    new NativeFunction("parseFloat", (args) =>
      Number.parseFloat(stringify(args[0]))
    ),
    "const"
  )
  scope.declare("NaN", Number.NaN, "const")
  scope.declare("Infinity", Number.POSITIVE_INFINITY, "const")
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isSignal(value: unknown): boolean {
  return (
    value instanceof BreakSignal ||
    value instanceof ContinueSignal ||
    value instanceof ReturnSignal ||
    value instanceof TraceCapSignal
  )
}

function thrownToValue(thrown: unknown): unknown {
  if (thrown instanceof ThrownValue) return thrown.value
  if (thrown instanceof TraceRuntimeError) {
    const error: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >
    error.name = thrown.name
    error.message = thrown.message
    return error
  }
  return thrown
}

function describeThrown(thrown: unknown): NonNullable<TraceResult["error"]> {
  if (thrown instanceof TraceRuntimeError) {
    const error: NonNullable<TraceResult["error"]> = {
      name: thrown.name,
      message: clip(thrown.message),
    }
    if (thrown.line !== undefined) error.line = thrown.line
    return error
  }
  if (thrown instanceof ThrownValue) {
    return { name: "Error", message: clip(display(thrown.value, 0)) }
  }
  if (thrown instanceof Error) {
    return { name: thrown.name || "Error", message: clip(thrown.message) }
  }
  return { name: "Error", message: clip(String(thrown)) }
}

function truthy(value: unknown): boolean {
  return Boolean(value)
}

function typeOf(value: unknown): string {
  if (value instanceof NativeFunction || value instanceof InterpretedFunction) {
    return "function"
  }
  return typeof value
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value === "boolean") return value ? 1 : 0
  if (value === null) return 0
  if (value === undefined) return Number.NaN
  if (typeof value === "string") return value.trim() === "" ? 0 : Number(value)
  if (Array.isArray(value)) {
    return value.length === 0
      ? 0
      : value.length === 1
        ? toNumber(value[0])
        : Number.NaN
  }
  return Number.NaN
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value
  return display(value, 0)
}

function looseEquals(left: unknown, right: unknown): boolean {
  if (left === null || left === undefined) {
    return right === null || right === undefined
  }
  if (right === null || right === undefined) return false
  if (typeof left === typeof right) return left === right
  return toNumber(left) === toNumber(right)
}

function compare(left: unknown, right: unknown): number {
  if (typeof left === "string" && typeof right === "string") {
    return left < right ? -1 : left > right ? 1 : 0
  }
  const a = toNumber(left)
  const b = toNumber(right)
  return a < b
    ? -1
    : a > b
      ? 1
      : Number.isNaN(a) || Number.isNaN(b)
        ? Number.NaN
        : 0
}

function iterableValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === "string") return [...value]
  if (isPlainRecord(value)) return Object.values(value)
  throw new TraceRuntimeError(
    "TypeError",
    `${describeValue(value)} is not iterable`
  )
}

function enumerableKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((_, index) => String(index))
  if (isPlainRecord(value)) return Object.keys(value)
  return []
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof NativeFunction) &&
    !(value instanceof InterpretedFunction)
  )
}

function labelOf(value: object): string {
  return Array.isArray(value) ? "Array" : "Object"
}

function describeValue(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}

function describeCallee(callee: AnyNode): string {
  if (callee.type === "Identifier") return String(callee.name)
  if (callee.type === "MemberExpression" && !callee.computed) {
    return String((callee.property as AnyNode).name)
  }
  return "expression"
}

function unsupportedMember(
  receiver: string,
  key: string,
  line: number
): TraceRuntimeError {
  return new TraceRuntimeError(
    "TypeError",
    `${receiver}.${key} is not available in the JavaScript visualizer`,
    line
  )
}

function assertWritableKey(key: string, line: number): void {
  if (FORBIDDEN_KEYS.has(key)) {
    throw new TraceRuntimeError(
      "TypeError",
      `Writing '${key}' is blocked in the JavaScript visualizer`,
      line
    )
  }
}

/** console.log / template formatting; bounded and cycle-safe. */
function display(
  value: unknown,
  depth: number,
  seen = new Set<object>()
): string {
  if (typeof value === "string")
    return depth === 0 ? value : JSON.stringify(value)
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "bigint") return `${value}n`
  if (typeof value === "number" || typeof value === "boolean")
    return String(value)
  if (value instanceof NativeFunction || value instanceof InterpretedFunction) {
    return `[Function: ${value.name}]`
  }
  const object = value as object
  if (seen.has(object)) return "[Circular]"
  if (depth >= TRACE_LIMITS.maxDepth)
    return Array.isArray(object) ? "[Array]" : "[Object]"
  seen.add(object)
  try {
    if (Array.isArray(object)) {
      const items = object
        .slice(0, TRACE_LIMITS.maxCollectionEntries)
        .map((item) => display(item, depth + 1, seen))
      if (object.length > TRACE_LIMITS.maxCollectionEntries) items.push("…")
      return `[ ${items.join(", ")} ]`
    }
    const record = object as Record<string, unknown>
    const keys = Object.keys(record).slice(0, TRACE_LIMITS.maxCollectionEntries)
    const items = keys.map(
      (key) => `${key}: ${display(record[key], depth + 1, seen)}`
    )
    if (Object.keys(record).length > keys.length) items.push("…")
    return items.length ? `{ ${items.join(", ")} }` : "{}"
  } finally {
    seen.delete(object)
  }
}

/** Entries to emit so that emitted + any truncation marker fits the width cap. */
function widthLimit(total: number): number {
  return total <= TRACE_LIMITS.maxCollectionEntries
    ? total
    : TRACE_LIMITS.maxCollectionEntries - 1
}

function uniqueKey(fields: Record<string, unknown>, base: string): string {
  if (!(base in fields)) return base
  let suffix = 2
  while (`${base}#${suffix}` in fields) suffix += 1
  return `${base}#${suffix}`
}

function bitLength(value: bigint): number {
  const absolute = value < 0n ? -value : value
  return absolute.toString(2).length
}

function byteLength(text: string): number {
  let bytes = 0
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
  }
  return bytes
}

function clip(text: string): string {
  return text.length <= TRACE_LIMITS.maxStringLength
    ? text
    : `${text.slice(0, TRACE_LIMITS.maxStringLength - 3)}...`
}

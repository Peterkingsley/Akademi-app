// Compares two math answers for equivalence without a full CAS. Two independent strategies,
// tried in order:
//   1. Both sides parse as a closed-form numeric expression (int/decimal/fraction/surd/pi/e, with
//      an optional unit) -> evaluate and compare numerically within tolerance.
//   2. Both sides parse as an algebraic expression with free variables (e.g. a derivative,
//      "3x^2 - 4x") -> evaluate both at several shared sample points for the variable(s); equal at
//      every sample point is treated as equal expressions. This is what actually generalizes
//      across "expanded vs factored", "simplified vs not" without symbolic simplification.
//   3. If either side fails to parse as an expression at all, fall back to normalized string
//      equality (lowercase, whitespace/punctuation stripped, a small synonym table for
//      "undefined"/"no solution"/"does not exist"-style answers).

const ABS_TOLERANCE = 1e-6;
const REL_TOLERANCE = 1e-4;
const SAMPLE_POINTS = [0.5, 1.3, -2.7, 3.9, -0.6, 2.2, -1.8, 4.4];
const MIN_SUCCESSFUL_SAMPLES = 3;

function numbersMatch(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const diff = Math.abs(a - b);
  return diff <= Math.max(ABS_TOLERANCE, REL_TOLERANCE * Math.max(Math.abs(a), Math.abs(b)));
}

// ─── tokenizer + recursive-descent parser ──────────────────────────────────────────────────────

type TokenType = 'NUMBER' | 'IDENT' | 'OP' | 'LPAREN' | 'RPAREN' | 'COMMA';
type Token = { type: TokenType; value: string };

const FUNCTION_NAMES = new Set(['sqrt', 'sin', 'cos', 'tan', 'ln', 'log', 'exp', 'abs', 'cbrt']);
const CONSTANT_VALUES: Record<string, number> = { pi: Math.PI, e: Math.E };

function preprocess(raw: string): string {
  let s = raw.trim();
  // Unicode / notation normalization.
  s = s
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\*\*/g, '^')
    .replace(/π/g, 'pi')
    .replace(/√\(/g, 'sqrt(')
    .replace(/√(\d+(\.\d+)?)/g, 'sqrt($1)')
    .replace(/√([a-zA-Z])/g, 'sqrt($1)');
  // Strip a leading "y =", "f(x) =", "answer:" style prefix and a trailing unit-carrying "≈".
  s = s.replace(/^[a-zA-Z0-9_'()\/\s]*=\s*/, (m) => (m.length < s.length ? '' : m));
  return s.trim();
}

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(s[i + 1] || ''))) {
      let j = i;
      while (j < s.length && /[\d.]/.test(s[j])) j += 1;
      tokens.push({ type: 'NUMBER', value: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j += 1;
      tokens.push({ type: 'IDENT', value: s.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: ch });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ch });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ch });
      i += 1;
      continue;
    }
    if ('+-*/^'.includes(ch)) {
      tokens.push({ type: 'OP', value: ch });
      i += 1;
      continue;
    }
    // Unknown character (currency symbols, stray punctuation, etc.) — not a parseable expression.
    throw new Error(`Unexpected character "${ch}" at position ${i}`);
  }
  return insertImplicitMultiplication(tokens);
}

// "2x" -> "2 * x", "3(x+1)" -> "3 * (x+1)", "2sqrt(3)" -> "2 * sqrt(3)", ")(" -> ") * (".
function insertImplicitMultiplication(tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const cur = tokens[i];
    const prev = result[result.length - 1];
    if (
      prev &&
      (prev.type === 'NUMBER' || prev.type === 'RPAREN' || (prev.type === 'IDENT' && !FUNCTION_NAMES.has(prev.value))) &&
      (cur.type === 'NUMBER' || cur.type === 'IDENT' || cur.type === 'LPAREN')
    ) {
      result.push({ type: 'OP', value: '*' });
    }
    result.push(cur);
  }
  return result;
}

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'bin'; op: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node }
  | { kind: 'neg'; operand: Node }
  | { kind: 'call'; name: string; args: Node[] };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private consume(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new Error('Unexpected end of expression');
    this.pos += 1;
    return t;
  }

  parse(): Node {
    const node = this.parseExpression();
    if (this.pos < this.tokens.length) throw new Error(`Unexpected trailing token "${this.peek()?.value}"`);
    return node;
  }

  private parseExpression(): Node {
    let node = this.parseTerm();
    while (this.peek()?.type === 'OP' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.consume().value as '+' | '-';
      node = { kind: 'bin', op, left: node, right: this.parseTerm() };
    }
    return node;
  }

  private parseTerm(): Node {
    let node = this.parseUnary();
    while (this.peek()?.type === 'OP' && (this.peek()!.value === '*' || this.peek()!.value === '/')) {
      const op = this.consume().value as '*' | '/';
      node = { kind: 'bin', op, left: node, right: this.parseUnary() };
    }
    return node;
  }

  private parseUnary(): Node {
    if (this.peek()?.type === 'OP' && this.peek()!.value === '-') {
      this.consume();
      return { kind: 'neg', operand: this.parseUnary() };
    }
    if (this.peek()?.type === 'OP' && this.peek()!.value === '+') {
      this.consume();
      return this.parseUnary();
    }
    return this.parsePower();
  }

  private parsePower(): Node {
    const base = this.parsePrimary();
    if (this.peek()?.type === 'OP' && this.peek()!.value === '^') {
      this.consume();
      const exponent = this.parseUnary(); // right-associative, allows "2^-1"
      return { kind: 'bin', op: '^', left: base, right: exponent };
    }
    return base;
  }

  private parsePrimary(): Node {
    const t = this.peek();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.type === 'NUMBER') {
      this.consume();
      return { kind: 'num', value: Number(t.value) };
    }
    if (t.type === 'LPAREN') {
      this.consume();
      const node = this.parseExpression();
      if (this.peek()?.type !== 'RPAREN') throw new Error('Missing closing parenthesis');
      this.consume();
      return node;
    }
    if (t.type === 'IDENT') {
      this.consume();
      const name = t.value.toLowerCase();
      if (FUNCTION_NAMES.has(name) && this.peek()?.type === 'LPAREN') {
        this.consume(); // '('
        const args: Node[] = [this.parseExpression()];
        while (this.peek()?.type === 'COMMA') {
          this.consume();
          args.push(this.parseExpression());
        }
        if (this.peek()?.type !== 'RPAREN') throw new Error('Missing closing parenthesis in function call');
        this.consume();
        return { kind: 'call', name, args };
      }
      if (name in CONSTANT_VALUES) return { kind: 'num', value: CONSTANT_VALUES[name] };
      return { kind: 'var', name };
    }
    throw new Error(`Unexpected token "${t.value}"`);
  }
}

function collectVariables(node: Node, out: Set<string>): void {
  switch (node.kind) {
    case 'var':
      out.add(node.name);
      return;
    case 'num':
      return;
    case 'neg':
      collectVariables(node.operand, out);
      return;
    case 'bin':
      collectVariables(node.left, out);
      collectVariables(node.right, out);
      return;
    case 'call':
      for (const a of node.args) collectVariables(a, out);
      return;
  }
}

function evaluate(node: Node, bindings: Record<string, number>): number {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'var': {
      const v = bindings[node.name];
      if (v === undefined) throw new Error(`Unbound variable "${node.name}"`);
      return v;
    }
    case 'neg':
      return -evaluate(node.operand, bindings);
    case 'bin': {
      const l = evaluate(node.left, bindings);
      const r = evaluate(node.right, bindings);
      switch (node.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return l / r;
        case '^':
          return Math.pow(l, r);
      }
      break;
    }
    case 'call': {
      const args = node.args.map((a) => evaluate(a, bindings));
      switch (node.name) {
        case 'sqrt':
          return Math.sqrt(args[0]);
        case 'cbrt':
          return Math.cbrt(args[0]);
        case 'sin':
          return Math.sin(args[0]);
        case 'cos':
          return Math.cos(args[0]);
        case 'tan':
          return Math.tan(args[0]);
        case 'ln':
          return Math.log(args[0]);
        case 'log':
          return args.length > 1 ? Math.log(args[1]) / Math.log(args[0]) : Math.log10(args[0]);
        case 'exp':
          return Math.exp(args[0]);
        case 'abs':
          return Math.abs(args[0]);
        default:
          throw new Error(`Unknown function "${node.name}"`);
      }
    }
  }
  throw new Error('Unreachable');
}

export type ParsedExpression = { node: Node; variables: string[] };

export function tryParseExpression(raw: string): ParsedExpression | null {
  try {
    const cleaned = preprocess(raw);
    if (!cleaned) return null;
    const tokens = tokenize(cleaned);
    if (tokens.length === 0) return null;
    const node = new Parser(tokens).parse();
    const vars = new Set<string>();
    collectVariables(node, vars);
    return { node, variables: Array.from(vars).sort() };
  } catch {
    return null;
  }
}

// ─── units ───────────────────────────────────────────────────────────────────────────────────

const UNIT_ALIASES: Record<string, string> = {
  meter: 'm', meters: 'm', metre: 'm', metres: 'm', m: 'm',
  centimeter: 'cm', centimeters: 'cm', cm: 'cm',
  second: 's', seconds: 's', sec: 's', s: 's',
  kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  gram: 'g', grams: 'g', g: 'g',
  newton: 'n', newtons: 'n', n: 'n',
  radian: 'rad', radians: 'rad', rad: 'rad',
  degree: 'deg', degrees: 'deg', deg: 'deg',
  joule: 'j', joules: 'j', j: 'j',
  'm/s': 'm/s', 'm/s^2': 'm/s^2', 'm/s2': 'm/s^2',
};

function splitUnit(raw: string): { numericPart: string; unit: string | null } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*?)([a-zA-Z°][a-zA-Z°²/^0-9]*)$/);
  if (!match) return { numericPart: trimmed, unit: null };
  const candidateUnit = match[2].toLowerCase().replace(/\s+/g, '');
  const candidateNumeric = match[1].trim();
  // Only treat the trailing token as a unit if it's a recognized one AND there's a numeric-looking
  // prefix left over — otherwise a bare word answer like "undefined" would get chopped in half.
  if (candidateNumeric && UNIT_ALIASES[candidateUnit]) {
    return { numericPart: candidateNumeric, unit: UNIT_ALIASES[candidateUnit] };
  }
  return { numericPart: trimmed, unit: null };
}

// ─── string fallback ────────────────────────────────────────────────────────────────────────

const TEXT_SYNONYMS: Array<[RegExp, string]> = [
  [/^(undefined|does not exist|dne|no solution|does not exists)$/i, 'undefined'],
  [/^(empty set|no solutions|none|no such value|∅)$/i, 'undefined'],
];

function normalizeText(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[.,;!]+$/g, '').replace(/\s+/g, ' ');
  for (const [pattern, canonical] of TEXT_SYNONYMS) {
    if (pattern.test(cleaned)) return canonical;
  }
  return cleaned;
}

// ─── public API ─────────────────────────────────────────────────────────────────────────────

export type AnswerComparison = { equal: boolean; method: 'numeric' | 'algebraic' | 'text'; reason?: string };

export function compareAnswers(rawA: string, rawB: string): AnswerComparison {
  const { numericPart: numA, unit: unitA } = splitUnit(rawA);
  const { numericPart: numB, unit: unitB } = splitUnit(rawB);

  const parsedA = tryParseExpression(numA);
  const parsedB = tryParseExpression(numB);

  if (parsedA && parsedB) {
    if ((unitA || unitB) && unitA !== unitB) {
      return { equal: false, method: parsedA.variables.length === 0 && parsedB.variables.length === 0 ? 'numeric' : 'algebraic', reason: `unit mismatch: "${unitA}" vs "${unitB}"` };
    }

    if (parsedA.variables.length === 0 && parsedB.variables.length === 0) {
      try {
        const va = evaluate(parsedA.node, {});
        const vb = evaluate(parsedB.node, {});
        return { equal: numbersMatch(va, vb), method: 'numeric' };
      } catch {
        // fall through to text comparison below
      }
    } else {
      const allVars = Array.from(new Set([...parsedA.variables, ...parsedB.variables])).sort();
      let successfulSamples = 0;
      let allMatched = true;
      for (const point of SAMPLE_POINTS) {
        const bindings: Record<string, number> = {};
        allVars.forEach((v, i) => {
          bindings[v] = point + i * 0.31; // stagger multi-variable samples so they're not identical
        });
        try {
          const va = evaluate(parsedA.node, bindings);
          const vb = evaluate(parsedB.node, bindings);
          if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
          successfulSamples += 1;
          if (!numbersMatch(va, vb)) {
            allMatched = false;
            break;
          }
        } catch {
          continue; // singular point for one side (division by zero, domain error) — try another
        }
        if (successfulSamples >= SAMPLE_POINTS.length) break;
      }
      if (successfulSamples >= MIN_SUCCESSFUL_SAMPLES) {
        return { equal: allMatched, method: 'algebraic' };
      }
      // Couldn't get enough clean sample points (both expressions singular almost everywhere
      // sampled) — fall through to text comparison as a last resort.
    }
  }

  const equal = normalizeText(rawA) === normalizeText(rawB);
  return { equal, method: 'text' };
}

export function answersMatch(a: string, b: string): boolean {
  return compareAnswers(a, b).equal;
}

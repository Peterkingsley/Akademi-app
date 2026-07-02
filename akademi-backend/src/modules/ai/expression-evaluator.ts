// A small, self-contained recursive-descent evaluator for single-variable math expressions
// (e.g. "x^2 - 4*x + 3", "sin(x) * 2"). This exists so we never have to trust the AI's own
// arithmetic for a function graph - it computes the actual sample points, roots, and turning
// points itself instead of trusting numbers the model might have gotten wrong. It never calls
// eval()/Function() on the input; it tokenizes and walks its own tiny grammar.

const ALLOWED_FUNCTIONS = new Set(['sin', 'cos', 'tan', 'sqrt', 'log', 'ln', 'exp', 'abs']);
const ALLOWED_CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

const SAFE_EXPRESSION_PATTERN = /^[\d\s.x+\-*/^()a-z,]+$/i;

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'lparen' }
  | { type: 'rparen' };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let start = index;
      while (index < expression.length && /[0-9.]/.test(expression[index])) index += 1;
      const value = Number(expression.slice(start, index));
      if (!Number.isFinite(value)) throw new Error('Invalid number literal');
      tokens.push({ type: 'number', value });
      continue;
    }

    if (/[a-z]/i.test(char)) {
      let start = index;
      while (index < expression.length && /[a-z]/i.test(expression[index])) index += 1;
      tokens.push({ type: 'ident', value: expression.slice(start, index).toLowerCase() });
      continue;
    }

    if ('+-*/^'.includes(char)) {
      tokens.push({ type: 'op', value: char as '+' | '-' | '*' | '/' | '^' });
      index += 1;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'lparen' });
      index += 1;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'rparen' });
      index += 1;
      continue;
    }

    throw new Error(`Unexpected character "${char}" in expression`);
  }

  return tokens;
}

type Node =
  | { type: 'number'; value: number }
  | { type: 'variable' }
  | { type: 'call'; name: string; arg: Node }
  | { type: 'unary'; op: '+' | '-'; arg: Node }
  | { type: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node };

class Parser {
  private tokens: Token[];
  private position = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private consume(): Token {
    const token = this.tokens[this.position];
    if (!token) throw new Error('Unexpected end of expression');
    this.position += 1;
    return token;
  }

  parse(): Node {
    const node = this.parseExpression();
    if (this.position < this.tokens.length) throw new Error('Unexpected trailing tokens');
    return node;
  }

  private parseExpression(): Node {
    let node = this.parseTerm();
    while (this.peek()?.type === 'op' && (this.peek() as any).value === '+' || this.peek()?.type === 'op' && (this.peek() as any).value === '-') {
      const op = (this.consume() as { type: 'op'; value: '+' | '-' }).value;
      const right = this.parseTerm();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  private parseTerm(): Node {
    let node = this.parseUnary();
    while (this.peek()?.type === 'op' && ((this.peek() as any).value === '*' || (this.peek() as any).value === '/')) {
      const op = (this.consume() as { type: 'op'; value: '*' | '/' }).value;
      const right = this.parseUnary();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  private parseUnary(): Node {
    const token = this.peek();
    if (token?.type === 'op' && (token.value === '+' || token.value === '-')) {
      this.consume();
      return { type: 'unary', op: token.value, arg: this.parseUnary() };
    }
    return this.parsePower();
  }

  private parsePower(): Node {
    const base = this.parsePrimary();
    if (this.peek()?.type === 'op' && (this.peek() as any).value === '^') {
      this.consume();
      const exponent = this.parseUnary();
      return { type: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  private parsePrimary(): Node {
    const token = this.consume();

    if (token.type === 'number') return { type: 'number', value: token.value };

    if (token.type === 'lparen') {
      const inner = this.parseExpression();
      if (this.peek()?.type !== 'rparen') throw new Error('Missing closing parenthesis');
      this.consume();
      return inner;
    }

    if (token.type === 'ident') {
      if (token.value === 'x') return { type: 'variable' };
      if (token.value in ALLOWED_CONSTANTS) return { type: 'number', value: ALLOWED_CONSTANTS[token.value] };

      if (ALLOWED_FUNCTIONS.has(token.value)) {
        if (this.peek()?.type !== 'lparen') throw new Error(`Expected "(" after ${token.value}`);
        this.consume();
        const arg = this.parseExpression();
        if (this.peek()?.type !== 'rparen') throw new Error('Missing closing parenthesis');
        this.consume();
        return { type: 'call', name: token.value, arg };
      }

      throw new Error(`Unknown identifier "${token.value}"`);
    }

    throw new Error('Unexpected token in expression');
  }
}

function evaluateNode(node: Node, x: number): number {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'variable':
      return x;
    case 'unary':
      return node.op === '-' ? -evaluateNode(node.arg, x) : evaluateNode(node.arg, x);
    case 'call': {
      const argValue = evaluateNode(node.arg, x);
      switch (node.name) {
        case 'sin': return Math.sin(argValue);
        case 'cos': return Math.cos(argValue);
        case 'tan': return Math.tan(argValue);
        case 'sqrt': return Math.sqrt(argValue);
        case 'log': return Math.log10(argValue);
        case 'ln': return Math.log(argValue);
        case 'exp': return Math.exp(argValue);
        case 'abs': return Math.abs(argValue);
        default: throw new Error(`Unknown function "${node.name}"`);
      }
    }
    case 'binary': {
      const left = evaluateNode(node.left, x);
      const right = evaluateNode(node.right, x);
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '^': return Math.pow(left, right);
        default: throw new Error('Unknown operator');
      }
    }
  }
}

export function isSafeExpression(expression: string): boolean {
  if (!expression || expression.length > 200) return false;
  if (!SAFE_EXPRESSION_PATTERN.test(expression)) return false;

  const identifiers = expression.toLowerCase().match(/[a-z]+/g) || [];
  return identifiers.every(
    (identifier) => identifier === 'x' || ALLOWED_FUNCTIONS.has(identifier) || identifier in ALLOWED_CONSTANTS,
  );
}

export function compileExpression(expression: string): (x: number) => number {
  if (!isSafeExpression(expression)) throw new Error('Expression contains disallowed characters or names');
  const ast = new Parser(tokenize(expression)).parse();
  return (x: number) => evaluateNode(ast, x);
}

export interface Point {
  x: number;
  y: number;
}

const MAX_SAMPLE_MAGNITUDE_MULTIPLIER = 60;

export function sampleFunction(expression: string, domainMin: number, domainMax: number, steps = 120): Point[] {
  const evaluate = compileExpression(expression);
  const span = Math.max(Math.abs(domainMax - domainMin), 1);
  const magnitudeLimit = span * MAX_SAMPLE_MAGNITUDE_MULTIPLIER;
  const points: Point[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const x = domainMin + ((domainMax - domainMin) * index) / steps;
    let y: number;
    try {
      y = evaluate(x);
    } catch {
      continue;
    }
    if (!Number.isFinite(y) || Math.abs(y) > magnitudeLimit) continue;
    points.push({ x, y });
  }

  return points;
}

export function findYIntercept(expression: string, domainMin: number, domainMax: number): Point | null {
  if (domainMin > 0 || domainMax < 0) return null;
  try {
    const evaluate = compileExpression(expression);
    const y = evaluate(0);
    if (!Number.isFinite(y)) return null;
    return { x: 0, y };
  } catch {
    return null;
  }
}

// Approximate roots by scanning sampled points for sign changes and linearly interpolating
// between them. Good enough for a study visualization, not a numerical-methods textbook.
export function findRoots(points: Point[], maxRoots = 4): Point[] {
  const roots: Point[] = [];

  for (let index = 1; index < points.length && roots.length < maxRoots; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous.y === 0) {
      roots.push({ x: previous.x, y: 0 });
      continue;
    }
    if (previous.y * current.y < 0) {
      const ratio = previous.y / (previous.y - current.y);
      const x = previous.x + ratio * (current.x - previous.x);
      roots.push({ x, y: 0 });
    }
  }

  return roots;
}

// Approximate turning points by scanning for a sign change in the discrete derivative.
export function findTurningPoints(points: Point[], maxPoints = 3): Point[] {
  const turningPoints: Point[] = [];

  for (let index = 1; index < points.length - 1 && turningPoints.length < maxPoints; index += 1) {
    const before = points[index].y - points[index - 1].y;
    const after = points[index + 1].y - points[index].y;
    if (before === 0 || after === 0) continue;
    if ((before > 0) !== (after > 0)) {
      turningPoints.push(points[index]);
    }
  }

  return turningPoints;
}

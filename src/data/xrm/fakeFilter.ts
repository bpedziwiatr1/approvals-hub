import type { Entity } from "./xrmTypes";

/**
 * Evaluates the subset of OData `$filter` the hub sends: `eq`/`ne`/`ge`/`le` against string, number, GUID,
 * date-time and null literals, `contains(field,'x')`, `collection/any(v:v/field ...)`, `and`, `or` and parentheses. String comparison ignores case, like
 * Dataverse's collation. Throws on anything else so an unsupported query fails a contract test loudly.
 */
export function compileFilter(filter: string): (row: Entity) => boolean {
  const tokens = filter.match(/'(?:[^']|'')*'|[(),]|[^\s(),']+/g) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (token: string) => {
    if (next() !== token) throw new Error(`Unsupported $filter near "${tokens[pos - 1]}": expected "${token}" in ${filter}`);
  };

  type Pred = (row: Entity) => boolean;
  // Name of the lambda variable while parsing the body of any(); its fields read from the element tested.
  let lambdaVar: string | null = null;

  const value = (): ((row: Entity) => unknown) => {
    const token = next();
    if (token === undefined) throw new Error(`Unexpected end of $filter: ${filter}`);
    if (token === "null") return () => null;
    if (token.startsWith("'")) {
      const text = token.slice(1, -1).replace(/''/g, "'");
      return () => text;
    }
    if (/^-?\d+(\.\d+)?$/.test(token)) return () => Number(token);
    if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(token)) return () => token;
    if (/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(token)) return () => ({ date: Date.parse(token) });
    const field = lambdaVar && token.startsWith(`${lambdaVar}/`) ? token.slice(lambdaVar.length + 1) : token;
    return (row) => row[field] ?? null;
  };

  const same = (a: unknown, b: unknown) =>
    typeof a === "string" && typeof b === "string" ? a.toLowerCase() === b.toLowerCase() : a === b;

  const time = (v: unknown) => (typeof v === "object" && v !== null ? (v as { date: number }).date : typeof v === "string" ? Date.parse(v) : NaN);

  const primary = (): Pred => {
    if (peek() === "(") {
      next();
      const inner = or();
      expect(")");
      return inner;
    }
    if (peek() === "contains") {
      next();
      expect("(");
      const haystack = value();
      expect(",");
      const needle = value();
      expect(")");
      return (row) => {
        const h = haystack(row);
        const n = needle(row);
        return typeof h === "string" && typeof n === "string" && h.toLowerCase().includes(n.toLowerCase());
      };
    }
    if (peek()?.endsWith("/any") && tokens[pos + 1] === "(") {
      const collection = next()!.slice(0, -"/any".length);
      next();
      const variable = /^(\w+):/.exec(peek() ?? "")?.[1];
      if (!variable) throw new Error(`Unsupported any() in $filter: ${filter}`);
      tokens[pos] = tokens[pos].slice(variable.length + 1);
      const outer = lambdaVar;
      lambdaVar = variable;
      const body = or();
      lambdaVar = outer;
      expect(")");
      return (row) => Array.isArray(row[collection]) && (row[collection] as Entity[]).some(body);
    }
    const left = value();
    const op = next();
    if (op === "ge" || op === "le") {
      const bound = value();
      return (row) => {
        const l = time(left(row));
        const r = time(bound(row));
        return !Number.isNaN(l) && !Number.isNaN(r) && (op === "ge" ? l >= r : l <= r);
      };
    }
    if (op !== "eq" && op !== "ne") throw new Error(`Unsupported operator "${op}" in $filter: ${filter}`);
    const right = value();
    return op === "eq" ? (row) => same(left(row), right(row)) : (row) => !same(left(row), right(row));
  };

  const and = (): Pred => {
    let result = primary();
    while (peek() === "and") {
      next();
      const l = result;
      const r = primary();
      result = (row) => l(row) && r(row);
    }
    return result;
  };

  function or(): Pred {
    let result = and();
    while (peek() === "or") {
      next();
      const l = result;
      const r = and();
      result = (row) => l(row) || r(row);
    }
    return result;
  }

  const predicate = or();
  if (pos !== tokens.length) throw new Error(`Unsupported $filter near "${tokens[pos]}": ${filter}`);
  return predicate;
}

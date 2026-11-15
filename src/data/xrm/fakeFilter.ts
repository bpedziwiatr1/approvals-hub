import type { Entity } from "./xrmTypes";

/**
 * Evaluates the subset of OData `$filter` the hub sends: `eq`/`ne` against string, number and null
 * literals, `contains(field,'x')`, `startswith(field,'x')`, `and`, `or` and parentheses. String comparison ignores case, like
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

  const value = (): ((row: Entity) => unknown) => {
    const token = next();
    if (token === undefined) throw new Error(`Unexpected end of $filter: ${filter}`);
    if (token === "null") return () => null;
    if (token.startsWith("'")) {
      const text = token.slice(1, -1).replace(/''/g, "'");
      return () => text;
    }
    if (/^-?\d+(\.\d+)?$/.test(token)) return () => Number(token);
    return (row) => row[token] ?? null;
  };

  const same = (a: unknown, b: unknown) =>
    typeof a === "string" && typeof b === "string" ? a.toLowerCase() === b.toLowerCase() : a === b;

  const primary = (): Pred => {
    if (peek() === "(") {
      next();
      const inner = or();
      expect(")");
      return inner;
    }
    if (peek() === "contains" || peek() === "startswith") {
      const fn = next();
      expect("(");
      const haystack = value();
      expect(",");
      const needle = value();
      expect(")");
      return (row) => {
        const h = haystack(row);
        const n = needle(row);
        if (typeof h !== "string" || typeof n !== "string") return false;
        return fn === "contains" ? h.toLowerCase().includes(n.toLowerCase()) : h.toLowerCase().startsWith(n.toLowerCase());
      };
    }
    const left = value();
    const op = next();
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

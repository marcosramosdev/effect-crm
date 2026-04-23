type Row = Record<string, unknown>

interface MockOptions {
  rows?: Row[]
  error?: { message: string; code?: string } | null
}

interface QueryResult<T = Row | Row[] | null> {
  data: T
  error: { message: string; code?: string } | null
}

function makeChain(rows: Row[], error: { message: string; code?: string } | null) {
  const result: QueryResult<Row[]> = error ? { data: [], error } : { data: rows, error: null }
  const singleResult: QueryResult<Row | null> = error
    ? { data: null, error }
    : { data: rows[0] ?? null, error: null }

  const chain: Record<string, unknown> & PromiseLike<QueryResult<Row[]>> = {
    select: (_cols?: string) => chain,
    eq: (_col: string, _val: unknown) => chain,
    neq: (_col: string, _val: unknown) => chain,
    is: (_col: string, _val: unknown) => chain,
    in: (_col: string, _vals: unknown[]) => chain,
    not: (_col: string, _op: string, _val: unknown) => chain,
    order: (_col: string, _opts?: unknown) => chain,
    limit: (_n: number) => chain,
    range: (_from: number, _to: number) => chain,
    update: (_data: Row) => chain,
    delete: () => chain,
    insert: (_data: Row | Row[]) => chain,
    upsert: (_data: Row | Row[], _opts?: unknown) => chain,
    single: () => Promise.resolve(singleResult),
    maybeSingle: () => Promise.resolve(singleResult),
    then: <R>(
      onfulfilled: (v: QueryResult<Row[]>) => R,
      onrejected?: (e: unknown) => R,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  }

  return chain
}

export function makeSupabaseMock({ rows = [], error = null }: MockOptions = {}) {
  return {
    from: (_table: string) => makeChain(rows, error),
  }
}

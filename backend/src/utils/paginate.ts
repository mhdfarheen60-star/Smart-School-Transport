import { FilterQuery, Model, PopulateOptions } from 'mongoose';
import { escapeRegex } from './http';

interface Options {
  populate?: (string | PopulateOptions)[];
  sortable?: string[];
  defaultSort?: string;
  searchFields?: string[];
}

export interface PageResult<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}

/** Search + sort + pagination shared by every list endpoint. */
export async function paginate<T>(
  model: Model<T>,
  baseFilter: FilterQuery<T>,
  query: Record<string, unknown>,
  opts: Options = {}
): Promise<PageResult<any>> {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '10'), 10) || 10));

  const filter: any = { ...baseFilter };
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search && opts.searchFields?.length) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const or = opts.searchFields.map((f) => ({ [f]: rx }));
    filter.$and = [...(filter.$and || []), { $or: or }];
  }

  let sort: Record<string, 1 | -1> = {};
  const rawSort = typeof query.sort === 'string' ? query.sort : opts.defaultSort || '-createdAt';
  const field = rawSort.replace(/^-/, '');
  const allowed = opts.sortable || [];
  if (allowed.includes(field) || field === 'createdAt') {
    sort[field] = rawSort.startsWith('-') ? -1 : 1;
  } else {
    const d = opts.defaultSort || '-createdAt';
    sort[d.replace(/^-/, '')] = d.startsWith('-') ? -1 : 1;
  }

  let q = model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
  for (const p of opts.populate || []) q = q.populate(p as any);
  const [items, total] = await Promise.all([q.lean().exec(), model.countDocuments(filter)]);
  return { items, meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

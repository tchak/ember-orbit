import { QueryExpression } from '@orbit/data';
import { deepMerge } from '@orbit/utils';

import Store from '../store';
import Model from '../model';
import { cacheQuery, sourceQuery, LookupResult } from '../cache';
import { BaseQueryOrTransformBuilder } from './base';
import { mergeOptions } from './utils';

export class BatchQueryBuilder<T extends Model>
  implements PromiseLike<LookupResult<T>> {
  source: Store;
  expressions: QueryExpression[];
  options?: object;

  constructor(source: Store, expressions: QueryExpression[], options?: object) {
    this.source = source;
    this.expressions = expressions;
    this.options = options;
  }

  toQueryExpressions(): QueryExpression[] {
    return this.expressions;
  }

  peek(): LookupResult<T> {
    return cacheQuery<T>(this.source, this.toQueryExpressions(), this.options);
  }

  then<K = LookupResult<T>>(
    onfullfiled?: null | ((value: any) => K | PromiseLike<K>),
    onrejected?: null | ((reason: any) => PromiseLike<never>)
  ): Promise<K> {
    return sourceQuery<T>(
      this.source,
      this.toQueryExpressions(),
      this.options
    ).then<K>(onfullfiled, onrejected);
  }

  reload(): Promise<LookupResult<T>> {
    return sourceQuery(
      this.source,
      this.toQueryExpressions(),
      mergeOptions(this.options, { reload: true })
    );
  }

  merge<K extends Model = T>(
    ...queryBuilders: BaseQueryOrTransformBuilder[]
  ): BatchQueryBuilder<T | K> {
    return merge<T | K>(this.toQueryExpressions(), queryBuilders);
  }

  static merge<T extends Model>(
    ...queryBuilders: BaseQueryOrTransformBuilder[]
  ) {
    return merge<T>([], queryBuilders);
  }
}

function merge<T extends Model>(
  queryExpressions: QueryExpression[],
  queryBuilders: BaseQueryOrTransformBuilder[]
) {
  const expressions = queryExpressions.concat(
    queryBuilders.map(queryBuilder => queryBuilder.toQueryExpression())
  );
  const options = queryBuilders.reduce(
    (options, queryBuilder) =>
      queryBuilder.options ? deepMerge(options, queryBuilder.options) : options,
    {}
  );

  return new BatchQueryBuilder<T>(
    queryBuilders[0].source,
    expressions,
    options
  );
}

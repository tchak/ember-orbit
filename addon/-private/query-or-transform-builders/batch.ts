import { QueryExpression } from '@orbit/data';

import {
  QueryableAndTransfomableSource,
  cacheQuery,
  sourceQuery,
  LookupResult
} from '../cache';
import { ModelIdentity } from '../identity-map';
import { BaseQueryOrTransformBuilder } from './base';
import { deepMerge } from '@orbit/utils';

export class BatchQueryBuilder<T extends ModelIdentity>
  implements PromiseLike<LookupResult<T>> {
  source: QueryableAndTransfomableSource;
  expressions: QueryExpression[];
  options?: object;

  constructor(
    source: QueryableAndTransfomableSource,
    expressions: QueryExpression[],
    options?: object
  ) {
    this.source = source;
    this.expressions = expressions;
    this.options = options;
  }

  toQueryExpressions(): QueryExpression[] {
    return this.expressions;
  }

  peek(): LookupResult<T> {
    return cacheQuery<T>(
      this.source.cache,
      this.toQueryExpressions(),
      this.options
    );
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

  merge<K extends ModelIdentity = T>(
    ...queryBuilders: BaseQueryOrTransformBuilder[]
  ): BatchQueryBuilder<T | K> {
    return merge<T | K>(this.toQueryExpressions(), queryBuilders);
  }

  static merge<T extends ModelIdentity>(
    ...queryBuilders: BaseQueryOrTransformBuilder[]
  ) {
    return merge<T>([], queryBuilders);
  }
}

function merge<T extends ModelIdentity>(
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

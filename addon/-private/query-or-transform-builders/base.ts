import { QueryExpression } from '@orbit/data';

import { QueryableAndTransfomableSource } from '../cache';

export class BaseQueryOrTransformBuilder {
  source: QueryableAndTransfomableSource;
  expression: QueryExpression;
  options?: object;

  constructor(
    source: QueryableAndTransfomableSource,
    expression: QueryExpression,
    options?: object
  ) {
    this.source = source;
    this.expression = expression;
    this.options = options;
  }

  toQueryExpression(): QueryExpression {
    return this.expression;
  }
}

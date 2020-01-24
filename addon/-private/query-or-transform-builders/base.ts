import { QueryExpression } from '@orbit/data';

import Store from '../store';

export abstract class BaseQueryOrTransformBuilder {
  source: Store;
  expression: QueryExpression;
  options?: object;

  constructor(source: Store, expression: QueryExpression, options?: object) {
    this.source = source;
    this.expression = expression;
    this.options = options;
  }

  toQueryExpression(): QueryExpression {
    return this.expression;
  }
}

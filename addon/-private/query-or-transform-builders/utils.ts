import {
  FilterQBParam,
  FilterSpecifier,
  RelatedRecordFilterQBParam,
  RelatedRecordFilterSpecifier,
  RelatedRecordsFilterQBParam,
  RelatedRecordsFilterSpecifier,
  AttributeFilterQBParam,
  PageSpecifier,
  PageQBParam,
  AttributeFilterSpecifier,
  SortQBParam,
  SortSpecifier,
  AttributeSortQBParam,
  AttributeSortSpecifier,
  SortOrder
} from '@orbit/data';
import { deepMerge, clone, isObject } from '@orbit/utils';

export function mergeOptions(
  options?: object,
  newOptions?: object
): object | undefined {
  if (options) {
    if (newOptions) {
      return deepMerge(clone(options), newOptions);
    }
    return clone(options);
  }
  return undefined;
}

export function filterParamToSpecifier(param: FilterQBParam): FilterSpecifier {
  if (hasOwnProperty(param, 'kind')) {
    return param as FilterSpecifier;
  }
  const op = param.op || 'equal';
  if (hasOwnProperty(param, 'relation')) {
    if (hasOwnProperty(param, 'record')) {
      return {
        kind: 'relatedRecord',
        op,
        relation: (param as RelatedRecordFilterQBParam).relation,
        record: (param as RelatedRecordFilterQBParam).record
      } as RelatedRecordFilterSpecifier;
    } else if (hasOwnProperty(param, 'records')) {
      return {
        kind: 'relatedRecords',
        op,
        relation: (param as RelatedRecordsFilterQBParam).relation,
        records: (param as RelatedRecordsFilterQBParam).records
      } as RelatedRecordsFilterSpecifier;
    }
  } else if (hasOwnProperty(param, 'attribute')) {
    return {
      kind: 'attribute',
      op,
      attribute: (param as AttributeFilterQBParam).attribute,
      value: (param as AttributeFilterQBParam).value
    } as AttributeFilterSpecifier;
  }
  throw new Error('Unrecognized filter param.');
}

export function pageParamToSpecifier(param: PageQBParam): PageSpecifier {
  if (hasOwnProperty(param, 'offset') || hasOwnProperty(param, 'limit')) {
    return {
      kind: 'offsetLimit',
      offset: param.offset,
      limit: param.limit
    };
  }
  throw new Error('Unrecognized page param.');
}

export function sortParamToSpecifier(param: SortQBParam): SortSpecifier {
  if (isObject(param)) {
    if (hasOwnProperty(param, 'kind')) {
      return param as SortSpecifier;
    } else if (hasOwnProperty(param, 'attribute')) {
      return {
        kind: 'attribute',
        attribute: (param as AttributeSortQBParam).attribute,
        order: (param as AttributeSortQBParam).order || 'ascending'
      } as AttributeSortSpecifier;
    }
  } else if (typeof param === 'string') {
    return parseSortParamString(param);
  }
  throw new Error('Unrecognized sort param.');
}

export function parseSortParamString(
  sortSpecifier: string
): AttributeSortSpecifier {
  let attribute: string;
  let order: SortOrder;

  if (sortSpecifier[0] === '-') {
    attribute = sortSpecifier.slice(1);
    order = 'descending';
  } else {
    attribute = sortSpecifier;
    order = 'ascending';
  }

  return {
    kind: 'attribute',
    attribute,
    order
  };
}

function hasOwnProperty(obj: any, property: string) {
  return Object.prototype.hasOwnProperty.call(obj, property);
}

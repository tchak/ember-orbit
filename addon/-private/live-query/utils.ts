import {
  Record,
  cloneRecordIdentity,
  RecordIdentity,
  RecordOperation
} from '@orbit/data';

export interface RecordChange extends RecordIdentity {
  keys: string[];
  attributes: string[];
  relationships: string[];
  remove: boolean;
}

export function recordOperationChange(
  operation: RecordOperation
): RecordChange {
  const record = operation.record as Record;
  const change: RecordChange = {
    ...cloneRecordIdentity(record),
    remove: false,
    keys: [],
    attributes: [],
    relationships: []
  };

  switch (operation.op) {
    case 'addRecord':
    case 'updateRecord':
      if (record.keys) {
        change.keys = Object.keys(record.keys);
      }
      if (record.attributes) {
        change.attributes = Object.keys(record.attributes);
      }
      if (record.relationships) {
        change.relationships = Object.keys(record.relationships);
      }
      break;
    case 'replaceAttribute':
      change.attributes = [operation.attribute];
      break;
    case 'replaceKey':
      change.keys = [operation.key];
      break;
    case 'replaceRelatedRecord':
    case 'replaceRelatedRecords':
    case 'addToRelatedRecords':
    case 'removeFromRelatedRecords':
      change.relationships = [operation.relationship];
      break;
    case 'removeRecord':
      change.remove = true;
      break;
  }

  return change;
}

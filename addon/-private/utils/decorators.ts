export function isFieldDescriptor(possibleDesc) {
  let [target, key, desc] = possibleDesc;

  return (
    possibleDesc.length === 3 &&
    typeof target === 'object' &&
    target !== null &&
    typeof key === 'string' &&
    ((typeof desc === 'object' &&
      desc !== null &&
      'enumerable' in desc &&
      'configurable' in desc) ||
      desc === undefined) // TS compatibility
  );
}

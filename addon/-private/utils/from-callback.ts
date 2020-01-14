export interface Options {
  onError?: (err: Error) => void;
  onClose?: (listenerReturnValue?: ListenerReturnValue) => void;
  buffering?: boolean;
}

export type ListenerReturnValue = void | (() => void);

export default function fromCallback<T>(
  listener: (callback: (input: T) => void) => Promise<ListenerReturnValue>,
  options?: Options
): AsyncIterableIterator<T> {
  const {
    onError = defaultOnError,
    onClose = defaultOnClose,
    buffering = true
  } = options || {};

  try {
    let listenerReturnValue: ListenerReturnValue;
    const { pushValue, emptyQueue, next } = createQueue<T>(buffering, () =>
      onClose(listenerReturnValue)
    );

    listener(value => pushValue(value))
      .then(a => {
        listenerReturnValue = a;
      })
      .catch(err => {
        onError(err);
      });

    return {
      next(): Promise<IteratorResult<T>> {
        return next();
      },
      return(): Promise<IteratorResult<T>> {
        emptyQueue();
        return Promise.resolve({ value: undefined, done: true });
      },
      throw(error) {
        emptyQueue();
        onError(error);
        return Promise.reject(error);
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  } catch (err) {
    onError(err);
    return {
      next() {
        return Promise.reject(err);
      },
      return() {
        return Promise.reject(err);
      },
      throw(error) {
        return Promise.reject(error);
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }
}

function createQueue<T>(buffering: boolean, onClose: () => void) {
  let pullQueue: ((
    value?: IteratorResult<T> | PromiseLike<IteratorResult<T>>
  ) => void)[] = [];
  let pushQueue: T[] = [];
  let listening = true;

  function pushValue(value: T): void {
    if (pullQueue.length !== 0) {
      const resolve = pullQueue.shift();
      resolve && resolve({ value, done: false });
    } else if (buffering === true) {
      pushQueue.push(value);
    }
  }

  function pullValue(): Promise<IteratorResult<T>> {
    return new Promise(resolve => {
      if (pushQueue.length !== 0) {
        const value = pushQueue.shift();
        if (value === undefined) {
          throw new Error();
        }
        resolve({ value, done: false });
      } else {
        pullQueue.push(resolve);
      }
    });
  }

  function next(): Promise<IteratorResult<T>> {
    if (listening) {
      return pullValue();
    } else {
      emptyQueue();
      return Promise.resolve({ value: undefined, done: true });
    }
  }

  function emptyQueue(): void {
    if (listening) {
      listening = false;
      pullQueue.forEach(resolve => resolve({ value: undefined, done: true }));
      pullQueue = [];
      pushQueue = [];
      onClose();
    }
  }

  return {
    pushValue,
    emptyQueue,
    next
  };
}

function defaultOnError(err: Error) {
  throw err;
}

function defaultOnClose(listenerReturnValue?: ListenerReturnValue): void {
  listenerReturnValue && listenerReturnValue();
}

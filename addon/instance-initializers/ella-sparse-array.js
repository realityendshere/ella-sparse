import Ember from 'ember';
import { task } from 'ember-concurrency';

const DEFAULT_TTL = 36000000;

const {
  Object: EmberObject,
  Array: EmberArray,
  computed,
  get,
  getProperties,
  set,
  setProperties,
  isArray,
  A,
  assert,
  RSVP: { Promise },
  typeOf,
  ObjectProxy
} = Ember;

const EllaSparseArray = EmberObject.extend(EmberArray, {
  __onFetch__() {
    assert('Provide a custom `on-fetch` method to populate data into this sparse array');

    return {
      data: A(),
      total: 0
    };
  },

  _length: null,

  enabled: true,

  expired: 0,

  limit: 10,

  ttl: DEFAULT_TTL,

  data: computed(function() {
    return {};
  }).readOnly(),

  isLength: computed('_length', function() {
    let _length = parseInt(get(this, '_length'), 10);

    return !isNaN(_length);
  }).readOnly(),

  isNotLength: computed.not('isLength').readOnly(),

  isSparseArray: computed(function() {
    return true;
  }).readOnly(),

  lastObject: computed('length', function() {
    let len = get(this, 'length');

    if (len === 0) {
      return undefined;
    }

    return this.objectAt(len - 1);
  }),

  length: computed('_length', 'isNotLength', 'remoteQuery', {
    get() {
      if (get(this, 'isNotLength')) {
        this._fetchObjectAt(0);

        return 0;
      }

      return result;
    },

    set(key, value) {
      return set(this, '_length', value);
    }
  }),

  loading: computed.and('isNotLength', 'fetchTask.isRunning'),

  'on-fetch': computed(function() {
    return this.__onFetch__;
  }),

  init() {
    this._super();

    assert('`on-fetch` must be a function', typeof get(this, 'on-fetch') === 'function');

    return this;
  },

  expire() {
    get(this, 'fetchTask').cancelAll();
    set(this, 'expired', Date.now());

    return this;
  },

  fetchObjectAt(idx, options = {}) {
    let { noFetch } = options;

    idx = parseInt(idx, 10);

    if (noFetch || !get(this, 'enabled')) {
      return this.sparseObjectAt(idx);
    }

    return this._fetchObjectAt(idx);
  },

  filter(fn) {
    assert('filter() not supported in sparse arrays. Use filterBy instead.');

    return this;
  },

  filterBy(obj = {}) {
    assert("filterBy only supports objects.", typeOf(obj) === 'object');

    if (this.isCurrentFilter(obj)) {
      return this;
    }

    setProperties(this, {
      remoteQuery: obj,
      _length: null
    });

    return this.expire();
  },

  fulfill(range, array) {
    array = A(array);

    for (let i = 0; i < range.length; i++) {
      let itemIndex = range.start + i;
      let item = this.sparseObjectAt(itemIndex);

      if (item && typeof item.resolveContent === 'function') {
        item.resolveContent(array.objectAt(i));
      }
    }

    return this;
  },

  isCurrentFilter(obj) {
    let current = get(this, 'remoteQuery');

    return JSON.stringify(obj) === JSON.stringify(current);
  },

  objectAt(idx, options = {}) {
    idx = parseInt(idx, 10);

    // Arrays and negative indexes don't mix
    if (isNaN(idx) || idx < 0) {
      return undefined;
    }

    let { isLength, length } = getProperties(this, 'isLength', 'length');
    let result;

    if (isLength && idx >= length) {
      return undefined;
    }

    result = this.sparseObjectAt(idx);

    if (result && result.isContentExpired(get(this, 'expired')) !== true) {
      return result;
    }

    return this.fetchObjectAt(idx, options);
  },

  pathToIndex(idx) {
    return ['data', idx].join('.');
  },

  sparseObjectAt(idx) {
    return get(this, 'data')[idx] || this._insertSparseItem(idx);
  },

  unset(...idx) {
    let indexes = A([].concat.apply([], idx));

    indexes.forEach((i) => {
      this._unset(i);
    });

    return this;
  },

  _didRequestRange(range) {
    let fn = get(this, 'on-fetch');
    let query = get(this, 'remoteQuery');

    this._startFetchingContentInRange(range);

    if (typeof fn !== 'function') {
      fn = this.__onFetch__;
    }

    return fn(range, query);
  },

  _fetchObjectAt(idx) {
    let limit = parseInt(get(this, 'limit'), 10) || 1;
    let start = Math.floor(idx / limit) * limit;
    start = Math.max(start, 0);

    get(this, 'fetchTask').perform({ start: start, length: limit });

    return this.sparseObjectAt(idx);
  },

  _insertSparseItem(idx) {
    get(this, 'data')[idx] = EllaSparseItem.create({
      __ttl__: get(this, 'ttl')
    });

    return get(this, this.pathToIndex(idx));
  },

  _requestRangeFailed(range, err) {
    let data = get(this, 'data');
    let from = range.start;
    let until = Math.min((range.start + range.length), data.length);

    for (let i = from; i < until; i++) {
      let item = data[i];

      if (item && typeof item.reportError === 'function') {
        item.reportError(err);
      }
    }
  },

  _startFetchingContentInRange(range) {
    for (let i = range.start; i < (range.start + range.length); i++) {
      let item = this.sparseObjectAt(i);

      if (item) {
        get(item, 'fetchingContent').perform();
      }
    }
  },

  _unset(idx) {
    idx = parseInt(idx, 10);

    if (isNaN(idx)) {
      return this;
    }

    let item = get(this, this.pathToIndex(idx));

    if (typeof item.resetContent === 'function') {
      item.resetContent();
    }

    return this;
  },

  fetchTask: task(function* (range) {
    try {
      let { data, total } = yield this._didRequestRange(range);

      total = parseInt(total, 10);

      if (!isNaN(total) && total >= 0 && total !== Infinity) {
        set(this, 'length', total);
      }

      this.fulfill(range, data);
    } catch(e) {
      this._requestRangeFailed(range, e);
    }
  })
});

const EllaSparseItem = ObjectProxy.extend({
  reportError: null,
  resolveContent: null,

  isSparseItem: computed(function() {
    return true;
  }).readOnly(),

  __lastFetch__: 0,

  __ttl__: DEFAULT_TTL,

  __stale__: computed('__ttl__', '__lastFetch__', function() {
    return Boolean((get(this, '__lastFetch__') + get(this, '__ttl__')) <= Date.now());
  }).readOnly(),

  isContentExpired(timestamp = 0) {
    if (get(this, 'fetchingContent.isRunning')) {
      return false;
    }

    return Boolean(get(this, '__stale__') || get(this, '__lastFetch__') <= timestamp);
  },

  resetContent() {
    setProperties(this, {
      content: null,
      __lastFetch__: 0
    });

    return this;
  },

  __fetchContent() {
    return new Promise((resolve, reject) => {
      this.reportError = reject;
      this.resolveContent = resolve;
    });
  },

  fetchingContent: task(function* () {
    setProperties(this, { content: null });

    let content = yield this.__fetchContent();

    if (typeof content === 'undefined') {
      this.destroy();
    }

    setProperties(this, {
      content: content,
      __lastFetch__: Date.now()
    });
  }).drop()
});

export function initialize(appInstance) {
  appInstance.register('ella-sparse:array', EllaSparseArray);
}

export default {
  name: 'ella-sparse-arrays',
  initialize
};

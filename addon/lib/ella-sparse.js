import Ember from 'ember';
import { task } from 'ember-concurrency';
import SparseItem from 'ella-sparse/lib/ella-sparse-item';

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
  typeOf
} = Ember;

export default EmberObject.extend(EmberArray, {
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
  }),

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

  length: computed('_length', 'isLength', 'remoteQuery', {
    get() {
      if (!get(this, 'isLength')) {
        this.get('findLengthTask').perform();

        return 0;
      }

      return result;
    },

    set(key, value) {
      return set(this, '_length', value);
    }
  }),

  loading: computed.readOnly('findLengthTask.isRunning'),

  expire() {
    get(this, 'findLengthTask').cancelAll();
    get(this, 'fetchRecordsTask').cancelAll();

    set(this, 'expired', Date.now());
    return this;
  },

  fetchObjectAt(idx, options = {}) {
    idx = parseInt(idx, 10);

    let { noFetch } = options;

    if (noFetch || !get(this, 'enabled')) {
      return this.sparseObjectAt(idx);
    }

    let limit = parseInt(get(this, 'limit'), 10) || 1;
    let start = Math.floor(idx / limit) * limit;
    start = Math.max(start, 0);

    get(this, 'fetchRecordsTask').perform({ start: start, length: limit });

    return this.sparseObjectAt(idx);
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
    A(array).forEach((result, idx) => {
      let item = this.sparseObjectAt(range.start + idx);

      if (item && typeof item.resolveContent === 'function') {
        item.resolveContent(result);
      }
    });

    return this;
  },

  insertSparseItem(idx) {
    let q = this.pathToIndex(idx);
    let item = SparseItem.create({
      __ttl__: get(this, 'ttl')
    });

    get(this, 'data')[idx] = item;

    return get(this, q);
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
    return get(this, 'data')[idx] || this.insertSparseItem(idx);
  },

  unset(...idx) {
    let indexes = A([].concat.apply([], idx));

    indexes.forEach((i) => {
      this._unset(i);
    });

    return this;
  },

  _didRequestLength() {
    let action = get(this, 'on-length');
    let fn = get(this, ['target', 'actions', action].join('.'));
    let query = get(this, 'remoteQuery');

    if (typeof fn !== 'function') {
      return new Promise((resolve) => {
        assert('Cannot fetch length: `target` is undefined', get(this, 'target'));
        assert('Cannot fetch length: `target` has no actions', get(this, 'target.actions'));
        assert('Cannot fetch length: `on-length` action is invalid or undefined', typeof fn === 'function');

        resolve(0);
      });
    }

    return fn(query);
  },

  _didRequestRange(range) {
    let action = get(this, 'on-fetch');
    let fn = get(this, ['target', 'actions', action].join('.'));
    let query = get(this, 'remoteQuery');

    this._startFetchingContentInRange(range);

    if (typeof fn !== 'function') {
      return new Promise((resolve) => {
        assert('Cannot fetch results: `target` is undefined', get(this, 'target'));
        assert('Cannot fetch results: `target` has no actions', get(this, 'target.actions'));
        assert('Cannot fetch results: `on-fetch` action is invalid or undefined', typeof fn === 'function');

        resolve(A());
      });
    }

    return fn(range, query, this);
  },

  _requestRangeFailed(range, err) {
    let data = get(this, 'data');
    let from = range.start;
    let until = Math.min((range.start + range.length), data.length);

    for (let i = from; i < until; i++) {
      let item = data.objectAt(i);

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

  findLengthTask: task(function* () {
    let length = yield this._didRequestLength();

    set(this, 'length', length);
  }).restartable(),

  fetchRecordsTask: task(function* (range) {
    try {
      let records = yield this._didRequestRange(range);

      this.fulfill(range, records);
    } catch(e) {
      this._requestRangeFailed(range, e);
    }
  })
});

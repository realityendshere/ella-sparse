import EmberArray from '@ember/array';
import EmberObject from '@ember/object';
import { EllaSparseItem, DEFAULT_TTL } from '../-private/ella-sparse-item';
import { A } from '@ember/array';
import { assert } from '@ember/debug';
import { get, set, setProperties } from '@ember/object';
import { task, animationFrame } from 'ember-concurrency';
import { tracked } from '@glimmer/tracking';
import { typeOf } from '@ember/utils';

const ON_FETCH_FN = function () {
  assert(
    'Provide a custom `on-fetch` method to populate data into this sparse array'
  );

  return {
    data: A(),
    total: 0,
  };
};

/**
 * Sometimes in the course of creating ambitious web applications, we find
 * ourselves (potentially) needing to fetch hundreds or thousands of records
 * to display in a large list. Most APIs place limits on how many records can
 * be fetched in a single request. In most cases, the complete list of records
 * won't be entirely visible on screen at the same time.
 *
 * `EllaSparseArray` allows data to be retrieved on an as-needed basis. It
 * imitates the basic functionality of an array, and fetches "blocks" of data,
 * using a custom "on-fetch" function, when code or a template asks for the
 * first item on a "page."
 *
 * For example, with the default `limit` of `10` and a collection size of 765,
 * `sparseInstance.objectAt(102)` would request records with the indexes of
 * 100 through 109 and return the record with the index of 102.
 *
 * @class EllaSparseArray
 * @constructor
 * @extends {Ember.Object}
 * @uses Ember.Array
 * @public
 */
class EllaSparseArray extends EmberObject.extend(EmberArray) {
  /**
   * The internal length property.
   *
   * @property _length
   * @type {Number|Null}
   * @default null
   * @private
   */
  @tracked _length = null;

  /**
   * When `true`, the `enabled` property allows the `EllaSparseArray` instance
   * to request content. When `enabled` is `false`, empty placeholder objects
   * will be provided when getting a particular index, but no async requests
   * for data will be triggered.
   *
   * @property enabled
   * @type {Boolean}
   * @default true
   * @public
   */
  enabled = true;

  /**
   * A Javascript timestamp. Any items last resolved before the timestamp
   * stored in the `expired` property will be considered stale.
   *
   * @property expired
   * @type {Number}
   * @default 0
   * @public
   */
  expired = 0;

  /**
   * The number of items to fetch together on a "page."
   *
   * @property limit
   * @type {Number}
   * @default 10
   * @public
   */
  limit = 10;

  /**
   * The number of ms to wait until previously fetched content gets marked
   * as stale. For best results, set this value at init.
   *
   * @property ttl
   * @type {Number}
   * @default 36000000
   * @public
   */
  ttl = DEFAULT_TTL;

  /**
   * The content of this sparse array. Plot twist: it's actually an object.
   *
   * @property data
   * @type {Object}
   * @default {}
   * @public
   * @readOnly
   */
  data = null;

  /**
   * Indicates if the provided length of this "array" is available and valid.
   *
   * @property isLength
   * @type {Boolean}
   * @default false
   * @public
   * @readOnly
   */
  get isLength() {
    const _length = parseInt(this._length, 10);

    return !isNaN(_length);
  }

  /**
   * This is a "quacks like a duck" property to help quickly identify instances
   * of this class.
   *
   * @property isSparseArray
   * @type {Boolean}
   * @default true
   * @public
   * @readOnly
   * @final
   */
  get isSparseArray() {
    return true;
  }

  /**
   * Returns the item at the index `length - 1`.
   *
   * @property lastObject
   * @default undefined
   * @public
   * @readOnly
   */
  get lastObject() {
    const { length } = this;

    return length === 0 ? undefined : this.objectAt(length - 1);
  }

  /**
   * Reports the expected length of this sparse array.
   *
   * @property length
   * @type {Number}
   * @default 0
   * @public
   */
  get length() {
    return this.loading ? 0 : this._length;
  }

  set length(value) {
    set(this, '_length', value);
  }

  /**
   * The array itself is considered `loading` when the `length` is unknown.
   *
   * @property loading
   * @type {Boolean}
   * @default true
   * @readOnly
   * @public
   */
  get loading() {
    return !this.isLength;
  }

  /**
   * The on-fetch function is called each time a block of records must be
   * retrieved. This hook is provided with two parameters, both objects, a
   * `range` and a `query`.
   *
   * The `range` object contains three properties:
   *
   * + `length`: the number of items to fetch; the page size or limit
   * + `start`: the index of the first item to fetch; the offset
   * + `page`: the page number to retrieve
   *
   * The query object passes along any additional filter parameters you've
   * set on this `EllaSparseArray` instance.
   *
   * @property on-fetch
   * @type {Function}
   * @public
   */
  'on-fetch' = ON_FETCH_FN;

  static create(props) {
    const instance = new this(props);

    Object.assign(instance, props);
    instance.initialize();

    return instance;
  }

  constructor() {
    super(...arguments);

    this.data = {};
    this.__tasks = A([]);

    return this;
  }

  initialize() {
    assert(
      '`on-fetch` must be a function',
      typeof this['on-fetch'] === 'function'
    );

    if (this.loading) {
      this.fetchObjectAt(0);
    }
  }

  /**
   * Mark all items as stale. Useful when `length` changes or it seems likely
   * the previously fetched content is outdated.
   *
   * @method expire
   * @chainable
   * @public
   */
  expire() {
    this.fetchTask.cancelAll();
    this.__tasks = A([]);
    this.expired = Date.now();

    return this;
  }

  /**
   * Initiate the retrieval of content at a specified index. If
   * `this.get('enabled')` is `false` or the options param indicates
   * `noFetch: true` then data retrieval will be skipped.
   *
   * @method fetchObjectAt
   * @param {Number} idx The index of the object to retreive or reload
   * @param {Object} options Additional options (i.e. `{ noFetch: true }`)
   * @return {EllaSparseItem} The proxy object at the specified index
   * @public
   */
  fetchObjectAt(idx, options = {}) {
    const { noFetch } = options;

    idx = parseInt(idx, 10);

    if (noFetch || !this.enabled) {
      return this.sparseObjectAt(idx);
    }

    return this._fetchObjectAt(idx);
  }

  filter() {
    assert('filter() not supported in sparse arrays. Use filterBy instead.');

    return this;
  }

  /**
   * Set query parameters to pass along to the data fetching function. Updating
   * this filter will expire previously fetched content.
   *
   * @method filterBy
   * @param {Object} obj Query parameters to pass along to the `on-fetch` hook
   * @chainable
   * @public
   */
  filterBy(obj = {}) {
    assert('filterBy only supports objects.', typeOf(obj) === 'object');

    if (this.isCurrentFilter(obj)) {
      return this;
    }

    setProperties(this.expire(), {
      remoteQuery: obj,
      _length: null,
    });

    this.fetchObjectAt(0);

    return this;
  }

  /**
   * Inject data into the sparse array at the specified range.
   *
   * @method fulfill
   * @param {Object} range An object with `start` and `length` properties
   * @param {Array} array Data to inject into the items in the range
   * @chainable
   * @public
   */
  fulfill(range, array) {
    array = A(array);

    for (let i = 0; i < range.length; i++) {
      const itemIndex = range.start + i;
      const item = this.sparseObjectAt(itemIndex);

      if (item && typeof item.resolveContent === 'function') {
        item.resolveContent(array.objectAt(i));
      }
    }

    return this;
  }

  /**
   * Compare an object with the current `remoteQuery` value.
   *
   * @method isCurrentFilter
   * @param {Object} obj An object to compare with the current `remoteQuery`
   * @return {Boolean} `true` if current `remoteQuery` and object provided are a match
   * @public
   */
  isCurrentFilter(obj) {
    const current = this.remoteQuery;

    return JSON.stringify(obj) === JSON.stringify(current);
  }

  /**
   * Get the content at a specified index.
   *
   * If the content at the given index is present and up to date,
   * `this.get('enabled')` is `false`, or the options param indicates
   * `noFetch: true` then data retrieval will be skipped.
   *
   * @method objectAt
   * @param {Number} idx The index of the object to get
   * @param {Object} options Additional options (i.e. `{ noFetch: true }`)
   * @return {EllaSparseItem} The content available at the specified index
   * @public
   */
  objectAt(idx, options = {}) {
    const { isLength, length } = this;

    idx = parseInt(idx, 10);

    // Arrays and negative indexes don't mix
    if (isNaN(idx) || idx < 0) return undefined;
    if (isLength && idx >= length) return undefined;

    const item = this.sparseObjectAt(idx);

    if (item?.shouldFetchContent(this.expired) === true) {
      this.fetchObjectAt(idx, options);
    }

    return item;
  }

  /**
   * Return a dot-delimited path to use with `Ember.get`.
   *
   * @method pathToIndex
   * @param {Number} idx The index of the object to get
   * @return {String} A dot-delimited path to use with `Ember.get`
   * @public
   */
  pathToIndex(idx) {
    return ['data', idx].join('.');
  }

  /**
   * Return the `EllaSparseItem` instance at the given index.
   *
   * If nothing is found at the given index, generate an empty, new
   * `EllaSparseItem` at the given index and return it.
   *
   * @method sparseObjectAt
   * @param {Number} idx The index of the object to get
   * @return {EllaSparseItem} The content available at the specified index
   * @public
   */
  sparseObjectAt(idx) {
    return this.data[idx] || this._insertSparseItem(idx);
  }

  /**
   * Eject the content at the specified index(es). Accepts multiple arguments.
   *
   * @method unset
   * @param {Number} ...idx The index(es) to clear content from
   * @chainable
   * @public
   */
  unset(...idx) {
    const indexes = A([].concat.apply([], idx));

    indexes.forEach((i) => {
      this._unset(i);
    });

    return this;
  }

  /**
   * Assemble the range and query objects. Place the items in the specified
   * range into a loading state. Call the `on-fetch` hook.
   *
   * @method _didRequestRange
   * @param {Object} range A range object
   * @return {Promise} The promise returned from the `on-fetch` hook
   * @private
   */
  _didRequestRange(range) {
    const { remoteQuery } = this;
    let fn = this['on-fetch'];

    this._startFetchingContentInRange(range);

    if (typeof fn !== 'function') {
      fn = ON_FETCH_FN;
    }

    return fn(range, remoteQuery);
  }

  /**
   * Trigger a `fetchTask` to retrieve data for a given index.
   *
   * @method _fetchObjectAt
   * @param {Number} idx The index to fetch
   * @return {EllaSparseItem} The content available at the specified index
   * @private
   */
  _fetchObjectAt(idx) {
    const limit = parseInt(this.limit, 10) || 1;
    const pageIdx = Math.floor(idx / limit);
    const start = Math.max(pageIdx * limit, 0);
    const range = {
      start: start,
      length: limit,
      page: pageIdx + 1,
    };

    if (!this._isUnfinishedTaskForRange(range)) {
      this.__tasks.push(this.fetchTask.perform(range));
    }

    return this.sparseObjectAt(idx);
  }

  /**
   * Checks for unfinished tasks relevant to the given range.
   *
   * @method _isUnfinishedTaskForRange
   * @param {Object} range The range to place into a loading state
   * @private
   */
  _isUnfinishedTaskForRange({ start, length, page }) {
    return this.__tasks.find((task) => {
      const [arg] = task.args;

      if (task.isFinished) return false;
      if (arg.start === start && arg.length === length && arg.page === page)
        return true;
    })
      ? true
      : false;
  }

  /**
   * Removes finished tasks from the task tracking array.
   *
   * @method _cleanupFinishedTasks
   * @private
   */
  _cleanupFinishedTasks() {
    this.__tasks = this.__tasks.filter((task) => !task.isFinished);
  }

  /**
   * Create a new `EllaSparseItem` at a specified index.
   *
   * @method _insertSparseItem
   * @param {Number} idx The index to make an `EllaSparseItem` for
   * @return {EllaSparseItem} The content added at the specified index
   * @private
   */
  _insertSparseItem(idx) {
    this.data[idx] = new EllaSparseItem({
      __ttl__: this.ttl,
    });

    return get(this, this.pathToIndex(idx));
  }

  /**
   * Handle data fetching errors.
   *
   * @method _requestRangeFailed
   * @param {Object} range The range that failed to be retrieved
   * @param {Error} err The fetch error
   * @private
   */
  _requestRangeFailed(range, err) {
    const data = this.data;
    const from = range.start;
    const until = Math.min(range.start + range.length, data.length);

    for (let i = from; i < until; i++) {
      const item = data[i];

      if (item && typeof item.reportError === 'function') {
        item.reportError(err);
      }
    }
  }

  /**
   * Marks items in the specified range as in progress.
   *
   * @method _startFetchingContentInRange
   * @param {Object} range The range to place into a loading state
   * @private
   */
  _startFetchingContentInRange(range) {
    for (let i = range.start; i < range.start + range.length; i++) {
      const item = this.sparseObjectAt(i);

      if (item) {
        item.fetchContent();
      }
    }
  }

  /**
   * Clears the content of the item at the specified index.
   *
   * @method _unset
   * @param {Number} idx The index of the item to reset
   * @chainable
   * @private
   */
  _unset(idx) {
    idx = parseInt(idx, 10);

    if (isNaN(idx)) {
      return this;
    }

    const item = get(this, this.pathToIndex(idx));

    if (typeof item.resetContent === 'function') {
      item.resetContent();
    }

    return this;
  }

  fetchTask = task(async (range) => {
    try {
      await animationFrame();

      const { data, total } = await this._didRequestRange(range);
      const totalInt = parseInt(total, 10);

      if (!isNaN(totalInt) && totalInt >= 0 && totalInt !== Infinity) {
        set(this, '_length', totalInt);
      } else {
        assert(
          `Numeric, non-negative "total" is required! ({ total: ${totalInt} })`
        );
      }

      this.fulfill(range, data);
      this._cleanupFinishedTasks();
    } catch (e) {
      this._requestRangeFailed(range, e);
    }
  });
}

export function initialize(appInstance) {
  appInstance.register('ella-sparse:array', EllaSparseArray, {
    instantiate: false,
  });
}

export default {
  name: 'ella-sparse-arrays',
  initialize,
};

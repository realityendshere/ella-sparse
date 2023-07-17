/* eslint ember/named-functions-in-promises: 0 */
/* eslint ember/no-get: 0 */

import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import fetch from 'fetch';
import { assign } from '@ember/polyfills';
import { defer } from 'rsvp';
import { get, set } from '@ember/object';
import { later } from '@ember/runloop';
import { settled, waitUntil } from '@ember/test-helpers';
import { startMirage } from 'dummy/initializers/ember-cli-mirage';
import { typeOf } from '@ember/utils';

const assignFn = typeof Object.assign === 'function' ? Object.assign : assign;
let fetchSomeRecordsCalled = 0;

const objectToParams = function (obj) {
  if (typeOf(obj) !== 'object') {
    return '';
  }

  return Object.keys(obj)
    .sort()
    .map((key) => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`;
    })
    .join('&');
};

const fetchSomeRecords = function (range = {}, query = {}) {
  fetchSomeRecordsCalled = fetchSomeRecordsCalled + 1;

  query = assignFn(
    {
      limit: range.length,
      offset: range.start,
    },
    query
  );

  let params = objectToParams(query);
  let uri = `/api/words?${params}`;

  return fetch(uri)
    .then((response) => {
      return response.json();
    })
    .then((json = {}) => {
      let result = {
        data: json.data,
        total: get(json, 'meta.total'),
      };

      return result;
    });
};

module('Unit | Instance Initializer | ella sparse array', function (hooks) {
  setupTest(hooks);

  hooks.beforeEach(function () {
    fetchSomeRecordsCalled = 0;

    this.server = startMirage();
    this.server.timing = 10;
  });

  hooks.afterEach(function () {
    this.server.shutdown();
  });

  test('it uses a factory to create new instances', function (assert) {
    assert.expect(1);

    assert.ok(this.owner.factoryFor('ella-sparse:array').create());
  });

  test('it inits with ttl: 36000000 (10 hours)', function (assert) {
    assert.expect(1);

    const subject = this.owner.factoryFor('ella-sparse:array').create();

    assert.strictEqual(subject.ttl, 36000000);
  });

  test('it inits with limit: 10', function (assert) {
    assert.expect(1);

    const subject = this.owner.factoryFor('ella-sparse:array').create();

    assert.strictEqual(subject.limit, 10);
  });

  test('it inits with expired: 0', function (assert) {
    assert.expect(1);

    const subject = this.owner.factoryFor('ella-sparse:array').create();

    assert.strictEqual(subject.expired, 0);
  });

  test('it inits with enabled: true', function (assert) {
    assert.expect(1);

    const subject = this.owner.factoryFor('ella-sparse:array').create();

    assert.true(subject.enabled);
  });

  test('it inits with isLength: false', function (assert) {
    assert.expect(1);

    const subject = this.owner.factoryFor('ella-sparse:array').create();

    assert.false(subject.isLength);
  });

  test('it inits with loading: true', function (assert) {
    assert.expect(1);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    assert.true(subject.loading);
  });

  test('it automatically fetches the first "page" of results when computing "length"', async function (assert) {
    assert.expect(4);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    assert.true(subject.loading);

    await waitUntil(() => !subject.loading);

    assert.strictEqual(fetchSomeRecordsCalled, 1);
    assert.strictEqual(subject.length, 1001);
    assert.false(subject.loading);
  });

  test('.objectAt initially returns loading SparseItems', async function (assert) {
    assert.expect(2);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    const item = subject.objectAt(0);

    assert.true(item.is_loading);

    await waitUntil(() => !item.is_loading);

    assert.false(item.is_loading);
  });

  test('.objectAt initially returns stale SparseItems', function (assert) {
    assert.expect(2);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    const item = subject.objectAt(0);

    assert.true(item.isSparseItem);
    assert.true(item.__stale__);
  });

  test('.objectAt returns `undefined` if requested index out of range', function (assert) {
    assert.expect(2);

    let item;
    const l = 42;
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    subject.length = l;
    item = subject.objectAt(-1);
    assert.strictEqual(typeof item, 'undefined');

    item = subject.objectAt(l);
    assert.strictEqual(typeof item, 'undefined');
  });

  test('`firstObject` returns object at index 0', function (assert) {
    assert.expect(2);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });
    const item1 = subject.firstObject;
    const item2 = subject.objectAt(0);

    assert.true(item1.isSparseItem);
    assert.strictEqual(item1, item2);
  });

  test('`lastObject` returns object at index (length - 1)', function (assert) {
    assert.expect(3);

    const l = 67;
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    let item1;
    let item2;

    item1 = subject.lastObject;

    assert.strictEqual(typeof item1, 'undefined');

    subject.length = l;

    item1 = subject.lastObject;
    item2 = subject.objectAt(l - 1);

    assert.true(item1.isSparseItem);
    assert.strictEqual(item1, item2);
  });

  test('it updates length when resolved with numeric total', async function (assert) {
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {
          total: 622,
        };
      },
    });

    assert.strictEqual(subject.length, 505);

    subject.objectAt(120);

    await waitUntil(() => subject.length !== 505);

    assert.strictEqual(subject.length, 622);
  });

  test('it updates length when resolved with parseable total', async function (assert) {
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {
          total: '1003',
        };
      },
    });

    assert.strictEqual(subject.length, 505);

    subject.objectAt(120);

    await waitUntil(() => subject.length !== 505);

    assert.strictEqual(subject.length, 1003);
  });

  test('it keeps existing length when resolved without a total', async function (assert) {
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {};
      },
    });

    assert.strictEqual(subject.length, 505);

    subject.objectAt(120);

    await settled();

    assert.strictEqual(subject.length, 505);
  });

  test('it keeps existing length when resolved with a negative total', async function (assert) {
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {
          total: -22,
        };
      },
    });

    assert.strictEqual(subject.length, 505);

    subject.objectAt(120);

    await settled();

    assert.strictEqual(subject.length, 505);
  });

  test('it keeps existing length when resolved with a total of Infinity', async function (assert) {
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {
          total: 10 / 0,
        };
      },
    });

    assert.strictEqual(subject.length, 505);

    subject.objectAt(120);

    await settled();

    assert.strictEqual(subject.length, 505);
  });

  test('it keeps existing length when resolved with an invalid total', async function (assert) {
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {
          total: 'I am invalid',
        };
      },
    });

    assert.strictEqual(subject.length, 505);

    subject.objectAt(120);

    await settled();

    assert.strictEqual(subject.length, 505);
  });

  test('its item properties are updated once fetched', async function (assert) {
    assert.expect(2);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    const item1 = subject.objectAt(0);
    const item2 = subject.objectAt(723);

    await waitUntil(() => !(item1.is_loading || item2.is_loading));

    assert.strictEqual(get(item1, 'phrase'), 'brainy carnation');
    assert.strictEqual(get(item2, 'phrase'), 'obeisant bunghole');
  });

  test('.objectAt does not fetch data when sent a options.noFetch is truthy', async function (assert) {
    assert.expect(2);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    const item1 = subject.objectAt(22, { noFetch: true });
    const item2 = subject.objectAt(123, { noFetch: true });

    await settled();

    assert.notOk(item1.content);
    assert.notOk(item2.content);
  });

  test('.objectAt does not fetch data when enabled: false', async function (assert) {
    assert.expect(2);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
      enabled: false,
    });

    const item1 = subject.objectAt(22);
    const item2 = subject.objectAt(123);

    await settled();

    assert.notOk(item1.content);
    assert.notOk(item2.content);
  });

  test('.objectsAt assembles an array of SparseItems', async function (assert) {
    assert.expect(5);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    const items = subject.objectsAt([3, 5, 567, 456, 901]);

    await settled();

    assert.strictEqual(get(items[0], 'phrase'), 'smell blueberry');
    assert.strictEqual(get(items[1], 'phrase'), 'rot pickle');
    assert.strictEqual(get(items[2], 'phrase'), 'superficial anesthesiology');
    assert.strictEqual(get(items[3], 'phrase'), 'clip boxer');
    assert.strictEqual(get(items[4], 'phrase'), 'protect daisy');
  });

  test('it loads the first "page" (default 10) of SparseItems automatically', async function (assert) {
    assert.expect(4);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });
    const items = subject.objectsAt([0, 9]);

    await waitUntil(() => !items[0].is_loading);

    assert.strictEqual(fetchSomeRecordsCalled, 1);
    assert.strictEqual(get(items[0], 'phrase'), 'brainy carnation');
    assert.strictEqual(get(items[1], 'phrase'), 'outgoing graph');

    const item = subject.objectAt(19);

    await waitUntil(() => !item.is_loading);

    assert.strictEqual(
      fetchSomeRecordsCalled,
      2,
      'additional call to fetch page 2'
    );
  });

  test('its "page size" can be modified with the "limit" property', async function (assert) {
    assert.expect(5);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
      limit: 20,
    });
    const items = subject.objectsAt([0, 9]);

    await waitUntil(() => get(items[0], 'phrase') && get(items[1], 'phrase'));

    assert.strictEqual(fetchSomeRecordsCalled, 1);
    assert.strictEqual(get(items[0], 'phrase'), 'brainy carnation');
    assert.strictEqual(get(items[1], 'phrase'), 'outgoing graph');

    assert.strictEqual(
      get(subject.objectAt(19), 'phrase'),
      'precede average',
      'item 20 already fetched'
    );

    await settled();

    assert.strictEqual(
      fetchSomeRecordsCalled,
      1,
      'no additional call to fetch method'
    );
  });

  test('its items init with __stale__: true; __stale__ becomes false once content loads', async function (assert) {
    assert.expect(12);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    const items = subject.objectsAt([3, 5, 567, 456, 901, 7]);

    assert.true(items[0].__stale__);
    assert.true(items[1].__stale__);
    assert.true(items[2].__stale__);
    assert.true(items[3].__stale__);
    assert.true(items[4].__stale__);
    assert.true(items[5].__stale__);

    await waitUntil(() => {
      for (let i = 0; i < items.length; ++i) {
        if (items[i].is_loading) return false;
      }

      return true;
    });

    assert.false(items[0].__stale__);
    assert.false(items[1].__stale__);
    assert.false(items[2].__stale__);
    assert.false(items[3].__stale__);
    assert.false(items[4].__stale__);
    assert.false(items[5].__stale__);
  });

  test('.unset removes SparseItems and marks them stale', async function (assert) {
    assert.expect(26);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    const items = subject.objectsAt([3, 5, 567, 456, 901, 7]);

    await waitUntil(() => {
      for (let i = 0; i < items.length; ++i) {
        if (items[i].is_loading) return false;
      }

      return true;
    });

    assert.false(items[0].__stale__);
    assert.false(items[1].__stale__);
    assert.false(items[2].__stale__);
    assert.false(items[3].__stale__);
    assert.false(items[4].__stale__);
    assert.false(items[5].__stale__);

    assert.strictEqual(get(items[0], 'phrase'), 'smell blueberry');
    assert.strictEqual(get(items[1], 'phrase'), 'rot pickle');
    assert.strictEqual(get(items[2], 'phrase'), 'superficial anesthesiology');
    assert.strictEqual(get(items[3], 'phrase'), 'clip boxer');
    assert.strictEqual(get(items[4], 'phrase'), 'protect daisy');
    assert.strictEqual(get(items[5], 'phrase'), 'brush tablecloth');

    subject.unset(7);

    assert.strictEqual(get(items[4], 'phrase'), 'protect daisy');
    assert.strictEqual(get(items[5], 'phrase'), undefined);

    subject.unset(3, 4, 5);

    assert.strictEqual(get(items[0], 'phrase'), undefined);
    assert.strictEqual(get(items[1], 'phrase'), undefined);
    assert.strictEqual(get(items[2], 'phrase'), 'superficial anesthesiology');

    subject.unset([567], [456, [901, 6, 8]]);

    assert.strictEqual(get(items[2], 'phrase'), undefined);
    assert.strictEqual(get(items[3], 'phrase'), undefined);
    assert.strictEqual(get(items[4], 'phrase'), undefined);

    assert.true(items[0].__stale__);
    assert.true(items[1].__stale__);
    assert.true(items[2].__stale__);
    assert.true(items[3].__stale__);
    assert.true(items[4].__stale__);
    assert.true(items[5].__stale__);
  });

  test('SparseItem __ttl__ inherits SparseArray ttl', function (assert) {
    assert.expect(2);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
      ttl: 50,
    });
    const item = subject.objectAt(0);

    assert.strictEqual(item.__ttl__, subject.ttl);
    assert.strictEqual(item.__ttl__, 50);
  });

  test('SparseItem appears stale after ttl ms', function (assert) {
    assert.expect(2);

    const deferred = defer();
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });
    const item = subject.objectAt(0);

    later(function () {
      deferred.resolve();
    }, 100);

    return deferred.promise.then(function () {
      assert.false(item.__stale__);
      set(item, '__ttl__', 10);
      assert.true(item.__stale__);
    });
  });

  test('SparseItem .shouldFetchContent initially returns true', function (assert) {
    assert.expect(1);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });
    const item = subject.objectAt(37, { noFetch: true });

    assert.true(item.shouldFetchContent(subject.expired));
  });

  test('SparseItem .shouldFetchContent returns false while loading and after item is resolved', async function (assert) {
    assert.expect(4);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });
    const item = subject.objectAt(0);

    await waitUntil(() => get(item, 'fetchingContent.isRunning'));

    assert.true(get(item, 'fetchingContent.isRunning'));
    assert.false(item.shouldFetchContent(subject.expired));

    await settled();

    assert.false(get(item, 'fetchingContent.isRunning'));
    assert.false(item.shouldFetchContent(subject.expired));
  });

  test('it only requests each "page" once', async function (assert) {
    assert.expect(4);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    await waitUntil(() => subject.isLength);

    assert.strictEqual(
      fetchSomeRecordsCalled,
      1,
      'automatically fetch first page'
    );

    const items = subject.objectsAt([0, 1, 2, 3, 4]);
    const item = subject.objectAt(9);

    subject.objectsAt([5, 6, 7, 8]);

    await waitUntil(() => !(items[2].is_loading || item.is_loading));

    assert.strictEqual(get(items[2], 'phrase'), 'cheap milk');
    assert.strictEqual(get(item, 'phrase'), 'outgoing graph');
    assert.strictEqual(
      fetchSomeRecordsCalled,
      1,
      'used cached results from first page'
    );
  });

  test('Calling .expire makes all SparseItems stale and cancels all "fetchTasks"', async function (assert) {
    assert.expect(6);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });
    const item = subject.objectAt(1);

    await waitUntil(() => !item.is_loading);

    assert.false(get(item, 'fetchingContent.isRunning'));
    assert.false(item.shouldFetchContent(subject.expired));

    subject.objectAt(123);

    await waitUntil(() => get(subject, 'fetchTask.isRunning'));

    assert.true(get(subject, 'fetchTask.isRunning'));

    subject.expire();

    assert.false(get(subject, 'fetchTask.isRunning'));
    assert.false(get(item, 'fetchingContent.isRunning'));
    assert.true(item.shouldFetchContent(subject.expired));
  });

  test('Calling .expire causes SparseItems to be fetched again', async function (assert) {
    assert.expect(4);

    let items;
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    items = subject.objectsAt([0, 1, 2, 3, 4]);

    await waitUntil(() => !items[0].is_loading);

    assert.strictEqual(fetchSomeRecordsCalled, 1);

    const before0 = items[0].__lastFetch__;
    const before1 = items[1].__lastFetch__;

    subject.expire();

    await settled();

    items = subject.objectsAt([0, 1, 2, 3, 4]);

    await waitUntil(() => !items[0].is_loading);

    assert.strictEqual(fetchSomeRecordsCalled, 2);

    const after0 = items[0].__lastFetch__;
    const after1 = items[1].__lastFetch__;

    assert.ok(after0 > before0);
    assert.ok(after1 > before1);
  });

  test('.filterBy sets remoteQuery property', async function (assert) {
    assert.expect(2);

    const query = { q: 'charm' };
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    subject.filterBy(query);

    const item = subject.objectAt(0);

    await waitUntil(() => get(item, 'phrase'));

    assert.deepEqual(query, subject.remoteQuery);
    assert.strictEqual(get(item, 'phrase'), 'charming snowboarding');
  });

  test('.filterBy causes isLength to become false', function (assert) {
    assert.expect(5);

    const query = { q: 'charm' };
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    assert.false(subject.isLength);

    subject.length = 4;

    assert.true(subject.isLength);

    subject.filterBy(query);

    // isLength reverts to false if length is 0
    assert.false(subject.isLength);

    subject.length = 4;

    assert.true(subject.isLength);

    subject.filterBy({ q: 'charm' });

    // isLength stays true if new query matches existing query
    assert.true(subject.isLength);
  });

  test('Responses to previous filterBy objects are ignored', async function (assert) {
    assert.expect(1);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    subject.filterBy({ q: 'e' });
    subject.filterBy({ q: 'gr' });
    subject.filterBy({ q: 'mi' });
    subject.filterBy({ q: 'a' });
    subject.filterBy({ q: 'ou' });
    subject.filterBy({ q: 'charm' });

    await waitUntil(() => subject.isLength);

    assert.strictEqual(subject.length, 2);
  });

  test('.filterBy throws error when provided a non-object', function (assert) {
    assert.expect(3);

    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    assert.throws(
      function () {
        return subject.filterBy('query');
      },
      Error,
      'throws an error when provided a string'
    );

    assert.throws(
      function () {
        return subject.filterBy(12);
      },
      Error,
      'throws an error when provided a number'
    );

    assert.throws(
      function () {
        return subject.filterBy(null);
      },
      Error,
      'throws an error when provided null'
    );
  });

  test('.filter always throws an error', function (assert) {
    assert.expect(4);

    const query = { foo: 'bar', baz: 'hello, world' };
    const subject = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    assert.throws(
      function () {
        return subject.filter('query');
      },
      Error,
      'throws an error when provided a string'
    );

    assert.throws(
      function () {
        return subject.filter(12);
      },
      Error,
      'throws an error when provided a number'
    );

    assert.throws(
      function () {
        return subject.filter(query);
      },
      Error,
      'throws an error when provided an object'
    );

    assert.throws(
      function () {
        return subject.filter(function (item) {
          return item.id === 1;
        });
      },
      Error,
      'throws an error when provided a function'
    );
  });

  test('it throws error when "on-fetch" is not a function', function (assert) {
    assert.expect(3);

    assert.ok(this.owner.factoryFor('ella-sparse:array').create());

    assert.throws(
      function () {
        this.owner.factoryFor('ella-sparse:array').create({
          'on-fetch': 'not-a-function',
        });
      },
      Error,
      'throws an error when provided a string'
    );

    assert.throws(
      function () {
        this.owner.factoryFor('ella-sparse:array').create({
          'on-fetch': null,
        });
      },
      Error,
      'throws an error when provided null'
    );
  });
});

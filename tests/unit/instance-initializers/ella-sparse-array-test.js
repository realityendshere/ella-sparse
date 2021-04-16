/* eslint ember/named-functions-in-promises: 0 */

import Application from '@ember/application';
import { get, set } from '@ember/object';
import { run } from '@ember/runloop';
import { merge, assign } from '@ember/polyfills';
import { typeOf } from '@ember/utils';
import { defer } from 'rsvp';
import { initialize } from 'dummy/instance-initializers/ella-sparse-array';
import { module, test } from 'qunit';
import destroyApp from '../../helpers/destroy-app';
import { startMirage } from 'dummy/initializers/ember-cli-mirage';
import fetch from 'fetch';

import { settled } from '@ember/test-helpers';

const emberAssign = typeof assign === 'function' ? assign : merge;
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

  query = emberAssign(
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
  hooks.beforeEach(function () {
    fetchSomeRecordsCalled = 0;

    this.server = startMirage();
    this.server.timing = 10;

    run(() => {
      this.application = Application.create();
      this.appInstance = this.application.buildInstance();
      initialize(this.appInstance);
    });
  });

  hooks.afterEach(function () {
    this.server.shutdown();

    run(this.appInstance, 'destroy');
    destroyApp(this.application);
  });

  test('it uses a factory to create new instances', function (assert) {
    run(() => {
      assert.ok(this.appInstance.factoryFor('ella-sparse:array').create());
    });
  });

  test('it inits with ttl: 36000000 (10 hours)', function (assert) {
    assert.expect(1);

    run(() => {
      let arr = this.appInstance.factoryFor('ella-sparse:array').create();

      assert.equal(arr.ttl, 36000000);
    });
  });

  test('it inits with limit: 10', function (assert) {
    assert.expect(1);

    run(() => {
      let arr = this.appInstance.factoryFor('ella-sparse:array').create();

      assert.equal(arr.limit, 10);
    });
  });

  test('it inits with expired: 0', function (assert) {
    assert.expect(1);

    run(() => {
      let arr = this.appInstance.factoryFor('ella-sparse:array').create();

      assert.equal(arr.expired, 0);
    });
  });

  test('it inits with enabled: true', function(assert) {
    assert.expect(1);

    run(() => {
      let arr = this.appInstance.factoryFor('ella-sparse:array').create();

      assert.equal(arr.enabled, true);
    });
  });

  test('it inits with isLength: false', function (assert) {
    assert.expect(1);

    run(() => {
      let arr = this.appInstance.factoryFor('ella-sparse:array').create();

      assert.equal(arr.isLength, false);
    });
  });

  test('it inits with loading: true', function (assert) {
    assert.expect(1);

    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    assert.equal(arr.loading, true);
  });

  test('it automatically fetches the first "page" of results when computing "length"', function (assert) {
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      arr.length;
      arr.length;
      arr.length;
      assert.equal(arr.loading, true);
    });

    assert.equal(fetchSomeRecordsCalled, 1);

    return settled().then(() => {
      assert.equal(arr.length, 1001);
      assert.equal(arr.loading, false);
    });
  });

  test('.objectAt initially returns loading SparseItems', function (assert) {
    assert.expect(2);

    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    let item = arr.objectAt(0);

    assert.equal(item.is_loading, true);

    return settled().then(() => {
      assert.equal(item.is_loading, false);
    });
  });

  test('.objectAt initially returns stale SparseItems', function (assert) {
    assert.expect(2);

    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    let item = arr.objectAt(0);

    assert.equal(item.isSparseItem, true);
    assert.equal(item.__stale__, true);
  });

  test('.objectAt returns `undefined` if requested index out of range', function (assert) {
    assert.expect(2);

    let l = 42;
    let item;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      set(arr, 'length', l);
    });

    item = arr.objectAt(-1);
    assert.ok('undefined' === typeof item);

    item = arr.objectAt(l);
    assert.ok('undefined' === typeof item);
  });

  test('`firstObject` returns object at index 0', function (assert) {
    assert.expect(2);

    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });
    let item1 = arr.firstObject;
    let item2 = arr.objectAt(0);

    assert.equal(item1.isSparseItem, true);
    assert.equal(item1, item2);
  });

  test('`lastObject` returns object at index (length - 1)', function (assert) {
    assert.expect(3);

    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });
    let l = 67;
    let item1 = arr.lastObject;

    assert.ok('undefined' === typeof item1);

    run(() => {
      set(arr, 'length', l);
    });

    item1 = arr.lastObject;
    let item2 = arr.objectAt(l - 1);

    assert.equal(item1.isSparseItem, true);
    assert.equal(item1, item2);
  });

  test('it updates length when resolved with numeric total', function (assert) {
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {
          total: 622,
        };
      },
    });

    assert.equal(arr.length, 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(arr.length, 622);
  });

  test('it updates length when resolved with parseable total', function (assert) {
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {
          total: '1003',
        };
      },
    });

    assert.equal(arr.length, 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(arr.length, 1003);
  });

  test('it keeps existing length when resolved without a total', function (assert) {
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {};
      },
    });

    assert.equal(arr.length, 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(arr.length, 505);
  });

  test('it keeps existing length when resolved with a negative total', function (assert) {
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {
          total: -22,
        };
      },
    });

    assert.equal(arr.length, 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(arr.length, 505);
  });

  test('it keeps existing length when resolved with a total of Infinity', function (assert) {
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {
          total: 10 / 0,
        };
      },
    });

    assert.equal(arr.length, 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(arr.length, 505);
  });

  test('it keeps existing length when resolved with an invalid total', function (assert) {
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function () {
        return {
          total: 'I am invalid',
        };
      },
    });

    assert.equal(arr.length, 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(arr.length, 505);
  });

  test('its item properties are updated once fetched', function (assert) {
    assert.expect(2);

    let item1;
    let item2;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      arr.length;
      item1 = arr.objectAt(0);
      item2 = arr.objectAt(723);
    });

    return settled().then(() => {
      assert.equal(get(item1, 'phrase'), 'brainy carnation');
      assert.equal(get(item2, 'phrase'), 'obeisant bunghole');
    });
  });

  test('.objectAt does not fetch data when sent a options.noFetch is truthy', function (assert) {
    assert.expect(2);

    let item1;
    let item2;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      arr.length;
      item1 = arr.objectAt(22, { noFetch: true });
      item2 = arr.objectAt(123, { noFetch: true });
    });

    return settled().then(() => {
      assert.ok(!item1.content);
      assert.ok(!item2.content);
    });
  });

  test('.objectAt does not fetch data when enabled: false', function (assert) {
    assert.expect(2);

    let item1;
    let item2;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
      enabled: false,
    });

    run(() => {
      arr.length;
      item1 = arr.objectAt(22);
      item2 = arr.objectAt(123);
    });

    return settled().then(() => {
      assert.ok(!item1.content);
      assert.ok(!item2.content);
    });
  });

  test('.objectsAt assembles an array of SparseItems', function (assert) {
    assert.expect(5);

    let items;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      arr.length;
      items = arr.objectsAt([3, 5, 567, 456, 901]);
    });

    return settled().then(() => {
      assert.equal(items[0].get('phrase'), 'smell blueberry');
      assert.equal(items[1].get('phrase'), 'rot pickle');
      assert.equal(items[2].get('phrase'), 'superficial anesthesiology');
      assert.equal(items[3].get('phrase'), 'clip boxer');
      assert.equal(items[4].get('phrase'), 'protect daisy');
    });
  });

  test('it loads the first "page" (default 10) of SparseItems automatically', function (assert) {
    assert.expect(4);

    let items;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      items = arr.objectsAt([0, 9]);
    });

    assert.equal(fetchSomeRecordsCalled, 1);

    return settled().then(() => {
      assert.equal(items[0].get('phrase'), 'brainy carnation');
      assert.equal(items[1].get('phrase'), 'outgoing graph');

      run(() => {
        arr.objectAt(19);
      });

      assert.equal(
        fetchSomeRecordsCalled,
        2,
        'additional call to fetch page 2'
      );
    });
  });

  test('its "page size" can be modified with the "limit" property', function (assert) {
    assert.expect(5);

    let items;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
      limit: 20,
    });

    run(() => {
      items = arr.objectsAt([0, 9]);
    });

    assert.equal(fetchSomeRecordsCalled, 1);

    return settled().then(() => {
      assert.equal(items[0].get('phrase'), 'brainy carnation');
      assert.equal(items[1].get('phrase'), 'outgoing graph');

      run(() => {
        assert.equal(
          arr.objectAt(19).get('phrase'),
          'precede average',
          'item 20 already fetched'
        );
      });

      assert.equal(
        fetchSomeRecordsCalled,
        1,
        'no additional call to fetch method'
      );
    });
  });

  test('its items init with __stale__: true; __stale__ becomes false once content loads', function (assert) {
    let items;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      arr.length;
      items = arr.objectsAt([3, 5, 567, 456, 901, 7]);
    });

    assert.equal(items[0].__stale__, true);
    assert.equal(items[1].__stale__, true);
    assert.equal(items[2].__stale__, true);
    assert.equal(items[3].__stale__, true);
    assert.equal(items[4].__stale__, true);
    assert.equal(items[5].__stale__, true);

    return settled().then(() => {
      assert.equal(items[0].__stale__, false);
      assert.equal(items[1].__stale__, false);
      assert.equal(items[2].__stale__, false);
      assert.equal(items[3].__stale__, false);
      assert.equal(items[4].__stale__, false);
      assert.equal(items[5].__stale__, false);
    });
  });

  test('.unset removes SparseItems and marks them stale', function (assert) {
    assert.expect(26);

    let items;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      arr.length;
      items = arr.objectsAt([3, 5, 567, 456, 901, 7]);
    });

    return settled().then(() => {
      assert.equal(items[0].__stale__, false);
      assert.equal(items[1].__stale__, false);
      assert.equal(items[2].__stale__, false);
      assert.equal(items[3].__stale__, false);
      assert.equal(items[4].__stale__, false);
      assert.equal(items[5].__stale__, false);

      assert.equal(items[0].get('phrase'), 'smell blueberry');
      assert.equal(items[1].get('phrase'), 'rot pickle');
      assert.equal(items[2].get('phrase'), 'superficial anesthesiology');
      assert.equal(items[3].get('phrase'), 'clip boxer');
      assert.equal(items[4].get('phrase'), 'protect daisy');
      assert.equal(items[5].get('phrase'), 'brush tablecloth');

      arr.unset(7);

      assert.equal(items[4].get('phrase'), 'protect daisy');
      assert.equal(items[5].get('phrase'), undefined);

      arr.unset(3, 4, 5);

      assert.equal(items[0].get('phrase'), undefined);
      assert.equal(items[1].get('phrase'), undefined);
      assert.equal(items[2].get('phrase'), 'superficial anesthesiology');

      arr.unset([567], [456, [901, 6, 8]]);

      assert.equal(items[2].get('phrase'), undefined);
      assert.equal(items[3].get('phrase'), undefined);
      assert.equal(items[4].get('phrase'), undefined);

      assert.equal(items[0].__stale__, true);
      assert.equal(items[1].__stale__, true);
      assert.equal(items[2].__stale__, true);
      assert.equal(items[3].__stale__, true);
      assert.equal(items[4].__stale__, true);
      assert.equal(items[5].__stale__, true);
    });
  });

  test('SparseItem __ttl__ inherits SparseArray ttl', function (assert) {
    assert.expect(2);

    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
      ttl: 50,
    });
    let item = arr.objectAt(0);

    assert.equal(item.__ttl__, arr.ttl);
    assert.equal(item.__ttl__, 50);
  });

  test('SparseItem appears stale after ttl ms', function (assert) {
    assert.expect(2);

    let deferred = defer();
    let item;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(function () {
      arr.length;
      item = arr.objectAt(0);
    });

    run.later(function () {
      deferred.resolve();
    }, 50);

    return deferred.promise.then(function () {
      assert.equal(item.__stale__, false);
      set(item, '__ttl__', 10);
      assert.equal(item.__stale__, true);
    });
  });

  test('SparseItem .shouldFetchContent initially returns true', function (assert) {
    assert.expect(1);

    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });
    let item = arr.objectAt(37, { noFetch: true });

    assert.equal(item.shouldFetchContent(arr.expired), true);
  });

  test('SparseItem .shouldFetchContent returns false while loading and after item is resolved', function (assert) {
    assert.expect(4);

    let item;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      arr.length;
      item = arr.objectAt(0);
    });

    assert.equal(get(item, 'fetchingContent.isRunning'), true);
    assert.equal(item.shouldFetchContent(arr.expired), false);

    return settled().then(() => {
      assert.equal(get(item, 'fetchingContent.isRunning'), false);
      assert.equal(item.shouldFetchContent(arr.expired), false);
    });
  });

  test('it only requests each "page" once', function (assert) {
    assert.expect(4);

    let item;
    let items;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    assert.equal(fetchSomeRecordsCalled, 1, 'automatically fetch first page');

    run(() => {
      arr.length;
      items = arr.objectsAt([0, 1, 2, 3, 4]);
      arr.objectsAt([5, 6, 7, 8]);
      item = arr.objectAt(9);
    });

    return settled().then(() => {
      assert.equal(items[2].get('phrase'), 'cheap milk');
      assert.equal(item.get('phrase'), 'outgoing graph');
      assert.equal(
        fetchSomeRecordsCalled,
        1,
        'used cached results from first page'
      );
    });
  });

  test('Calling .expire makes all SparseItems stale and cancels all "fetchTasks"', function (assert) {
    assert.expect(6);

    let item;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      arr.length;
      item = arr.objectAt(1);
    });

    return settled().then(() => {
      assert.equal(get(item, 'fetchingContent.isRunning'), false);
      assert.equal(item.shouldFetchContent(arr.expired), false);

      run(() => {
        arr.objectAt(123);
      });

      assert.equal(get(arr, 'fetchTask.isRunning'), true);

      run(() => {
        arr.expire();
      });

      assert.equal(get(arr, 'fetchTask.isRunning'), false);
      assert.equal(get(item, 'fetchingContent.isRunning'), false);
      assert.equal(item.shouldFetchContent(arr.expired), true);
    });
  });

  test('Calling .expire causes SparseItems to be fetched again', function (assert) {
    assert.expect(4);

    let items;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      arr.length;
      items = arr.objectsAt([0, 1, 2, 3, 4]);
    });

    return settled().then(() => {
      assert.equal(fetchSomeRecordsCalled, 1);

      let before0 = items[0].__lastFetch__;
      let before1 = items[1].__lastFetch__;

      run(() => {
        arr.expire();
        items = arr.objectsAt([0, 1, 2, 3, 4]);
      });

      return settled().then(() => {
        assert.equal(fetchSomeRecordsCalled, 2);

        let after0 = items[0].__lastFetch__;
        let after1 = items[1].__lastFetch__;

        assert.ok(after0 > before0);
        assert.ok(after1 > before1);
      });
    });
  });

  test('.filterBy sets remoteQuery property', function (assert) {
    assert.expect(2);

    let item;
    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    var query = { q: 'charm' };

    run(() => {
      arr.filterBy(query);
      item = arr.objectAt(0);
    });

    assert.deepEqual(query, arr.remoteQuery);

    return settled().then(() => {
      assert.equal(item.get('phrase'), 'charming snowboarding');
    });
  });

  test('.filterBy causes isLength to become false', function (assert) {
    assert.expect(5);

    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    let query = { q: 'charm' };

    assert.equal(arr.isLength, false);

    set(arr, 'length', 4);

    assert.equal(arr.isLength, true);

    arr.filterBy(query);

    // isLength reverts to false if length is 0
    assert.equal(arr.isLength, false);

    set(arr, 'length', 4);

    assert.equal(arr.isLength, true);

    arr.filterBy({ q: 'charm' });

    // isLength stays true if new query matches existing query
    assert.equal(arr.isLength, true);
  });

  test('Responses to previous filterBy objects are ignored', function (assert) {
    assert.expect(1);

    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    run(() => {
      arr.length;
    });

    run(() => {
      arr.filterBy({ q: 'e' });
      arr.filterBy({ q: 'gr' });
      arr.filterBy({ q: 'mi' });
      arr.filterBy({ q: 'a' });
      arr.filterBy({ q: 'ou' });
      arr.filterBy({ q: 'charm' });
    });

    run(() => {
      arr.length;
    });

    return settled().then(() => {
      assert.equal(arr.length, 2);
    });
  });

  test('.filterBy throws error when provided a non-object', function (assert) {
    assert.expect(3);

    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    assert.throws(
      function () {
        return arr.filterBy('query');
      },
      Error,
      'throws an error when provided a string'
    );

    assert.throws(
      function () {
        return arr.filterBy(12);
      },
      Error,
      'throws an error when provided a number'
    );

    assert.throws(
      function () {
        return arr.filterBy(null);
      },
      Error,
      'throws an error when provided null'
    );
  });

  test('.filter always throws an error', function (assert) {
    assert.expect(4);

    let arr = this.appInstance.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
    });

    let query = { foo: 'bar', baz: 'hello, world' };

    assert.throws(
      function () {
        return arr.filter('query');
      },
      Error,
      'throws an error when provided a string'
    );

    assert.throws(
      function () {
        return arr.filter(12);
      },
      Error,
      'throws an error when provided a number'
    );

    assert.throws(
      function () {
        return arr.filter(query);
      },
      Error,
      'throws an error when provided an object'
    );

    assert.throws(
      function () {
        return arr.filter(function (item) {
          return item.id === 1;
        });
      },
      Error,
      'throws an error when provided a function'
    );
  });

  test('it throws error when "on-fetch" is not a function', function (assert) {
    assert.expect(3);

    run(() => {
      assert.ok(this.appInstance.factoryFor('ella-sparse:array').create());
    });

    assert.throws(
      function () {
        this.appInstance.factoryFor('ella-sparse:array').create({
          'on-fetch': 'not-a-function',
        });
      },
      Error,
      'throws an error when provided a string'
    );

    assert.throws(
      function () {
        this.appInstance.factoryFor('ella-sparse:array').create({
          'on-fetch': null,
        });
      },
      Error,
      'throws an error when provided null'
    );
  });
});

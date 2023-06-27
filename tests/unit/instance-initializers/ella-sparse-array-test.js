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
import { setupTest } from 'ember-qunit';
import { later } from '@ember/runloop';
import { settled } from '@ember/test-helpers';

const emberAssign = (typeof assign === 'function') ? assign : merge;
let fetchSomeRecordsCalled = 0;

const objectToParams = function(obj) {
  if (typeOf(obj) !== 'object') {
    return '';
  }

  return Object.keys(obj).sort().map((key) => {
    return `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`
  }).join('&');
}

const fetchSomeRecords = function(range = {}, query = {}) {
  fetchSomeRecordsCalled = fetchSomeRecordsCalled + 1;

  query = emberAssign({
    limit: get(range, 'length'),
    offset: get(range, 'start')
  }, query);

  let params = objectToParams(query);
  let uri = `/api/words?${params}`

  return fetch(uri).then((response) => {
    return response.json();
  }).then((json = {}) => {
    let result = {
      data: get(json, 'data'),
      total: get(json, 'meta.total')
    };

    return result;
  });
};

module('Unit | Instance Initializer | ella sparse array', function(hooks) {
  setupTest(hooks);

  hooks.beforeEach(function() {
    fetchSomeRecordsCalled = 0;

    this.server = startMirage();
    this.server.timing = 10;
  });

  hooks.afterEach(function() {
    this.server.shutdown();
  });

  test('it uses a factory to create new instances', function(assert) {
    run(() => {
      assert.ok(this.owner.factoryFor('ella-sparse:array').create());
    });
  });

  test('it inits with ttl: 36000000 (10 hours)', function(assert) {
    assert.expect(1);

    run(() => {
      let arr = this.owner.factoryFor('ella-sparse:array').create();

      assert.equal(get(arr, 'ttl'), 36000000);
    });
  });

  test('it inits with limit: 10', function(assert) {
    assert.expect(1);

    run(() => {
      let arr = this.owner.factoryFor('ella-sparse:array').create();

      assert.equal(get(arr, 'limit'), 10);
    });
  });

  test('it inits with expired: 0', function(assert) {
    assert.expect(1);

    run(() => {
      let arr = this.owner.factoryFor('ella-sparse:array').create();

      assert.equal(get(arr, 'expired'), 0);
    });
  });

  test('it inits with enabled: true', function(assert) {
    assert.expect(1);

    run(() => {
      let arr = this.owner.factoryFor('ella-sparse:array').create();

      assert.equal(get(arr, 'enabled'), true);
    });
  });

  test('it inits with isLength: false', function(assert) {
    assert.expect(1);

    run(() => {
      let arr = this.owner.factoryFor('ella-sparse:array').create();

      assert.equal(get(arr, 'isLength'), false);
    });
  });

  test('it inits with loading: true', function(assert) {
    assert.expect(1);

    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    assert.equal(get(arr, 'loading'), true);
  });

  test('it automatically fetches the first "page" of results when computing "length"', function(assert) {
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      get(arr, 'length');
      get(arr, 'length');
      get(arr, 'length');
      assert.equal(get(arr, 'loading'), true);
    });

    assert.equal(fetchSomeRecordsCalled, 1);

    return settled().then(() => {
      assert.equal(get(arr, 'length'), 1001);
      assert.equal(get(arr, 'loading'), false);
    });
  });

  test('.objectAt initially returns loading SparseItems', function(assert) {
    assert.expect(2);

    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    let item = arr.objectAt(0);

    assert.equal(get(item, 'is_loading'), true);

    return settled().then(() => {
      assert.equal(get(item, 'is_loading'), false);
    });
  });

  test('.objectAt initially returns stale SparseItems', function(assert) {
    assert.expect(2);

    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    let item = arr.objectAt(0);

    assert.equal(get(item, 'isSparseItem'), true);
    assert.equal(get(item, '__stale__'), true);
  });

  test('.objectAt returns `undefined` if requested index out of range', function(assert) {
    assert.expect(2);

    let l = 42;
    let item;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      set(arr, 'length', l);
    });

    item = arr.objectAt(-1);
    assert.ok('undefined' === typeof(item));

    item = arr.objectAt(l);
    assert.ok('undefined' === typeof(item));
  });

  test('`firstObject` returns object at index 0', function(assert) {
    assert.expect(2);

    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });
    let item1 = get(arr, 'firstObject');
    let item2 = arr.objectAt(0);

    assert.equal(get(item1, 'isSparseItem'), true);
    assert.equal(item1, item2);
  });

  test('`lastObject` returns object at index (length - 1)', function(assert) {
    assert.expect(3);

    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });
    let l = 67;
    let item1 = get(arr, 'lastObject');

    assert.ok('undefined' === typeof(item1));

    run(() => {
      set(arr, 'length', l);
    });

    item1 = get(arr, 'lastObject');
    let item2 = arr.objectAt(l - 1);

    assert.equal(get(item1, 'isSparseItem'), true);
    assert.equal(item1, item2);
  });

  test('it updates length when resolved with numeric total', function(assert) {
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function() {
        return {
          total: 622
        }
      }
    });

    assert.equal(get(arr, 'length'), 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(get(arr, 'length'), 622);
  });

  test('it updates length when resolved with parseable total', function(assert) {
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function() {
        return {
          total: '1003'
        }
      }
    });

    assert.equal(get(arr, 'length'), 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(get(arr, 'length'), 1003);
  });

  test('it keeps existing length when resolved without a total', function(assert) {
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function() {
        return {}
      }
    });

    assert.equal(get(arr, 'length'), 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(get(arr, 'length'), 505);
  });

  test('it keeps existing length when resolved with a negative total', function(assert) {
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function() {
        return {
          total: -22
        }
      }
    });

    assert.equal(get(arr, 'length'), 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(get(arr, 'length'), 505);
  });

  test('it keeps existing length when resolved with a total of Infinity', function(assert) {
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function() {
        return {
          total: 10/0
        }
      }
    });

    assert.equal(get(arr, 'length'), 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(get(arr, 'length'), 505);
  });

  test('it keeps existing length when resolved with an invalid total', function(assert) {
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      length: 505,
      'on-fetch': function() {
        return {
          total: 'I am invalid'
        }
      }
    });

    assert.equal(get(arr, 'length'), 505);

    run(() => {
      arr.objectAt(120);
    });

    assert.equal(get(arr, 'length'), 505);
  });

  test('its item properties are updated once fetched', function(assert) {
    assert.expect(2);

    let item1;
    let item2;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      get(arr, 'length');
      item1 = arr.objectAt(0);
      item2 = arr.objectAt(723);
    });

    return settled().then(() => {
      assert.equal(get(item1, 'phrase'), 'brainy carnation');
      assert.equal(get(item2, 'phrase'), 'obeisant bunghole');
    });
  });

  test('.objectAt does not fetch data when sent a options.noFetch is truthy', function(assert) {
    assert.expect(2);

    let item1;
    let item2;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      get(arr, 'length');
      item1 = arr.objectAt(22, { noFetch: true });
      item2 = arr.objectAt(123, { noFetch: true });
    });

    return settled().then(() => {
      assert.ok(!get(item1, 'content'));
      assert.ok(!get(item2, 'content'));
    });
  });

  test('.objectAt does not fetch data when enabled: false', function(assert) {
    assert.expect(2);

    let item1;
    let item2;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
      enabled: false
    });

    run(() => {
      get(arr, 'length');
      item1 = arr.objectAt(22);
      item2 = arr.objectAt(123);
    });

    return settled().then(() => {
      assert.ok(!get(item1, 'content'));
      assert.ok(!get(item2, 'content'));
    });
  });

  test('.objectsAt assembles an array of SparseItems', function(assert) {
    assert.expect(5);

    let items;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      get(arr, 'length');
      items = arr.objectsAt([3, 5, 567, 456, 901]);
    });

    return settled().then(() => {
      assert.equal(get(items[0], 'phrase'), 'smell blueberry');
      assert.equal(get(items[1], 'phrase'), 'rot pickle');
      assert.equal(get(items[2], 'phrase'), 'superficial anesthesiology');
      assert.equal(get(items[3], 'phrase'), 'clip boxer');
      assert.equal(get(items[4], 'phrase'), 'protect daisy');
    });
  });

  test('it loads the first "page" (default 10) of SparseItems automatically', function(assert) {
    assert.expect(4);

    let items;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      items = arr.objectsAt([0, 9]);
    });

    assert.equal(fetchSomeRecordsCalled, 1);

    return settled().then(() => {
      assert.equal(get(items[0], 'phrase'), 'brainy carnation');
      assert.equal(get(items[1], 'phrase'), 'outgoing graph');

      run(() => {
        arr.objectAt(19);
      });

      assert.equal(fetchSomeRecordsCalled, 2, 'additional call to fetch page 2');
    });
  });

  test('its "page size" can be modified with the "limit" property', function(assert) {
    assert.expect(5);

    let items;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
      limit: 20
    });

    run(() => {
      items = arr.objectsAt([0, 9]);
    });

    assert.equal(fetchSomeRecordsCalled, 1);

    return settled().then(() => {
      assert.equal(get(items[0], 'phrase'), 'brainy carnation');
      assert.equal(get(items[1], 'phrase'), 'outgoing graph');

      run(() => {
        assert.equal(get(arr.objectAt(19), 'phrase'), 'precede average', 'item 20 already fetched');
      });

      assert.equal(fetchSomeRecordsCalled, 1, 'no additional call to fetch method');
    });
  });

  test('its items init with __stale__: true; __stale__ becomes false once content loads', function(assert) {
    let items;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      get(arr, 'length');
      items = arr.objectsAt([3, 5, 567, 456, 901, 7]);
    });

    assert.equal(get(items[0], '__stale__'), true);
    assert.equal(get(items[1], '__stale__'), true);
    assert.equal(get(items[2], '__stale__'), true);
    assert.equal(get(items[3], '__stale__'), true);
    assert.equal(get(items[4], '__stale__'), true);
    assert.equal(get(items[5], '__stale__'), true);

    return settled().then(() => {
      assert.equal(get(items[0], '__stale__'), false);
      assert.equal(get(items[1], '__stale__'), false);
      assert.equal(get(items[2], '__stale__'), false);
      assert.equal(get(items[3], '__stale__'), false);
      assert.equal(get(items[4], '__stale__'), false);
      assert.equal(get(items[5], '__stale__'), false);
    });
  })

  test('.unset removes SparseItems and marks them stale', function(assert) {
    assert.expect(26);

    let items;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      get(arr, 'length');
      items = arr.objectsAt([3, 5, 567, 456, 901, 7]);
    });

    return settled().then(() => {
      assert.equal(get(items[0], '__stale__'), false);
      assert.equal(get(items[1], '__stale__'), false);
      assert.equal(get(items[2], '__stale__'), false);
      assert.equal(get(items[3], '__stale__'), false);
      assert.equal(get(items[4], '__stale__'), false);
      assert.equal(get(items[5], '__stale__'), false);

      assert.equal(get(items[0], 'phrase'), 'smell blueberry');
      assert.equal(get(items[1], 'phrase'), 'rot pickle');
      assert.equal(get(items[2], 'phrase'), 'superficial anesthesiology');
      assert.equal(get(items[3], 'phrase'), 'clip boxer');
      assert.equal(get(items[4], 'phrase'), 'protect daisy');
      assert.equal(get(items[5], 'phrase'), 'brush tablecloth');

      arr.unset(7);

      assert.equal(get(items[4], 'phrase'), 'protect daisy');
      assert.equal(get(items[5], 'phrase'), undefined);

      arr.unset(3, 4, 5);

      assert.equal(get(items[0], 'phrase'), undefined);
      assert.equal(get(items[1], 'phrase'), undefined);
      assert.equal(get(items[2], 'phrase'), 'superficial anesthesiology');

      arr.unset([567], [456, [901, 6, 8]]);

      assert.equal(get(items[2], 'phrase'), undefined);
      assert.equal(get(items[3], 'phrase'), undefined);
      assert.equal(get(items[4], 'phrase'), undefined);

      assert.equal(get(items[0], '__stale__'), true);
      assert.equal(get(items[1], '__stale__'), true);
      assert.equal(get(items[2], '__stale__'), true);
      assert.equal(get(items[3], '__stale__'), true);
      assert.equal(get(items[4], '__stale__'), true);
      assert.equal(get(items[5], '__stale__'), true);
    });
  });

  test('SparseItem __ttl__ inherits SparseArray ttl', function(assert) {
    assert.expect(2);

    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords,
      ttl: 50
    });
    let item = arr.objectAt(0);

    assert.equal(get(item, '__ttl__'), get(arr, 'ttl'));
    assert.equal(get(item, '__ttl__'), 50);
  });

  test('SparseItem appears stale after ttl ms', function(assert) {
    assert.expect(2);

    let deferred = defer();
    let item;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(function() {
      get(arr, 'length');
      item = arr.objectAt(0);
    });

    later(function() {
      deferred.resolve();
    }, 50);

    return deferred.promise.then(function() {
      assert.equal(get(item, '__stale__'), false);
      set(item, '__ttl__', 10);
      assert.equal(get(item, '__stale__'), true);
    });
  });

  test('SparseItem .shouldFetchContent initially returns true', function(assert) {
    assert.expect(1);

    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });
    let item = arr.objectAt(37, { noFetch: true });

    assert.equal(item.shouldFetchContent(get(arr, 'expired')), true);
  });

  test('SparseItem .shouldFetchContent returns false while loading and after item is resolved', function(assert) {
    assert.expect(4);

    let item;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      get(arr, 'length');
      item = arr.objectAt(0);
    });

    assert.equal(get(item, 'fetchingContent.isRunning'), true);
    assert.equal(item.shouldFetchContent(get(arr, 'expired')), false);

    return settled().then(() => {
      assert.equal(get(item, 'fetchingContent.isRunning'), false);
      assert.equal(item.shouldFetchContent(get(arr, 'expired')), false);
    });
  });

  test('it only requests each "page" once', function(assert) {
    assert.expect(4);

    let item;
    let items;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    assert.equal(fetchSomeRecordsCalled, 1, 'automatically fetch first page');

    run(() => {
      get(arr, 'length');
      items = arr.objectsAt([0, 1, 2, 3, 4]);
      arr.objectsAt([5, 6, 7, 8]);
      item = arr.objectAt(9);
    });

    return settled().then(() => {
      assert.equal(get(items[2], 'phrase'), 'cheap milk');
      assert.equal(get(item, 'phrase'), 'outgoing graph');
      assert.equal(fetchSomeRecordsCalled, 1, 'used cached results from first page');
    });
  });

  test('Calling .expire makes all SparseItems stale and cancels all "fetchTasks"', function(assert) {
    assert.expect(6);

    let item;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      get(arr, 'length');
      item = arr.objectAt(1);
    });

    return settled().then(() => {
      assert.equal(get(item, 'fetchingContent.isRunning'), false);
      assert.equal(item.shouldFetchContent(get(arr, 'expired')), false);

      run(() => {
        arr.objectAt(123);
      });

      assert.equal(get(arr, 'fetchTask.isRunning'), true);

      run(() => {
        arr.expire();
      });

      assert.equal(get(arr, 'fetchTask.isRunning'), false);
      assert.equal(get(item, 'fetchingContent.isRunning'), false);
      assert.equal(item.shouldFetchContent(get(arr, 'expired')), true);
    });
  });

  test('Calling .expire causes SparseItems to be fetched again', function(assert) {
    assert.expect(4);

    let items;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      get(arr, 'length');
      items = arr.objectsAt([0, 1, 2, 3, 4]);
    });

    return settled().then(() => {
      assert.equal(fetchSomeRecordsCalled, 1);

      let before0 = get(items[0], '__lastFetch__');
      let before1 = get(items[1], '__lastFetch__');

      run(() => {
        arr.expire();
        items = arr.objectsAt([0, 1, 2, 3, 4]);
      });

      return settled().then(() => {
        assert.equal(fetchSomeRecordsCalled, 2);

        let after0 = get(items[0], '__lastFetch__');
        let after1 = get(items[1], '__lastFetch__');

        assert.ok(after0 > before0);
        assert.ok(after1 > before1);
      });
    });
  });

  test('.filterBy sets remoteQuery property', function(assert) {
    assert.expect(2);

    let item;
    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    var query = { q: 'charm' };

    run(() => {
      arr.filterBy(query);
      item = arr.objectAt(0);
    });

    assert.deepEqual(query, get(arr, 'remoteQuery'));

    return settled().then(() => {
      assert.equal(get(item, 'phrase'), 'charming snowboarding');
    });
  });

  test('.filterBy causes isLength to become false', function(assert) {
    assert.expect(5);

    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    let query = { q: 'charm' };

    assert.equal(get(arr, 'isLength'), false);

    set(arr, 'length', 4);

    assert.equal(get(arr, 'isLength'), true);

    arr.filterBy(query);

    // isLength reverts to false if length is 0
    assert.equal(get(arr, 'isLength'), false);

    set(arr, 'length', 4);

    assert.equal(get(arr, 'isLength'), true);

    arr.filterBy({ q: 'charm' });

    // isLength stays true if new query matches existing query
    assert.equal(get(arr, 'isLength'), true);
  });

  test('Responses to previous filterBy objects are ignored', function(assert) {
    assert.expect(1);

    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    run(() => {
      get(arr, 'length');
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
      get(arr, 'length');
    });

    return settled().then(() => {
      assert.equal(get(arr, 'length'), 2);
    });
  });

  test('.filterBy throws error when provided a non-object', function(assert) {
    assert.expect(3);

    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    assert.throws(function() {
      return arr.filterBy('query');
    }, Error, 'throws an error when provided a string');

    assert.throws(function() {
      return arr.filterBy(12);
    }, Error, 'throws an error when provided a number');

    assert.throws(function() {
      return arr.filterBy(null);
    }, Error, 'throws an error when provided null');
  });

  test('.filter always throws an error', function(assert) {
    assert.expect(4);

    let arr = this.owner.factoryFor('ella-sparse:array').create({
      'on-fetch': fetchSomeRecords
    });

    let query = {foo: 'bar', baz: 'hello, world'};

    assert.throws(function() {
      return arr.filter('query');
    }, Error, 'throws an error when provided a string');

    assert.throws(function() {
      return arr.filter(12);
    }, Error, 'throws an error when provided a number');

    assert.throws(function() {
      return arr.filter(query);
    }, Error, 'throws an error when provided an object');

    assert.throws(function() {
      return arr.filter(function(item) { return (item.id === 1);});
    }, Error, 'throws an error when provided a function');
  });

  test('it throws error when "on-fetch" is not a function', function(assert) {
    assert.expect(3);

    run(() => {
      assert.ok(this.owner.factoryFor('ella-sparse:array').create());
    });

    assert.throws(function() {
      this.owner.factoryFor('ella-sparse:array').create({
        'on-fetch': 'not-a-function'
      });
    }, Error, 'throws an error when provided a string');

    assert.throws(function() {
      this.owner.factoryFor('ella-sparse:array').create({
        'on-fetch': null
      });
    }, Error, 'throws an error when provided null');
  });
});

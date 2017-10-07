/* eslint ember/named-functions-in-promises: 0 */

import { test, module } from 'ember-qunit';
import Ember from 'ember';
import wait from 'ember-test-helpers/wait';
import EllaSparse from 'ella-sparse/lib/ella-sparse';
import { startMirage } from 'dummy/initializers/ember-cli-mirage';
import fetch from 'fetch';

const { get, set, run, RSVP: { defer }, typeOf, merge } = Ember;

let actionTriggered = 0;
let fetchSomeRecordsCalled = 0;

const objectToParams = function(obj) {
  if (typeOf(obj) !== 'object') {
    return '';
  }

  return Object.keys(obj).sort().map((key) => {
    return `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`
  }).join('&');
}

const fetchTotalRecords = function(query = {}) {
  query = merge({
    limit: 1
  }, query);

  let params = objectToParams(query);
  let uri = `/api/words?${params}`;

  return fetch(uri).then((response) => {
    return response.json();
  }).then((json = {}) => {
    return get(json, 'meta.total');
  });
};

const fetchSomeRecords = function(range = {}, query = {}) {
  fetchSomeRecordsCalled = fetchSomeRecordsCalled + 1;

  query = merge({
    limit: get(range, 'length'),
    offset: get(range, 'start')
  }, query);

  let params = objectToParams(query);
  let uri = `/api/words?${params}`

  return fetch(uri).then((response) => {
    return response.json();
  }).then((json = {}) => {
    return get(json, 'data');
  });
};

let defaultActions = {
  fetchLength(query) {
    actionTriggered = actionTriggered + 1;
    return fetchTotalRecords(query);
  },

  fetchRecords(range, query, sparseArray) {
    actionTriggered = actionTriggered + 1;
    return fetchSomeRecords(range, query, sparseArray);
  }
};

module('ella-sparse:lib:ella-sparse', {
  unit: true,
  beforeEach() {
    actionTriggered = 0;
    fetchSomeRecordsCalled = 0;

    set(this, 'actions', defaultActions);

    this.server = startMirage();
    this.server.timing = 10;
  },
  afterEach() {
    this.server.shutdown();
  }
});

test('Sparse array exists', function(assert) {
  assert.expect(2);
  assert.ok(EllaSparse);

  let arr = EllaSparse.create();

  assert.ok(get(arr, 'isSparseArray'));
});

test('it inits with ttl: 36000000 (10 minutes)', function(assert) {
  assert.expect(1);

  let arr = EllaSparse.create();

  assert.equal(get(arr, 'ttl'), 36000000);
});

test('it inits with limit: 10', function(assert) {
  assert.expect(1);

  let arr = EllaSparse.create();

  assert.equal(get(arr, 'limit'), 10);
});

test('it inits with expired: 0', function(assert) {
  assert.expect(1);

  let arr = EllaSparse.create();

  assert.equal(get(arr, 'expired'), 0);
});

test('it inits with enabled: true', function(assert) {
  assert.expect(1);

  let arr = EllaSparse.create();

  assert.equal(get(arr, 'enabled'), true);
});

test('it inits with data: {}', function(assert) {
  assert.expect(1);

  let arr = EllaSparse.create();

  assert.deepEqual(get(arr, 'data'), {});
});

test('it inits with isLength: false', function(assert) {
  assert.expect(1);

  let arr = EllaSparse.create();

  assert.equal(get(arr, 'isLength'), false);
});

test('it inits with length: 0', function(assert) {
  assert.expect(1);

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength'
  });

  run(() => {
    assert.equal(get(arr, 'length'), 0);
  });
});

test('it inits with loading: false, becomes true after querying for "length"', function(assert) {
  assert.expect(2);

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength'
  });

  assert.equal(get(arr, 'loading'), false);

  run(() => {
    get(arr, 'length');
    assert.equal(get(arr, 'loading'), true);
  });
});

test('it calls the "on-length" action once when length is unknown', function(assert) {
  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength'
  });

  run(() => {
    get(arr, 'length');
    get(arr, 'length');
    get(arr, 'length');
    assert.equal(get(arr, 'loading'), true);
  });

  assert.equal(actionTriggered, 1);

  return wait().then(() => {
    assert.equal(get(arr, 'length'), 1001);
    assert.equal(get(arr, 'loading'), false);
  });
});

test('.objectAt initially returns stale SparseArrayItems', function(assert) {
  assert.expect(2);

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  let item = arr.objectAt(0);

  assert.equal(get(item, 'isSparseItem'), true);
  assert.equal(get(item, '__stale__'), true);
});

test('.objectAt returns `undefined` if requested index out of range', function(assert) {
  assert.expect(2);

  let l = 42;
  let item;

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
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

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  let item1 = get(arr, 'firstObject');
  let item2 = arr.objectAt(0);

  assert.equal(get(item1, 'isSparseItem'), true);
  assert.equal(item1, item2);
});

test('`lastObject` returns object at index (length - 1)', function(assert) {
  assert.expect(3);

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
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

test('its item properties are updated once fetched', function(assert) {
  assert.expect(2);

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  let item1;
  let item2;

  run(() => {
    get(arr, 'length');
    item1 = arr.objectAt(0);
    item2 = arr.objectAt(723);
  });

  return wait().then(() => {
    assert.equal(get(item1, 'phrase'), 'brainy carnation');
    assert.equal(get(item2, 'phrase'), 'obeisant bunghole');
  });
});

test('.objectAt does not fetch data when sent a options.noFetch is truthy', function(assert) {
  assert.expect(2);

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  let item1;
  let item2;

  run(() => {
    get(arr, 'length');
    item1 = arr.objectAt(0, { noFetch: true });
    item2 = arr.objectAt(723, { noFetch: true });
  });

  return wait().then(() => {
    assert.ok(!get(item1, 'content'));
    assert.ok(!get(item2, 'content'));
  });
});

test('.objectAt does not fetch data when enabled: false', function(assert) {
  assert.expect(2);

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords',
    enabled: false
  });

  let item1;
  let item2;

  run(() => {
    get(arr, 'length');
    item1 = arr.objectAt(0);
    item2 = arr.objectAt(723);
  });

  return wait().then(() => {
    assert.ok(!get(item1, 'content'));
    assert.ok(!get(item2, 'content'));
  });
});

test('.objectsAt assembles an array of SparseItems', function(assert) {
  assert.expect(5);

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  let items;

  run(() => {
    get(arr, 'length');
    items = arr.objectsAt([3, 5, 567, 456, 901]);
  });

  return wait().then(() => {
    assert.equal(get(items[0], 'phrase'), 'smell blueberry');
    assert.equal(get(items[1], 'phrase'), 'rot pickle');
    assert.equal(get(items[2], 'phrase'), 'superficial anesthesiology');
    assert.equal(get(items[3], 'phrase'), 'clip boxer');
    assert.equal(get(items[4], 'phrase'), 'protect daisy');
  });
});

test('its items init with __stale__: true; __stale__ becomes false once content loads', function(assert) {
  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  let items;

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

  return wait().then(() => {
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

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  let items;

  run(() => {
    get(arr, 'length');
    items = arr.objectsAt([3, 5, 567, 456, 901, 7]);
  });

  return wait().then(() => {
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

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords',
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

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  run(function() {
    get(arr, 'length');
    item = arr.objectAt(0);
  });

  run.later(function() {
    deferred.resolve();
  }, 50);

  return deferred.promise.then(function() {
    assert.equal(get(item, '__stale__'), false);
    set(item, '__ttl__', 10);
    assert.equal(get(item, '__stale__'), true);
  });
});

test('SparseItem .isContentExpired initially returns true', function(assert) {
  assert.expect(1);

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  let item = arr.objectAt(0, { noFetch: true });

  assert.equal(item.isContentExpired(get(arr, 'expired')), true);
});

test('SparseItem .isContentExpired returns false while loading and after item is resolved', function(assert) {
  assert.expect(4);

  let item;
  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  run(() => {
    get(arr, 'length');
    item = arr.objectAt(0);
  });

  assert.equal(get(item, 'fetchingContent.isRunning'), true);
  assert.equal(item.isContentExpired(get(arr, 'expired')), false);

  return wait().then(() => {
    assert.equal(get(item, 'fetchingContent.isRunning'), false);
    assert.equal(item.isContentExpired(get(arr, 'expired')), false);
  });
});

test('it only requests each "page" once', function(assert) {
  assert.expect(4);

  let item;
  let items;
  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  assert.equal(fetchSomeRecordsCalled, 0);

  run(() => {
    get(arr, 'length');
    items = arr.objectsAt([0, 1, 2, 3, 4]);
    arr.objectsAt([5, 6, 7, 8]);
    item = arr.objectAt(9);
  });

  return wait().then(() => {
    assert.equal(get(items[2], 'phrase'), 'cheap milk');
    assert.equal(get(item, 'phrase'), 'outgoing graph');
    assert.equal(fetchSomeRecordsCalled, 1);
  });
});

test('Calling .expire makes all SparseItems stale', function(assert) {
  assert.expect(4);

  let item;
  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  run(() => {
    get(arr, 'length');
    item = arr.objectAt(1);
  });

  return wait().then(() => {
    assert.equal(get(item, 'fetchingContent.isRunning'), false);
    assert.equal(item.isContentExpired(get(arr, 'expired')), false);

    run(() => {
      arr.expire();
    });

    assert.equal(get(item, 'fetchingContent.isRunning'), false);
    assert.equal(item.isContentExpired(get(arr, 'expired')), true);
  });
});

test('Calling .expire causes SparseItems to be fetched again', function(assert) {
  assert.expect(5);

  let items;
  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  assert.equal(fetchSomeRecordsCalled, 0);

  run(() => {
    get(arr, 'length');
    items = arr.objectsAt([0, 1, 2, 3, 4]);
  });

  return wait().then(() => {
    assert.equal(fetchSomeRecordsCalled, 1);

    let before0 = get(items[0], '__lastFetch__');
    let before1 = get(items[1], '__lastFetch__');

    run(() => {
      arr.expire();
      items = arr.objectsAt([0, 1, 2, 3, 4]);
    });

    return wait().then(() => {
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
  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
  });

  var query = { q: 'charm' };

  arr.filterBy(query);

  assert.deepEqual(query, get(arr, 'remoteQuery'));

  run(() => {
    arr.expire();
    item = arr.objectAt(0);
  });

  return wait().then(() => {
    assert.equal(get(item, 'phrase'), 'charming snowboarding');
  });
});

test('.filterBy causes isLength to become false', function(assert) {
  assert.expect(5);

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
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

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
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

  return wait().then(() => {
    assert.equal(get(arr, 'length'), 2);
  });
});

test('.filterBy throws error when provided a non-object', function(assert) {
  assert.expect(3);

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
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

  let arr = EllaSparse.create({
    target: this,
    'on-length': 'fetchLength',
    'on-fetch': 'fetchRecords'
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

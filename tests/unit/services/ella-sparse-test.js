/* eslint ember/named-functions-in-promises: 0 */

import { run } from '@ember/runloop';
import { get } from '@ember/object';
import { merge } from '@ember/polyfills';
import { typeOf } from '@ember/utils';
import { getOwner } from '@ember/application';

import { moduleFor, test } from 'ember-qunit';
import wait from 'ember-test-helpers/wait';
import { initialize } from 'dummy/instance-initializers/ella-sparse-array';
import { startMirage } from 'dummy/initializers/ember-cli-mirage';
import fetch from 'fetch';

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

  query = merge({
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

moduleFor('service:ella-sparse', 'Unit | Service | ella sparse', {
  beforeEach() {
    fetchSomeRecordsCalled = 0;

    this.server = startMirage();
    this.server.timing = 10;

    run(() => {
      this.service = this.subject();
      initialize(getOwner(this.service));
    });

  },

  afterEach() {
    this.server.shutdown();
  }
});

test('ella-sparse service exists', function(assert) {
  let service = this.subject();

  assert.ok(service);
  assert.ok(this.service);
});

test('.array returns an instance of EllaSparseArray', function(assert) {
  let arr = this.service.array(fetchSomeRecords);

  assert.ok(get(arr, 'isSparseArray'));
});

test('.array sets the "on-fetch" method of the returned EllaSparseArray', function(assert) {
  let item1;
  let item2;
  let arr = this.service.array(fetchSomeRecords);

  assert.expect(3);

  run(() => {
    get(arr, 'length');
    item1 = arr.objectAt(1);
    item2 = arr.objectAt(314);
  });

  assert.equal(fetchSomeRecordsCalled, 2);

  return wait().then(() => {
    assert.equal(get(item1, 'phrase'), 'ossified combine');
    assert.equal(get(item2, 'phrase'), 'peaceful cloister');
  });
});

test('.array sets "ttl" property on instance of EllaSparseArray', function(assert) {
  let arr = this.service.array(fetchSomeRecords, { ttl: 50 });

  assert.equal(get(arr, 'ttl'), 50);
});

test('.array sets "enabled" property on instance of EllaSparseArray', function(assert) {
  let arr = this.service.array(fetchSomeRecords, { enabled: false });

  assert.equal(get(arr, 'enabled'), false);
});

test('.array sets "length" property on instance of EllaSparseArray', function(assert) {
  let arr = this.service.array(fetchSomeRecords, { length: 1000 });

  assert.equal(get(arr, 'length'), 1000);
});

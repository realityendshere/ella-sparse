/* eslint ember/named-functions-in-promises: 0 */

import { run } from '@ember/runloop';
import { get } from '@ember/object';
import { assign } from '@ember/polyfills';
import { typeOf } from '@ember/utils';
import { getOwner } from '@ember/application';

import { module, test } from 'qunit';

import { setupTest } from 'ember-qunit';
import { settled } from '@ember/test-helpers';
import { initialize } from 'dummy/instance-initializers/ella-sparse-array';
import { setupMirage } from 'ember-cli-mirage/test-support';
import fetch from 'fetch';

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

module('Unit | Service | ella sparse', function (hooks) {
  setupTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    fetchSomeRecordsCalled = 0;

    this.server.timing = 10;

    run(() => {
      this.service = this.owner.lookup('service:ella-sparse');
      initialize(getOwner(this.service));
    });
  });

  hooks.afterEach(function () {
    this.server.shutdown();
  });

  test('ella-sparse service exists', function (assert) {
    let service = this.owner.lookup('service:ella-sparse');

    assert.ok(service);
    assert.ok(this.service);
  });

  test('.array returns an instance of EllaSparseArray', function (assert) {
    let arr = this.service.array(fetchSomeRecords);

    assert.ok(arr.isSparseArray);
  });

  test('.array sets the "on-fetch" method of the returned EllaSparseArray', function (assert) {
    let item1;
    let item2;
    let arr = this.service.array(fetchSomeRecords);

    assert.expect(3);

    run(() => {
      arr.length;
      item1 = arr.objectAt(1);
      item2 = arr.objectAt(314);
    });

    assert.equal(fetchSomeRecordsCalled, 2);

    return settled().then(() => {
      assert.equal(get(item1, 'phrase'), 'ossified combine');
      assert.equal(get(item2, 'phrase'), 'peaceful cloister');
    });
  });

  test('.array sets "ttl" property on instance of EllaSparseArray', function (assert) {
    let arr = this.service.array(fetchSomeRecords, { ttl: 50 });

    assert.equal(arr.ttl, 50);
  });

  test('.array sets "enabled" property on instance of EllaSparseArray', function (assert) {
    let arr = this.service.array(fetchSomeRecords, { enabled: false });

    assert.false(arr.enabled);
  });

  test('.array sets "length" property on instance of EllaSparseArray', function (assert) {
    let arr = this.service.array(fetchSomeRecords, { length: 1000 });

    assert.equal(arr.length, 1000);
  });
});

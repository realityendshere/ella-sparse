/* eslint ember/named-functions-in-promises: 0 */
/* eslint ember/no-get: 0 */

import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import fetch from 'fetch';
import { get } from '@ember/object';
import { getOwner } from '@ember/application';
import { initialize } from 'dummy/instance-initializers/ella-sparse-array';
import { run } from '@ember/runloop';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { typeOf } from '@ember/utils';
import { waitUntil } from '@ember/test-helpers';

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

  query = Object.assign(
    {
      limit: range.length,
      offset: range.start,
    },
    query
  );

  const params = objectToParams(query);
  const uri = `/api/words?${params}`;

  return fetch(uri)
    .then((response) => {
      return response.json();
    })
    .then((json = {}) => {
      const result = {
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
    assert.expect(2);

    const service = this.owner.lookup('service:ella-sparse');

    assert.ok(service);
    assert.ok(this.service);
  });

  test('.array returns an instance of EllaSparseArray', function (assert) {
    assert.expect(1);

    const arr = this.service.array(fetchSomeRecords);

    assert.ok(arr.isSparseArray);
  });

  test('.array sets the "on-fetch" method of the returned EllaSparseArray', async function (assert) {
    assert.expect(3);

    const arr = this.service.array(fetchSomeRecords);
    const item1 = arr.objectAt(1);
    const item2 = arr.objectAt(314);

    await waitUntil(() => !(item1.is_loading || item2.is_loading));

    assert.strictEqual(fetchSomeRecordsCalled, 2);
    assert.strictEqual(get(item1, 'phrase'), 'ossified combine');
    assert.strictEqual(get(item2, 'phrase'), 'peaceful cloister');
  });

  test('.array sets "ttl" property on instance of EllaSparseArray', function (assert) {
    assert.expect(1);

    const arr = this.service.array(fetchSomeRecords, { ttl: 50 });

    assert.strictEqual(arr.ttl, 50);
  });

  test('.array sets "enabled" property on instance of EllaSparseArray', function (assert) {
    assert.expect(1);

    const arr = this.service.array(fetchSomeRecords, { enabled: false });

    assert.false(arr.enabled);
  });

  test('.array sets "length" property on instance of EllaSparseArray', function (assert) {
    assert.expect(1);

    const arr = this.service.array(fetchSomeRecords, { length: 1000 });

    assert.strictEqual(arr.length, 1000);
  });
});

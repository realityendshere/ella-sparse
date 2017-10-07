import { test, module } from 'ember-qunit';
// import Ember from 'ember';
import SparseItem from 'ella-sparse/lib/ella-sparse-item';

module('ella-sparse:lib:ella-sparse-item', {
  unit: true,
  beforeEach: function() {}
});

test('Sparse item exists', function(assert) {
  assert.expect(1);
  assert.ok(SparseItem);
});

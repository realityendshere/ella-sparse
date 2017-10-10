import Ember from 'ember';

const { Route, inject, get, set, merge } = Ember;

export default Route.extend({
  ellaSparse: inject.service(),

  model() {
    let store = get(this, 'store');

    return get(this, 'ellaSparse').array((range = {}, query = {}) => {
      query = merge({
        limit: get(range, 'length'),
        offset: get(range, 'start')
      }, query);

      let handler = (result) => {
        return {
          data: result,
          total: get(result, 'meta.total')
        }
      };

      return store.query('word', query).then(handler);
    }, {
      ttl: 60000
    });
  },

  setupController(controller, model) {
    set(controller, 'words', model);
  }
});

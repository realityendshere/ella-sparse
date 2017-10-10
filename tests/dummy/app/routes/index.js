import Ember from 'ember';

const { Route, inject, get, merge } = Ember;

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
    });
  },

  setupController(controller, model) {
    controller.set('words', model);
  }
});

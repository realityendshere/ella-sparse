import Route from '@ember/routing/route';
import { get, set } from '@ember/object';
import { merge, assign } from '@ember/polyfills';
import { inject as service } from '@ember/service';

const emberAssign = typeof assign === 'function' ? assign : merge;

export default Route.extend({
  ellaSparse: service('ella-sparse'),

  model() {
    let store = this.store;

    return this.ellaSparse.array(
      (range = {}, query = {}) => {
        query = emberAssign(
          {
            limit: range.length,
            offset: range.start,
          },
          query
        );

        let handler = (result) => {
          return {
            data: result,
            total: get(result, 'meta.total'),
          };
        };

        return store.query('word', query).then(handler);
      },
      {
        ttl: 600000,
      }
    );
  },

  setupController(controller, model) {
    set(controller, 'words', model);
  },
});

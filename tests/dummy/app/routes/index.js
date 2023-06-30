import Route from '@ember/routing/route';
import { assign } from '@ember/polyfills';
import { inject as service } from '@ember/service';
import { set } from '@ember/object';

const assignFn = typeof Object.assign === 'function' ? Object.assign : assign;

class IndexRoute extends Route {
  ellaSparse = service('ella-sparse');

  model() {
    let store = this.store;

    return this.ellaSparse.array(
      (range = {}, query = {}) => {
        query = assignFn(
          {
            limit: range.length,
            offset: range.start,
          },
          query
        );

        let handler = (result) => {
          return {
            data: result,
            total: result?.meta?.total || 0,
          };
        };

        return store.query('word', query).then(handler);
      },
      {
        ttl: 600000,
      }
    );
  }

  setupController(controller, model) {
    set(controller, 'words', model);
  }
}

export default IndexRoute;

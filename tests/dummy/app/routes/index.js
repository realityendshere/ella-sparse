import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

class IndexRoute extends Route {
  @service ellaSparse;
  @service store;

  model() {
    const { store, ellaSparse } = this;

    return ellaSparse.array(
      async (range = {}, query = {}) => {
        query = Object.assign(
          {
            limit: range.length,
            offset: range.start,
          },
          query
        );

        const result = await store.query('word', query);

        return {
          data: result,
          total: result?.meta?.total || 0,
        };
      },
      {
        ttl: 600000,
      }
    );
  }
}

export default IndexRoute;

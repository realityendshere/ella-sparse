import { discoverEmberDataModels } from 'ember-cli-mirage';
import { createServer } from 'miragejs';

/**
 * Initializes Mirage
 */
export default function (config) {
  return createServer({
    ...config,
    models: { ...discoverEmberDataModels(), ...config.models },
    routes,
  });
}

function routes() {
  this.get('/api/words', function (schema, request) {
    let allWords = schema.words.all();
    let { offset, limit, q } = request.queryParams;

    offset = parseInt(offset, 10) || 0;
    limit = parseInt(limit, 10) || 20;

    if (q && `${q}`.trim() !== '') {
      let exp = new RegExp(`${q}`, 'g');

      allWords = allWords.filter((item) => {
        return item.phrase.match(exp);
      });
    }

    if (request.requestHeaders.accept === 'application/vnd.api+json') {
      let json = this.serialize(allWords.slice(offset, offset + limit));

      json.meta = { total: allWords.length };

      return json;
    }

    return {
      data: allWords.slice(offset, offset + limit).models,
      meta: {
        total: allWords.length,
      },
    };
  });
}

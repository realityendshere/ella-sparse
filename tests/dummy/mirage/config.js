import { createServer } from 'miragejs';

/**
 * Initializes Mirage
 */
export default function (config) {
  return createServer({ ...config, routes });
}

function routes() {
  this.get('/api/words', function (schema, request) {
    const { q } = request.queryParams;
    let { offset, limit } = request.queryParams;
    let allWords = schema.words.all();

    offset = parseInt(offset, 10) || 0;
    limit = parseInt(limit, 10) || 20;

    if (q && `${q}`.trim() !== '') {
      const exp = new RegExp(`${q}`, 'g');

      allWords = allWords.filter((item) => {
        return item.phrase.match(exp);
      });
    }

    if (request.requestHeaders.Accept === 'application/vnd.api+json') {
      const json = this.serialize(allWords.slice(offset, offset + limit));

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

export default function() {
  this.namespace = 'api';

  this.get('/words', ({ words }, request) => {
    let allWords = words.all();
    let { offset, limit, q } = request.queryParams;

    offset = parseInt(offset, 10) || 0;
    limit = parseInt(limit, 10) || 20;

    if (q && `${q}`.trim() !== '') {
      let exp = new RegExp(`${q}`, 'g');

      allWords = allWords.filter((item) => {
        return item.phrase.match(exp);
      });
    }

    return {
      data: allWords.slice(offset, offset + limit).models,
      meta: {
        total: allWords.length
      }
    };
  });

}

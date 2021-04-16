import { JSONAPISerializer } from 'ember-cli-mirage';

export default JSONAPISerializer.extend({
  serialize(object) {
    let json = JSONAPISerializer.prototype.serialize.apply(this, arguments);

    json.meta = object.meta;

    return json;
  },
});

import Ember from 'ember';

const { Service, merge, getOwner } = Ember;

export default Service.extend({
  array(fn, options = {}) {
    let owner = getOwner(this);
    let factory = owner.factoryFor('ella-sparse:array');

    return factory.create(merge({ 'on-fetch': fn }, options));
  }
});

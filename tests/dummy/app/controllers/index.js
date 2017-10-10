import Ember from 'ember';

const { Controller, set, computed: { alias } } = Ember;

export default Controller.extend({
  words: alias('model'),

  actions: {
    handleScrollStart() {
      set(this, 'model.enabled', false);
    },

    handleScrollEnd() {
      set(this, 'model.enabled', true);
    }
  }
});

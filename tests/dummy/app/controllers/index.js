import Controller from '@ember/controller';
import { set } from '@ember/object';
import { alias } from '@ember/object/computed';

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

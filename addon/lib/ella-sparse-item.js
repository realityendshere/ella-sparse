import Ember from 'ember';
import { task } from 'ember-concurrency';

const DEFAULT_TTL = 36000000;

const { ObjectProxy, computed, get, setProperties, RSVP: { Promise } } = Ember;

export default ObjectProxy.extend({
  reportError: null,
  resolveContent: null,

  isSparseItem: computed(function() {
    return true;
  }).readOnly(),

  __lastFetch__: 0,

  __ttl__: DEFAULT_TTL,

  __stale__: computed('__ttl__', '__lastFetch__', function() {
    return Boolean((get(this, '__lastFetch__') + get(this, '__ttl__')) <= Date.now());
  }).readOnly(),

  isContentExpired(timestamp = 0) {
    if (get(this, 'fetchingContent.isRunning')) {
      return false;
    }

    return Boolean(get(this, '__stale__') || get(this, '__lastFetch__') <= timestamp);
  },

  resetContent() {
    setProperties(this, {
      content: null,
      __lastFetch__: 0
    });

    return this;
  },

  __fetchContent() {
    return new Promise((resolve, reject) => {
      this.reportError = reject;
      this.resolveContent = resolve;
    });
  },

  fetchingContent: task(function* () {
    setProperties(this, { content: null });

    let content = yield this.__fetchContent();

    if (typeof content === 'undefined') {
      this.destroy();
    }

    setProperties(this, {
      content: content,
      __lastFetch__: Date.now()
    });
  }).drop()
});

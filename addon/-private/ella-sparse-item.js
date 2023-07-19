import ObjectProxy from '@ember/object/proxy';
import { guidFor } from '@ember/object/internals';
import { get, setProperties } from '@ember/object';
import { task } from 'ember-concurrency';
import { tracked } from '@glimmer/tracking';

const DEFAULT_TTL = 36000000;

/**
 * An individual item for an `EllaSparseArray`. Each item offers an
 * `is_loading` property to indicate when it is waiting for content to be
 * resolved.
 *
 * @class EllaSparseItem
 * @constructor
 * @extends {Ember.ObjectProxy}
 * @private
 */
class EllaSparseItem extends ObjectProxy {
  guid = guidFor(this);
  /**
   * A Javascript timestamp indicating the last time this item's content was
   * resolved. Used along with the `__ttl__` property to identify and refetch
   * stale content.
   *
   * @property __lastFetch__
   * @type {Number}
   * @default 0
   * @public
   */
  __lastFetch__ = 0;

  /**
   * The number of ms to wait until previously fetched content gets marked
   * as stale.
   *
   * @property __ttl__
   * @type {Number}
   * @default 36000000
   * @public
   */
  @tracked __ttl__ = DEFAULT_TTL;

  /**
   * Hook for rejecting the content retrieval promise. The `fetchingContent`
   * task places the content retrieval promise's `reject` handler here.
   *
   * @property reportError
   * @type {Null|Function}
   * @default null
   * @public
   */
  reportError = null;

  /**
   * Hook for resolving the content retrieval promise. The `fetchingContent`
   * task places the content retrieval promise's `resolve` handler here.
   *
   * @property resolveContent
   * @type {Null|Function}
   * @default null
   * @public
   */
  resolveContent = null;

  /**
   * Returns `true` when the `fetchingContent` task has never been performed
   * or is in the `isRunning` state. Otherwise, returns `false`.
   *
   * @property is_loading
   * @type {Boolean}
   * @default true
   * @public
   * @readOnly
   */
  get is_loading() {
    return Boolean(
      get(this, 'fetchingContent.isRunning') ||
        get(this, 'fetchingContent.performCount') === 0
    );
  }

  /**
   * This is a "quacks like a duck" property to help quickly identify instances
   * of this class.
   *
   * @property isSparseItem
   * @type {Boolean}
   * @default true
   * @public
   * @readOnly
   * @final
   */
  get isSparseItem() {
    return true;
  }

  /**
   * Indicates the content managed by this item should be refetched.
   *
   * @property __stale__
   * @type {Boolean}
   * @default true
   * @readOnly
   * @public
   */
  get __stale__() {
    return Boolean(this.__lastFetch__ + this.__ttl__ <= Date.now());
  }

  constructor(options) {
    super(...arguments);

    this.__ttl__ = options.__ttl__;

    return this;
  }

  /**
   * Determines if content managed by this object proxy is valid, stale,
   * or outdated. If the content appears to be present and valid, this method
   * returns `false` (no content should be fetched for this item). If the
   * content is already in the process of being retrieved, this method returns
   * `false`. If no content retrieval processes have been initiated for this
   * item or the content appears to be "stale," then this method returns `true`
   * to indicate that content (or updated content) should be acquired.
   *
   * @param  {Number} timestamp A Javascript timestamp
   * @return {Boolean} `true` if content is missing or stale, otherwise false
   * @public
   */
  shouldFetchContent(timestamp = 0) {
    if (get(this, 'fetchingContent.isRunning')) return false;

    return Boolean(this.__stale__ || this.__lastFetch__ <= timestamp);
  }

  /**
   * Remove the content managed by this item instance and ensure the item
   * becomes "stale."
   *
   * @chainable
   * @public
   */
  resetContent() {
    setProperties(this, {
      content: null,
      __lastFetch__: 0,
    });

    return this;
  }

  __fetchContent() {
    return new Promise((resolve, reject) => {
      this.reportError = reject;
      this.resolveContent = resolve;
    });
  }

  fetchContent() {
    return this.fetchingContent.perform();
  }

  fetchingContent = task({ drop: true }, async () => {
    setProperties(this, { content: null });

    const content = await this.__fetchContent();

    setProperties(this, {
      content: content,
      __lastFetch__: Date.now(),
    });
  });
}

export { EllaSparseItem, DEFAULT_TTL };

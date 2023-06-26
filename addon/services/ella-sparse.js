import Service from '@ember/service';
import { assign } from '@ember/polyfills';
import { getOwner } from '@ember/application';

const emberAssign = (typeof assign === 'function') ? assign : Object.assign;

/**
 * The `EllaSparseService` makes it easy to materialize new `EllaSparseArray`
 * instances from your routes and controllers.
 *
 * A simple example of usage:
 *
 * ```javascript
 * export default Ember.Route.extend({
 *   // Inject the `ella-sparse` service into the route
 *   ellaSparse: Ember.inject.service('ella-sparse'),
 *
 *   model() {
 *     let store = this.get('store');
 *
 *     return this.get('ellaSparse').array((range = {}, query = {}) => {
 *       // Combine the pagination and filter parameters into one object
 *       query = Ember.assign({
 *         limit: Ember.get(range, 'length'),
 *         offset: Ember.get(range, 'start')
 *       }, query);
 *
 *       // Return a Promise that resolves with the array of fetched data
 *       // and the total available records
 *       return store.query('word', query).then((result) => {
 *         return {
 *           data: result,
 *           total: Ember.get(result, 'meta.total')
 *         }
 *       });
 *     });
 *   }
 * });
 * ```
 *
 * @class EllaSparseService
 * @constructor
 * @extends {Ember.Service}
 * @public
 */

export default Service.extend({

  /**
   * Instantiates a new `EllaSparseArray`.
   *
   * The specified function parameter will be called upon to fetch data. When
   * called, this function will be provided a `range` and `query` argument.
   *
   * The `range` object contains three properties:
   *
   * + `length`: the number of items to fetch; the page size or limit
   * + `start`: the index of the first item to fetch; the offset
   * + `page`: the page number to retrieve
   *
   * The query object contains any additional filter parameters set on the
   * `EllaSparseArray` instance.
   *
   * The function should return a `Promise` that resolves with an object in the
   * following structure:
   *
   * ```javascript
   * return {
   *   data: [ //a "page" of results ],
   *   total: 1111 // The grand total number of available records
   * }
   * ```
   *
   * `data`:  contains an array of records to use in fulfilling the
   *          specified range
   *
   * `total`: indicates the number of records available overall (that match
   *          the current query parameters)
   *
   * @method array
   * @param {Function} fn A function to call to fetch data
   * @param {Object} options Properties to set on the sparse array instance
   * @return {EllaSparseArray} A new instance of `EllaSparseArray`
   * @public
   */
  array(fn, options = {}) {
    let owner = getOwner(this);
    let factory = owner.factoryFor('ella-sparse:array');

    return factory.create(emberAssign({ 'on-fetch': fn }, options));
  }
});

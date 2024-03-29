# Emberella Sparse

Welcome!

Emberella Sparse is an Ember CLI addon that provides a sparse array data
structure. Its aim is to provide a means for populating an array of data into
the client app in "pages" or "chunks" rather than all at once.

I once worked on an Ember project where a customer had created over 30,000
records. Long story short: to support various functionality in the app, all
30,000 records had to be fetched up front in the route's model hook. Needless to
say, the customer was pretty upset about waiting for 30,000 records to load from
the server each time they visited the app. Fetching all that data took at least
30 seconds. That's 30 seconds of staring at a loading indicator before getting
anything useful or interactive to work with. And loading 30,000 records didn't
do any favors for our server load.

This is the problem Emberella Sparse aims to tackle.

For starters, Emberella Sparse automatically fetches only the first "page" of
results. Ideally, whatever system feeds data into your Ember app can return the
first handful of records fairly quickly. Subsequent results are requested on an
as-needed basis. This eliminates the need for customers to wait for hundreds or
thousands of records to finish loading before the app becomes interactive.

The ultimate goal of Emberella Sparse is to:

* imitate as much typical array functionality as possible
* fetch data gradually or as the UI needs it
* maintain the illusion of a high-performance, fully functioning app for customers

While not all of Ember's enhanced array functionality is completely implemented
yet, the parts of Emberella Sparse that do work pair nicely with
[Emberella Treadmill](https://github.com/realityendshere/ella-treadmill).

## Compatibility

* Ember.js v4.4 or above
* Ember CLI v4.4 or above
* Node.js v16 or above

It passes all tests in the latest versions of Chrome, Firefox, and
Safari (macOS and iOS).

## Installation

As an Ember Addon, it's easy to get started with Emberella Sparse.

### Ember CLI

From the root directory of your Ember project

```
$ ember install ember-ella-sparse
```

## Quickstart

Here's one simple integration using Ember Data:

```javascript
export default Ember.Route.extend({
  // Inject the `ella-sparse` service into the route
  ellaSparse: Ember.inject.service('ella-sparse'),

  model() {
    let store = this.get('store');

    return this.get('ellaSparse').array((range = {}, query = {}) => {
      // Combine the pagination and filter parameters into one object
      // for Ember Data's .query() method
      query = Ember.assign({
        limit: get(range, 'length'),
        offset: get(range, 'start')
      }, query);

      // Return a Promise that resolves with the array of fetched data
      // and the total available records
      return store.query('word', query).then((result) => {
        return {
          data: result,
          total: get(result, 'meta.total')
        }
      });
    });
  }
});
```

New Emberella Sparse Array instances can be generated by the `'ella-sparse'`
service. Simply `inject` the `'ella-sparse'` service into another object like a
`route`.

```javascript
Ember.Route.extend({
  ellaSparse: Ember.inject.service('ella-sparse'),

  // MORE TO COME...
});
```

Then, create new Emberella Sparse Array instances by calling the `.array()` method
on the service. For example, you can return a sparse array from a route's
`model()` hook.

```javascript
Ember.Route.extend({
  model() {
    let store = this.get('store');

    return this.get('ellaSparse').array((range = {}, query = {}) => {
      // A FUNCTION THAT FETCHES DATA WITH A PROMISE
    }, {
      // ADDITIONAL PARAMETERS (OPTIONAL)
    });
  }
});
```

The service's `.array()` method accepts two arguments: a function to call for
fetching data and (optionally) custom configuration for the Emberella Sparse
Array instance.

The data fetch function should itself expect two arguments, both plain objects:
`range` and `query`.

The `range` object provides data to build pagination queries for "paged" or
"offset/limit" APIs. It contains three properties:

* `length`: the number of items to fetch; the page size or limit
* `start`: the index of the first item to fetch; the offset
* `page`: the page number to retrieve

The `query` object contains additional filter parameters to pass along to the
data persistence system. For example: the `query` of `{ surname: 'Smith' }`
might get sent to an API as the query parameter `&surname=Smith`.

The function should return a `Promise` that ultimately resolves with an object
with the following structure:

```javascript
return {
  data: [ //a "page" of results ],
  total: 1111 // The grand total number of available records
}
```

* `data`: contains an array of records to use in fulfilling the specified range
* `total`: indicates the number of records available overall (that match the current `query` parameters)

To recap: at a minimum, you write a custom function that takes requests from an
Emberella Sparse Array and transforms them into a request to your data
persistence layer (e.g. an API). This allows Emberella Sparse to be data
framework agnostic. You can use plain XHR requests, jQuery's AJAX, Ember Data,
or another library to fetch and manage records. As long as you can provide a
collection of data and a grand total count of all available records to Emberella
Sparse Array, you should be in good shape.

### Options

Emberella Sparse Array can be configured to meet some variation of needs. Here are some configuration options you can pass in:

```javascript
Ember.Route.extend({
  model() {
    return this.get('ellaSparse').array((range = {}, query = {}) => {
      // A FUNCTION THAT FETCHES DATA WITH A PROMISE
    }, {
      // Some optional configuration for your Emberella Sparse Array
      enabled: true,

      limit: 25,

      ttl: 600000,

      length: 1001
    });
  }
});
```
#### enabled

If set to `false`, Emberella Sparse Array will not attempt to fetch any
additional content past the first page.

In the dummy app, an Emberella Treadmill sets Emberella Sparse Array's `enabled`
property to `false` while scrolling. This allows scrolling past a section of the
listings without triggering a data retrieval operation. Once scrolling stops,
`enabled` is set to `true` and items are fetched for the currently visible
portion of the list.

The default value is `true`.

#### limit

The number of items to fetch together from the data persistence layer. In most
cases, requesting one record at a time is far from ideal. Whenever an object is
requested from an Emberella Sparse Array, it will (if necessary) fetch a
neighboring group of records. The number of records fetched together can be
specified by the `limit` property.

Another way to think of the `limit` property is as a page size configuration.

The default value is `10`.

#### ttl

The general idea behind Emberella Sparse Array is that it is for displaying a
large number of records. Given a large number of records, the opportunity for
content to become stale or out of date is notable. The `ttl` (or time to live)
configuration allows you to specify how long to wait after successfully fetching
content before that content should be fetched again. This value should be
specified in milliseconds.

The default value is `36000000`. (That's 10 hours!)

#### length

If you know the total number of available records ahead of time, you can set it here. Otherwise, this should only be provided by your custom data fetching function.

## Contributing

If you use Ember CLI (and I hope you do), here are the standard instructions for
installing and modifying this addon for yourself or to pitch in with
enhancements or bugfixes.

### Installation

* `git clone http://github.com/realityendshere/ella-sparse.git` this repository
* `cd ella-sparse`
* `yarn install`

### Running

* `ember serve`
* Visit your app at [http://localhost:4200](http://localhost:4200).

### Running Tests

* `yarn test` (Runs `ember try:each` to test your addon against multiple Ember versions)
* `ember test`
* `ember test --server`

### Building

* `ember build`

For more information on using ember-cli, visit [https://ember-cli.com/](https://ember-cli.com/).

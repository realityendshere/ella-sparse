import Application from '../../app';
import config from '../../config/environment';
import { merge, assign } from '@ember/polyfills';
import { run } from '@ember/runloop';

const emberAssign = (typeof assign === 'function') ? assign : merge;

export default function startApp(attrs) {
  let attributes = emberAssign({}, config.APP);
  attributes = assign(attributes, attrs); // use defaults, but you can override;

  return run(() => {
    let application = Application.create(attributes);
    application.setupForTesting();
    application.injectTestHelpers();
    return application;
  });
}

import Controller from '@ember/controller';
import { set } from '@ember/object';
import { action } from '@ember/object';

export default class IndexController extends Controller {
  @action
  handleScrollStart() {
    set(this, 'model.enabled', false);
  }

  @action
  handleScrollEnd() {
    set(this, 'model.enabled', true);
  }
}

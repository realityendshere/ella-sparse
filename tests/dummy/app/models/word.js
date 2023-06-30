import Model, { attr } from '@ember-data/model';

export default class Word extends Model {
  @attr('string') phrase;
}

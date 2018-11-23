import Bottle from 'bottlejs';
import store from './Store';
import constants from './constants';
import util from './util';

export default () => {
  let bottle = new Bottle();
  store(bottle);
  constants(bottle);
  util(bottle);
  return bottle;
}

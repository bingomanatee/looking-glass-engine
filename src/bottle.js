import Bottle from 'bottlejs';
import constants from './constants';
import util from './util';
import storeFactory from './Store';
import changePromiseFactory from './ChangePromise';

export default () => {
  const bottle = new Bottle();
  [constants, changePromiseFactory, util, storeFactory].forEach(factory => factory(bottle));
  return bottle;
};

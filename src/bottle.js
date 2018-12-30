import Bottle from 'bottlejs';
import constants from './constants';
import util from './util';
import storeFactory from './Store';
import changePromiseFactory from './ChangePromise';
import storeMapFactory from './StoreMap';

export default () => {
  const bottle = new Bottle();
  [constants, changePromiseFactory, util, storeMapFactory, storeFactory].forEach(factory => factory(bottle));
  return bottle;
};

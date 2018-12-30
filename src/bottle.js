import Bottle from 'bottlejs';
import constants from './constants';
import util from './util';

import changePromiseFactory from './ChangePromise';

export default () => {
  const bottle = new Bottle();
  [constants, changePromiseFactory, util].forEach(factory => factory(bottle));
  return bottle;
};

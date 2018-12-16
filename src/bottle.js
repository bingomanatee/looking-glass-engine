import Bottle from 'bottlejs';
import store from './Store';
import engine from './Engine';
import constants from './constants';
import util from './util';

export default () => {
  const bottle = new Bottle();
  store(bottle);
  constants(bottle);
  util(bottle);
  engine(bottle);
  return bottle;
};

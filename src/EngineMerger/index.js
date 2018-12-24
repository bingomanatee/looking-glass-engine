import engineMerger from './EngineMerger';
import defaultReducers from './defaultReducers';

export default (bottle) => {
  defaultReducers(bottle);
  engineMerger(bottle);
};

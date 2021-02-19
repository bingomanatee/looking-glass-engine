import {EventFilter} from './Event';
import {
  A_DELETE,
  A_NEXT,
  A_SET,
  E_COMMIT,
  E_INITIAL,
  E_MAP_MERGE,
  E_PRECOMMIT,
  E_RESTRICT
} from './constants';

export const onInitialNext = new EventFilter({
  action: A_NEXT,
  stage: E_INITIAL,
});
export const onMergeNext = new EventFilter({
  action: A_NEXT,
  stage: E_MAP_MERGE,
});
export const onPrecommitSet = new EventFilter({
  action: A_SET,
  stage: E_PRECOMMIT,
});
export const onCommitSet = new EventFilter({
  action: A_SET,
  stage: E_COMMIT,
});
export const onRestrictKeyForSet = new EventFilter({
  action: A_SET,
  stage: E_RESTRICT,
});
export const onDeleteCommit = new EventFilter({
  action: A_DELETE,
  stage: E_COMMIT,
});

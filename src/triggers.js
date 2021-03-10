import {
  A_DELETE, A_NEXT, A_SET, E_COMMIT, E_INITIAL, E_MAP_MERGE, E_PRECOMMIT, E_RESTRICT,
} from './constants';
import matchEvent from './matchEvent';

export const onInitialNext = matchEvent({ action: A_NEXT, stage: E_INITIAL });
export const onMergeNext = matchEvent({ action: A_NEXT, stage: E_MAP_MERGE });
export const onPrecommitSet = matchEvent({ action: A_SET, stage: E_PRECOMMIT });
export const onCommitSet = matchEvent({ action: A_SET, stage: E_COMMIT });
export const onRestrictKeyForSet = matchEvent({ action: A_SET, stage: E_RESTRICT });
export const onDeleteCommit = matchEvent({ action: A_DELETE, stage: E_COMMIT });
export const onNextCommit = matchEvent({ action: A_NEXT, stage: E_COMMIT });
export const onPreCommitNext = matchEvent({ action: A_NEXT, stage: E_PRECOMMIT });

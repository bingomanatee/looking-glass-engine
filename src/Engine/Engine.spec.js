
import bottle from './../bottle';

describe('Engine', () => {
  let Engine;
  let STORE_STATUS_NEW;
  let STORE_STATUS_INITIALIZED;
  let STORE_STATUS_INITIALIZING;
  let STORE_STATE_UNSET_VALUE;

  beforeEach(() => {
    const b = bottle();
    Engine = b.container.Engine;
    STORE_STATUS_NEW = b.container.STORE_STATUS_NEW;
    STORE_STATE_UNSET_VALUE = b.container.STORE_STATE_UNSET_VALUE;
    STORE_STATUS_INITIALIZING = b.container.STORE_STATUS_INITIALIZING;
    STORE_STATUS_INITIALIZED = b.container.STORE_STATUS_INITIALIZED;
  });

  describe('allowing chaining of actions before init', () => {
    describe('before initialize', () => {
      it('stub', () => expect(1).toBe(1));
    });
  });
});

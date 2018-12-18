
import bottle from './../bottle';

describe('Change', () => {
  let Change;
  let ACTION_STATUS_NEW;
  let myChange;

  beforeEach(() => {
    const b = bottle();
    Change = b.container.Change;
    ACTION_STATUS_NEW = b.container.ACTION_STATUS_NEW;
  });

  describe('simple change', () => {
    beforeEach(() => {
      myChange = new Change({ change: 4 });
    });

    it('should have the set change', () => {
      expect(myChange.change).toEqual(4);
    });

    it('should have functions for done and fail', () => {
      expect(typeof myChange.done).toBe('function');
      expect(typeof myChange.fail).toBe('function');
    });
  });

  describe('actionStatus change', () => {
    beforeEach(() => {
      myChange = new Change({ change: 4, actionStatus: ACTION_STATUS_NEW });
    });

    it('should have the set change', () => {
      expect(myChange.change).toEqual(4);
    });

    it('should have the actionStatus', () => {
      expect(myChange.actionStatus).toEqual(ACTION_STATUS_NEW);
    });

    it('should have functions for done and fail', () => {
      expect(typeof myChange.done).toBe('function');
      expect(typeof myChange.fail).toBe('function');
    });
  });

  describe('.extend', () => {
    it('should perform done on extended done addin', async () => {
      let foo = '';
      myChange = new Change({ change: 3 });
      const eChange = myChange.extend({ done: () => foo = 'bar' });
      await eChange.done();
      expect(foo).toEqual('bar');
    });

    it('should perform the original method on extended done addin', async () => {
      let foo = '';
      let bar = 0;
      myChange = new Change({ change: 3, done: () => bar = 2 });
      const eChange = myChange.extend({ done: () => foo = 'bar' });
      await eChange.done();
      expect(foo).toEqual('bar');
      expect(bar).toEqual(2);
    });
  });

  describe('bad data fails', () => {
    it('should fail on a bad actionStatus', () => {
      expect.assertions(1);
      try {
        new Change({ change: 4, actionStatus: Symbol('I am a symbol') });
      } catch (err) {
        expect(err.message).toEqual('Error: actionStatus must be an action state');
      }
    });
  });
});

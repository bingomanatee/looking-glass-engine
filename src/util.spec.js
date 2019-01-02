import bottle from './bottle';

describe('util', () => {
  let p;

  beforeEach(() => {
    const b = bottle();
    p = b.container.p;
  });

  describe('p', () => {
    it('should execute an asynchronous function', async () => {
      let a = 0;
      const doLater = () => new Promise((res) => { setTimeout(() => { a = 2; res(); }, 100); });
      expect.assertions(2);
      const promise = p(doLater);
      expect(a).toEqual(0);
      await promise;
      expect(a).toEqual(2);
    });

    it('should pass arguments to an asynchronous function', async () => {
      let a = 0;
      const doLater = n => new Promise((res) => { setTimeout(() => { a = n; res(); }, 100); });
      expect.assertions(2);
      const promise = p(doLater, 4);
      expect(a).toEqual(0);
      await promise;
      expect(a).toEqual(4);
    });

    it('should execute a promise', async () => {
      let a = 0;
      const doLater = new Promise((res) => { setTimeout(() => { a = 2; res(); }, 100); });
      expect.assertions(2);
      const promise = p(doLater);
      expect(a).toEqual(0);
      await promise;
      expect(a).toEqual(2);
    });
  });
});

import bottle from './bottle';

describe('util', () => {
  let diffStream;

  beforeEach(() => {
    let b = bottle();
    diffStream = b.container.diffStream;
  });

  describe('diffStream', () => {
    let stream;
    let history = [];
    beforeEach(() => {
      history = [];
      stream = diffStream();
      stream.subscribe((...value) => history.push(value));
    });

    it('should start with no output', () => {
      expect(history).toEqual([]);
    });

    it('should express change', () => {
      stream.next(2);
      expect(history).toEqual([[2]])
    })

    it('should ignore identical values', () => {
      stream.next(2);
      stream.next(2);
      expect(history).toEqual([[2]])
    })

    it('should handle new data', () => {
      stream.next(2);
      stream.next(2);
      stream.next(3);
      stream.next(2);
      expect(history).toEqual([[2], [3], [2]])
    })
  });
});

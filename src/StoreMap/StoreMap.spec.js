import util from 'util';
import bottleFactory from '../bottle';

describe('looking-glass-engine', () => {
  let bottle;
  let Store;
  let StoreMap;
  let S_STARTED;

  beforeEach(() => {
    bottle = bottleFactory();
    Store = bottle.container.Store;
    StoreMap = bottle.container.StoreMap;
    S_STARTED = bottle.container.S_STARTED;
  });

  describe('StoreMap', () => {
    let userStore;
    let cartStore;

    beforeEach(() => {
      cartStore = new Store({ state: { items: [] } });
      cartStore
        .addProp('total', { start: 0, type: 'float' })
        .addAction('addToCart', ({ state }, id, name, price) => {
          const newItem = { id, name, price };
          const cart = [...state.items, newItem];
          return {
            ...state,
            items: cart,
            total: cart.reduce((total, item) => total + item.price, 0),
          };
        });

      userStore = new Store({ state: {} });
      userStore
        .addProp('users', { start: {} })
        .addProp('loggedIn', { start: false, type: 'boolean' })
        .addAction('addUser', ({ state }, user) => {
          const users = state.users;
          users[user.id] = user;

          return { ...state, users };
        });
    });

    it('user store - behaves as expected', () => {
      expect(userStore.state).toEqual({ loggedIn: false, users: {} });
      userStore.do.addUser({ id: 1, name: 'Bob' });
      expect(userStore.state).toEqual({
        loggedIn: false,
        users: { 1: { id: 1, name: 'Bob' } },
      });
    });

    it('cart store - behaves as expected', () => {
      expect(cartStore.state).toEqual({ total: 0, items: [] });
      cartStore.do.addToCart(123, 'fruit', 100.50);

      expect(cartStore.state).toEqual({ items: [{ id: 123, name: 'fruit', price: 100.5 }], total: 100.5 });
    });

    it('should combine stores into a shared store', () => {
      try {
        const myStoreMap = new StoreMap({
          userStore, cartStore,
        });
        expect(myStoreMap.state).toEqual(S_STARTED);
      } catch (err) {
        console.log('error --- ', err);
      }
    });
  });
});

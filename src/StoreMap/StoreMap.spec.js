import util from 'util';
import bottleFactory from '../bottle';

describe('looking-glass-engine', () => {
  let bottle;
  let Store;
  let StoreMap;
  let S_STARTED;
  let S_STARTING;
  let NOT_SET;

  beforeEach(() => {
    bottle = bottleFactory();
    Store = bottle.container.Store;
    StoreMap = bottle.container.StoreMap;
    S_STARTED = bottle.container.S_STARTED;
    S_STARTING = bottle.container.S_STARTING;
    NOT_SET = bottle.container.NOT_SET;
  });

  describe('StoreMap', () => {
    let userStore;
    let cartStore;

    beforeEach(() => {
      cartStore = new Store({ state: { items: [] } });
      cartStore
        .addProp('total', { start: 0, type: 'float' })
        .addAction('clearCart', ({ state }) => ({ ...state, items: [], total: 0 }))
        .addAction('addToCart', ({ state }, id, name, price, qty = 1) => {
          const newItem = {
            id, name, price, qty,
          };
          const cart = [...state.items, newItem];
          return {
            ...state,
            items: cart,
            total: cart.reduce((total, item) => total + (item.price * item.qty || 1), 0),
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

    describe('(constructor)', () => {
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

        expect(cartStore.state)
          .toEqual({
            items: [{
              id: 123, name: 'fruit', price: 100.5, qty: 1,
            }],
            total: 100.5,
          });
      });

      it('should combine stores into a shared store', () => {
        const myStoreMap = new StoreMap({
          userStore, cartStore,
        });
        myStoreMap.start();
        expect(myStoreMap.status).toEqual(S_STARTED);
      });

      describe('with stores that have delayed starter functions', () => {
        let productsStore;

        beforeEach(() => {
          productsStore = new Store({
            state: { products: [] },
            starter: () => new Promise((done) => {
              setTimeout(() => {
                done({
                  products: [
                    {
                      id: 100, name: 'watch', price: 500,
                    },
                    {
                      id: 200, name: 'calendar', price: 20,
                    },
                  ],
                });
              }, 100);
            }),
          });
        });

        it('should be in starting status with one async store', () => {
          const myStoreMap = new StoreMap({
            userStore, cartStore, productsStore,
          });
          myStoreMap.start();
          expect(myStoreMap.status).toEqual(S_STARTING);
          expect(myStoreMap.state).toEqual({
            users: {},
            loggedIn: false,
            items: [],
            total: 0,
            products: [],
            userStore: { users: {}, loggedIn: false },
            cartStore: { items: [], total: 0 },
            productsStore: { products: [] },
          });
        });

        it('should be in started after start complete', async () => {
          const myStoreMap = new StoreMap({
            userStore, cartStore, productsStore,
          });
          await myStoreMap.start();
          expect(myStoreMap.status).toEqual(S_STARTED);
          expect(myStoreMap.state).toEqual({
            cartStore: { items: [], total: 0 },
            items: [],
            loggedIn: false,
            products: [{ id: 100, name: 'watch', price: 500 }, {
              id: 200, name: 'calendar', price: 20,
            }],
            productsStore: {
              products: [{ id: 100, name: 'watch', price: 500 }, {
                id: 200, name: 'calendar', price: 20,
              }],
            },
            total: 0,
            userStore: { loggedIn: false, users: {} },
            users: {},
          });
        });
      });
    });

    describe('actions', () => {
      let myStoreMap;
      beforeEach(() => {
        myStoreMap = new StoreMap({
          userStore, cartStore,
        });
        myStoreMap.start();
      });

      it('should have expected actions', () => {
        expect(new Set(Array.from(Object.keys(myStoreMap.actions))))
          .toEqual(new Set(['setUsers', 'setLoggedIn', 'clearCart', 'addUser', 'setTotal', 'addToCart', 'userStore', 'cartStore']));
        expect(new Set(Array.from(Object.keys(myStoreMap.actions.userStore))))
          .toEqual(new Set(['setUsers', 'setLoggedIn', 'addUser']));
        expect(new Set(Array.from(Object.keys(myStoreMap.actions.cartStore))))
          .toEqual(new Set(['setTotal', 'clearCart', 'addToCart']));
      });

      it('should broadcast change from its components', () => {
        let stateFromStream = myStoreMap.state;

        myStoreMap.stream.subscribe((newState) => {
          stateFromStream = newState;
        });

        myStoreMap.do.addToCart(666, 'Slim Jims', 3.5, 4);

        expect(stateFromStream).toEqual({
          state: {
            cartStore: {
              items: [{
                id: 666, name: 'Slim Jims', price: 3.5, qty: 4,
              }],
              total: 14,
            },
            items: [{
              id: 666, name: 'Slim Jims', price: 3.5, qty: 4,
            }],
            loggedIn: false,
            total: 14,
            userStore: { loggedIn: false, users: {} },
            users: {},
          },
          status: S_STARTED,
        });
      });
    });

    describe('.addAction', () => {
      let myStoreMap;
      beforeEach(() => {
        myStoreMap = new StoreMap({
          userStore, cartStore,
        });
        myStoreMap.addAction('clearCartAndLogOut', ({ actions }) => {
          actions.setLoggedIn(false);
          actions.clearCart();
          return 1000;
        });
        myStoreMap.start();
      });

      it('should have expected actions', () => {
        expect(new Set(Array.from(Object.keys(myStoreMap.actions))))
          .toEqual(new Set(['setUsers', 'clearCart', 'clearCartAndLogOut', 'setLoggedIn', 'addUser', 'setTotal', 'addToCart', 'userStore', 'cartStore']));
        expect(new Set(Array.from(Object.keys(myStoreMap.actions.userStore))))
          .toEqual(new Set(['setUsers', 'setLoggedIn', 'addUser']));
        expect(new Set(Array.from(Object.keys(myStoreMap.actions.cartStore))))
          .toEqual(new Set(['setTotal', 'addToCart', 'clearCart']));
      });

      it('should broadcast change from its components', () => {
        let stateFromStream = myStoreMap.state;

        myStoreMap.stream.subscribe((newState) => {
          stateFromStream = newState;
        });
        myStoreMap.do.setLoggedIn(true);
        myStoreMap.do.addToCart(666, 'Slim Jims', 3.5, 4);

        expect(stateFromStream).toEqual({
          state: {
            cartStore: {
              items: [{
                id: 666, name: 'Slim Jims', price: 3.5, qty: 4,
              }],
              total: 14,
            },
            items: [{
              id: 666, name: 'Slim Jims', price: 3.5, qty: 4,
            }],
            loggedIn: true,
            total: 14,
            userStore: { loggedIn: true, users: {} },
            users: {},
          },
          status: S_STARTED,
        }); // validate that items and loggedIn have values to be overridden.

        myStoreMap.do.clearCartAndLogOut();

        expect(stateFromStream).toEqual({
          state: {
            cartStore: { items: [], total: 0 },
            items: [],
            loggedIn: false,
            total: 0,
            userStore: { loggedIn: false, users: {} },
            users: {},
          },
          status: S_STARTED,
        });
      });
    });
  });
});

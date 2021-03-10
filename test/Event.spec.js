/* eslint-disable camelcase */

const tap = require('tap');
const { BehaviorSubject } = require('rxjs');
const p = require('../package.json');

const { Event, ABSENT, matchEvent } = require('../lib/index');

tap.test(p.name, (suite) => {
  suite.test('Event', (event) => {
    event.test('constructor', (con) => {
      con.test('list', (list) => {
        const target = Symbol('target');

        const ev = new Event('doThing', new BehaviorSubject(3), 'alpha', target);

        list.same(ev.action, 'doThing', 'action is set');
        list.same(ev.value, 3, 'value is set');
        list.same(ev.stage, 'alpha', 'stage is set');
        // list.same(ev.target, target);

        list.end();
      });

      con.test('params', (params) => {
        const target = Symbol('target');

        const ev = new Event({
          action: 'doThing', valueStream: new BehaviorSubject(3), stage: 'alpha', target,
        });

        params.same(ev.action, 'doThing', 'action is set');
        params.same(ev.value, 3, 'value is set');
        params.same(ev.stage, 'alpha', 'stage is set');
        // params.same(ev.target, target);
        params.end();
      });

      con.end();
    });

    event.test('changing stage', (params) => {
      const target = Symbol('target');

      const ev = new Event({
        action: 'doThing', valueStream: new BehaviorSubject(3), stage: 'alpha', target,
      });

      ev.stage = 'beta';

      params.same(ev.action, 'doThing', 'action is set');
      params.same(ev.value, 3, 'value is set');
      params.same(ev.stage, 'beta', 'stage is updated');
      // params.same(ev.target, target);
      params.end();
    });

    event.test('error', (params) => {
      const target = Symbol('target');
      const ev = new Event({
        action: 'doThing', valueStream: new BehaviorSubject(3), stage: 'alpha', target,
      });

      ev.error(new Error('I failed'));
      params.same(ev.action, 'doThing', 'action is set');
      params.same(ev.stage, 'alpha', 'stage is updated');
      //  params.same(ev.target, target);
      params.same(ev.thrownError.message, 'I failed');

      params.end();
    });

    event.end();
  });

  suite.test('matchEvent', (me) => {
    me.test('with single tests', (mes) => {
      const t1 = matchEvent('alpha');
      console.log('test-----', t1);

      const e1 = { action: 'alpha', target: { debug: true } };
      const e2 = { action: 'beta', target: { debug: true } };

      mes.ok(t1(e1), 'param action - match with action');
      mes.notOk(t1(e2), 'param action - no match with different action');

      const to1 = matchEvent({ action: 'alpha' });
      console.log('to1:', [...to1.tests.values()].map((v) => v.toString()));
      mes.ok(to1(e1), 'obj action - match with action');
      mes.notOk(to1(e2), 'obj action - no match with different action');

      mes.end();
    });
    me.test('with functional tests', (mes) => {
      const t1 = matchEvent({
        value: (v) => v > 0,
      });

      const e1 = { value: 3 };
      const e2 = { value: -3 };

      mes.ok(t1(e1), 'functional value test - match with 3');
      mes.notOk(t1(e2), 'functional value test - no match with -3');

      mes.end();
    });

    me.end();
  });

  suite.end();
});

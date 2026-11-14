/* global afterEach beforeEach describe it setImmediate */
/* eslint-disable compat/compat */

import {Panel} from "../../../saltgui/static/scripts/panels/Panel.js";
import {assert} from "chai";

// no DOM in the unit tests, window is replaced by a stub;
// not enumerable, so that mocha --check-leaks does not report it
const defineGlobal = (pName, pValue) => {
  Object.defineProperty(globalThis, pName, {"configurable": true, "enumerable": false, "value": pValue, "writable": true});
};

describe("Unittests for panels/Panel.js", () => {

  describe("_getIpNumberPriority", () => {

    it("test with local loopback IPv4", () => {
      const result = Panel._getIpNumberPriority("127.0.0.1");
      assert.equal(result, 5);
    });

    it("test with local loopback IPv6", () => {
      const result = Panel._getIpNumberPriority("::1");
      assert.equal(result, 5);
    });

    it("test with private class A address", () => {
      const result = Panel._getIpNumberPriority("10.0.0.1");
      assert.equal(result, 4);
    });

    it("test with private class B address", () => {
      const result = Panel._getIpNumberPriority("172.16.0.1");
      assert.equal(result, 2);
    });

    it("test with private class C address", () => {
      const result = Panel._getIpNumberPriority("192.168.1.1");
      assert.equal(result, 3);
    });

    it("test with public address", () => {
      const result = Panel._getIpNumberPriority("8.8.8.8");
      assert.equal(result, 1);
    });

    it("test with link-local address", () => {
      const result = Panel._getIpNumberPriority("169.254.1.1");
      assert.equal(result, 1);
    });

    it("test with non-string input", () => {
      const result = Panel._getIpNumberPriority(null);
      assert.equal(result, 10);
    });

    it("test with number input", () => {
      const result = Panel._getIpNumberPriority(12345);
      assert.equal(result, 10);
    });

  });

  describe("_filterIpAddresses", () => {

    it("test with empty list and empty prefix", () => {
      const result = Panel._filterIpAddresses([], []);
      assert.deepEqual(result, []);
    });

    it("test with addresses and empty prefix", () => {
      const ips = ["10.0.0.1", "192.168.1.1", "8.8.8.8"];
      const result = Panel._filterIpAddresses(ips, []);
      assert.deepEqual(result, ["10.0.0.1", "192.168.1.1", "8.8.8.8"]);
    });

    it("test with single prefix match", () => {
      const ips = ["10.0.0.1", "192.168.1.1", "8.8.8.8"];
      const result = Panel._filterIpAddresses(ips, ["10."]);
      assert.deepEqual(result, ["10.0.0.1"]);
    });

    it("test with multiple prefix matches", () => {
      const ips = ["10.0.0.1", "192.168.1.1", "8.8.8.8"];
      const result = Panel._filterIpAddresses(ips, ["10.", "192."]);
      assert.deepEqual(result, ["10.0.0.1", "192.168.1.1"]);
    });

    it("test with no matching prefix", () => {
      const ips = ["10.0.0.1", "192.168.1.1", "8.8.8.8"];
      const result = Panel._filterIpAddresses(ips, ["172."]);
      assert.deepEqual(result, []);
    });

    it("test with IPv6 addresses", () => {
      const ips = ["::1", "fe80::1", "2001:db8::1"];
      const result = Panel._filterIpAddresses(ips, ["::1"]);
      assert.deepEqual(result, ["::1"]);
    });

    it("test with partial IPv6 prefix", () => {
      const ips = ["::1", "fe80::1", "2001:db8::1"];
      const result = Panel._filterIpAddresses(ips, ["fe80::"]);
      assert.deepEqual(result, ["fe80::1"]);
    });

  });

  describe("_makeCommandString", () => {

    it("test with empty array", () => {
      const result = Panel._makeCommandString([]);
      assert.equal(result, "");
    });

    it("test with single string command", () => {
      const result = Panel._makeCommandString(["cmd.run"]);
      assert.equal(result, "cmd.run");
    });

    it("test with multiple commands", () => {
      const result = Panel._makeCommandString(["cmd.run", "echo", "hello"]);
      assert.equal(result, "cmd.run echo hello");
    });

    it("test with object argument", () => {
      const result = Panel._makeCommandString([{"key": "value"}]);
      assert.equal(result, '{"key":"value"}');
    });

    it("test with mixed string and object", () => {
      const result = Panel._makeCommandString(["cmd.run", {"arg": "val"}]);
      assert.equal(result, 'cmd.run {"arg":"val"}');
    });

    it("test with key-value pair format", () => {
      const result = Panel._makeCommandString(["cmd.run", "key=value"]);
      assert.isString(result);
      assert.include(result, "cmd.run");
    });

  });

  // pins: a restart with the same owner while an item was in progress
  // (leave and return, refreshPage) ran two loops at the same time and
  // called loopEnd before the last item was done
  describe("startLoop", () => {
    let timers;
    let pending;
    let inFlight;
    let inFlightAtStart;
    let loopEndInFlight;
    let panel;
    let owner;

    const flush = () => new Promise((pResolve) => {
      setImmediate(pResolve);
    });

    const runToEnd = async () => {
      for (let i = 0; i < 20; i++) {
        while (pending.length > 0) {
          pending.shift()();
          await flush();
        }
        const callbacks = [...timers.values()];
        timers.clear();
        callbacks.forEach((pCallback) => pCallback());
        await flush();
      }
    };

    beforeEach(() => {
      timers = new Map();
      pending = [];
      inFlight = 0;
      inFlightAtStart = [];
      loopEndInFlight = [];
      let nextTimerId = 1;
      defineGlobal("window", {
        "clearTimeout": (pId) => timers.delete(pId),
        "setTimeout": (pCallback) => {
          const id = nextTimerId;
          nextTimerId += 1;
          timers.set(id, pCallback);
          return id;
        }
      });
      panel = Object.create(Panel.prototype);
      panel.setPlayPauseButton = () => {};
      panel.playOrPause = "play";
      owner = {
        "loopEnd": () => loopEndInFlight.push(inFlight),
        "loopInit": () => ["m1", "m2", "m3", "m4"],
        "loopItem": () => {
          inFlightAtStart.push(inFlight);
          inFlight += 1;
          return new Promise((pResolve) => {
            pending.push(() => {
              inFlight -= 1;
              pResolve(true);
            });
          });
        }
      };
    });

    afterEach(() => {
      delete globalThis.window;
    });

    it("test restart with the same owner runs one item at a time", async () => {
      panel.startLoop(owner, 1000);
      panel.onHide();
      panel.startLoop(owner, 1000);
      await runToEnd();
      // only the first item of the new loop starts while the item of the
      // stopped loop is still in progress, that one cannot be cancelled
      assert.deepEqual(inFlightAtStart, [0, 1, 0, 0, 0]);
      assert.deepEqual(loopEndInFlight, [0]);
    });
  });

});

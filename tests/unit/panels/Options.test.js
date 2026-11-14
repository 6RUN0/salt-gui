/* global afterEach beforeEach describe it */

// Api.js first: loading Options.js on its own ends in an import cycle
import "../../../saltgui/static/scripts/Api.js";
import {OptionsPanel} from "../../../saltgui/static/scripts/panels/Options.js";
import {assert} from "chai";

// no DOM in the unit tests, window is replaced by a stub;
// not enumerable, so that mocha --check-leaks does not report it
const defineGlobal = (pName, pValue) => {
  Object.defineProperty(globalThis, pName, {"configurable": true, "enumerable": false, "value": pValue, "writable": true});
};

describe("Unittests for panels/Options.js", () => {

  // pins: the intervals of session start and session expire were stored
  // in one field, each show of the Options page lost one of them
  describe("_setupOptionIntervals", () => {
    let intervals;
    let panel;

    const showSessionOptions = () => {
      panel._setupOptionIntervals({}, "start", "session", 1000, 1000);
      panel._setupOptionIntervals({}, "expire", "session", 2000, 1000);
    };

    beforeEach(() => {
      intervals = new Map();
      let nextIntervalId = 1;
      defineGlobal("window", {
        "clearInterval": (pId) => intervals.delete(pId),
        "clearTimeout": () => {},
        "setInterval": (pCallback) => {
          const id = nextIntervalId;
          nextIntervalId += 1;
          intervals.set(id, pCallback);
          return id;
        }
      });
      panel = Object.create(OptionsPanel.prototype);
    });

    afterEach(() => {
      delete globalThis.window;
    });

    it("test onHide stops both intervals", () => {
      showSessionOptions();
      assert.equal(intervals.size, 2);
      panel.onHide();
      assert.equal(intervals.size, 0);
    });

    it("test show again without onHide keeps two intervals", () => {
      showSessionOptions();
      showSessionOptions();
      assert.equal(intervals.size, 2);
      panel.onHide();
      assert.equal(intervals.size, 0);
    });
  });

});

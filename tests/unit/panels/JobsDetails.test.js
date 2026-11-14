/* global afterEach beforeEach describe it */

// Api.js first: loading JobsDetails.js on its own ends in an import cycle
import "../../../saltgui/static/scripts/Api.js";
import {JobsDetailsPanel} from "../../../saltgui/static/scripts/panels/JobsDetails.js";
import {assert} from "chai";

// no DOM in the unit tests, window is replaced by a stub;
// not enumerable, so that mocha --check-leaks does not report it
const defineGlobal = (pName, pValue) => {
  Object.defineProperty(globalThis, pName, {"configurable": true, "enumerable": false, "value": pValue, "writable": true});
};

describe("Unittests for panels/JobsDetails.js", () => {

  // pins: each refresh of the jobs list started another interval that
  // loads the job details, and a list that arrived after leaving the page
  // started one on the hidden page; onHide stopped only the last one
  describe("jobsListIsReady", () => {
    let intervals;
    let panel;

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
      panel = Object.create(JobsDetailsPanel.prototype);
    });

    afterEach(() => {
      delete globalThis.window;
    });

    it("test refresh of the list runs one interval", () => {
      panel.jobsListIsReady();
      panel.jobsListIsReady();
      assert.equal(intervals.size, 1);
      panel.onHide();
      assert.equal(intervals.size, 0);
    });

    it("test list that arrives after onHide starts no interval", () => {
      panel.onHide();
      panel.jobsListIsReady();
      assert.equal(intervals.size, 0);
    });
  });

});

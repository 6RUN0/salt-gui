/* global afterEach beforeEach describe it setImmediate */
/* eslint-disable compat/compat */

// Api.js first: loading Job.js on its own ends in an import cycle
import "../../../saltgui/static/scripts/Api.js";
import {JobPanel} from "../../../saltgui/static/scripts/panels/Job.js";
import {Utils} from "../../../saltgui/static/scripts/Utils.js";
import {assert} from "chai";

// no DOM in the unit tests, window and document are replaced by stubs;
// not enumerable, so that mocha --check-leaks does not report them
const defineGlobal = (pName, pValue) => {
  Object.defineProperty(globalThis, pName, {"configurable": true, "enumerable": false, "value": pValue, "writable": true});
};

describe("Unittests for panels/Job.js", () => {

  // pins: an answer that arrived after leaving the job page started a new
  // refresh timer on the hidden page, every return to the page added
  // another polling chain
  describe("refresh timer", () => {
    let timers;
    let pending;
    let requests;
    let panel;

    const flush = () => new Promise((pResolve) => {
      setImmediate(pResolve);
    });

    const answerAll = async () => {
      while (pending.length > 0) {
        pending.shift()({"return": [{}]});
        await flush();
      }
    };

    const fireTimers = async () => {
      const callbacks = [...timers.values()];
      timers.clear();
      for (const callback of callbacks) {
        callback();
      }
      await flush();
    };

    beforeEach(() => {
      timers = new Map();
      pending = [];
      requests = 0;
      let nextTimerId = 1;
      defineGlobal("window", {
        "clearTimeout": (pId) => timers.delete(pId),
        "localStorage": Utils._getDummyStorage("local"),
        "location": {"href": "http://localhost/?id=20261114120000000001#job"},
        "sessionStorage": Utils._getDummyStorage("session"),
        "setTimeout": (pCallback) => {
          const id = nextTimerId;
          nextTimerId += 1;
          timers.set(id, pCallback);
          return id;
        }
      });
      defineGlobal("document", {"getElementById": () => ({"innerText": "1 active"})});
      Utils.setStorageItem("local", "jobrefresh", "play");

      const request = () => {
        requests += 1;
        return new Promise((pResolve) => {
          pending.push(pResolve);
        });
      };
      panel = Object.create(JobPanel.prototype);
      panel.api = {"getRunnerJobsActive": request, "getRunnerJobsListJob": request};
      panel._handleJobRunnerJobsListJob = () => {};
      panel._handleRunnerJobsActive = () => {};
      panel.setPlayPauseButton = (pValue) => {
        panel.playOrPause = pValue;
      };
    });

    afterEach(() => {
      Utils.clearStorage("local");
      delete globalThis.window;
      delete globalThis.document;
    });

    it("test answer after onHide schedules no refresh", async () => {
      panel.onShow();
      await answerAll();
      assert.equal(timers.size, 1);

      // the refresh is underway when the user leaves the page
      await fireTimers();
      panel.onHide();
      await answerAll();
      assert.equal(timers.size, 0);

      const before = requests;
      await fireTimers();
      await answerAll();
      assert.equal(requests - before, 0);
    });

    it("test return to the page runs one refresh timer", async () => {
      panel.onShow();
      await answerAll();
      await fireTimers();
      panel.onHide();
      panel.onShow();
      await answerAll();
      assert.equal(timers.size, 1);
    });

    it("test onShow while a timer is set keeps one timer", async () => {
      panel.onShow();
      await answerAll();
      // e.g. a click on the "N active" summary
      panel.onShow();
      await answerAll();
      assert.equal(timers.size, 1);
    });
  });

});

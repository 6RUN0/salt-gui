/* global afterEach beforeEach describe it setImmediate */
/* eslint-disable compat/compat */

// Api.js first: loading Login.js on its own ends in an import cycle
import "../../../saltgui/static/scripts/Api.js";
import {LoginPanel} from "../../../saltgui/static/scripts/panels/Login.js";
import {Router} from "../../../saltgui/static/scripts/Router.js";
import {Utils} from "../../../saltgui/static/scripts/Utils.js";
import {assert} from "chai";

// no DOM in the unit tests, window and document are replaced by stubs;
// not enumerable, so that mocha --check-leaks does not report them
const defineGlobal = (pName, pValue) => {
  Object.defineProperty(globalThis, pName, {"configurable": true, "enumerable": false, "value": pValue, "writable": true});
};

describe("Unittests for panels/Login.js", () => {

  // pins: the first page was shown 1 second after the login, also when
  // wheel config.values had not answered yet; it then missed e.g.
  // saltgui_pages and saltgui_preview_grains
  describe("_onLoginSuccess", () => {
    const replaced = [];
    let timers;
    let events;
    let configValues;
    let panel;

    const flush = () => new Promise((pResolve) => {
      setImmediate(pResolve);
    });

    const fireTimers = async (pMillis) => {
      for (const [id, timer] of [...timers.entries()]) {
        if (timer.millis === pMillis) {
          timers.delete(id);
          timer.callback();
        }
      }
      await flush();
    };

    const replaceMethod = (pOwner, pName, pReplacement) => {
      replaced.push([pOwner, pName, pOwner[pName]]);
      pOwner[pName] = pReplacement;
    };

    const pendingPromise = () => new Promise(() => {});

    beforeEach(() => {
      timers = new Map();
      events = [];
      let nextTimerId = 1;
      defineGlobal("window", {
        "localStorage": Utils._getDummyStorage("local"),
        "location": {"href": "http://localhost/#login", "search": ""},
        "sessionStorage": Utils._getDummyStorage("session"),
        "setTimeout": (pCallback, pMillis) => {
          const id = nextTimerId;
          nextTimerId += 1;
          timers.set(id, {"callback": pCallback, "millis": pMillis});
          return id;
        }
      });
      defineGlobal("document", {"querySelectorAll": () => []});
      Utils.setStorageItem("session", "login_response", "{}");
      // BeaconsMinionPanel asks for it only once per session
      Utils.setStorageItem("session", "beacons_list_available", "[]");

      replaceMethod(LoginPanel, "_handleLoginWheelConfigValues", () => events.push("config"));
      replaceMethod(Router, "updateMainMenu", () => {});

      panel = Object.create(LoginPanel.prototype);
      panel._showNoticeText = () => {};
      panel.usernameField = {"value": "user"};
      panel.passwordField = {"value": "secret"};
      panel.router = {"goTo": (pPage) => events.push("goTo " + pPage)};
      panel.api = {
        "getLocalBeaconsListAvailable": pendingPromise,
        "getRunnerStateOrchestrateShowSls": pendingPromise,
        "getWheelConfigValues": () => new Promise((pResolve, pReject) => {
          configValues = {"reject": pReject, "resolve": pResolve};
        }),
        "getWheelKeyListAll": pendingPromise
      };
    });

    afterEach(() => {
      while (replaced.length > 0) {
        const [owner, name, original] = replaced.pop();
        owner[name] = original;
      }
      Utils.clearStorage("local");
      Utils.clearStorage("session");
      delete globalThis.window;
      delete globalThis.document;
    });

    it("test answer within the first second", async () => {
      panel._onLoginSuccess();
      configValues.resolve({});
      await flush();
      assert.deepEqual(events, ["config"]);
      await fireTimers(1000);
      assert.deepEqual(events, ["config", "goTo "]);
      assert.equal(panel.passwordField.value, "");
    });

    it("test slow answer is waited for", async () => {
      panel._onLoginSuccess();
      await fireTimers(1000);
      assert.deepEqual(events, []);
      configValues.resolve({});
      await flush();
      assert.deepEqual(events, ["config", "goTo "]);
      await fireTimers(5000);
      assert.deepEqual(events, ["config", "goTo "]);
    });

    it("test error does not delay the first page", async () => {
      panel._onLoginSuccess();
      configValues.reject(new Error("HTTP 500"));
      await flush();
      await fireTimers(1000);
      assert.deepEqual(events, ["goTo "]);
    });

    it("test no answer shows the first page after 5 seconds", async () => {
      panel._onLoginSuccess();
      await fireTimers(1000);
      assert.deepEqual(events, []);
      await fireTimers(5000);
      assert.deepEqual(events, ["goTo "]);
      // a very late answer does not show the first page again
      configValues.resolve({});
      await flush();
      assert.deepEqual(events, ["goTo ", "config"]);
    });

    // pins: a page chosen in the menu during the wait was replaced
    // by the first page
    it("test page chosen during the wait is kept", async () => {
      replaceMethod(Router, "currentPage", {"path": "login"});
      panel._onLoginSuccess();
      await fireTimers(1000);
      Router.currentPage = {"path": "jobs"};
      configValues.resolve({});
      await flush();
      assert.deepEqual(events, ["config"]);
      assert.equal(panel.passwordField.value, "");
      await fireTimers(5000);
      assert.deepEqual(events, ["config"]);
    });

    it("test first page is shown when still on the login page", async () => {
      replaceMethod(Router, "currentPage", {"path": "login"});
      panel._onLoginSuccess();
      await fireTimers(1000);
      await fireTimers(5000);
      assert.deepEqual(events, ["goTo "]);
    });
  });

});

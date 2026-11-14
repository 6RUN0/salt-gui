/* global afterEach beforeEach describe it setImmediate */
/* eslint-disable compat/compat */

// Api.js first: loading Logout.js on its own ends in an import cycle
import "../../../saltgui/static/scripts/Api.js";
import {LogoutPage} from "../../../saltgui/static/scripts/pages/Logout.js";
import {Utils} from "../../../saltgui/static/scripts/Utils.js";
import {assert} from "chai";

// no DOM in the unit tests, window and document are replaced by stubs;
// not enumerable, so that mocha --check-leaks does not report them
const defineGlobal = (pName, pValue) => {
  Object.defineProperty(globalThis, pName, {"configurable": true, "enumerable": false, "value": pValue, "writable": true});
};

describe("Unittests for pages/Logout.js", () => {

  // pins: with an expired session /logout was sent every second until
  // the first one answered, and each answer showed the login page again
  describe("_updateSessionTimeoutWarning", () => {
    let logouts;
    let goTos;
    let page;

    const flush = () => new Promise((pResolve) => {
      setImmediate(pResolve);
    });

    beforeEach(() => {
      logouts = [];
      goTos = [];
      defineGlobal("window", {
        "localStorage": Utils._getDummyStorage("local"),
        "sessionStorage": Utils._getDummyStorage("session")
      });
      defineGlobal("document", {"getElementById": () => ({"style": {}})});
      Utils.setStorageItem("session", "token", "token1");
      // expired one second after 1970-01-01
      Utils.setStorageItem("session", "login_response", JSON.stringify({"expire": 1}));
      page = Object.create(LogoutPage.prototype);
      page.api = {"logout": () => new Promise((pResolve, pReject) => {
        logouts.push({"reject": pReject, "resolve": pResolve});
      })};
      page.router = {"goTo": (pPage, pQuery) => goTos.push(pPage + " " + pQuery.reason)};
    });

    afterEach(() => {
      Utils.clearStorage("session");
      delete globalThis.window;
      delete globalThis.document;
    });

    it("test slow logout is sent once", async () => {
      page._updateSessionTimeoutWarning();
      page._updateSessionTimeoutWarning();
      page._updateSessionTimeoutWarning();
      assert.lengthOf(logouts, 1);
      logouts[0].resolve(true);
      await flush();
      assert.deepEqual(goTos, ["login session-expired"]);
    });

    it("test failed logout allows a next one", async () => {
      page._updateSessionTimeoutWarning();
      logouts[0].reject(new Error("timeout"));
      await flush();
      assert.deepEqual(goTos, ["login session-expired"]);
      page._updateSessionTimeoutWarning();
      assert.lengthOf(logouts, 2);
    });
  });

});

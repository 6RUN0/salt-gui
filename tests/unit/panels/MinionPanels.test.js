/* global afterEach beforeEach describe it setImmediate window */
/* eslint-disable compat/compat */

// Api.js first: loading a panel on its own ends in an import cycle
import "../../../saltgui/static/scripts/Api.js";
import {BeaconsMinionPanel} from "../../../saltgui/static/scripts/panels/BeaconsMinion.js";
import {GrainsMinionPanel} from "../../../saltgui/static/scripts/panels/GrainsMinion.js";
import {MineMinionPanel} from "../../../saltgui/static/scripts/panels/MineMinion.js";
import {PillarsMinionPanel} from "../../../saltgui/static/scripts/panels/PillarsMinion.js";
import {SchedulesMinionPanel} from "../../../saltgui/static/scripts/panels/SchedulesMinion.js";
import {Utils} from "../../../saltgui/static/scripts/Utils.js";
import {assert} from "chai";

// no DOM in the unit tests, window is replaced by a stub;
// not enumerable, so that mocha --check-leaks does not report it
const defineGlobal = (pName, pValue) => {
  Object.defineProperty(globalThis, pName, {"configurable": true, "enumerable": false, "value": pValue, "writable": true});
};

const PANELS = [
  {"apiMethod": "getLocalGrainsItems", "handler": "_handleLocalGrainsItems", "panelClass": GrainsMinionPanel},
  {"apiMethod": "getLocalPillarItems", "handler": "_handleLocalPillarItems", "panelClass": PillarsMinionPanel},
  {"apiMethod": "getLocalScheduleList", "handler": "_handleLocalScheduleList", "panelClass": SchedulesMinionPanel},
  {"apiMethod": "getLocalBeaconsList", "handler": "_handleLocalBeaconsList", "panelClass": BeaconsMinionPanel},
  {"apiMethod": "getLocalMineValid", "handler": "_handleLocalMineValid", "panelClass": MineMinionPanel}
];

describe("Unittests for the panels of one minion", () => {

  // pins: the late answer of the previous minion was added to the page of
  // the next minion, with menus that target the previous minion
  describe("late answer for another minion", () => {
    let requests;
    let handled;

    const flush = () => new Promise((pResolve) => {
      setImmediate(pResolve);
    });

    const showMinion = (pPanel, pMinionId) => {
      window.location.href = "http://localhost/?minionid=" + pMinionId + "#grains-minion";
      pPanel.onShow();
    };

    const createPanel = (pSpec) => {
      const panel = Object.create(pSpec.panelClass.prototype);
      const api = {
        [pSpec.apiMethod]: (pMinionId) => new Promise((pResolve, pReject) => {
          requests.set(pMinionId, {"reject": pReject, "resolve": pResolve});
        })
      };
      panel.api = api;
      panel.router = {"api": api};
      panel.updateTitle = () => {};
      panel.setWarningText = () => {};
      panel[pSpec.handler] = (...pArgs) => {
        // the minion id is the last argument of each handler
        handled.push(pArgs[pArgs.length - 1]);
      };
      return panel;
    };

    beforeEach(() => {
      requests = new Map();
      handled = [];
      defineGlobal("window", {
        "localStorage": Utils._getDummyStorage("local"),
        "location": {"href": "http://localhost/"},
        "sessionStorage": Utils._getDummyStorage("session")
      });
      // BeaconsMinionPanel asks for it only once per session
      Utils.setStorageItem("session", "beacons_list_available", "[]");
    });

    afterEach(() => {
      Utils.clearStorage("session");
      delete globalThis.window;
    });

    for (const spec of PANELS) {
      it("test " + spec.panelClass.name + " ignores the answer for the previous minion", async () => {
        const panel = createPanel(spec);
        showMinion(panel, "minionA");
        showMinion(panel, "minionB");
        requests.get("minionB").resolve({"return": [{}]});
        await flush();
        requests.get("minionA").resolve({"return": [{}]});
        await flush();
        assert.deepEqual(handled, ["minionB"]);
      });

      it("test " + spec.panelClass.name + " ignores the error for the previous minion", async () => {
        const panel = createPanel(spec);
        showMinion(panel, "minionA");
        showMinion(panel, "minionB");
        requests.get("minionB").resolve({"return": [{}]});
        await flush();
        requests.get("minionA").reject(new Error("timeout"));
        await flush();
        assert.deepEqual(handled, ["minionB"]);
      });

      it("test " + spec.panelClass.name + " ignores an earlier answer for the same minion", async () => {
        const panel = createPanel(spec);
        showMinion(panel, "minionA");
        const firstRequest = requests.get("minionA");
        showMinion(panel, "minionA");
        requests.get("minionA").resolve({"return": [{}]});
        firstRequest.resolve({"return": [{}]});
        await flush();
        assert.deepEqual(handled, ["minionA"]);
      });
    }
  });

});

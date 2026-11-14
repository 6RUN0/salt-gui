/* global afterEach beforeEach describe it setImmediate */
/* eslint-disable compat/compat */

import {CommandBox} from "../../saltgui/static/scripts/CommandBox.js";
import {Output} from "../../saltgui/static/scripts/output/Output.js";
import {Page} from "../../saltgui/static/scripts/pages/Page.js";
import {RunType} from "../../saltgui/static/scripts/RunType.js";
import {TargetType} from "../../saltgui/static/scripts/TargetType.js";
import {Utils} from "../../saltgui/static/scripts/Utils.js";
import {assert} from "chai";

// no DOM in the unit tests, window and document are replaced by stubs;
// not enumerable, so that mocha --check-leaks does not report them
const defineGlobal = (pName, pValue) => {
  Object.defineProperty(globalThis, pName, {"configurable": true, "enumerable": false, "value": pValue, "writable": true});
};

const createElementStub = () => {
  const elem = {
    "appendChild": (pChild) => elem.children.push(pChild),
    "children": [],
    "classList": {"add": () => {}, "remove": () => {}},
    "disabled": false,
    "firstChild": null,
    "focus": () => {},
    "style": {},
    "value": ""
  };
  return elem;
};

describe("Unittests for the run of CommandBox.js", () => {

  const replaced = [];
  let elements;
  let button;
  let answers;
  let shownOutputs;

  const flush = () => new Promise((pResolve) => {
    setImmediate(pResolve);
  });

  const replaceMethod = (pOwner, pName, pReplacement) => {
    replaced.push([pOwner, pName, pOwner[pName]]);
    pOwner[pName] = pReplacement;
  };

  const runCommand = (pCommand) => {
    elements["target"].value = "minion1";
    elements["command"].value = pCommand;
    const commandBox = Object.create(CommandBox.prototype);
    commandBox.getRunParams = () => new Promise((pResolve) => {
      answers.push(pResolve);
    });
    commandBox._onRun();
  };

  const runCommandInOpenBox = (pCommand) => {
    elements["popup-run-command"].style.display = "block";
    runCommand(pCommand);
  };

  const pressKey = (pKey) => {
    const page = Object.create(Page.prototype);
    page.api = null;
    return page._handleTemplateKey({"key": pKey}) || page._handleMenuKey({"key": pKey});
  };

  beforeEach(() => {
    answers = [];
    shownOutputs = [];
    button = createElementStub();
    elements = {
      "command": createElementStub(),
      "data-list-target": createElementStub(),
      "popup-run-command": createElementStub(),
      "target": createElementStub()
    };
    const output = createElementStub();
    defineGlobal("window", {
      "localStorage": Utils._getDummyStorage("local"),
      "location": {"hash": ""},
      "sessionStorage": Utils._getDummyStorage("session")
    });
    defineGlobal("document", {
      "createElement": createElementStub,
      "getElementById": (pId) => elements[pId] || null,
      "querySelector": (pSelector) => {
        if (pSelector === ".run-command pre") {
          return output;
        }
        if (pSelector === ".run-command input[type='submit']") {
          return button;
        }
        return null;
      }
    });
    replaceMethod(TargetType, "menuTargetType", {"_value": "glob"});
    replaceMethod(TargetType, "autoSelectTargetType", () => {});
    replaceMethod(RunType, "setRunTypeDefault", () => {});
    replaceMethod(CommandBox, "_markPanelsForRefresh", () => {});
    replaceMethod(CommandBox, "_prepareForAsyncResults", () => {});
    replaceMethod(CommandBox, "_populateTemplateCatMenu", () => {});
    replaceMethod(CommandBox, "_populateTemplateTmplMenu", () => {});
    replaceMethod(CommandBox, "_populateTestProviders", () => {});
    replaceMethod(Output, "addResponseOutput", (...pArgs) => {
      // the command is the fourth argument
      shownOutputs.push(pArgs[3]);
    });
  });

  afterEach(() => {
    while (replaced.length > 0) {
      const [owner, name, original] = replaced.pop();
      if (original === undefined) {
        delete owner[name];
      } else {
        owner[name] = original;
      }
    }
    delete globalThis.window;
    delete globalThis.document;
  });

  // pins: closing the box during a run kept the fields disabled after it
  // was opened again, and the late answer was shown under the new command
  describe("_onRun with the box opened again", () => {
    it("test answer is shown when the box stays open", async () => {
      runCommand("test.ping");
      assert.isTrue(button.disabled);
      answers[0]({"return": [{"minion1": true}]});
      await flush();
      assert.deepEqual(shownOutputs, ["test.ping"]);
      assert.isFalse(button.disabled);
    });

    it("test opening the box again enables the fields", () => {
      runCommand("test.sleep 60");
      CommandBox.showManualRun(null);
      assert.isFalse(elements["target"].disabled);
      assert.isFalse(elements["command"].disabled);
      assert.isFalse(button.disabled);
    });

    it("test answer of the previous command is not shown", async () => {
      runCommand("test.sleep 60");
      CommandBox.showManualRun(null);
      answers[0]({"return": [{"minion1": true}]});
      await flush();
      assert.deepEqual(shownOutputs, []);
    });

    it("test answer of a new command is shown", async () => {
      runCommand("test.sleep 60");
      CommandBox.showManualRun(null);
      runCommand("test.ping");
      answers[1]({"return": [{"minion1": true}]});
      answers[0]({"return": [{"minion1": true}]});
      await flush();
      assert.deepEqual(shownOutputs, ["test.ping"]);
    });
  });

  // pins: a hotkey that shows the box while it is open took the box
  // from the running command, its answer was lost and Run was enabled
  describe("hotkeys while a command runs", () => {
    it("test key c keeps the running command and its answer", async () => {
      runCommandInOpenBox("state.apply");
      assert.isTrue(pressKey("c"));
      assert.isTrue(elements["target"].disabled);
      assert.isTrue(elements["command"].disabled);
      assert.isTrue(button.disabled);
      answers[0]({"return": [{"minion1": true}]});
      await flush();
      assert.deepEqual(shownOutputs, ["state.apply"]);
      assert.isFalse(button.disabled);
    });

    it("test template key keeps the running command and its answer", async () => {
      Utils.setStorageItem("session", "template_t", "mytemplate");
      runCommandInOpenBox("state.apply");
      assert.isTrue(pressKey("t"));
      assert.isTrue(button.disabled);
      answers[0]({"return": [{"minion1": true}]});
      await flush();
      assert.deepEqual(shownOutputs, ["state.apply"]);
    });
  });

});

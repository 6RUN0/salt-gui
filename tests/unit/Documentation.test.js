/* global describe it beforeEach */

import {Documentation} from "../../saltgui/static/scripts/Documentation.js";
import {assert} from "chai";

describe("Unittests for Documentation.js", () => {

  beforeEach(() => {
    // Reset PROVIDERS for each test
    Documentation.PROVIDERS = {};
  });

  describe("_getKeywordFragments", () => {
    it("test with empty command line", () => {
      const result = Documentation._getKeywordFragments("");
      assert.deepEqual(result, ["modules"]);
    });

    it("test with single module command", () => {
      const result = Documentation._getKeywordFragments("test.echo hello");
      assert.deepEqual(result, ["modules", "test", "echo"]);
    });

    it("test with runners prefix", () => {
      const result = Documentation._getKeywordFragments("runners.jobs.list");
      assert.deepEqual(result, ["runners", "jobs", "list"]);
    });

    it("test with wheel prefix", () => {
      const result = Documentation._getKeywordFragments("wheel.key.finger");
      assert.deepEqual(result, ["wheel", "key", "finger"]);
    });

    it("test with modules prefix explicit", () => {
      const result = Documentation._getKeywordFragments("modules.test.echo");
      assert.deepEqual(result, ["modules", "test", "echo"]);
    });

    it("test with trailing dots removed", () => {
      const result = Documentation._getKeywordFragments("test.echo...");
      assert.deepEqual(result, ["modules", "test", "echo"]);
    });

    it("test with unknown category becomes modules", () => {
      const result = Documentation._getKeywordFragments("unknown.category.command");
      assert.deepEqual(result, ["modules", "unknown", "category", "command"]);
    });
  });

  describe("_correctProviderKey", () => {
    it("test with simple key and value", () => {
      const result = Documentation._correctProviderKey("pkg", "apt");
      assert.equal(result, "pkg");
    });

    it("test removes cpython-35 suffix", () => {
      const result = Documentation._correctProviderKey("key.cpython-35", "value");
      assert.equal(result, "key");
    });

    it("test applies known Windows correction for vsphere", () => {
      const result = Documentation._correctProviderKey("__init__", "vsphere");
      assert.equal(result, "vsphere");
    });

    it("test applies known Windows correction for win_lgpo", () => {
      const result = Documentation._correctProviderKey("configparser", "lgpo");
      assert.equal(result, "win_lgpo");
    });

    it("test applies known Windows correction for win_pkg", () => {
      const result = Documentation._correctProviderKey("functools", "pkg");
      assert.equal(result, "win_pkg");
    });

    it("test handles travisci module misreporting with parse", () => {
      const result = Documentation._correctProviderKey("parse", "travisci");
      assert.equal(result, "travisci");
    });

    it("test handles travisci module misreporting with urlparse", () => {
      const result = Documentation._correctProviderKey("urlparse", "travisci");
      assert.equal(result, "travisci");
    });
  });

  describe("_addProvider", () => {
    it("test adds provider to empty PROVIDERS", () => {
      Documentation._addProvider("module_name", "provider_key");
      assert.deepEqual(Documentation.PROVIDERS["module_name"], ["provider_key"]);
    });

    it("test prevents duplicate providers", () => {
      Documentation._addProvider("module", "key");
      Documentation._addProvider("module", "key");
      assert.deepEqual(Documentation.PROVIDERS["module"], ["key"]);
    });

    it("test adds multiple providers to same module", () => {
      Documentation._addProvider("module", "key1");
      Documentation._addProvider("module", "key2");
      assert.deepEqual(Documentation.PROVIDERS["module"], ["key1", "key2"]);
    });

    it("test maintains order of insertion", () => {
      Documentation._addProvider("mod", "first");
      Documentation._addProvider("mod", "second");
      Documentation._addProvider("mod", "third");
      assert.deepEqual(Documentation.PROVIDERS["mod"], ["first", "second", "third"]);
    });
  });

  describe("_buildModuleAndFunctionLinks", () => {
    beforeEach(() => {
      // normally set by the constructor
      Documentation.DOCUMENTATION_URL = "https://docs.saltproject.io/en/latest/ref/";
      Documentation.EXTERNAL_LINK = "";
    });

    it("test regular module and function links", () => {
      const html = Documentation._buildModuleAndFunctionLinks(["modules", "cmd", "run"], ["cmdmod"]);
      assert.include(html, "<a href='https://docs.saltproject.io/en/latest/ref/modules/all/salt.modules.cmdmod.html' target='_blank' rel='noopener'>Module 'cmdmod'");
      assert.include(html, "<a href='https://docs.saltproject.io/en/latest/ref/modules/all/salt.modules.cmdmod.html#salt.modules.cmdmod.run' target='_blank' rel='noopener'>Function 'cmdmod.run'");
    });

    it("test html in module and function name is escaped", () => {
      const html = Documentation._buildModuleAndFunctionLinks(["modules", "x", "<img src=x onerror=alert(1)>"], ["y' onmouseover='alert(2)"]);
      assert.notInclude(html, "<img");
      assert.notInclude(html, "' onmouseover='");
      assert.include(html, "Function-name '&lt;img src=x onerror=alert(1)&gt;' cannot be verified");
      assert.include(html, "salt.modules.y&#039;%20onmouseover%3D&#039;alert(2).html'");
    });

    it("test aliased function links to the anchor of the python name", () => {
      // "state.apply" is implemented as "apply_", the documentation has no anchor "apply"
      const html = Documentation._buildModuleAndFunctionLinks(["modules", "state", "apply"], ["state"]);
      assert.include(html, "<a href='https://docs.saltproject.io/en/latest/ref/modules/all/salt.modules.state.html#salt.modules.state.apply_' target='_blank' rel='noopener'>Function 'state.apply'");
    });

    it("test aliased function with another python name", () => {
      const html = Documentation._buildModuleAndFunctionLinks(["wheel", "key", "print"], ["key"]);
      assert.include(html, "salt.wheel.key.html#salt.wheel.key.key_str'");
      assert.include(html, "Function 'wheel.key.print'");
    });

    it("test alias is looked up per module", () => {
      // "ls" is aliased in "etcd_mod", but not in "grains"
      const html = Documentation._buildModuleAndFunctionLinks(["modules", "grains", "ls"], ["grains"]);
      assert.include(html, "salt.modules.grains.html#salt.modules.grains.ls'");
      const etcdHtml = Documentation._buildModuleAndFunctionLinks(["modules", "etcd", "ls"], ["etcd_mod"]);
      assert.include(etcdHtml, "salt.modules.etcd_mod.html#salt.modules.etcd_mod.ls_'");
    });
  });

  describe("_buildBeaconsWithNoTemplateSection", () => {
    it("test beacon name without template is shown", () => {
      const html = Documentation._buildBeaconsWithNoTemplateSection({}, {"_cnt": 2, "mybeacon": 1});
      assert.include(html, "<p>&nbsp;&nbsp;mybeacon (1 of 2)</p>");
    });

    it("test html in beacon name is escaped", () => {
      const html = Documentation._buildBeaconsWithNoTemplateSection({}, {"<img src=x onerror=alert(1)>": 1, "_cnt": 1});
      assert.notInclude(html, "<img");
      assert.include(html, "<p>&nbsp;&nbsp;&lt;img src=x onerror=alert(1)&gt;</p>");
    });
  });

});

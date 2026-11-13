/* global describe it beforeEach */

import {HTTPError, API} from "../../saltgui/static/scripts/Api.js";
import {Utils} from "../../saltgui/static/scripts/Utils.js";
import {assert} from "chai";

describe("Unittests for Api.js", () => {

  beforeEach(() => {
    Utils.clearStorage("local");
    Utils.clearStorage("session");
  });

  // pins: after a restart of salt-api the GUI kept sending requests that got 401,
  // while a 401 caused by the eauth ACL must not end the session
  describe("getUnauthorizedReason", () => {
    const valid = JSON.stringify({"expire": 2000});

    it("test without login response", () => {
      assert.equal(API.getUnauthorizedReason(null, 1000, "/"), "no-session");
    });

    it("test with expired session", () => {
      assert.equal(API.getUnauthorizedReason(valid, 3000, "/"), "session-expired");
      assert.equal(API.getUnauthorizedReason(valid, 3000, "/stats"), "session-expired");
    });

    it("test 401 from /stats on a valid session ends it", () => {
      assert.equal(API.getUnauthorizedReason(valid, 1000, "/stats"), "session-rejected");
    });

    it("test 401 from a regular request on a valid session needs a probe", () => {
      assert.isNull(API.getUnauthorizedReason(valid, 1000, "/"));
      assert.isNull(API.getUnauthorizedReason(valid, 1000, "/static/minions.txt"));
    });
  });

  // pins: after a new login the page came back without its parameters,
  // e.g. the job page without "id"
  describe("buildLoginQuery", () => {
    it("test page and its parameters are kept", () => {
      assert.deepEqual(API.buildLoginQuery("session-rejected", "#job", "?id=20261113"),
        {"id": "20261113", "page": "job", "reason": "session-rejected"});
      assert.deepEqual(API.buildLoginQuery("session-expired", "#grains-minion", "?minionid=m1&popup=true"),
        {"minionid": "m1", "page": "grains-minion", "popup": "true", "reason": "session-expired"});
    });

    it("test old reason and page are replaced", () => {
      assert.deepEqual(API.buildLoginQuery("session-rejected", "#minions", "?reason=no-session&page=keys"),
        {"page": "minions", "reason": "session-rejected"});
    });

    it("test login page as current page keeps no page", () => {
      assert.deepEqual(API.buildLoginQuery("no-session", "#login", ""), {"reason": "no-session"});
    });
  });

  describe("getReturnPage", () => {
    it("test regular page is kept", () => {
      assert.equal(API.getReturnPage("#minions"), "minions");
      assert.equal(API.getReturnPage("#job"), "job");
    });

    it("test login, logout and empty hash are not kept", () => {
      assert.isNull(API.getReturnPage(""));
      assert.isNull(API.getReturnPage("#"));
      assert.isNull(API.getReturnPage("#login"));
      assert.isNull(API.getReturnPage("#logout"));
    });
  });

  // pins: the "(error)" tooltip showed "{}" for network errors
  describe("makeErrorSerializable", () => {
    it("test network error shows name and message", () => {
      const error = API.makeErrorSerializable(new TypeError("NetworkError when attempting to fetch resource."));
      assert.deepEqual(JSON.parse(JSON.stringify(error)), {"message": "NetworkError when attempting to fetch resource.", "name": "TypeError"});
    });

    it("test toString is unchanged for the login panel", () => {
      const error = API.makeErrorSerializable(new TypeError("NetworkError when attempting to fetch resource."));
      assert.isTrue(error.toString().startsWith("TypeError: NetworkError"));
      assert.instanceOf(error, TypeError);
    });

    it("test HTTPError is unchanged", () => {
      const error = API.makeErrorSerializable(new HTTPError(500, "Internal Server Error"));
      assert.deepEqual(JSON.parse(JSON.stringify(error)), {"message": "Internal Server Error", "status": 500});
    });

    it("test non-error values pass through", () => {
      assert.equal(API.makeErrorSerializable("text"), "text");
      assert.isNull(API.makeErrorSerializable(null));
    });
  });

  describe("HTTPError", () => {
    it("test constructor with status and message", () => {
      const error = new HTTPError(404, "Not Found");
      assert.equal(error.status, 404);
      assert.equal(error.message, "Not Found");
    });

    it("test with status 401", () => {
      const error = new HTTPError(401, "Unauthorized");
      assert.equal(error.status, 401);
      assert.equal(error.message, "Unauthorized");
    });

    it("test with status 500", () => {
      const error = new HTTPError(500, "Internal Server Error");
      assert.equal(error.status, 500);
      assert.equal(error.message, "Internal Server Error");
    });

    it("test is instanceof Error", () => {
      const error = new HTTPError(500, "Error");
      assert.instanceOf(error, Error);
    });
  });

  describe("_cleanStorage", () => {
    it("test clears local storage", () => {
      Utils.setStorageItem("local", "testkey", "testvalue");
      API._cleanStorage();
      const result = Utils.getStorageItem("local", "testkey");
      assert.isNull(result);
    });

    it("test clears session storage", () => {
      Utils.setStorageItem("session", "testkey", "testvalue");
      API._cleanStorage();
      const result = Utils.getStorageItem("session", "testkey");
      assert.isNull(result);
    });

    it("test preserves local eauth setting", () => {
      Utils.setStorageItem("local", "eauth", "pam");
      Utils.setStorageItem("local", "otherkey", "othervalue");
      API._cleanStorage();
      const eauth = Utils.getStorageItem("local", "eauth");
      const other = Utils.getStorageItem("local", "otherkey");
      assert.equal(eauth, "pam");
      assert.isNull(other);
    });

    it("test preserves local runtype setting", () => {
      Utils.setStorageItem("local", "runtype", "async");
      Utils.setStorageItem("local", "otherkey", "othervalue");
      API._cleanStorage();
      const runtype = Utils.getStorageItem("local", "runtype");
      const other = Utils.getStorageItem("local", "otherkey");
      assert.equal(runtype, "async");
      assert.isNull(other);
    });

    it("test preserves both eauth and runtype", () => {
      Utils.setStorageItem("local", "eauth", "ldap");
      Utils.setStorageItem("local", "runtype", "normal");
      Utils.setStorageItem("local", "other", "value");
      API._cleanStorage();
      const eauth = Utils.getStorageItem("local", "eauth");
      const runtype = Utils.getStorageItem("local", "runtype");
      const other = Utils.getStorageItem("local", "other");
      assert.equal(eauth, "ldap");
      assert.equal(runtype, "normal");
      assert.isNull(other);
    });

    it("test handles missing eauth gracefully", () => {
      Utils.setStorageItem("local", "runtype", "async");
      API._cleanStorage();
      const eauth = Utils.getStorageItem("local", "eauth");
      const runtype = Utils.getStorageItem("local", "runtype");
      assert.isNull(eauth);
      assert.equal(runtype, "async");
    });

    it("test handles missing runtype gracefully", () => {
      Utils.setStorageItem("local", "eauth", "pam");
      API._cleanStorage();
      const eauth = Utils.getStorageItem("local", "eauth");
      const runtype = Utils.getStorageItem("local", "runtype");
      assert.equal(eauth, "pam");
      assert.isNull(runtype);
    });
  });

  // pins: a failed event stream was closed for good, the screens got no more updates
  describe("getNextEventsRetryMillis", () => {
    it("test first retry after 2 seconds", () => {
      assert.equal(API.getNextEventsRetryMillis(undefined), 2000);
      assert.equal(API.getNextEventsRetryMillis(0), 2000);
    });

    it("test retry delay doubles", () => {
      assert.equal(API.getNextEventsRetryMillis(2000), 4000);
      assert.equal(API.getNextEventsRetryMillis(16000), 32000);
    });

    it("test retry delay stops at 60 seconds", () => {
      assert.equal(API.getNextEventsRetryMillis(32000), 60000);
      assert.equal(API.getNextEventsRetryMillis(60000), 60000);
    });
  });

});

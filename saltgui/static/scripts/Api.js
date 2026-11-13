/* global config EventSource URLSearchParams window */

import {Character} from "./Character.js";
import {CommandBox} from "./CommandBox.js";
import {Router} from "./Router.js";
import {TargetType} from "./TargetType.js";
import {Utils} from "./Utils.js";

// how long a 401 waits for /logout before showing the login page anyway
const LOGOUT_WAIT_MS = 10000;

export class HTTPError extends Error {
  constructor (pStatus, pMessage) {
    super();
    this.status = pStatus;
    this.message = pMessage;
  }
}

export class API {
  login (pUserName, pPassWord, pEauth = "pam") {
    const params = {
      "eauth": pEauth,
      "password": pPassWord,
      "username": pUserName
    };

    // store it as the default login method
    Utils.setStorageItem("local", "eauth", pEauth);

    return this.apiRequest("POST", "/login", params).
      then((pLoginData) => {
        const response = pLoginData.return[0];
        if (Object.keys(response.perms).length === 0) {
          // We are allowed to login but there are no permissions available
          // This may happen e.g. for accounts that are in PAM,
          // but not in the 'master' file.
          // Don't give the user an empty screen full of errors
          // just like 403 Unauthorized
          throw new HTTPError(-1, "No permissions");
        }
        Utils.setStorageItem("session", "login_response", JSON.stringify(response));
        Utils.setStorageItem("session", "token", response.token);
        return true;
      });
  }

  static _cleanStorage () {
    // clear local storage except key 'eauth' and 'runtype'
    const eauth = Utils.getStorageItem("local", "eauth");
    const runtype = Utils.getStorageItem("local", "runtype");
    Utils.clearStorage("local");
    Utils.setStorageItem("local", "eauth", eauth);
    Utils.setStorageItem("local", "runtype", runtype);

    // clear all of session storage
    Utils.clearStorage("session");
  }

  logout () {
    // on touchscreens the menus do not go away by themselves
    Utils.hideAllMenus(true);

    // only delete the session here as the router should take care of
    // redirecting to the login screen
    // a late answer must not delete a session that started after this
    // logout, e.g. when the login page was shown without waiting for it
    const token = Utils.getStorageItem("session", "token", "");
    const cleanStorageOfThisSession = () => {
      if (Utils.getStorageItem("session", "token", "") === token) {
        API._cleanStorage();
      }
    };
    return this.apiRequest("POST", "/logout", {}).
      then(() => {
        // we could logout, assume the session is terminated
        cleanStorageOfThisSession();
        return true;
      }, () => {
        // we could not logout, assume the session is broken
        cleanStorageOfThisSession();
        return false;
      });
  }

  getStaticMinionsTxt () {
    return this.apiRequest("GET", "/static/minions.txt");
  }

  getStaticSaltAuthTxt () {
    return this.apiRequest("GET", "/static/salt-auth.txt");
  }

  getStaticSaltMotdTxt () {
    return this.apiRequest("GET", "/static/salt-motd.txt");
  }

  getStaticSaltMotdHtml () {
    return this.apiRequest("GET", "/static/salt-motd.html");
  }

  getLocalBeaconsList (pMinionId) {
    const params = {
      "client": "local",
      "fun": "beacons.list",
      "kwarg": {"return_yaml": false}
    };
    if (pMinionId) {
      params["tgt_type"] = "list";
      params.tgt = pMinionId;
    } else {
      params["tgt_type"] = "glob";
      params.tgt = "*";
    }
    return this.apiRequest("POST", "/", params);
  }

  getLocalBeaconsListAvailable (pMinionId) {
    const params = {
      "client": "local",
      "fun": "beacons.list_available",
      "kwarg": {"return_yaml": false}
    };
    if (pMinionId) {
      params["tgt_type"] = "list";
      params.tgt = pMinionId;
    } else {
      params["tgt_type"] = "glob";
      params.tgt = "*";
    }
    return this.apiRequest("POST", "/", params);
  }

  getLocalGrainsItems (pMinionId) {
    const params = {
      "client": "local",
      "fun": "grains.items"
    };
    if (pMinionId) {
      params["tgt_type"] = "list";
      params.tgt = pMinionId;
    } else {
      params["tgt_type"] = "glob";
      params.tgt = "*";
    }
    return this.apiRequest("POST", "/", params);
  }

  getLocalMineGet (pMinionId, pMineTarget, pMineItem) {
    const params = {
      "arg": [pMineTarget, pMineItem],
      "client": "local",
      "fun": "mine.get"
    };
    if (pMinionId) {
      params["tgt_type"] = "list";
      params.tgt = pMinionId;
    } else {
      params["tgt_type"] = "glob";
      params.tgt = "*";
    }
    return this.apiRequest("POST", "/", params);
  }

  getLocalMineValid (pMinionId) {
    const params = {
      "client": "local",
      "fun": "mine.valid"
    };
    if (pMinionId) {
      params["tgt_type"] = "list";
      params.tgt = pMinionId;
    } else {
      params["tgt_type"] = "glob";
      params.tgt = "*";
    }
    return this.apiRequest("POST", "/", params);
  }

  getLocalPillarItems (pMinionId) {
    const params = {
      "client": "local",
      "fun": "pillar.items"
    };
    if (pMinionId) {
      params["tgt_type"] = "list";
      params.tgt = pMinionId;
    } else {
      params["tgt_type"] = "glob";
      params.tgt = "*";
    }
    return this.apiRequest("POST", "/", params);
  }

  getLocalPillarObfuscate (pMinionId) {
    const params = {
      "client": "local",
      "fun": "pillar.obfuscate"
    };
    if (pMinionId) {
      params["tgt_type"] = "list";
      params.tgt = pMinionId;
    } else {
      params["tgt_type"] = "glob";
      params.tgt = "*";
    }
    return this.apiRequest("POST", "/", params);
  }

  getLocalScheduleList (pMinionId) {
    const params = {
      "client": "local",
      "fun": "schedule.list",
      "kwarg": {"return_yaml": false}
    };
    if (pMinionId) {
      params["tgt_type"] = "list";
      params.tgt = pMinionId;
    } else {
      params["tgt_type"] = "glob";
      params.tgt = "*";
    }
    return this.apiRequest("POST", "/", params);
  }

  getLocalTestProviders (pTgt) {
    const params = {
      "client": "local",
      "fun": "test.providers",
      "tgt": pTgt,
      "tgt_type": TargetType.getTargetTypeFromTarget(pTgt)
    };
    return this.apiRequest("POST", "/", params);
  }

  getLocalTestVersion (pNodegroup) {
    const params = {
      "client": "local",
      "full_return": true,
      "fun": "test.version",
      "tgt": "N@" + pNodegroup,
      "tgt_type": "compound"
    };
    return this.apiRequest("POST", "/", params);
  }

  getRunnerCacheGrains (pTgt) {
    const params = {
      "client": "runner",
      "fun": "cache.grains",
      "tgt": pTgt || "*"
    };
    return this.apiRequest("POST", "/", params);
  }

  getRunnerCachePillar (pTgt) {
    const params = {
      "client": "runner",
      "fun": "cache.pillar",
      "tgt": pTgt || "*"
    };
    return this.apiRequest("POST", "/", params);
  }

  getRunnerJobsActive () {
    const params = {
      "client": "runner",
      "fun": "jobs.active"
    };
    return this.apiRequest("POST", "/", params);
  }

  getRunnerJobsListJob (pJobId) {
    const params = {
      "client": "runner",
      "fun": "jobs.list_job",
      "jid": pJobId
    };
    return this.apiRequest("POST", "/", params);
  }

  getRunnerJobsListJobs (pCmd = null) {
    const params = {
      "client": "runner",
      "fun": "jobs.list_jobs"
    };
    if (pCmd) {
      params["search_function"] = pCmd;
    }
    return this.apiRequest("POST", "/", params);
  }

  getRunnerManageVersions () {
    const params = {
      "client": "runner",
      "fun": "manage.versions"
    };
    return this.apiRequest("POST", "/", params);
  }

  getRunnerStateOrchestrateShowSls () {
    const params = {
      "arg": ["*"],
      "client": "runner",
      "fun": "state.orchestrate_show_sls"
    };
    return this.apiRequest("POST", "/", params);
  }

  getWheelConfigValues () {
    const params = {
      "client": "wheel",
      "fun": "config.values"
    };
    return this.apiRequest("POST", "/", params);
  }

  getWheelKeyFinger (pMinionId) {
    const params = {
      "client": "wheel",
      "fun": "key.finger"
    };
    if (pMinionId) {
      params.match = pMinionId;
    } else {
      params.match = "*";
    }
    return this.apiRequest("POST", "/", params);
  }

  getWheelKeyListAll () {
    const params = {
      "client": "wheel",
      "fun": "key.list_all"
    };
    return this.apiRequest("POST", "/", params);
  }

  getWheelMinionsConnected () {
    const params = {
      "client": "wheel",
      "fun": "minions.connected"
    };
    return this.apiRequest("POST", "/", params);
  }

  getStats () {
    const params = {
    };
    return this.apiRequest("GET", "/stats", params);
  }

  apiRequest (pMethod, pPage, pParams) {
    const url = config.API_URL + pPage;
    const token = Utils.getStorageItem("session", "token", "");
    const headers = {
      "Accept": "application/json",
      "Cache-Control": "no-cache",
      "X-Auth-Token": token
    };
    if (pPage.endsWith(".txt")) {
      headers["Accept"] = "text/plain";
    } else if (pPage.endsWith(".html")) {
      headers["Accept"] = "text/html";
    }
    const options = {
      "headers": headers,
      "method": pMethod,
      "url": url
    };

    if (pMethod === "POST") {
      options.body = JSON.stringify(pParams);
    }

    /* eslint-disable compat/compat */
    /* fetch is not supported in op_mini all, IE 11 */
    return window.fetch(url, options).
    /* eslint-enable compat/compat */
      then((pResponse) => {
        if (pResponse.ok && pPage.endsWith(".txt")) {
          return pResponse.text();
        }
        if (pResponse.ok && pPage.endsWith(".html")) {
          return pResponse.text();
        }
        if (pResponse.ok) {
          return pResponse.json();
        }
        // fetch does not reject on > 300 http status codes,
        // so let's do it ourselves
        if (pResponse.status === 401 && pPage === "/logout") {
          // so we can't logout?
          API._cleanStorage();
          return null;
        }
        if (pResponse.status === 401 && pPage !== "/login") {
          this._handleUnauthorized(pPage, token);
          return null;
        }
        throw new HTTPError(pResponse.status, pResponse.statusText);
      }).
      then(undefined, (pError) => {
        throw API.makeErrorSerializable(pError);
      });
  }

  // callers show errors with JSON.stringify, which gives "{}" for an Error:
  // its name and message are not enumerable. toString() stays the same,
  // the login panel recognizes "TypeError: NetworkError" with it.
  static makeErrorSerializable (pError) {
    if (pError instanceof Error && !(pError instanceof HTTPError)) {
      Object.defineProperty(pError, "name", {"configurable": true, "enumerable": true, "value": pError.name, "writable": true});
      Object.defineProperty(pError, "message", {"configurable": true, "enumerable": true, "value": pError.message, "writable": true});
    }
    return pError;
  }

  // salt-api also answers 401 when the eauth ACL denies a function,
  // so a 401 on a session that is not expired only ends the session when
  // it came from /stats: that one checks the session, not the permissions.
  // e.g. a restart of salt-api forgets the sessions; without this every
  // next request gets a 401 again
  // returns null when the session may still be valid
  static getUnauthorizedReason (pLoginResponseStr, pNow, pPage) {
    if (!pLoginResponseStr) {
      return "no-session";
    }
    const loginResponse = JSON.parse(pLoginResponseStr);
    // just in case...
    if (loginResponse && pNow > loginResponse.expire) {
      return "session-expired";
    }
    if (pPage === "/stats") {
      return "session-rejected";
    }
    return null;
  }

  // the page to return to after the new login
  static getReturnPage (pHash) {
    const page = pHash.replace(/^#/, "");
    if (page === "" || page === "login" || page === "logout") {
      return null;
    }
    return page;
  }

  // the query for the login page: the reason, and the page with its own
  // parameters (e.g. "id" of the job page) to return to after the login
  static buildLoginQuery (pReason, pHash, pSearch) {
    /* eslint-disable compat/compat */
    /* URLSearchParams.entries() is not supported in IE 11 */
    /* URLSearchParams is not supported in op_mini all, IE 11, Baidu 7.12 */
    const query = Object.fromEntries(new URLSearchParams(pSearch));
    /* eslint-enable compat/compat */
    delete query["page"];
    query["reason"] = pReason;
    const page = API.getReturnPage(pHash);
    if (page) {
      query["page"] = page;
    }
    return query;
  }

  _handleUnauthorized (pPage, pRequestToken) {
    // parallel requests all get a 401, handle only the first one
    if (API.isHandlingUnauthorized) {
      return;
    }
    // a late answer to a request of an older session, e.g. one that was
    // still underway during the logout: handling it again would replace
    // the reason and the page to return to
    if (pRequestToken !== Utils.getStorageItem("session", "token", "")) {
      return;
    }

    const loginResponseStr = Utils.getStorageItem("session", "login_response");
    const reason = API.getUnauthorizedReason(loginResponseStr, Date.now() / 1000, pPage);
    if (reason === null) {
      // maybe only this function is not permitted, let /stats decide
      // its own 401 comes back here with pPage "/stats"
      if (!API.isProbingSession) {
        API.isProbingSession = true;
        const resetProbe = () => {
          API.isProbingSession = false;
        };
        this.getStats().then(resetProbe, resetProbe);
      }
      return;
    }
    API.isHandlingUnauthorized = true;

    const query = API.buildLoginQuery(reason, window.location.hash, window.location.search);

    let isLoginShown = false;
    const goToLogin = () => {
      if (isLoginShown) {
        return;
      }
      isLoginShown = true;
      API.isHandlingUnauthorized = false;
      this.router.goTo("login", query);
    };
    this.logout().then(() => {
      goToLogin();
      return true;
    }, () => {
      goToLogin();
      return false;
    });
    // fetch has no timeout: a hanging /logout must not keep the GUI
    // on a dead session, with every next 401 ignored
    window.setTimeout(() => {
      if (!isLoginShown) {
        // the session is dead anyway, do not wait for the server to say so
        API._cleanStorage();
        goToLogin();
      }
    }, LOGOUT_WAIT_MS);
  }

  static getEvents () {
    // do not attempt event-connection when there is no valid session, e.g. before login or after logout
    if (!Utils.getStorageItem("session", "token")) {
      return;
    }

    // allow only one event-stream
    if (API.eventsOK) {
      return;
    }
    API.eventsOK = true;

    let source;
    try {
      source = new EventSource(config.API_URL + "/events");
    } catch (err) { // eslint-disable-line no-unused-vars
      Utils.error("Cannot read the Salt-EventBus with this browser version, browser upgrade recommended");
      return;
    }
    // a closed stream must not block the next start,
    // e.g. after a new login without reloading the page
    const stopStream = () => {
      source.close();
      API.eventsOK = false;
    };
    source.onopen = () => {
      // Utils info "Listening for events..."
      API.eventsRetryMillis = 0;
    };
    source.onerror = () => {
      // Don't show the error
      // It appears with every page-load
      stopStream();
      // without a new stream, the screens no longer get any updates
      API._scheduleEventsRestart();
    };
    source.onmessage = (pMessage) => {
      const tokenOnMessage = Utils.getStorageItem("session", "token");
      if (!tokenOnMessage) {
        // no token, stop the stream
        stopStream();
        return;
      }

      const loginResponseStr = Utils.getStorageItem("session", "login_response");
      if (!loginResponseStr) {
        // no login details, stop the stream
        stopStream();
        return;
      }
      const loginResponse = JSON.parse(loginResponseStr);
      const expireValue = loginResponse.expire;
      const now = Date.now() / 1000;
      if (now > expireValue) {
        // the regular session has expired, also stop the stream
        stopStream();
        return;
      }

      const saltEvent = JSON.parse(pMessage.data);
      const tag = saltEvent.tag;
      const data = saltEvent.data;

      // shorten the public key value when it is present.
      // because it is long and boring, not because it is a secret.
      // the sizes are so that the first and last 8 characters of the public key are still shown.
      // the character counts include "-----BEGIN PUBLIC KEY-----" at the beginning and
      // include "-----END PUBLIC KEY-----" at the end.
      if (data.pub && data.pub.length > 75) {
        data.pub = data.pub.substring(0, 35) + Character.HORIZONTAL_ELLIPSIS + data.pub.substring(data.pub.length - 33);
      }

      // salt/beacon/<minion>/<beacon>/
      if (tag.startsWith("salt/beacon/")) {
        // new beacon-value is received
        Router.beaconsMinionPage.handleSaltBeaconEvent(tag, data);
      } else if (tag === "salt/auth") {
        // new key has been received
        Router.keysPage.handleSaltAuthEvent(data);
      } else if (tag === "salt/key") {
        Router.keysPage.handleSaltKeyEvent(data);
      } else if (tag.startsWith("salt/job/") && tag.includes("/ret/")) {
        // return value
        CommandBox.handleSaltJobRetEvent(tag, data);
        Router.beaconsMinionPage.handleSaltJobRetEvent(data);
        Router.beaconsPage.handleSaltJobRetEvent(data);
        Router.grainsMinionPage.handleSaltJobRetEvent(data);
        Router.grainsPage.handleSaltJobRetEvent(data);
        Router.highStatePage.handleSaltJobRetEvent(data);
        Router.issuesPage.handleSaltJobRetEvent(data);
        Router.jobPage.handleSaltJobRetEvent(data);
        Router.jobsPage.handleSaltJobRetEvent(data);
        Router.keysPage.handleSaltJobRetEvent(data);
        Router.mineMinionPage.handleSaltJobRetEvent(data);
        Router.minePage.handleSaltJobRetEvent(data);
        Router.minionsPage.handleSaltJobRetEvent(data);
        Router.nodegroupsPage.handleSaltJobRetEvent(data);
        Router.orchestrationsPage.handleSaltJobRetEvent(data);
        Router.pillarsMinionPage.handleSaltJobRetEvent(data);
        Router.pillarsPage.handleSaltJobRetEvent(data);
        Router.reactorsPage.handleSaltJobRetEvent(data);
        Router.schedulesMinionPage.handleSaltJobRetEvent(data);
        Router.schedulesPage.handleSaltJobRetEvent(data);
        Router.templatesPage.handleSaltJobRetEvent(data);
      } else if (tag.startsWith("salt/job/") && tag.includes("/prog/")) {
        // progress value (exists only for states)
        CommandBox.handleSaltJobProgEvent(tag, data);
      } else if (tag.startsWith("syndic/")) {
        Router.keysPage.handleSyndicEvent();
      }

      Router.eventsPage.handleAnyEvent(tag, data);
    };
  }

  // 2s after the first failure, doubling up to 60s while the stream keeps failing
  static getNextEventsRetryMillis (pPreviousMillis) {
    if (!pPreviousMillis) {
      return 2000;
    }
    return Math.min(pPreviousMillis * 2, 60000);
  }

  static _scheduleEventsRestart () {
    if (API.eventsRetryTimeout) {
      return;
    }
    API.eventsRetryMillis = API.getNextEventsRetryMillis(API.eventsRetryMillis);
    API.eventsRetryTimeout = window.setTimeout(() => {
      API.eventsRetryTimeout = null;
      // does nothing after a logout
      API.getEvents();
    }, API.eventsRetryMillis);
  }
}

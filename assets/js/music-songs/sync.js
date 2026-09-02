// GitHub Contents API client for the songs-inbox sync.
// Fine-grained PAT (Contents: Read & Write on this repo only) lives in
// localStorage. Each song JSON is one file under data/songs-inbox/<id>.json
// on a non-default branch ("songs-inbox") so Pages doesn't rebuild on
// every phone save. The repo's _config.yml excludes that dir from the
// Jekyll build, so even if you merge it into main, the files don't ship.
(function () {
  "use strict";

  var SETTINGS_KEY = "music-sync-settings";
  var DEFAULTS = {
    owner: "andreyrisukhin",
    repo: "andreyrisukhin.github.io",
    branch: "songs-inbox",
    inboxDir: "data/songs-inbox",
  };

  function getSettings() {
    var raw;
    try {
      raw = localStorage.getItem(SETTINGS_KEY);
    } catch (_) {
      return Object.assign({}, DEFAULTS);
    }
    var parsed = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw) || {};
      } catch (_) {
        parsed = {};
      }
    }
    return Object.assign({}, DEFAULTS, parsed);
  }

  function setSettings(patch) {
    var next = Object.assign(getSettings(), patch || {});
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (_) {
      /* quota / private mode */
    }
    return next;
  }

  function clearPat() {
    setSettings({ pat: undefined });
    var s = getSettings();
    delete s.pat;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (_) {}
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function authHeaders(pat) {
    return {
      Authorization: "Bearer " + pat,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function apiUrl(s, path) {
    return "https://api.github.com/repos/" + s.owner + "/" + s.repo + path;
  }

  function asMessage(res) {
    return res
      .text()
      .then(function (t) {
        var msg = "";
        try {
          var j = JSON.parse(t);
          msg = j && j.message ? j.message : t;
        } catch (_) {
          msg = t || "";
        }
        return res.status + " " + (msg || res.statusText || "");
      })
      .catch(function () {
        return res.status + " " + (res.statusText || "");
      });
  }

  // Ensure the inbox branch exists. Creates it from the default branch tip
  // if missing. Idempotent.
  function ensureBranch(s) {
    var headers = authHeaders(s.pat);
    return fetch(apiUrl(s, "/branches/" + encodeURIComponent(s.branch)), {
      headers: headers,
    }).then(function (r) {
      if (r.ok) return true;
      if (r.status !== 404) {
        return asMessage(r).then(function (m) {
          throw new Error("Branch lookup failed: " + m);
        });
      }
      return fetch(apiUrl(s, ""), { headers: headers })
        .then(function (rr) {
          if (!rr.ok) {
            return asMessage(rr).then(function (m) {
              throw new Error("Repo lookup failed: " + m);
            });
          }
          return rr.json();
        })
        .then(function (repo) {
          var defaultBranch = repo.default_branch || "main";
          return fetch(apiUrl(s, "/git/ref/heads/" + encodeURIComponent(defaultBranch)), {
            headers: headers,
          });
        })
        .then(function (rr) {
          if (!rr.ok) {
            return asMessage(rr).then(function (m) {
              throw new Error("Default ref lookup failed: " + m);
            });
          }
          return rr.json();
        })
        .then(function (ref) {
          return fetch(apiUrl(s, "/git/refs"), {
            method: "POST",
            headers: Object.assign({}, headers, { "Content-Type": "application/json" }),
            body: JSON.stringify({
              ref: "refs/heads/" + s.branch,
              sha: ref.object.sha,
            }),
          });
        })
        .then(function (rr) {
          if (!rr.ok && rr.status !== 422) {
            return asMessage(rr).then(function (m) {
              throw new Error("Create branch failed: " + m);
            });
          }
          return true;
        });
    });
  }

  // GET file from inbox branch; returns { sha } or null if missing.
  function getFileMeta(s, path) {
    var url = apiUrl(s, "/contents/" + encodeURIComponent(path).replace(/%2F/g, "/")) + "?ref=" + encodeURIComponent(s.branch);
    return fetch(url, { headers: authHeaders(s.pat) }).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) {
        return asMessage(r).then(function (m) {
          throw new Error("Get file meta failed: " + m);
        });
      }
      return r.json().then(function (j) {
        return { sha: j.sha };
      });
    });
  }

  function putFile(s, path, contentJson, prevSha, message) {
    var body = {
      message: message,
      content: utf8ToBase64(contentJson),
      branch: s.branch,
    };
    if (prevSha) body.sha = prevSha;
    var url = apiUrl(s, "/contents/" + encodeURIComponent(path).replace(/%2F/g, "/"));
    return fetch(url, {
      method: "PUT",
      headers: Object.assign({}, authHeaders(s.pat), { "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok) {
        return asMessage(r).then(function (m) {
          throw new Error("PUT failed: " + m);
        });
      }
      return r.json();
    });
  }

  // Push one song. Returns the new content sha.
  function pushSong(song) {
    var s = getSettings();
    if (!s.pat) return Promise.reject(new Error("No PAT configured"));
    var path = s.inboxDir + "/" + song.id + ".json";
    var content = JSON.stringify(song, null, 2) + "\n";
    return ensureBranch(s)
      .then(function () {
        return song.syncSha ? Promise.resolve({ sha: song.syncSha }) : getFileMeta(s, path);
      })
      .then(function (meta) {
        return putFile(s, path, content, meta && meta.sha, "Sync song: " + (song.name || song.id));
      })
      .then(function (resp) {
        return resp && resp.content ? resp.content.sha : null;
      });
  }

  // Push all songs whose updatedAt > syncedAt. Sequential to avoid hitting
  // secondary rate limits and to keep a stable error model.
  function pushAll(songs, onProgress) {
    var s = getSettings();
    if (!s.pat) return Promise.reject(new Error("No PAT configured"));
    var pending = songs.filter(function (x) {
      return !x.syncedAt || (x.updatedAt && x.updatedAt > x.syncedAt);
    });
    var i = 0;
    function step() {
      if (i >= pending.length) return Promise.resolve({ ok: pending.length, total: pending.length });
      var song = pending[i++];
      if (onProgress) onProgress({ phase: "push", index: i, total: pending.length, song: song });
      return pushSong(song).then(function (newSha) {
        song.syncSha = newSha;
        song.syncedAt = new Date().toISOString();
        return step();
      });
    }
    return step().then(function () {
      return { ok: pending.length, total: pending.length };
    });
  }

  // Smoke-test the PAT against the repo. Resolves with the default branch
  // name on success. Throws a friendly error on auth/permission/network
  // failure.
  function verify() {
    var s = getSettings();
    if (!s.pat) return Promise.reject(new Error("No PAT configured"));
    return fetch(apiUrl(s, ""), { headers: authHeaders(s.pat) }).then(function (r) {
      if (!r.ok) {
        return asMessage(r).then(function (m) {
          throw new Error(m);
        });
      }
      return r.json().then(function (j) {
        return { defaultBranch: j.default_branch, fullName: j.full_name };
      });
    });
  }

  window.MusicSongsSync = {
    getSettings: getSettings,
    setSettings: setSettings,
    clearPat: clearPat,
    pushSong: pushSong,
    pushAll: pushAll,
    verify: verify,
    ensureBranch: ensureBranch,
    DEFAULTS: DEFAULTS,
  };
})();

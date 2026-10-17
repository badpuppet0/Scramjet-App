"use strict";
/*
  TSW v2 engine connection (Scramjet).
  Mirrors how the stock Scramjet-App public/index.js starts the engine:
    ScramjetController + BareMux with the libcurl transport over the /wisp/ WebSocket.
  It defines window.TSWEngine, which index.html uses to switch the search bar on.
  If the engine scripts did not load, TSWEngine stays undefined and the search bar stays greyed out.
*/
(function () {
	if (
		typeof $scramjetLoadController !== "function" ||
		typeof BareMux === "undefined" ||
		typeof registerSW !== "function"
	) {
		console.error(
			"TSW v2: engine scripts missing. Need /scram/scramjet.all.js, /baremux/index.js and register-sw.js before engine.js."
		);
		return;
	}

	var ScramjetController = $scramjetLoadController().ScramjetController;
	var scramjet = new ScramjetController({
		files: {
			wasm: "/scram/scramjet.wasm.wasm",
			all: "/scram/scramjet.all.js",
			sync: "/scram/scramjet.sync.js",
		},
	});
	var initDone = Promise.resolve(scramjet.init());
	var connection = new BareMux.BareMuxConnection("/baremux/worker.js");

	async function setup() {
		await registerSW();
		await navigator.serviceWorker.ready;
		await initDone;
		var wispUrl =
			(location.protocol === "https:" ? "wss" : "ws") +
			"://" +
			location.host +
			"/wisp/";
		if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
			await connection.setTransport("/libcurl/index.mjs", [
				{ websocket: wispUrl },
			]);
		}
	}

	var ready = setup();
	ready.catch(function (err) {
		console.error("TSW v2 setup failed:", err);
	});

	var frame = null;
	var loadCb = null;

	function win() {
		try {
			return frame && frame.frame.contentWindow;
		} catch (e) {
			return null;
		}
	}

	function currentUrl() {
		try {
			var href = frame.frame.contentWindow.location.href;
			var u = typeof scramjet.decodeUrl === "function" ? scramjet.decodeUrl(href) : "";
			if (typeof u === "string" && /^https?:/i.test(u) && u.indexOf(location.origin) !== 0) return u;
		} catch (e) {}
		return undefined;
	}

	window.TSWEngine = {
		ready: ready,
		open: function (url, container) {
			if (!frame || frame.frame.parentNode !== container) {
				container.innerHTML = "";
				frame = scramjet.createFrame();
				frame.frame.id = "sj-frame";
				frame.frame.addEventListener("load", function () {
					if (loadCb) loadCb(currentUrl());
				});
				container.appendChild(frame.frame);
			}
			frame.go(url);
			return frame;
		},
		back: function () {
			if (frame && typeof frame.back === "function") return frame.back();
			var w = win();
			if (w) w.history.back();
		},
		forward: function () {
			if (frame && typeof frame.forward === "function") return frame.forward();
			var w = win();
			if (w) w.history.forward();
		},
		reload: function () {
			if (frame && typeof frame.reload === "function") return frame.reload();
			var w = win();
			if (w) w.location.reload();
		},
		onload: function (cb) {
			loadCb = cb;
		},
	};
})();

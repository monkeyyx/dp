(function() {
    if (typeof fetch === 'undefined') {
        globalThis.fetch = async function(url, options = {}) {
            return new Promise((resolve) => {
                const method = (options.method || 'GET').toUpperCase();
                const headers = options.headers || {};
                const body = options.body;
                const callback = (res) => {
                    resolve({
                        ok: res.status >= 200 && res.status < 300,
                        status: res.status,
                        json: async () => typeof res.body === 'string' ? JSON.parse(res.body) : res.body,
                        text: async () => typeof res.body === 'string' ? res.body : JSON.stringify(res.body),
                        headers: { get: (name) => { const key = Object.keys(res.headers || {}).find(k => k.toLowerCase() === name.toLowerCase()); return key ? res.headers[key] : null; } }
                    });
                };
                if (method === 'POST') http_post(url, headers, body, callback);
                else http_get(url, headers, callback);
            });
        };
    }

    const KABIR_PROXY = "https://script.google.com/macros/s/AKfycbxqpHMie9RFfevHFuUZRGiQqidN5iugORvxksVbZt8TEOYjiPylRtZVX50VFnlUMkr7VA/exec";
    const PROXY_BASE = "https://moviebox.s4nch1tt.workers.dev/proxy?url=";

    function wrapProxy(url) {
        if (!url || url.includes('.m3u8')) return url;
        return PROXY_BASE + encodeURIComponent(url);
    }

    async function getHome(cb) { cb({ success: true, data: {} }); }
    async function search(query, cb) { cb({ success: true, data: [] }); }
    async function load(url, cb) { cb({ success: true, data: {} }); }

    async function loadStreams(url, cb) {
        try {
            if (!url.startsWith("tmdb:")) return cb({ success: false, message: "Invalid URL" });
            const parts = url.split(":");
            const tmdbId = parts[1];
            const season = parts[3] || "1";
            const episode = parts[4] || "1";

            const apiUrl = `${KABIR_PROXY}?action=sflix_play&id=${tmdbId}&se=${season}&ep=${episode}`;
            const resp = await fetch(apiUrl);
            const json = await resp.json();
            if (json.code !== 0 || !json.data?.streams) return cb({ success: true, data: [] });

            cb({ success: true, data: json.data.streams.map(s => new StreamResult({
                source: `SFlix BFF`,
                url: wrapProxy(s.url),
                quality: s.resolutions || 'Auto',
                headers: { "Referer": "https://sflix.film/" }
            })) });
        } catch (e) { cb({ success: false, message: String(e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();

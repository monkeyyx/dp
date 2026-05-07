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

    const MOVIEBOX_BASE = "https://moviebox.s4nch1tt.workers.dev";

    async function getHome(cb) { cb({ success: true, data: {} }); }
    async function search(query, cb) { cb({ success: true, data: [] }); }
    async function load(url, cb) { cb({ success: true, data: {} }); }

    async function loadStreams(url, cb) {
        try {
            if (!url.startsWith("tmdb:")) return cb({ success: false, message: "Invalid URL" });
            const parts = url.split(":");
            const tmdbId = parts[1];
            const mediaType = parts[2] === 'series' ? 'tv' : 'movie';
            const season = parseInt(parts[3] || "1");
            const episode = parseInt(parts[4] || "1");

            const apiUrl = `${MOVIEBOX_BASE}/streams?tmdb_id=${tmdbId}&type=${mediaType}&proxy=${encodeURIComponent(MOVIEBOX_BASE)}` + 
                        (mediaType === 'tv' ? `&se=${season}&ep=${episode}` : '');
            
            const resp = await fetch(apiUrl);
            const data = await resp.json();
            const streams = Array.isArray(data) ? data : (data.streams || []);

            cb({ success: true, data: streams.map(s => new StreamResult({
                source: `MovieBox`,
                url: s.proxy_url || s.url,
                quality: s.resolution || 'HD'
            })) });
        } catch (e) { cb({ success: false, message: String(e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();

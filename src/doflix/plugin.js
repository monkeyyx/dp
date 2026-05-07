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

    const DOFLIX_BASE = "https://panel.watchkaroabhi.com";
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
            const mediaType = parts[2] === 'series' ? 'tv' : 'movie';
            const season = parts[3] || "1";
            const episode = parts[4] || "1";

            const apiKey = "qNhKLJiZVyoKdi9NCQGz8CIGrpUijujE";
            let apiUrl = (mediaType === "movie") 
                ? `${DOFLIX_BASE}/api/3/movie/${tmdbId}/links?api_key=${apiKey}`
                : `${DOFLIX_BASE}/api/3/tv/${tmdbId}/season/${season}/episode/${episode}/links?api_key=${apiKey}`;
            
            const resp = await fetch(apiUrl, {
                headers: { "User-Agent": "dooflix", "X-Package-Name": "com.king.moja", "Accept": "application/json" }
            });
            const data = await resp.json();
            const links = mediaType === "movie" ? data.links : data.results;
            if (!links || !Array.isArray(links)) return cb({ success: true, data: [] });

            cb({ success: true, data: links.map(link => new StreamResult({
                source: `DoFlix`,
                url: wrapProxy(link.url.includes(".m3u8") ? link.url : `${link.url}#.m3u8`),
                quality: link.quality || '720p',
                headers: { "Referer": "https://molop.art/", "User-Agent": "dooflix" }
            })).filter(s => s.url) });
        } catch (e) { cb({ success: false, message: String(e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();

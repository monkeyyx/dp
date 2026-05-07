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

    const STREAMFLIX_BASE = "https://api.streamflix.app";
    const KABIR_PROXY = "https://script.google.com/macros/s/AKfycbxqpHMie9RFfevHFuUZRGiQqidN5iugORvxksVbZt8TEOYjiPylRtZVX50VFnlUMkr7VA/exec";
    const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
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

            const tmdbResp = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);
            const tmdbData = await tmdbResp.json();
            const title = tmdbData.name || tmdbData.title;
            if (!title) return cb({ success: false, message: "Title not found" });

            const proxyUrl = `${KABIR_PROXY}?tmdb=${tmdbId}&title=${encodeURIComponent(title)}`;
            const searchResp = await fetch(proxyUrl);
            const searchData = await searchResp.json();
            if (!searchData.success || !searchData.data?.length) return cb({ success: true, data: [] });

            const configResp = await fetch(`${STREAMFLIX_BASE}/config/config-streamflixapp.json`);
            const config = await configResp.json();
            if (!config.premium) return cb({ success: true, data: [] });

            const allStreams = [];
            for (const item of searchData.data) {
                if (mediaType === 'movie' && item.movielink) {
                    config.premium.forEach(base => {
                        allStreams.push(new StreamResult({
                            source: `StreamFlix`,
                            url: wrapProxy(base + item.movielink),
                            quality: "1080p"
                        }));
                    });
                }
            }
            const filteredData = (globalThis.platform === "ios") ? allStreams.filter(s => s.type !== "embed") : allStreams; cb({ success: true, data: filteredData });
        } catch (e) { cb({ success: false, message: String(e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();

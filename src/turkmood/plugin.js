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

    const TURKMOOD_API = "https://krmzitv.app/wp-json/api-3chk/v1";
    const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

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

            let apiPath = (mediaType === "movie") 
                ? `${TURKMOOD_API}/movie-stream?movie_id=${tmdbId}`
                : `${TURKMOOD_API}/episode?tmdb_id=${tmdbId}&season=${season}&episode=${episode}`;
            
            const resp = await fetch(apiPath);
            const data = await resp.json();

            if (data && data.m3u8_url) {
                const m3u8Url = data.m3u8_url;
                const streams = [
                    { label: "1080p", v: "v1" },
                    { label: "720p", v: "v2" },
                    { label: "480p", v: "v3" }
                ].map(q => new StreamResult({
                    source: `TurkMood (${q.label})`,
                    url: m3u8Url.replace("-v1-", `-${q.v}-`),
                    quality: q.label,
                    headers: { "User-Agent": "Mozilla/5.0" }
                }));
                return cb({ success: true, data: streams });
            }

            cb({ success: true, data: [] });
        } catch (e) { cb({ success: false, message: String(e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();

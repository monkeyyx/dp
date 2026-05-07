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

    const GOVIX_BASE = "https://www.govixtv.com";
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

            // Govix Search (Simplified title match)
            const tmdbResp = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);
            const tmdbData = await tmdbResp.json();
            const title = tmdbData.name || tmdbData.title;

            // Use the bypass logic found in vega-providers
            const headers = {
                "User-Agent": "SoodagLives/1.1",
                "ppkey": "Hg4fPewbcGfBTskQQE5mktC2vgEHT9GX",
                "X-Requested-With": "com.soodag.lives"
            };

            // Attempt to get direct signed URL via their bridge
            const bridgeResp = await fetch(`https://orangegas.store/aaa.php?uid=${tmdbId}`, { headers });
            const bridgeData = await bridgeResp.json();

            if (bridgeData && bridgeData.signedUrl) {
                return cb({ success: true, data: [new StreamResult({
                    source: `GovixTV (Cloud)`,
                    url: bridgeData.signedUrl,
                    quality: "1080p",
                    headers: { "User-Agent": "SoodagLives/1.1" }
                })] });
            }

            cb({ success: true, data: [] });
        } catch (e) { cb({ success: false, message: String(e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();

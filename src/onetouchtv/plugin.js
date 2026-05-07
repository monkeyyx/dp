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

    const ONETOUCH_BASE = "https://onetouchtv.devcorp.me";
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
            const season = parseInt(parts[3] || "1");
            const episode = parseInt(parts[4] || "1");

            const tmdbResp = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`);
            const tmdbData = await tmdbResp.json();
            const title = tmdbData.name || tmdbData.title;
            if (!title) return cb({ success: false, message: "Title not found" });

            const keyB64 = btoa("im72charPasswordofdInitVectorStm");
            const ivB64 = btoa("im72charPassword");
            const apiRequest = async (path) => {
                const resp = await fetch(`${ONETOUCH_BASE}${path}`, {
                    headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://onetouchtv.xyz/" }
                });
                const text = await resp.text();
                let decrypted;
                if (globalThis.crypto && globalThis.crypto.decryptAES) {
                    decrypted = await globalThis.crypto.decryptAES(btoa(atob(btoa(text.replace(/-_\./g, "/").replace(/@/g, "+").replace(/\s+/g, "")))), keyB64, ivB64);
                } else { return null; }
                return JSON.parse(decrypted).result;
            };

            const searchData = await apiRequest(`/vod/search?keyword=${encodeURIComponent(title)}`);
            if (!searchData || !Array.isArray(searchData)) return cb({ success: true, data: [] });
            const match = searchData.find(m => m.title.toLowerCase().includes(title.toLowerCase()));
            if (!match) return cb({ success: true, data: [] });

            const detail = await apiRequest(`/vod/${match.id}/detail`);
            if (!detail || !detail.episodes) return cb({ success: true, data: [] });
            let targetEp = (mediaType === 'movie') ? detail.episodes[0] : detail.episodes.find(ep => parseInt(ep.episode.replace(/\D/g, "")) === episode);
            if (!targetEp) return cb({ success: true, data: [] });

            const sourcesData = await apiRequest(`/vod/${targetEp.identifier}/episode/${targetEp.playId}`);
            if (!sourcesData || !sourcesData.sources) return cb({ success: true, data: [] });

            cb({ success: true, data: sourcesData.sources.map(s => new StreamResult({
                source: `OneTouchTV`,
                url: wrapProxy(s.url),
                quality: s.quality || 'Auto',
                headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://api3.devcorp.me/" }
            })) });
        } catch (e) { cb({ success: false, message: String(e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();

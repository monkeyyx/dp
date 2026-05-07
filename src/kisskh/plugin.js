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

    const KISSKH_BASE = "https://kisskh.ovh";
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

            const searchResp = await fetch(`${KISSKH_BASE}/api/DramaList/Search?q=${encodeURIComponent(title)}&type=0`);
            const searchList = await searchResp.json();
            let matched = searchList.find(item => item.title.toLowerCase() === title.toLowerCase());
            if (!matched && searchList.length > 0) matched = searchList[0];
            if (!matched) return cb({ success: true, data: [] });

            const detailResp = await fetch(`${KISSKH_BASE}/api/DramaList/Drama/${matched.id}?isq=false`);
            const detail = await detailResp.json();
            const episodes = detail.episodes;
            if (!episodes || episodes.length === 0) return cb({ success: true, data: [] });

            let targetEp = (mediaType === 'movie') ? episodes[episodes.length - 1] : episodes.find(ep => parseInt(ep.number) === episode);
            if (!targetEp) return cb({ success: true, data: [] });

            const keyUrl = `https://script.google.com/macros/s/AKfycbzn8B31PuDxzaMa9_CQ0VGEDasFqfzI5bXvjaIZH4DM8DNq9q6xj1ALvZNz_JT3jF0suA/exec?id=${targetEp.id}&version=2.8.10`;
            const keyData = await (await fetch(keyUrl)).json();
            if (!keyData.key) return cb({ success: true, data: [] });

            const videoApi = `${KISSKH_BASE}/api/DramaList/Episode/${targetEp.id}.png?err=false&ts=&time=&kkey=${keyData.key}`;
            const sources = await (await fetch(videoApi)).json();
            const links = [sources.Video, sources.ThirdParty].filter(l => l);

            cb({ success: true, data: links.map(link => new StreamResult({
                source: `KissKH`,
                url: wrapProxy(link),
                quality: "Auto",
                headers: { "Origin": KISSKH_BASE, "Referer": KISSKH_BASE }
            })) });
        } catch (e) { cb({ success: false, message: String(e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();

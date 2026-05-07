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

    const FANPROJ_BASE = "https://fanproj.com";
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

            // Search on FanProj
            const searchResp = await fetch(`${FANPROJ_BASE}/?s=${encodeURIComponent(title)}`);
            const html = await searchResp.text();
            const linkMatch = html.match(/href="(https:\/\/[^"]+\/(video|movies)\/[^"]+)"/);
            if (!linkMatch) return cb({ success: true, data: [] });
            
            const contentUrl = linkMatch[1];
            const idMatch = contentUrl.match(/\/(video|movies)\/([a-zA-Z0-9]+)/);
            const id = idMatch ? idMatch[2] : "";
            if (!id) return cb({ success: true, data: [] });

            const host = new URL(contentUrl).origin;
            const playerUrl = `${host}/player/index.php?data=${id}&do=getVideo`;

            const res = await fetch(playerUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-Requested-With": "XMLHttpRequest",
                    "Referer": contentUrl,
                    "Origin": host
                },
                body: `data=${id}&do=getVideo`
            });

            const data = await res.json();
            if (!data || !data.videoSource) return cb({ success: true, data: [] });

            const videoUrl = data.videoSource || data.securedLink;
            const ck = data.ck || "";
            const cookies = ck.includes("fire_ck=") ? ck : `fire_ck=${ck}`;

            cb({ success: true, data: [new StreamResult({
                source: `FanProj`,
                url: wrapProxy(videoUrl),
                quality: "1080p",
                headers: { 
                    Referer: contentUrl,
                    Origin: host,
                    Cookie: cookies
                }
            })] });
        } catch (e) { cb({ success: false, message: String(e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();

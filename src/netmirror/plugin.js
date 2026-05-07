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

    const NETMIRROR_BASE = "https://net52.cc";
    const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
    const PROXY_BASE = "https://moviebox.s4nch1tt.workers.dev/proxy?url=";

    function wrapProxy(url) {
        if (!url || url.includes('.m3u8')) return url;
        return PROXY_BASE + encodeURIComponent(url);
    }

    async function getNetMirrorCookie() {
        try {
            const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                return (c == "x" ? r : (r & 0x3 | 0x8)).toString(16);
            });
            const verifyRes = await fetch(`${NETMIRROR_BASE}/verify.php`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `g-recaptcha-response=${uuid}`
            });
            const setCookie = verifyRes.headers.get("set-cookie");
            const match = setCookie?.match(/t_hash_t=([^;]+)/);
            return match ? match[1] : null;
        } catch (e) { return null; }
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

            const cookie = await getNetMirrorCookie();
            if (!cookie) return cb({ success: true, data: [] });
            const cookies = `t_hash_t=${cookie}; hd=on`;
            const platforms = [
                { key: "netflix", ott: "nf", path: "" },
                { key: "primevideo", ott: "pv", path: "/pv" },
                { key: "disney", ott: "hs", path: "/hs" }
            ];
            let allStreams = [];
            for (const p of platforms) {
                try {
                    const searchUrl = `${NETMIRROR_BASE}/mobile${p.path}/search.php?s=${encodeURIComponent(title)}&t=${Math.floor(Date.now()/1000)}`;
                    const searchResp = await fetch(searchUrl, { headers: { Cookie: `${cookies}; ott=${p.ott}` } });
                    const searchData = await searchResp.json();
                    if (searchData.searchResult?.length > 0) {
                        let targetId = searchData.searchResult[0].id;
                        if (mediaType === 'tv') {
                            const postResp = await fetch(`${NETMIRROR_BASE}/mobile${p.path}/post.php?id=${targetId}`, { headers: { Cookie: `${cookies}; ott=${p.ott}` } });
                            const postData = await postResp.json();
                            const targetEp = (postData.episodes || []).find(ep => parseInt(ep.s.replace("S", "")) === season && parseInt(ep.ep.replace("E", "")) === episode);
                            if (!targetEp) continue;
                            targetId = targetEp.id;
                        }
                        const playlistResp = await fetch(`${NETMIRROR_BASE}/mobile${p.path}/playlist.php?id=${targetId}&t=${encodeURIComponent(title)}`, { headers: { Cookie: `${cookies}; ott=${p.ott}` } });
                        const playlist = await playlistResp.json();
                        if (Array.isArray(playlist) && playlist[0]?.sources) {
                            playlist[0].sources.forEach(s => {
                                allStreams.push(new StreamResult({
                                    source: `NetMirror (${p.key})`,
                                    url: wrapProxy(s.file.startsWith("http") ? s.file : `${NETMIRROR_BASE}${s.file}`),
                                    quality: s.label,
                                    headers: { Referer: `${NETMIRROR_BASE}/`, Cookie: cookies }
                                }));
                            });
                        }
                    }
                } catch (e) {}
            }
            const filteredData = (globalThis.platform === "ios") ? allStreams.filter(s => s.type !== "embed") : allStreams; cb({ success: true, data: filteredData });
        } catch (e) { cb({ success: false, message: String(e) }); }
    }

    globalThis.getHome = getHome;
    globalThis.search = search;
    globalThis.load = load;
    globalThis.loadStreams = loadStreams;
})();
